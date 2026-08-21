"""B端卖家评分引擎 — 主营品牌仅作画像，不参与加减分"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from config import DEALER_NAME_KEYWORDS, RETAIN_MIN_LISTINGS
from scraper.filters import dealer_keyword_hits, parse_member_years

# 画像：品牌系别（不参与评分）
JAPANESE_BRANDS = {"toyota", "lexus", "honda", "nissan", "mazda", "mitsubishi", "suzuki", "infiniti", "acura"}
GERMAN_BRANDS = {"mercedes", "mercedes-benz", "bmw", "audi", "volkswagen", "porsche", "opel"}
KOREAN_BRANDS = {"hyundai", "kia", "genesis"}
LUXURY_BRANDS = {"lexus", "mercedes", "mercedes-benz", "bmw", "audi", "land rover", "range rover", "porsche", "jaguar", "bentley", "rolls-royce", "maserati", "infiniti"}
CHINA_NEV_BRANDS = {
    "byd", "geely", "xiaomi", "jetour", "gac", "changan", "chery", "exeed",
    "omoda", "dongfeng", "li auto", "jac", "avatr", "nio", "xpeng", "zeekr",
}

TIER_THRESHOLDS = (
    (70, "KEY", "重点 B 端车商"),
    (50, "FOLLOW", "可跟进车商"),
    (30, "WATCH", "观察线索"),
    (0, "LOW", "排除或低优先级"),
)

VALID_TIER_CODES = {code for _, code, _ in TIER_THRESHOLDS}


@dataclass
class ScoreLine:
    code: str
    label: str
    points: float
    category: str  # bonus | penalty | portrait


@dataclass
class SellerScoreResult:
    total_score: float
    tier_code: str
    tier_label: str
    cert_score: float
    tenure_score: float
    inventory_score: float
    trust_score: float
    engagement_score: float
    brand_score: float  # 恒为 0，品牌不参与评分
    lines: list[ScoreLine] = field(default_factory=list)
    portrait: dict[str, Any] = field(default_factory=dict)

    def to_detail_json(self) -> str:
        return json.dumps({
            "total_score": self.total_score,
            "tier_code": self.tier_code,
            "tier_label": self.tier_label,
            "lines": [
                {"code": l.code, "label": l.label, "points": l.points, "category": l.category}
                for l in self.lines
            ],
            "portrait": self.portrait,
            "dimension_scores": {
                "cert_score": self.cert_score,
                "tenure_score": self.tenure_score,
                "inventory_score": self.inventory_score,
                "trust_score": self.trust_score,
                "engagement_score": self.engagement_score,
                "brand_score": self.brand_score,
            },
        }, ensure_ascii=False)


def _parse_json_field(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (list, dict)):
        return val
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return val


def _norm_brand(b: str) -> str:
    return b.strip().lower()


def derive_brand_segments(top_brands: list[str]) -> list[str]:
    segments: list[str] = []
    norms = {_norm_brand(b) for b in top_brands}
    if norms & JAPANESE_BRANDS:
        segments.append("日系")
    if norms & GERMAN_BRANDS:
        segments.append("德系")
    if norms & KOREAN_BRANDS:
        segments.append("韩系")
    if norms & LUXURY_BRANDS:
        segments.append("豪华车")
    if norms & CHINA_NEV_BRANDS:
        segments.append("新能源")
    return segments


def derive_price_band(price_median: int | None, price_min: int | None, price_max: int | None) -> str | None:
    ref = price_median
    if ref is None and price_min is not None and price_max is not None:
        ref = (price_min + price_max) // 2
    if ref is None:
        return None
    if ref < 5_000_000:
        return "0-5M ₦"
    if ref < 10_000_000:
        return "5-10M ₦"
    if ref < 20_000_000:
        return "10-20M ₦"
    if ref < 40_000_000:
        return "20-40M ₦"
    return "40M+ ₦"


def _looks_personal(name: str) -> bool:
    n = (name or "").lower().strip()
    if not n:
        return True
    if any(kw in n for kw in DEALER_NAME_KEYWORDS):
        return False
    if any(s in n for s in ("ltd", "limited", "inc", "company", "motors", "autos")):
        return False
    return len(n.split()) <= 2 and len(n) < 20


def _has_recent_listings(listing_rows: list[dict], days: int = 60, min_count: int = 3) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    recent = 0
    for row in listing_rows:
        raw = row.get("posted_at")
        if not raw:
            continue
        try:
            # 兼容多种日期格式
            for fmt in ("%a, %d %b %Y %H:%M:%S %Z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    dt = datetime.strptime(str(raw).strip(), fmt)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt >= cutoff:
                        recent += 1
                    break
                except ValueError:
                    continue
        except Exception:
            continue
    return recent >= min_count


def _tier(total: float) -> tuple[str, str]:
    for threshold, code, label in TIER_THRESHOLDS:
        if total >= threshold:
            return code, label
    return "LOW", "排除或低优先级"


class SellerScorer:
    BULK_LISTING_THRESHOLD = RETAIN_MIN_LISTINGS  # 10

    def score(self, seller: dict, listing_rows: list[dict] | None = None) -> SellerScoreResult:
        listing_rows = listing_rows or []
        lines: list[ScoreLine] = []

        cert_diamond = bool(seller.get("cert_diamond"))
        cert_enterprise = bool(seller.get("cert_enterprise"))
        cert_verified_store = bool(seller.get("cert_verified_store"))
        cert_verified_id = bool(seller.get("cert_verified_id"))
        has_premium_store = cert_diamond or cert_enterprise or cert_verified_store

        member_label = seller.get("member_since_label") or ""
        member_years = float(seller.get("member_years") or 0) or parse_member_years(member_label)
        listing_count = int(seller.get("listing_count") or 0)
        feedback_count = int(seller.get("feedback_count") or 0)

        has_address = bool((seller.get("shop_address") or "").strip())
        has_hours = bool((seller.get("business_hours") or "").strip())
        company_name = seller.get("company_name") or ""
        kw_hits = _parse_json_field(seller.get("dealer_keyword_hits")) or dealer_keyword_hits(
            company_name, seller.get("shop_description") or ""
        )

        top_brands = _parse_json_field(seller.get("top_brands")) or []
        top_models = _parse_json_field(seller.get("top_models")) or []
        foreign_used_count = int(seller.get("foreign_used_count") or 0)
        is_foreign_focus = bool(seller.get("is_foreign_used_focus"))

        # ── 加分项 ──
        if cert_diamond:
            lines.append(ScoreLine("B_diamond", "Diamond", 25, "bonus"))
        if cert_enterprise:
            lines.append(ScoreLine("B_enterprise", "Enterprise", 25, "bonus"))
        if cert_verified_store:
            lines.append(ScoreLine("B_verified_store", "Store Address Verified", 30, "bonus"))

        if member_years >= 5 or "5+" in member_label:
            lines.append(ScoreLine("B_tenure_5y", "5+ years on Jiji", 20, "bonus"))
        elif member_years >= 3 or "3+" in member_label:
            lines.append(ScoreLine("B_tenure_3y", "3+ years on Jiji", 15, "bonus"))

        if listing_count >= 20:
            lines.append(ScoreLine("B_listings_20", "发布车辆数 ≥ 20", 25, "bonus"))
        elif listing_count >= 10:
            lines.append(ScoreLine("B_listings_10", "发布车辆数 10–19", 15, "bonus"))

        if has_address and has_hours:
            lines.append(ScoreLine("B_address_hours", "有固定地址和营业时间", 15, "bonus"))

        if kw_hits:
            lines.append(ScoreLine("B_dealer_keywords", "店铺名含车商特征词", 10, "bonus"))

        if feedback_count >= 10:
            lines.append(ScoreLine("B_feedback", "Feedback ≥ 10", 10, "bonus"))

        if _has_recent_listings(listing_rows):
            lines.append(ScoreLine("B_recent_posts", "近期持续发布车源", 10, "bonus"))

        if cert_verified_id and not has_premium_store:
            lines.append(ScoreLine("B_verified_id_only", "仅有 Verified ID", 3, "bonus"))

        # ── 扣分项 ──
        if not has_address:
            lines.append(ScoreLine("P_no_address", "无地址", -20, "penalty"))

        if listing_count <= 3:
            lines.append(ScoreLine("P_few_listings", "发布车辆数 ≤ 3", -30, "penalty"))

        if member_years > 0 and member_years < 1:
            lines.append(ScoreLine("P_tenure_lt1", "注册年限低于 1 年", -15, "penalty"))

        if not has_premium_store and listing_count < self.BULK_LISTING_THRESHOLD:
            lines.append(ScoreLine("P_no_premium_no_bulk", "无高级认证且无批量车源", -25, "penalty"))

        if _looks_personal(company_name) and not has_address and listing_count < self.BULK_LISTING_THRESHOLD and not kw_hits:
            lines.append(ScoreLine("P_personal_seller", "明显个人卖家", -20, "penalty"))

        bonus_penalty_lines = [l for l in lines if l.category in ("bonus", "penalty")]
        total = sum(l.points for l in bonus_penalty_lines)

        cert_score = sum(
            l.points for l in lines
            if l.code in ("B_diamond", "B_enterprise", "B_verified_store", "B_verified_id_only")
        )
        tenure_score = sum(l.points for l in lines if "tenure" in l.code)
        inventory_score = sum(l.points for l in lines if "listings" in l.code or "bulk" in l.code or "few" in l.code)
        trust_score = sum(l.points for l in lines if l.code in ("B_address_hours", "B_feedback", "P_no_address"))
        engagement_score = sum(l.points for l in lines if l.code in ("B_dealer_keywords", "B_recent_posts", "P_personal_seller"))

        brand_segments = derive_brand_segments(top_brands if isinstance(top_brands, list) else [])
        price_band = derive_price_band(
            seller.get("price_median"),
            seller.get("price_min"),
            seller.get("price_max"),
        )

        portrait = {
            "top_brands": top_brands[:3] if isinstance(top_brands, list) else [],
            "top_models": top_models[:5] if isinstance(top_models, list) else [],
            "brand_segments": brand_segments,
            "price_band": price_band,
            "foreign_used_count": foreign_used_count,
            "is_foreign_used_focus": is_foreign_focus,
            "note": "主营品牌/车型/价格带/系别仅作画像，不参与评分",
        }

        tier_code, tier_label = _tier(total)

        return SellerScoreResult(
            total_score=round(total, 1),
            tier_code=tier_code,
            tier_label=tier_label,
            cert_score=round(cert_score, 1),
            tenure_score=round(tenure_score, 1),
            inventory_score=round(inventory_score, 1),
            trust_score=round(trust_score, 1),
            engagement_score=round(engagement_score, 1),
            brand_score=0.0,
            lines=lines,
            portrait=portrait,
        )
