"""从 listing / shop 原始数据提取结构化字段"""

from __future__ import annotations

import re
import statistics
from collections import Counter
from typing import Any
from urllib.parse import urljoin

from config import BASE_URL


def _norm(s: str | None) -> str:
    return (s or "").strip().lower()


def _attr_map(listing: dict) -> dict[str, str]:
    attrs = listing.get("attributes") or listing.get("attrs") or []
    out: dict[str, str] = {}
    if isinstance(attrs, dict):
        for k, v in attrs.items():
            out[_norm(str(k))] = str(v).strip()
    elif isinstance(attrs, list):
        for a in attrs:
            if isinstance(a, dict) and a.get("name"):
                out[_norm(str(a["name"]))] = str(a.get("value", "")).strip()
    return out


def extract_brand(listing: dict) -> str | None:
    attrs = _attr_map(listing)
    for key in ("make", "brand"):
        if attrs.get(key):
            return attrs[key]
    title = listing.get("title") or ""
    known = (
        "Toyota", "Lexus", "Mercedes", "Mercedes-Benz", "BMW", "Honda", "Nissan",
        "Hyundai", "Kia", "Ford", "Audi", "Volkswagen", "Peugeot", "Land Rover",
        "Range Rover", "Mazda", "Chevrolet", "Mitsubishi",
    )
    for brand in known:
        if brand.lower() in title.lower():
            return brand
    return None


def extract_model(listing: dict) -> str | None:
    attrs = _attr_map(listing)
    for key in ("model", "trim"):
        if attrs.get(key):
            return attrs[key]
    title = listing.get("title") or ""
    brand = extract_brand(listing)
    if brand and brand.lower() in title.lower():
        rest = re.sub(re.escape(brand), "", title, flags=re.I).strip()
        parts = rest.split()
        if parts:
            return " ".join(parts[:3])
    return None


def extract_year(listing: dict) -> int | None:
    attrs = _attr_map(listing)
    for key in ("year", "year of manufacture"):
        if attrs.get(key):
            m = re.search(r"(20\d{2}|19\d{2})", attrs[key])
            if m:
                return int(m.group(1))
    title = listing.get("title") or ""
    m = re.search(r"\b(20\d{2}|19\d{2})\b", title)
    return int(m.group(1)) if m else None


def extract_condition(listing: dict) -> str | None:
    attrs = _attr_map(listing)
    if attrs.get("condition"):
        return attrs["condition"]
    desc = listing.get("short_description") or listing.get("description") or ""
    for c in ("Foreign Used", "Nigerian Used", "Brand New", "Locally Used"):
        if c.lower() in desc.lower():
            return c
    return None


def extract_price(listing: dict) -> int | None:
    po = listing.get("price_obj") or {}
    if isinstance(po, dict) and po.get("value"):
        return int(po["value"])
    if listing.get("price"):
        return int(listing["price"])
    return None


def listing_url(listing: dict) -> str | None:
    url = listing.get("url") or ""
    if not url:
        return None
    if url.startswith("http"):
        return url
    return urljoin(BASE_URL, url)


def top_n(counter: Counter, n: int) -> list[str]:
    return [k for k, _ in counter.most_common(n)]


def price_distribution(prices: list[int]) -> dict[str, int]:
    if not prices:
        return {}
    buckets = [
        (0, 5_000_000, "0-5M"),
        (5_000_000, 10_000_000, "5-10M"),
        (10_000_000, 20_000_000, "10-20M"),
        (20_000_000, 40_000_000, "20-40M"),
        (40_000_000, 10**12, "40M+"),
    ]
    dist: dict[str, int] = {label: 0 for _, _, label in buckets}
    for p in prices:
        for lo, hi, label in buckets:
            if lo <= p < hi:
                dist[label] += 1
                break
    return {k: v for k, v in dist.items() if v > 0}


def aggregate_listing_stats(listings: list[dict]) -> dict[str, Any]:
    brands: Counter = Counter()
    models: Counter = Counter()
    prices: list[int] = []
    foreign_used = 0
    sample_urls: list[str] = []
    latest_posted: str | None = None

    for lst in listings:
        b = extract_brand(lst)
        m = extract_model(lst)
        if b:
            brands[b] += 1
        if m:
            models[m] += 1
        p = extract_price(lst)
        if p:
            prices.append(p)
        cond = extract_condition(lst)
        if cond and "foreign" in cond.lower():
            foreign_used += 1
        url = listing_url(lst)
        if url and len(sample_urls) < 5:
            sample_urls.append(url)
        for date_key in ("date_created", "dateCreated", "date_moderated", "dateModerated"):
            if lst.get(date_key):
                d = str(lst[date_key])
                if not latest_posted or d > latest_posted:
                    latest_posted = d

    return {
        "listing_count": len(listings),
        "foreign_used_count": foreign_used,
        "top_brands": top_n(brands, 3),
        "top_models": top_n(models, 5),
        "price_min": min(prices) if prices else None,
        "price_max": max(prices) if prices else None,
        "price_median": int(statistics.median(prices)) if prices else None,
        "price_distribution": price_distribution(prices),
        "sample_listing_urls": sample_urls,
        "latest_posted_at": latest_posted,
        "is_foreign_used_focus": foreign_used >= max(1, len(listings) // 2),
    }
