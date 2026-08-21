"""列表页抓取：优先页面自然加载，减少主动 API 调用"""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from config import LISTING_API, MAX_ITEMS_PER_RUN, MAX_PAGES_PER_SESSION, START_URL
from scraper.browser import BrowserSession, human_delay, page_delay


def _listing_params(start_url: str, page: int) -> dict:
    qs = parse_qs(urlparse(start_url).query)
    flat = {k: v[0] for k, v in qs.items()}
    flat.update({
        "slug": "cars",
        "init_page": "true" if page == 1 else "false",
        "page": str(page),
        "webp": "true",
    })
    return flat


def _normalize(payload: Any) -> list[dict]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("results", "items", "listings", "ads", "data"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


class ListingScraper:
    def __init__(self, session: BrowserSession, start_url: str = START_URL):
        self.session = session
        self.start_url = start_url
        self.pages_scraped = 0

    def _page_url(self, page: int) -> str:
        parsed = urlparse(self.start_url)
        qs = parse_qs(parsed.query)
        qs["page"] = [str(page)]
        return urlunparse(parsed._replace(query=urlencode({k: v[0] for k, v in qs.items()})))

    async def scrape(
        self,
        max_pages: int = MAX_PAGES_PER_SESSION,
        max_items: int = MAX_ITEMS_PER_RUN,
    ) -> list[dict]:
        all_listings: list[dict] = []

        for page_num in range(1, max_pages + 1):
            page_url = self._page_url(page_num)

            # 策略：先让页面自然加载（触发已登录 session 的 API）
            captured = await self.session.navigate_and_capture(page_url, LISTING_API)
            batch = _normalize(captured) if captured else []

            if not batch:
                try:
                    data = await self.session.fetch_json(LISTING_API, _listing_params(self.start_url, page_num))
                    batch = _normalize(data)
                except RuntimeError:
                    break

            if not batch:
                break

            all_listings.extend(batch)
            self.pages_scraped += 1

            if len(all_listings) >= max_items:
                all_listings = all_listings[:max_items]
                break

            if page_num < max_pages:
                await page_delay()

        return all_listings
