"""供货方 → 尼日利亚车商 WhatsApp 破冰。

身份：中国二手车出口。货盘分两路——
1) 日系 tokunbo：Highlander / RAV4（含锋兰达）/ Camry / Corolla
2) 国产新能源：BYD / Geely / Xiaomi
客群不要混打。锋兰达对外一律说 RAV4。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from config import (
    OUTREACH_COMPANY,
    OUTREACH_FROM_CHINA,
    OUTREACH_INCOTERM,
    OUTREACH_MARKET,
    OUTREACH_NEV_BRANDS,
    OUTREACH_ORIGIN,
    OUTREACH_SENDER_NAME,
    OUTREACH_TOYOTA_MODELS,
)

CHINA_WHATSAPP_NOTE = (
    "I’m messaging from China / my international WhatsApp — happy to call or video if easier."
)

# 中国市场名 → 尼日利亚常用名
TOYOTA_MODEL_ALIASES = {
    "highlander": "Highlander",
    "grand highlander": "Highlander",
    "hanlanda": "Highlander",
    "rav4": "RAV4",
    "rav 4": "RAV4",
    "frontlander": "RAV4",
    "fenglanda": "RAV4",
    "camry": "Camry",
    "corolla": "Corolla",
}

NEV_BRAND_ALIASES = {
    "byd": "BYD",
    "geely": "Geely",
    "xiaomi": "Xiaomi",
    "jetour": "Jetour",
    "gac": "GAC",
    "changan": "Changan",
    "chery": "Chery",
    "exeed": "Exeed",
    "omoda": "Omoda",
    "dongfeng": "Dongfeng",
}

OUTREACH_TRACKING_FIELDS = (
    "outreach_status",
    "sent_at",
    "replied_at",
    "reply_type",
    "outreach_notes",
)

OUTREACH_LEAD_FIELDS = (
    "id",
    "company_name",
    "city",
    "state_region",
    "tier",
    "score_total",
    "listing_count",
    "top_brands",
    "top_models",
    "brand_segments",
    "price_band",
    "match_type",
    "contact_whatsapp",
    "contact_phone",
    "seller_profile_url",
    "shop_address",
)

MatchType = str  # toyota_tokunbo | china_nev | mixed


@dataclass(frozen=True)
class IcebreakerContext:
    sender_name: str = OUTREACH_SENDER_NAME
    company: str = OUTREACH_COMPANY
    origin: str = OUTREACH_ORIGIN
    market: str = OUTREACH_MARKET
    incoterm: str = OUTREACH_INCOTERM
    from_china: bool = OUTREACH_FROM_CHINA
    toyota_models: tuple[str, ...] = tuple(OUTREACH_TOYOTA_MODELS)
    nev_brands: tuple[str, ...] = tuple(OUTREACH_NEV_BRANDS)


def _parse_json_list(val: Any) -> list[str]:
    if val is None or val == "":
        return []
    if isinstance(val, list):
        return [str(x).strip() for x in val if str(x).strip()]
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return [part.strip() for part in val.split(",") if part.strip()]
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
    return []


def _text_blob(row: dict[str, Any]) -> str:
    parts = [
        row.get("company_name") or "",
        row.get("top_brands") or "",
        row.get("top_models") or "",
        row.get("brand_segments") or "",
        row.get("main_brands") or "",
    ]
    if isinstance(row.get("top_brands"), list):
        parts.append(" ".join(str(x) for x in row["top_brands"]))
    if isinstance(row.get("top_models"), list):
        parts.append(" ".join(str(x) for x in row["top_models"]))
    return " ".join(str(p) for p in parts).lower()


def shop_anchor(row: dict[str, Any]) -> str:
    name = (row.get("company_name") or "").strip()
    return name if name else "your dealership"


def _join_names(items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return ", ".join(items[:-1]) + f" and {items[-1]}"


def dealer_toyota_models(row: dict[str, Any]) -> list[str]:
    blob = _text_blob(row)
    found: list[str] = []
    for alias, canon in TOYOTA_MODEL_ALIASES.items():
        if alias in blob and canon not in found:
            found.append(canon)
    return found


def dealer_nev_brands(row: dict[str, Any]) -> list[str]:
    blob = _text_blob(row)
    found: list[str] = []
    for alias, canon in NEV_BRAND_ALIASES.items():
        if alias in blob and canon not in found:
            found.append(canon)
    return found


def classify_match(row: dict[str, Any]) -> MatchType:
    toyota_models = dealer_toyota_models(row)
    nev = dealer_nev_brands(row)
    blob = _text_blob(row)
    sells_toyota = bool(toyota_models) or "toyota" in blob
    sells_nev = bool(nev)
    if sells_toyota and sells_nev:
        return "mixed"
    if sells_nev:
        return "china_nev"
    return "toyota_tokunbo"


def brand_phrase(row: dict[str, Any]) -> str:
    match = classify_match(row)
    if match == "china_nev":
        nev = dealer_nev_brands(row)[:3] or list(OUTREACH_NEV_BRANDS)
        return _join_names(nev)
    models = dealer_toyota_models(row)[:3]
    if models:
        return "Toyota " + _join_names(models)
    brands = _parse_json_list(row.get("top_brands"))[:3]
    if brands:
        return _join_names(brands)
    return "Toyota Camry / Highlander"


def _stock_toyota(ctx: IcebreakerContext) -> str:
    return _join_names(list(ctx.toyota_models))


def _stock_nev(ctx: IcebreakerContext) -> str:
    return _join_names(list(ctx.nev_brands)[:3])


def _append_china_note(text: str, ctx: IcebreakerContext) -> str:
    if not ctx.from_china:
        return text
    return f"{text}\n{CHINA_WHATSAPP_NOTE}"


def build_icebreaker(
    row: dict[str, Any],
    *,
    variant: str = "short",
    ctx: IcebreakerContext | None = None,
) -> str:
    """按客群生成破冰。variant: short | full | qualify"""
    ctx = ctx or IcebreakerContext()
    shop = shop_anchor(row)
    match = classify_match(row)
    seen = brand_phrase(row)
    toyota_stock = _stock_toyota(ctx)
    nev_stock = _stock_nev(ctx)

    if variant == "qualify":
        text = (
            f"Hi, I saw {shop} on JiJi.\n"
            f"I’m {ctx.sender_name} from {ctx.company}, a used-car exporter in {ctx.origin}.\n"
            f"We supply Nigerian dealers wholesale ({ctx.incoterm}) — Toyota {toyota_stock}, "
            f"plus {nev_stock} if you take Chinese EV/PHEV.\n"
            "Do you currently buy stock in volume, or mainly retail local cars?"
        )
        return _append_china_note(text, ctx)

    if match == "china_nev":
        if variant == "full":
            text = (
                f"Hi, I found {shop} on JiJi — you seem to list {seen}.\n"
                f"I’m {ctx.sender_name} from {ctx.company}. We export from {ctx.origin} "
                f"to {ctx.market} dealers, not end buyers.\n"
                f"Current wholesale units: {nev_stock} ({ctx.incoterm}).\n"
                "Would you like 5–8 units with prices this week?"
            )
        else:
            text = (
                f"Hi, I saw {shop} on JiJi — noticed you list {seen}.\n"
                f"I’m {ctx.sender_name} from {ctx.company}, exporting from {ctx.origin}.\n"
                f"We have wholesale {nev_stock} for West Africa dealers ({ctx.incoterm}). "
                "Open to a short list this week?"
            )
        return _append_china_note(text, ctx)

    if match == "mixed":
        if variant == "full":
            text = (
                f"Hi, I found {shop} on JiJi — you cover {seen} and Chinese brands.\n"
                f"I’m {ctx.sender_name} from {ctx.company}, a used-car exporter in {ctx.origin}.\n"
                f"We can offer LHD Toyota {toyota_stock}, and separately {nev_stock} "
                f"({ctx.incoterm}).\n"
                "If you buy in volume, I can send two short lists (Toyota + NEV) this week."
            )
        else:
            text = (
                f"Hi, I saw {shop} on JiJi — looks like you sell {seen}.\n"
                f"I’m {ctx.sender_name} from {ctx.company}, exporting used cars from {ctx.origin}.\n"
                f"Main line for dealers: LHD Toyota {toyota_stock} ({ctx.incoterm}). "
                f"We also have {nev_stock} if you take Chinese EV. Open to a look this week?"
            )
        return _append_china_note(text, ctx)

    # toyota_tokunbo — 主客群，默认不提新能源
    if variant == "full":
        text = (
            f"Hi, I found {shop} on JiJi — looks like you deal in {seen}.\n"
            f"I’m {ctx.sender_name} from {ctx.company}, a used-car exporter in {ctx.origin}.\n"
            f"We supply Nigerian wholesalers and large retailers with LHD Toyota "
            f"{toyota_stock} ({ctx.incoterm}) — not end-buyer retail.\n"
            "Would you like 5–8 current units with wholesale prices this week?"
        )
    else:
        text = (
            f"Hi, I saw {shop} on JiJi — looks like you sell {seen}.\n"
            f"I’m {ctx.sender_name} from {ctx.company}, a used-car exporter in {ctx.origin}.\n"
            f"We have wholesale LHD Toyota {toyota_stock} for Nigerian dealers ({ctx.incoterm}). "
            "If you buy in volume, I can share 5–8 units this week. Open to a look?"
        )
    return _append_china_note(text, ctx)


def build_outreach_row(
    row: dict[str, Any],
    *,
    variant: str = "short",
    ctx: IcebreakerContext | None = None,
) -> dict[str, Any]:
    """导出用：线索字段 + 客群匹配 + 破冰文案 + 空的跟进列。"""
    out: dict[str, Any] = {}
    match = classify_match(row)
    for key in OUTREACH_LEAD_FIELDS:
        if key == "match_type":
            out[key] = match
        else:
            out[key] = row.get(key, "")
    out["icebreaker"] = build_icebreaker(row, variant=variant, ctx=ctx)
    for key in OUTREACH_TRACKING_FIELDS:
        out[key] = ""
    out["outreach_status"] = "pending"
    return out
