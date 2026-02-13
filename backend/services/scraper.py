import re
from dataclasses import dataclass, field

from playwright.async_api import async_playwright


@dataclass
class ScrapeResult:
    title: str = ""
    content: str = ""
    hashtags: list[str] = field(default_factory=list)
    platform: str = ""

    def to_dict(self):
        return {
            "title": self.title,
            "content": self.content,
            "hashtags": self.hashtags,
            "platform": self.platform,
        }


def detect_platform(url: str) -> str:
    url_lower = url.lower()
    if "xiaohongshu.com" in url_lower or "xhslink.com" in url_lower:
        return "xiaohongshu"
    if "douyin.com" in url_lower:
        return "douyin"
    return ""


async def scrape_url(url: str) -> ScrapeResult:
    platform = detect_platform(url)
    if not platform:
        raise ValueError(f"Unsupported platform URL: {url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                    "Version/16.0 Mobile/15E148 Safari/604.1"
                ),
                viewport={"width": 390, "height": 844},
            )
            page = await context.new_page()
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)

            if platform == "xiaohongshu":
                return await _scrape_xiaohongshu(page)
            elif platform == "douyin":
                return await _scrape_douyin(page)
        finally:
            await browser.close()


async def _scrape_xiaohongshu(page) -> ScrapeResult:
    result = ScrapeResult(platform="xiaohongshu")

    title_el = await page.query_selector("#detail-title, .title, .note-title")
    if title_el:
        result.title = (await title_el.text_content() or "").strip()

    content_el = await page.query_selector(
        "#detail-desc, .desc, .note-text, .content"
    )
    if content_el:
        result.content = (await content_el.text_content() or "").strip()

    if not result.content:
        body_text = await page.evaluate("""
            () => {
                const el = document.querySelector('article') ||
                           document.querySelector('.note-container') ||
                           document.querySelector('.content-container');
                return el ? el.innerText : document.body.innerText;
            }
        """)
        result.content = body_text.strip()[:5000]

    hashtag_els = await page.query_selector_all("a.tag, .hashtag, a[href*='tag']")
    for el in hashtag_els:
        tag_text = (await el.text_content() or "").strip()
        if tag_text:
            result.hashtags.append(tag_text)

    if result.content:
        found = re.findall(r"#(\S+?)(?:\s|#|$)", result.content)
        for tag in found:
            full_tag = f"#{tag}"
            if full_tag not in result.hashtags:
                result.hashtags.append(full_tag)

    return result


async def _scrape_douyin(page) -> ScrapeResult:
    result = ScrapeResult(platform="douyin")

    desc_el = await page.query_selector(
        ".video-info-detail, .desc, .content, [data-e2e='video-desc']"
    )
    if desc_el:
        result.content = (await desc_el.text_content() or "").strip()

    if not result.content:
        body_text = await page.evaluate("""
            () => {
                const el = document.querySelector('.video-container') ||
                           document.querySelector('main') ||
                           document.querySelector('#app');
                return el ? el.innerText : document.body.innerText;
            }
        """)
        result.content = body_text.strip()[:5000]

    result.title = await page.title()

    hashtag_els = await page.query_selector_all(
        "a.hashtag, a[href*='hashtag'], .hashtag-item"
    )
    for el in hashtag_els:
        tag_text = (await el.text_content() or "").strip()
        if tag_text:
            result.hashtags.append(tag_text)

    if result.content:
        found = re.findall(r"#(\S+?)(?:\s|#|$)", result.content)
        for tag in found:
            full_tag = f"#{tag}"
            if full_tag not in result.hashtags:
                result.hashtags.append(full_tag)

    return result
