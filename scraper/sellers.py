"""卖家聚合、店铺 enrichment、入库字段构建（不采集手机号）"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from config import BASE_URL, ITEM_API, SHOP_API, SHOP_FETCH_BATCH_PAUSE_SEC
from scraper.browser import BrowserSession, human_delay
from scraper.extractors import (
    aggregate_listing_stats,
    extract_brand,
    extract_condition,
    extract_model,
    extract_price,
    extract_year,
    listing_url,
)
from scraper.filters import SellerAggregate, SellerRuleEngine


def _seller_from_payload(payload: dict) -> dict:
    for key in ("seller", "user", "shop", "seller_info"):
        if isinstance(payload.get(key), dict):
            return payload[key]
    return {}


def _parse_city_region(seller: dict, listing: dict) -> tuple[str | None, str | None]:
    addr = seller.get("address") or seller.get("shop_address") or seller.get("location") or ""
    region = (
        listing.get("region")
        or listing.get("region_item_text")
        or seller.get("region")
        or ""
    )
    city = seller.get("city") or ""
    if not city and region:
        parts = [p.strip() for p in str(region).split(",")]
        city = parts[-1] if parts else None
    state = seller.get("state") or listing.get("region_parent_name") or ""
    if not state and region:
        parts = [p.strip() for p in str(region).split(",")]
        state = parts[0] if parts else None
    return city or None, state or None


class SellerPipeline:
    def __init__(self, session: BrowserSession):
        self.session = session
        self.rules = SellerRuleEngine()
        self._shop_cache: dict[str, dict] = {}
        self._item_cache: dict[int, dict] = {}

    @staticmethod
    def shop_slug(url: str | None) -> str | None:
        if not url:
            return None
        m = re.search(r"/shop/([^/?#]+)", url)
        return m.group(1) if m else None

    async def fetch_shop(self, slug: str) -> dict:
        if slug in self._shop_cache:
            return self._shop_cache[slug]
        try:
            data = await self.session.fetch_json(f"{SHOP_API}/{slug}")
        except RuntimeError:
            data = {}
        shop = data.get("shop") or data.get("data") or data if isinstance(data, dict) else {}
        self._shop_cache[slug] = shop if isinstance(shop, dict) else {}
        return self._shop_cache[slug]

    async def fetch_item_light(self, listing_id: int) -> dict:
        """仅拉取卖家区块，不提取电话"""
        if listing_id in self._item_cache:
            return self._item_cache[listing_id]
        try:
            data = await self.session.fetch_json(f"{ITEM_API}/{listing_id}")
        except RuntimeError:
            data = {}
        item = data.get("item") or data.get("data") or data if isinstance(data, dict) else {}
        self._item_cache[listing_id] = item if isinstance(item, dict) else {}
        return self._item_cache[listing_id]

    def group_listings(self, listings: list[dict]) -> dict[str, list[dict]]:
        groups: dict[str, list[dict]] = defaultdict(list)
        for lst in listings:
            uid = lst.get("user_id")
            if uid:
                groups[f"user:{uid}"].append(lst)
        return groups

    async def build_records(self, listings: list[dict], fetch_shop_details: bool = True) -> list[dict]:
        groups = self.group_listings(listings)
        records: list[dict] = []
        shop_fetches = 0

        for key, group in groups.items():
            sample = group[0]
            seller = _seller_from_payload(sample)
            shop_url = seller.get("url") or seller.get("shop_url") or ""
            slug = self.shop_slug(shop_url)

            if fetch_shop_details and slug:
                shop_fetches += 1
                if shop_fetches % 8 == 0:
                    await human_delay(SHOP_FETCH_BATCH_PAUSE_SEC, SHOP_FETCH_BATCH_PAUSE_SEC + 5)
                shop_data = await self.fetch_shop(slug)
                seller = {**seller, **shop_data}
                shop_url = shop_url or f"{BASE_URL}/shop/{slug}"

            agg = SellerAggregate(listings=group, seller=seller, listing=sample)
            qualified, meta = self.rules.evaluate(agg)
            stats = aggregate_listing_stats(group)
            listing_count = max(stats["listing_count"], agg.listing_count)
            stats["listing_count"] = listing_count
            cert = meta["cert"]
            city, state = _parse_city_region(seller, sample)

            profile_url = shop_url
            if not profile_url and slug:
                profile_url = f"{BASE_URL}/shop/{slug}"
            elif not profile_url and sample.get("user_id"):
                profile_url = f"{BASE_URL}/sellerpage-{sample['user_id']}"

            record = {
                "jiji_user_id": sample.get("user_id"),
                "shop_slug": slug,
                "company_name": agg.company_name or f"Seller_{sample.get('user_id')}",
                "seller_profile_url": profile_url,
                "cert_diamond": int(cert.diamond),
                "cert_enterprise": int(cert.enterprise),
                "cert_verified_store": int(cert.verified_store),
                "cert_verified_id": int(cert.verified_id),
                "certification_types": cert.types,
                "member_since_label": meta["member_since_label"],
                "member_years": meta["member_years"],
                "shop_address": seller.get("address") or seller.get("shop_address"),
                "city": city,
                "state_region": state,
                "business_hours": (
                    seller.get("business_hours")
                    or seller.get("working_hours")
                    or seller.get("schedule")
                ),
                "shop_description": seller.get("description") or seller.get("about"),
                "response_time": seller.get("response_time") or seller.get("responseTime"),
                "feedback_count": int(seller.get("feedback_count") or seller.get("feedbackCount") or 0),
                "listing_count": stats["listing_count"],
                "foreign_used_count": stats["foreign_used_count"],
                "is_foreign_used_focus": int(stats["is_foreign_used_focus"]),
                "top_brands": stats["top_brands"],
                "top_models": stats["top_models"],
                "price_min": stats["price_min"],
                "price_max": stats["price_max"],
                "price_median": stats["price_median"],
                "price_distribution": stats["price_distribution"],
                "sample_listing_urls": stats["sample_listing_urls"],
                "latest_posted_at": stats["latest_posted_at"],
                "retain_reasons": meta["retain_reasons"],
                "exclude_flags": meta["exclude_flags"],
                "dealer_keyword_hits": meta["dealer_keyword_hits"],
                "is_qualified": int(qualified),
                "_listings_detail": self._listing_rows(group),
            }
            records.append(record)

        records.sort(key=lambda r: (-r["is_qualified"], -r["listing_count"], r["company_name"]))
        return records

    @staticmethod
    def _listing_rows(group: list[dict]) -> list[dict]:
        rows = []
        for lst in group:
            rows.append({
                "jiji_listing_id": lst.get("id"),
                "listing_url": listing_url(lst),
                "title": lst.get("title"),
                "brand": extract_brand(lst),
                "model": extract_model(lst),
                "year": extract_year(lst),
                "condition": extract_condition(lst),
                "price": extract_price(lst),
                "region": lst.get("region") or lst.get("region_item_text"),
                "posted_at": lst.get("date_created") or lst.get("dateCreated"),
            })
        return rows
