"""B端车商保留 / 排除规则引擎"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from config import (
    DEALER_NAME_KEYWORDS,
    EXCLUDE_MAX_LISTINGS,
    EXCLUDE_MAX_YEARS,
    PERSONAL_TRANSFER_KEYWORDS,
    PREMIUM_BADGES,
    RETAIN_MIN_LISTINGS,
    RETAIN_MIN_YEARS,
    VERIFIED_ID_KEYWORDS,
    VERIFIED_STORE_KEYWORDS,
)


def parse_member_years(label: str | None) -> float:
    if not label:
        return 0.0
    text = label.lower().strip()
    years = 0.0
    m = re.search(r"(\d+)\s*y", text)
    if m:
        years += int(m.group(1))
    m = re.search(r"(\d+)\s*m", text)
    if m:
        years += int(m.group(1)) / 12
    m = re.search(r"(\d+)\+", text)
    if m and "year" in text:
        years = max(years, float(m.group(1)))
    return years


def _norm(s: str | None) -> str:
    return (s or "").strip().lower()


def _labels_blob(listing: dict, seller: dict) -> list[str]:
    out: list[str] = []
    for src in (listing, seller):
        labels = src.get("labels") or []
        if isinstance(labels, list):
            for item in labels:
                if isinstance(item, dict):
                    for k in ("type", "value", "name", "text"):
                        if item.get(k):
                            out.append(_norm(str(item[k])))
                elif isinstance(item, str):
                    out.append(_norm(item))
    return out


@dataclass
class CertificationFlags:
    diamond: bool = False
    enterprise: bool = False
    verified_store: bool = False
    verified_id: bool = False

    @property
    def types(self) -> list[str]:
        t = []
        if self.diamond:
            t.append("Diamond")
        if self.enterprise:
            t.append("Enterprise")
        if self.verified_store:
            t.append("Verified Store")
        if self.verified_id:
            t.append("Verified ID")
        return t

    @property
    def has_premium(self) -> bool:
        return self.diamond or self.enterprise or self.verified_store


def detect_certifications(listing: dict, seller: dict) -> CertificationFlags:
    flags = CertificationFlags()
    labels = _labels_blob(listing, seller)

    paid = listing.get("paid_info") or seller.get("paid_info") or {}
    pkg = _norm(paid.get("package_type") if isinstance(paid, dict) else "")
    boost = _norm(str(listing.get("is_boost") or ""))

    for blob in labels + [pkg, boost]:
        if "diamond" in blob:
            flags.diamond = True
        if "enterprise" in blob:
            flags.enterprise = True
        if any(vs in blob for vs in VERIFIED_STORE_KEYWORDS) or "verified store" in blob:
            flags.verified_store = True
        if any(vi in blob for vi in VERIFIED_ID_KEYWORDS) or blob == "verified id":
            flags.verified_id = True

    badge_info = listing.get("badge_info") or seller.get("badge_info") or {}
    if isinstance(badge_info, dict):
        blob = _norm(str(badge_info))
        if "diamond" in blob:
            flags.diamond = True
        if "enterprise" in blob:
            flags.enterprise = True
        if "store" in blob and "verif" in blob:
            flags.verified_store = True

    addr = _norm(seller.get("address") or seller.get("shop_address") or "")
    if "verified" in addr:
        flags.verified_store = True

    return flags


def dealer_keyword_hits(name: str, description: str = "") -> list[str]:
    blob = _norm(f"{name} {description}")
    return [kw for kw in DEALER_NAME_KEYWORDS if kw in blob]


def personal_transfer_signals(descriptions: list[str]) -> list[str]:
    hits = []
    blob = _norm(" ".join(descriptions))
    for kw in PERSONAL_TRANSFER_KEYWORDS:
        if kw in blob:
            hits.append(kw)
    return hits


@dataclass
class SellerAggregate:
    listings: list[dict] = field(default_factory=list)
    seller: dict = field(default_factory=dict)
    listing: dict = field(default_factory=dict)

    @property
    def listing_count(self) -> int:
        shop_count = self.seller.get("adverts_count") or self.seller.get("advertsCount")
        if shop_count and int(shop_count) > len(self.listings):
            return int(shop_count)
        return len(self.listings)

    @property
    def member_label(self) -> str:
        return (
            self.seller.get("member_since")
            or self.seller.get("memberSince")
            or self.seller.get("labels_member")
            or ""
        )

    @property
    def member_years(self) -> float:
        return parse_member_years(self.member_label)

    @property
    def company_name(self) -> str:
        return (
            self.seller.get("name")
            or self.seller.get("company_name")
            or self.seller.get("shop_name")
            or ""
        )

    @property
    def descriptions(self) -> list[str]:
        out = [
            self.seller.get("description") or "",
            self.seller.get("shop_description") or "",
        ]
        for lst in self.listings[:5]:
            out.append(lst.get("short_description") or lst.get("description") or "")
        return [d for d in out if d]


class SellerRuleEngine:
    """保留规则 OR 进入初筛；排除规则优先剔除"""

    def evaluate(self, agg: SellerAggregate) -> tuple[bool, dict]:
        listing = agg.listing or (agg.listings[0] if agg.listings else {})
        seller = agg.seller
        cert = detect_certifications(listing, seller)
        retain: list[str] = []
        exclude: list[str] = []

        # --- 保留规则 (OR) ---
        if cert.diamond:
            retain.append("R1_diamond")
        if cert.enterprise:
            retain.append("R2_enterprise")
        if cert.verified_store:
            retain.append("R3_verified_store")
        if agg.member_years >= RETAIN_MIN_YEARS or "5+" in agg.member_label or "3+" in agg.member_label:
            retain.append("R4_tenure_3plus")
        if agg.listing_count >= RETAIN_MIN_LISTINGS:
            retain.append(f"R5_listings_{agg.listing_count}")
        kw_hits = dealer_keyword_hits(agg.company_name, " ".join(agg.descriptions[:2]))
        if kw_hits:
            retain.append("R6_dealer_keywords")

        # --- 排除规则 (优先) ---
        if agg.listing_count <= EXCLUDE_MAX_LISTINGS:
            exclude.append("E4_listings_lte_3")

        if agg.member_years > 0 and agg.member_years < EXCLUDE_MAX_YEARS:
            exclude.append("E5_tenure_lt_1y")

        if cert.verified_id and not cert.verified_store and agg.listing_count < RETAIN_MIN_LISTINGS:
            if not cert.diamond and not cert.enterprise:
                exclude.append("E3_only_verified_id_no_bulk")

        has_address = bool(seller.get("address") or seller.get("shop_address") or seller.get("location"))
        has_hours = bool(seller.get("business_hours") or seller.get("working_hours") or seller.get("schedule"))
        if not has_address and not has_hours and not cert.has_premium:
            exclude.append("E2_no_address_no_hours")

        if not cert.has_premium and not kw_hits and agg.listing_count < RETAIN_MIN_LISTINGS:
            if agg.member_years < RETAIN_MIN_YEARS:
                exclude.append("E1_no_premium_badge")

        personal_name = self._looks_personal(agg.company_name)
        if personal_name and not has_address and agg.listing_count < RETAIN_MIN_LISTINGS and not kw_hits:
            exclude.append("E6_personal_name_no_shop")

        transfer_hits = personal_transfer_signals(agg.descriptions)
        if transfer_hits and agg.listing_count <= 5 and not cert.has_premium:
            exclude.append("E7_personal_transfer_tone")

        # Diamond / Enterprise 豁免部分排除项
        if cert.diamond or cert.enterprise:
            exclude = [e for e in exclude if e not in ("E1_no_premium_badge", "E2_no_address_no_hours", "E7_personal_transfer_tone")]

        qualified = bool(retain) and not exclude
        return qualified, {
            "cert": cert,
            "retain_reasons": retain,
            "exclude_flags": exclude,
            "dealer_keyword_hits": kw_hits,
            "member_since_label": agg.member_label,
            "member_years": agg.member_years,
        }

    @staticmethod
    def _looks_personal(name: str) -> bool:
        n = _norm(name)
        if not n:
            return True
        if any(kw in n for kw in DEALER_NAME_KEYWORDS):
            return False
        if any(suffix in n for suffix in ("ltd", "limited", "inc", "company", "motors", "autos")):
            return False
        # 短名 + 无商业后缀 → 偏个人
        words = n.split()
        return len(words) <= 2 and len(n) < 20
