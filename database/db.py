"""SQLite 数据库操作"""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from config import DB_PATH

SCHEMA_FILE = Path(__file__).parent / "schema.sql"

CONTACT_COLUMNS = (
    ("contact_whatsapp", "TEXT"),
    ("contact_phone", "TEXT"),
    ("contact_email", "TEXT"),
    ("contact_notes", "TEXT"),
    ("contact_added_at", "TEXT"),
    ("contact_added_by", "TEXT"),
)

PROFILE_COLUMNS = (
    ("brand_segments", "TEXT"),
    ("price_band", "TEXT"),
)


def _utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def migrate_schema(db_path: str = DB_PATH) -> None:
    """为已有数据库补充新列（幂等）"""
    if not os.path.exists(db_path):
        return
    with sqlite3.connect(db_path) as conn:
        existing = {row[1] for row in conn.execute("PRAGMA table_info(seller_leads)")}
        for col, typ in CONTACT_COLUMNS + PROFILE_COLUMNS:
            if col not in existing:
                conn.execute(f"ALTER TABLE seller_leads ADD COLUMN {col} {typ}")
        conn.commit()


def init_database(db_path: str = DB_PATH) -> str:
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))
        conn.commit()
    migrate_schema(db_path)
    return db_path


class Database:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        if not os.path.exists(db_path):
            init_database(db_path)
        else:
            migrate_schema(db_path)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def start_run(self, source_url: str) -> str:
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO scrape_runs (id, source_url, status) VALUES (?, ?, 'running')",
                (run_id, source_url),
            )
        return run_id

    def finish_run(
        self,
        run_id: str,
        *,
        pages: int,
        listings: int,
        sellers: int,
        status: str = "completed",
        notes: str | None = None,
    ) -> None:
        with self.connect() as conn:
            conn.execute(
                """UPDATE scrape_runs
                   SET finished_at=?, pages_scraped=?, listings_seen=?,
                       sellers_qualified=?, status=?, notes=?
                   WHERE id=?""",
                (_utcnow(), pages, listings, sellers, status, notes, run_id),
            )

    def upsert_seller(self, record: dict[str, Any], run_id: str) -> int:
        """插入或更新 seller_leads，返回 row id"""
        jiji_user_id = record.get("jiji_user_id")
        now = _utcnow()

        json_fields = (
            "certification_types", "top_brands", "top_models", "price_distribution",
            "sample_listing_urls", "retain_reasons", "exclude_flags", "dealer_keyword_hits",
        )
        for f in json_fields:
            if f in record and not isinstance(record[f], str):
                record[f] = json.dumps(record[f], ensure_ascii=False)

        cols = [
            "jiji_user_id", "shop_slug", "company_name", "seller_profile_url",
            "cert_diamond", "cert_enterprise", "cert_verified_store", "cert_verified_id",
            "certification_types", "member_since_label", "member_years",
            "shop_address", "city", "state_region", "business_hours", "shop_description",
            "response_time", "feedback_count", "listing_count", "foreign_used_count",
            "is_foreign_used_focus", "top_brands", "top_models",
            "price_min", "price_max", "price_median", "price_distribution",
            "sample_listing_urls", "latest_posted_at",
            "retain_reasons", "exclude_flags", "dealer_keyword_hits", "is_qualified",
        ]

        with self.connect() as conn:
            existing = None
            if jiji_user_id:
                row = conn.execute(
                    "SELECT id FROM seller_leads WHERE jiji_user_id=?",
                    (jiji_user_id,),
                ).fetchone()
                existing = row["id"] if row else None

            if existing:
                sets = ", ".join(f"{c}=?" for c in cols if c in record)
                vals = [record[c] for c in cols if c in record]
                vals.extend([now, run_id, now, existing])
                conn.execute(
                    f"""UPDATE seller_leads SET {sets},
                        last_scraped_at=?, last_scrape_run_id=?, updated_at=?
                        WHERE id=?""",
                    vals,
                )
                seller_id = existing
            else:
                data = {c: record.get(c) for c in cols}
                data["last_scrape_run_id"] = run_id
                data["first_seen_at"] = now
                data["last_scraped_at"] = now
                data["updated_at"] = now
                placeholders = ", ".join("?" * len(data))
                conn.execute(
                    f"INSERT INTO seller_leads ({', '.join(data.keys())}) VALUES ({placeholders})",
                    list(data.values()),
                )
                seller_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

            return seller_id

    def upsert_listings(self, seller_lead_id: int, listings: list[dict], run_id: str) -> None:
        with self.connect() as conn:
            for item in listings:
                conn.execute(
                    """INSERT INTO seller_listings
                       (seller_lead_id, jiji_listing_id, listing_url, title, brand, model,
                        year, condition, price, region, posted_at, scrape_run_id)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                       ON CONFLICT(jiji_listing_id) DO UPDATE SET
                         seller_lead_id=excluded.seller_lead_id,
                         price=excluded.price,
                         scraped_at=datetime('now')""",
                    (
                        seller_lead_id,
                        item.get("jiji_listing_id"),
                        item.get("listing_url"),
                        item.get("title"),
                        item.get("brand"),
                        item.get("model"),
                        item.get("year"),
                        item.get("condition"),
                        item.get("price"),
                        item.get("region"),
                        item.get("posted_at"),
                        run_id,
                    ),
                )

    def count_qualified(self) -> int:
        with self.connect() as conn:
            return conn.execute(
                "SELECT COUNT(*) FROM seller_leads WHERE is_qualified=1"
            ).fetchone()[0]

    def export_qualified_csv(self, path: str) -> int:
        import csv
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM seller_leads WHERE is_qualified=1 ORDER BY listing_count DESC"
            ).fetchall()
        if not rows:
            return 0
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=rows[0].keys())
            w.writeheader()
            for r in rows:
                w.writerow(dict(r))
        return len(rows)

    def set_manual_contact(
        self,
        seller_id: int,
        *,
        whatsapp: str | None = None,
        phone: str | None = None,
        email: str | None = None,
        notes: str | None = None,
        added_by: str | None = None,
    ) -> None:
        """评分后人工填写联络方式（抓取流程不写入这些字段）"""
        now = _utcnow()
        with self.connect() as conn:
            conn.execute(
                """UPDATE seller_leads SET
                     contact_whatsapp=COALESCE(?, contact_whatsapp),
                     contact_phone=COALESCE(?, contact_phone),
                     contact_email=COALESCE(?, contact_email),
                     contact_notes=COALESCE(?, contact_notes),
                     contact_added_at=?,
                     contact_added_by=COALESCE(?, contact_added_by),
                     updated_at=?
                   WHERE id=?""",
                (whatsapp, phone, email, notes, now, added_by, now, seller_id),
            )

    def fetch_sellers_for_scoring(self, qualified_only: bool = False) -> list[dict]:
        sql = "SELECT * FROM seller_leads"
        if qualified_only:
            sql += " WHERE is_qualified=1"
        sql += " ORDER BY id"
        with self.connect() as conn:
            return [dict(r) for r in conn.execute(sql).fetchall()]

    def fetch_listings_for_seller(self, seller_lead_id: int) -> list[dict]:
        with self.connect() as conn:
            return [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM seller_listings WHERE seller_lead_id=?",
                    (seller_lead_id,),
                ).fetchall()
            ]

    def save_score(self, seller_lead_id: int, result) -> None:
        """写入 seller_scores 并回写 seller_leads 评分与画像字段"""
        now = _utcnow()
        detail = result.to_detail_json()
        portrait = result.portrait
        brand_segments = json.dumps(portrait.get("brand_segments", []), ensure_ascii=False)
        price_band = portrait.get("price_band")

        with self.connect() as conn:
            conn.execute(
                """INSERT INTO seller_scores
                   (seller_lead_id, scored_at, total_score, tier,
                    cert_score, tenure_score, inventory_score, brand_score,
                    trust_score, engagement_score, score_detail)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(seller_lead_id) DO UPDATE SET
                     scored_at=excluded.scored_at,
                     total_score=excluded.total_score,
                     tier=excluded.tier,
                     cert_score=excluded.cert_score,
                     tenure_score=excluded.tenure_score,
                     inventory_score=excluded.inventory_score,
                     brand_score=excluded.brand_score,
                     trust_score=excluded.trust_score,
                     engagement_score=excluded.engagement_score,
                     score_detail=excluded.score_detail""",
                (
                    seller_lead_id, now, result.total_score, result.tier_code,
                    result.cert_score, result.tenure_score, result.inventory_score,
                    result.brand_score, result.trust_score, result.engagement_score,
                    detail,
                ),
            )
            conn.execute(
                """UPDATE seller_leads SET
                     b_end_score=?, score_breakdown=?,
                     brand_segments=?, price_band=?, updated_at=?
                   WHERE id=?""",
                (result.total_score, detail, brand_segments, price_band, now, seller_lead_id),
            )

    def fetch_scored_sellers(
        self,
        *,
        min_score: float | None = None,
        tiers: list[str] | None = None,
        brand_segment: str | None = None,
        foreign_used_only: bool = False,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        sql = """
            SELECT l.*, s.tier, s.total_score AS score_total, s.scored_at
            FROM seller_leads l
            INNER JOIN seller_scores s ON s.seller_lead_id = l.id
        """
        conditions: list[str] = []
        params: list[Any] = []

        if min_score is not None:
            conditions.append("l.b_end_score >= ?")
            params.append(min_score)
        if tiers:
            placeholders = ",".join("?" * len(tiers))
            conditions.append(f"s.tier IN ({placeholders})")
            params.extend(tiers)
        if brand_segment:
            conditions.append("l.brand_segments LIKE ?")
            params.append(f'%"{brand_segment}"%')
        if foreign_used_only:
            conditions.append("l.is_foreign_used_focus = 1")

        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY l.b_end_score DESC, l.listing_count DESC"
        if limit is not None:
            sql += " LIMIT ?"
            params.append(limit)

        with self.connect() as conn:
            return [dict(r) for r in conn.execute(sql, params).fetchall()]

    def export_scored_csv(
        self,
        path: str,
        *,
        min_score: float | None = None,
        tiers: list[str] | None = None,
        brand_segment: str | None = None,
        foreign_used_only: bool = False,
        with_icebreaker: bool = False,
        icebreaker_variant: str = "short",
    ) -> int:
        import csv

        from outreach import IcebreakerContext, build_icebreaker

        rows = self.fetch_scored_sellers(
            min_score=min_score,
            tiers=tiers,
            brand_segment=brand_segment,
            foreign_used_only=foreign_used_only,
        )
        if not rows:
            return 0

        fieldnames = list(rows[0].keys())
        if with_icebreaker:
            from outreach import classify_match

            fieldnames.extend(["match_type", "icebreaker"])
            ctx = IcebreakerContext()
            for row in rows:
                row["match_type"] = classify_match(row)
                row["icebreaker"] = build_icebreaker(
                    row, variant=icebreaker_variant, ctx=ctx
                )

        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)
        return len(rows)

    def export_outreach_csv(
        self,
        path: str,
        *,
        min_score: float | None = None,
        tiers: list[str] | None = None,
        brand_segment: str | None = None,
        foreign_used_only: bool = False,
        limit: int | None = None,
        icebreaker_variant: str = "short",
        sender_name: str | None = None,
        company: str | None = None,
    ) -> int:
        """导出试点触达表：线索 + 按店铺/品牌生成的供货方破冰文案 + 回复率跟踪列。"""
        import csv

        from outreach import IcebreakerContext, build_outreach_row
        from outreach.icebreaker import OUTREACH_LEAD_FIELDS, OUTREACH_TRACKING_FIELDS

        rows = self.fetch_scored_sellers(
            min_score=min_score,
            tiers=tiers,
            brand_segment=brand_segment,
            foreign_used_only=foreign_used_only,
            limit=limit,
        )
        ctx_kwargs: dict[str, Any] = {}
        if sender_name:
            ctx_kwargs["sender_name"] = sender_name
        if company:
            ctx_kwargs["company"] = company
        ctx = IcebreakerContext(**ctx_kwargs)

        fieldnames = list(OUTREACH_LEAD_FIELDS) + ["icebreaker"] + list(OUTREACH_TRACKING_FIELDS)
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            for row in rows:
                w.writerow(build_outreach_row(row, variant=icebreaker_variant, ctx=ctx))
        return len(rows)

    def tier_summary(self) -> dict[str, int]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT tier, COUNT(*) AS n FROM seller_scores GROUP BY tier"
            ).fetchall()
        return {r["tier"]: r["n"] for r in rows}
