#!/usr/bin/env python3
"""
JiJi Nigeria Foreign Used Cars — B端车商线索抓取

用法:
  python main.py init-db                         # 初始化数据库表
  python main.py login --wait 60                 # 打开浏览器完成 Gmail 登录并保存 cookie
  python main.py scrape --max-pages 10           # 抓取并写入 SQLite
  python main.py export                          # 导出合格卖家 CSV
  python main.py score                           # 对全部卖家评分
  python main.py score --qualified-only          # 仅评初筛合格卖家
  python main.py score --export                  # 评分并导出 CSV
  python main.py score --export --tier KEY              # 只导出重点 B 端
  python main.py score --export --tier KEY,FOLLOW       # 导出重点 + 可跟进
  python main.py export-scored --tier KEY                 # 不重新评分，直接导出
  python main.py export-scored --tier FOLLOW --segment 日系
  python main.py export-scored --tier KEY --with-icebreaker
  python main.py export-outreach --tier KEY --limit 20    # 试点触达表（破冰话术+回复跟踪）
  python main.py add-contact --id 12 --whatsapp 234... --by "张三"
"""

from __future__ import annotations

import argparse
import asyncio
import os

from config import (
    DB_PATH,
    MAX_PAGES_PER_SESSION,
    OUTREACH_COMPANY,
    OUTREACH_PILOT_LIMIT,
    OUTREACH_SENDER_NAME,
    OUTPUT_DIR,
    START_URL,
)
from database import Database, init_database
from scorer import SellerScorer
from scorer.seller_scorer import VALID_TIER_CODES
from scraper.browser import BrowserSession
from scraper.listings import ListingScraper
from scraper.sellers import SellerPipeline


def _parse_tiers(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    codes = [t.strip().upper() for t in raw.split(",") if t.strip()]
    bad = [c for c in codes if c not in VALID_TIER_CODES]
    if bad:
        raise SystemExit(f"无效 tier: {bad}，可选: {', '.join(sorted(VALID_TIER_CODES))}")
    return codes


def _export_path(tiers: list[str] | None, suffix: str = "scored") -> str:
    if tiers and len(tiers) == 1:
        return os.path.join(OUTPUT_DIR, f"seller_leads_{tiers[0]}.csv")
    if tiers:
        return os.path.join(OUTPUT_DIR, f"seller_leads_{'_'.join(tiers)}.csv")
    return os.path.join(OUTPUT_DIR, f"seller_leads_{suffix}.csv")


def _do_export_scored(db: Database, args: argparse.Namespace) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    tiers = _parse_tiers(getattr(args, "tier", None))
    path = getattr(args, "output", None) or _export_path(tiers)
    n = db.export_scored_csv(
        path,
        min_score=getattr(args, "min_score", None),
        tiers=tiers,
        brand_segment=getattr(args, "segment", None),
        foreign_used_only=getattr(args, "foreign_used_only", False),
        with_icebreaker=getattr(args, "with_icebreaker", False),
        icebreaker_variant=getattr(args, "variant", "short"),
    )
    if n == 0:
        print("无匹配记录。请先运行 score，或放宽 --tier / --segment 条件。")
    else:
        print(f"已导出 {n} 条 → {path}")


def cmd_init_db(_args: argparse.Namespace) -> None:
    path = init_database()
    print(f"数据库已初始化: {path}")
    print("表: scrape_runs, seller_leads, seller_listings, seller_scores")


async def cmd_login(args: argparse.Namespace) -> None:
    async with BrowserSession(headless=False) as session:
        await session.ensure_ready(login_wait_sec=args.wait)
        print(f"登录态已保存: data/jiji_storage_state.json")
        print("后续 scrape 将自动复用该 cookie。")


async def cmd_scrape(args: argparse.Namespace) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    db = Database(args.db)
    run_id = db.start_run(args.url or START_URL)

    try:
        async with BrowserSession(headless=args.headless) as session:
            if not args.skip_login_check:
                await session.ensure_ready(login_wait_sec=0)

            scraper = ListingScraper(session, start_url=args.url or START_URL)
            print(f"[1/3] 抓取列表 (max_pages={args.max_pages}) ...")
            listings = await scraper.scrape(
                max_pages=args.max_pages,
                max_items=args.max_items,
            )
            print(f"      listings: {len(listings)}, pages: {scraper.pages_scraped}")

            pipeline = SellerPipeline(session)
            print("[2/3] 聚合卖家 + 规则过滤 ...")
            records = await pipeline.build_records(listings, fetch_shop_details=not args.skip_shop)

            qualified = [r for r in records if r["is_qualified"]]
            print(f"      卖家总数: {len(records)}, 初筛合格: {len(qualified)}")

            print("[3/3] 写入数据库 ...")
            for rec in records:
                listings_detail = rec.pop("_listings_detail", [])
                seller_id = db.upsert_seller(rec, run_id)
                if listings_detail:
                    db.upsert_listings(seller_id, listings_detail, run_id)

            db.finish_run(
                run_id,
                pages=scraper.pages_scraped,
                listings=len(listings),
                sellers=len(qualified),
            )

        csv_path = os.path.join(OUTPUT_DIR, "seller_leads_qualified.csv")
        n = db.export_qualified_csv(csv_path)
        print(f"完成。合格卖家 {len(qualified)} 家 → DB: {args.db}")
        if n:
            print(f"CSV 导出: {csv_path}")

    except Exception as e:
        db.finish_run(run_id, pages=0, listings=0, sellers=0, status="failed", notes=str(e))
        raise


def cmd_export(args: argparse.Namespace) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, args.output or "seller_leads_qualified.csv")
    n = Database(args.db).export_qualified_csv(path)
    print(f"导出 {n} 条 → {path}")


