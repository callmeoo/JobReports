"""Playwright 会话：登录态持久化 + 反爬策略"""

from __future__ import annotations

import asyncio
import os
import random
from typing import Any

from playwright.async_api import BrowserContext, Page, async_playwright

from config import (
    BASE_URL,
    BROWSER_STATE_DIR,
    BROWSER_STATE_FILE,
    PAGE_DELAY_MAX_SEC,
    PAGE_DELAY_MIN_SEC,
    REQUEST_DELAY_MAX_SEC,
    REQUEST_DELAY_MIN_SEC,
    USER_DATA_DIR,
)


async def human_delay(min_sec: float | None = None, max_sec: float | None = None) -> None:
    lo = min_sec if min_sec is not None else REQUEST_DELAY_MIN_SEC
    hi = max_sec if max_sec is not None else REQUEST_DELAY_MAX_SEC
    await asyncio.sleep(random.uniform(lo, hi))


async def page_delay() -> None:
    await human_delay(PAGE_DELAY_MIN_SEC, PAGE_DELAY_MAX_SEC)


class BrowserSession:
    """
    反爬策略：
    1. persistent context 复用 Gmail 登录 cookie
    2. 非 headless + 关闭 automation 特征
    3. 随机延迟 + 页面间长暂停
    4. 优先拦截页面自然触发的 API，减少主动 fetch 频率
    5. 模拟滚动触发懒加载
    """

    def __init__(self, headless: bool = False):
        self.headless = headless
        self._pw = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None
        self._api_cache: dict[str, Any] = {}
        self._request_count = 0

    async def __aenter__(self) -> "BrowserSession":
        os.makedirs(BROWSER_STATE_DIR, exist_ok=True)
        os.makedirs(USER_DATA_DIR, exist_ok=True)

        self._pw = await async_playwright().start()

        storage = BROWSER_STATE_FILE if os.path.exists(BROWSER_STATE_FILE) else None

        self.context = await self._pw.chromium.launch_persistent_context(
            USER_DATA_DIR,
            headless=self.headless,
            locale="en-NG",
            viewport={"width": 1366, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
            storage_state=storage,
            slow_mo=random.randint(50, 150),
        )

        await self.context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )

        self.page = self.context.pages[0] if self.context.pages else await self.context.new_page()
        self.page.on("response", self._on_response)
        return self

    async def __aexit__(self, *args) -> None:
        await self.save_state()
        if self.context:
            await self.context.close()
        if self._pw:
            await self._pw.stop()

    async def save_state(self) -> None:
        if self.context:
            await self.context.storage_state(path=BROWSER_STATE_FILE)

    def _on_response(self, response) -> None:
        url = response.url
        if "/api_web/v1/" not in url or response.status != 200:
            return
        if "json" not in response.headers.get("content-type", ""):
            return

        async def _read():
            try:
                self._api_cache[url] = await response.json()
            except Exception:
                pass

        asyncio.create_task(_read())

    async def ensure_ready(self, login_wait_sec: int = 0) -> None:
        """打开首页，等待 CF / 登录完成"""
        assert self.page
        await self.page.goto(BASE_URL, wait_until="domcontentloaded", timeout=120000)

        for _ in range(40):
            title = (await self.page.title()).lower()
            if "just a moment" not in title:
                break
            await asyncio.sleep(2)

        if login_wait_sec > 0:
            print(f"  请在浏览器中确认 Gmail 登录状态，等待 {login_wait_sec}s ...")
            await asyncio.sleep(login_wait_sec)

        await self.save_state()
        await human_delay(1, 2)

    async def human_scroll(self) -> None:
        assert self.page
        for _ in range(random.randint(2, 4)):
            await self.page.mouse.wheel(0, random.randint(300, 700))
            await human_delay(0.5, 1.5)

    async def fetch_json(self, path: str, params: dict | None = None) -> Any:
        assert self.page
        from urllib.parse import urlencode

        qs = "?" + urlencode(params) if params else ""
        url = f"{BASE_URL}{path}{qs}"

        if url in self._api_cache:
            return self._api_cache[url]

        self._request_count += 1
        if self._request_count % 15 == 0:
            await human_delay(5, 12)

        result = await self.page.evaluate(
            """async (url) => {
                const r = await fetch(url, {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include',
                });
                if (!r.ok) return { __error: r.status };
                return await r.json();
            }""",
            url,
        )
        if isinstance(result, dict) and "__error" in result:
            raise RuntimeError(f"API {path} HTTP {result['__error']}")

        self._api_cache[url] = result
        await human_delay()
        return result

    async def navigate_and_capture(self, url: str, api_fragment: str) -> Any | None:
        assert self.page
        await self.page.goto(url, wait_until="domcontentloaded", timeout=120000)
        await self.human_scroll()
        await page_delay()
        return self.pop_cached(api_fragment)

    def pop_cached(self, fragment: str) -> Any | None:
        for url, data in self._api_cache.items():
            if fragment in url:
                return data
        return None