def cmd_add_contact(args: argparse.Namespace) -> None:
    db = Database(args.db)
    db.set_manual_contact(
        args.id,
        whatsapp=args.whatsapp,
        phone=args.phone,
        email=args.email,
        notes=args.notes,
        added_by=args.by,
    )
    print(f"已更新 seller_leads.id={args.id} 的人工联络信息")


def cmd_score(args: argparse.Namespace) -> None:
    db = Database(args.db)
    scorer = SellerScorer()
    sellers = db.fetch_sellers_for_scoring(qualified_only=args.qualified_only)

    if not sellers:
        print("数据库中无卖家记录，请先运行 scrape")
        return

    tiers = {"KEY": 0, "FOLLOW": 0, "WATCH": 0, "LOW": 0}
    print(f"评分中: {len(sellers)} 家卖家 ...")

    for seller in sellers:
        listings = db.fetch_listings_for_seller(seller["id"])
        result = scorer.score(seller, listings)
        db.save_score(seller["id"], result)
        tiers[result.tier_code] = tiers.get(result.tier_code, 0) + 1

    print("评分完成:")
    print(f"  重点 B 端 (≥70):  {tiers.get('KEY', 0)}")
    print(f"  可跟进 (50-69):   {tiers.get('FOLLOW', 0)}")
    print(f"  观察 (30-49):     {tiers.get('WATCH', 0)}")
    print(f"  低优先级 (<30):   {tiers.get('LOW', 0)}")

    if args.export:
        _do_export_scored(db, args)


def cmd_export_scored(args: argparse.Namespace) -> None:
    _do_export_scored(Database(args.db), args)


def cmd_export_outreach(args: argparse.Namespace) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    tiers = _parse_tiers(args.tier) or ["KEY"]
    path = args.output or os.path.join(OUTPUT_DIR, "outreach_pilot_KEY.csv")
    n = Database(args.db).export_outreach_csv(
        path,
        min_score=args.min_score,
        tiers=tiers,
        brand_segment=args.segment,
        foreign_used_only=args.foreign_used_only,
        limit=args.limit,
        icebreaker_variant=args.variant,
        sender_name=args.sender,
        company=args.company,
    )
    if n == 0:
        print("无匹配 KEY/评分记录。已写出表头模板，请先 scrape + score 后再导出。")
        print(f"模板 → {path}")
        print("试点建议：同一套 short 话术连发 10–20 家，填 outreach_status / replied_at 统计回复率。")
        return
    print(f"已导出 {n} 条试点触达表 → {path}")
    print("请用同一套 short 话术联系，并回填 outreach_status / sent_at / replied_at。")


def main() -> None:
    parser = argparse.ArgumentParser(description="JiJi Foreign Used B端车商线索")
    parser.add_argument("--db", default=DB_PATH)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init-db", help="创建数据库表")

    p_login = sub.add_parser("login", help="浏览器登录并保存 cookie")
    p_login.add_argument("--wait", type=int, default=90, help="等待手动登录秒数")

    p_scrape = sub.add_parser("scrape", help="抓取并入库")
    p_scrape.add_argument("--url", default=None)
    p_scrape.add_argument("--max-pages", type=int, default=MAX_PAGES_PER_SESSION)
    p_scrape.add_argument("--max-items", type=int, default=800)
    p_scrape.add_argument("--headless", action="store_true", help="不推荐，易触发 CF")
    p_scrape.add_argument("--skip-shop", action="store_true", help="跳过店铺详情请求")
    p_scrape.add_argument("--skip-login-check", action="store_true")

    p_export = sub.add_parser("export", help="导出合格卖家 CSV")
    p_export.add_argument("--output", default=None)

    p_contact = sub.add_parser("add-contact", help="评分后人工添加联络方式")
    p_contact.add_argument("--id", type=int, required=True, help="seller_leads.id")
    p_contact.add_argument("--whatsapp", default=None)
    p_contact.add_argument("--phone", default=None)
    p_contact.add_argument("--email", default=None)
    p_contact.add_argument("--notes", default=None)
    p_contact.add_argument("--by", default=None, help="录入人")

    p_score = sub.add_parser("score", help="B端卖家评分")
    p_score.add_argument("--qualified-only", action="store_true", help="仅评 is_qualified=1")
    p_score.add_argument("--export", action="store_true", help="导出评分结果 CSV")
    p_score.add_argument("--min-score", type=float, default=None, help="导出最低分过滤")
    p_score.add_argument(
        "--tier",
        default=None,
        help="按等级导出: KEY / FOLLOW / WATCH / LOW，逗号分隔",
    )
    p_score.add_argument("--segment", default=None, help="画像筛选: 日系/德系/韩系/豪华车")
    p_score.add_argument("--foreign-used-only", action="store_true", help="仅 Foreign Used 专注卖家")
    p_score.add_argument("--with-icebreaker", action="store_true", help="导出时附加供货方破冰话术列")
    p_score.add_argument(
        "--variant",
        default="short",
        choices=["short", "full", "qualify"],
        help="破冰话术版本",
    )

    p_export_scored = sub.add_parser("export-scored", help="导出已评分卖家（不重新评分）")
    p_export_scored.add_argument("--output", default=None)
    p_export_scored.add_argument("--min-score", type=float, default=None)
    p_export_scored.add_argument("--tier", default=None)
    p_export_scored.add_argument("--segment", default=None)
    p_export_scored.add_argument("--foreign-used-only", action="store_true")
    p_export_scored.add_argument("--with-icebreaker", action="store_true", help="附加供货方破冰话术列")
    p_export_scored.add_argument(
        "--variant",
        default="short",
        choices=["short", "full", "qualify"],
        help="破冰话术版本",
    )

    p_outreach = sub.add_parser("export-outreach", help="导出试点触达表（破冰话术 + 回复率跟踪）")
    p_outreach.add_argument("--output", default=None)
    p_outreach.add_argument("--min-score", type=float, default=None)
    p_outreach.add_argument("--tier", default="KEY", help="默认 KEY，优先职业车商")
    p_outreach.add_argument("--segment", default=None)
    p_outreach.add_argument("--foreign-used-only", action="store_true")
    p_outreach.add_argument("--limit", type=int, default=OUTREACH_PILOT_LIMIT)
    p_outreach.add_argument(
        "--variant",
        default="short",
        choices=["short", "full", "qualify"],
        help="破冰话术版本，试点建议 short",
    )
    p_outreach.add_argument("--sender", default=OUTREACH_SENDER_NAME, help="发信人英文名")
    p_outreach.add_argument("--company", default=OUTREACH_COMPANY, help="公司/平台名")

    args = parser.parse_args()

    if args.command == "init-db":
        cmd_init_db(args)
    elif args.command == "login":
        asyncio.run(cmd_login(args))
    elif args.command == "scrape":
        asyncio.run(cmd_scrape(args))
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "add-contact":
        cmd_add_contact(args)
    elif args.command == "score":
        cmd_score(args)
    elif args.command == "export-scored":
        cmd_export_scored(args)
    elif args.command == "export-outreach":
        cmd_export_outreach(args)


if __name__ == "__main__":
    main()
