import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from urllib.parse import unquote, urlparse

from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_DELAY = 2  # seconds


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
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        return ""

    hostname = (parsed.hostname or "").lower()
    if hostname in {
        "xiaohongshu.com",
        "www.xiaohongshu.com",
        "xhslink.com",
        "www.xhslink.com",
    }:
        return "xiaohongshu"
    if hostname in {"douyin.com", "www.douyin.com", "v.douyin.com"}:
        return "douyin"
    return ""


# ── Public entry point with retry ──


async def scrape_url(url: str) -> ScrapeResult:
    """Scrape with up to MAX_RETRIES retries. Empty content counts as failure."""
    platform = detect_platform(url)
    if not platform:
        raise ValueError(f"Unsupported platform URL: {url}")

    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 2):  # 1 initial + MAX_RETRIES retries
        try:
            result = await _do_scrape(url, platform)
            if result.content.strip():
                logger.info(
                    "Scrape succeeded on attempt %d for %s (%d chars)",
                    attempt, platform, len(result.content),
                )
                return result
            logger.warning(
                "Attempt %d returned empty content for %s", attempt, url
            )
            last_error = ValueError("Empty content returned")
        except Exception as exc:
            logger.warning("Attempt %d failed for %s: %s", attempt, url, exc)
            last_error = exc

        if attempt < MAX_RETRIES + 1:
            await asyncio.sleep(RETRY_DELAY)

    # All attempts exhausted — raise last error
    raise last_error or ValueError("Scrape failed with no specific error")


async def _do_scrape(url: str, platform: str) -> ScrapeResult:
    """Single scrape attempt using Playwright."""
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
            else:
                raise ValueError(f"Unknown platform: {platform}")
        finally:
            await browser.close()


# ── Common helpers ──


async def _extract_meta(page, prop: str) -> str:
    """Extract content from <meta property="..." /> or <meta name="..." />."""
    value = await page.evaluate(
        """(prop) => {
            const el = document.querySelector(
                `meta[property="${prop}"], meta[name="${prop}"]`
            );
            return el ? el.getAttribute('content') || '' : '';
        }""",
        prop,
    )
    return (value or "").strip()


def _extract_hashtags_from_content(result: ScrapeResult) -> None:
    """Parse #hashtags out of result.content and merge into result.hashtags."""
    if not result.content:
        return
    found = re.findall(r"#(\S+?)(?:\s|#|$)", result.content)
    existing = set(result.hashtags)
    for tag in found:
        full_tag = f"#{tag}"
        if full_tag not in existing:
            result.hashtags.append(full_tag)
            existing.add(full_tag)


# ── Xiaohongshu ──


def _extract_xhs_from_state(raw_json: str) -> ScrapeResult | None:
    """Try to extract note data from __INITIAL_STATE__ JSON."""
    try:
        state = json.loads(raw_json)
        # Navigate common XHS state shapes
        note_data = None
        # Shape 1: state.note.noteDetailMap.{noteId}.note
        note_map = state.get("note", {}).get("noteDetailMap", {})
        if note_map:
            first_key = next(iter(note_map))
            note_data = note_map[first_key].get("note", {})
        # Shape 2: state.note.firstNoteId -> use that key
        if not note_data:
            first_id = state.get("note", {}).get("firstNoteId", "")
            if first_id and first_id in note_map:
                note_data = note_map[first_id].get("note", {})

        if not note_data:
            return None

        title = note_data.get("title", "")
        desc = note_data.get("desc", "")
        tags = []
        for tag_item in note_data.get("tagList", []):
            name = tag_item.get("name", "")
            if name:
                tags.append(f"#{name}" if not name.startswith("#") else name)

        if title or desc:
            return ScrapeResult(
                title=title,
                content=desc,
                hashtags=tags,
                platform="xiaohongshu",
            )
    except (json.JSONDecodeError, KeyError, StopIteration):
        pass
    return None


async def _scrape_xiaohongshu(page) -> ScrapeResult:
    result = ScrapeResult(platform="xiaohongshu")

    # Layer 1: Open Graph meta tags
    og_title = await _extract_meta(page, "og:title")
    og_desc = await _extract_meta(page, "og:description")
    if og_title:
        result.title = og_title
    if og_desc:
        result.content = og_desc

    # Layer 2: __INITIAL_STATE__ SSR data
    if not result.content:
        raw_state = await page.evaluate("""() => {
            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
                const text = s.textContent || '';
                if (text.includes('__INITIAL_STATE__')) {
                    const match = text.match(/__INITIAL_STATE__\\s*=\\s*(\\{.+\\})/s);
                    if (match) return match[1].replace(/undefined/g, 'null');
                }
            }
            return '';
        }""")
        if raw_state:
            state_result = _extract_xhs_from_state(raw_state)
            if state_result:
                if not result.title and state_result.title:
                    result.title = state_result.title
                if state_result.content:
                    result.content = state_result.content
                if state_result.hashtags:
                    result.hashtags = state_result.hashtags

    # Layer 3: Expanded DOM selectors
    if not result.title:
        result.title = await page.evaluate("""() => {
            const selectors = [
                '#detail-title', '.title', '.note-title',
                '[class*="title"]', 'h1', 'h2'
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent.trim()) return el.textContent.trim();
            }
            return '';
        }""") or ""

    if not result.content:
        result.content = await page.evaluate("""() => {
            const selectors = [
                '#detail-desc', '.desc', '.note-text', '.content',
                '[class*="desc"]', '[class*="content"]',
                'article', '.note-container', '.content-container'
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.innerText.trim().length > 20) return el.innerText.trim();
            }
            // Body fallback
            return (document.body.innerText || '').substring(0, 5000);
        }""") or ""

    # Hashtags from DOM
    if not result.hashtags:
        dom_tags = await page.evaluate("""() => {
            const tags = [];
            const selectors = 'a.tag, .hashtag, a[href*="tag"], [class*="hashtag"], [class*="tag-item"]';
            document.querySelectorAll(selectors).forEach(el => {
                const t = el.textContent.trim();
                if (t) tags.push(t);
            });
            return tags;
        }""")
        result.hashtags = dom_tags or []

    _extract_hashtags_from_content(result)
    return result


# ── Douyin ──


def _extract_douyin_from_render(raw_json: str) -> ScrapeResult | None:
    """Try to extract video data from RENDER_DATA JSON (URL-encoded)."""
    try:
        decoded = unquote(raw_json)
        state = json.loads(decoded)

        # RENDER_DATA is a dict of numbered keys; search for video info
        for _key, value in state.items():
            if not isinstance(value, dict):
                continue
            # Look for aweme/video detail
            aweme = (
                value.get("aweme", {}).get("detail", {})
                or value.get("awemeDetail", {})
                or value.get("videoInfoRes", {})
            )
            if not aweme:
                continue
            desc = aweme.get("desc", "")
            if desc:
                tags = []
                for tag in aweme.get("textExtra", []):
                    name = tag.get("hashtagName", "")
                    if name:
                        tags.append(f"#{name}" if not name.startswith("#") else name)
                return ScrapeResult(
                    title=desc[:60] if len(desc) > 60 else desc,
                    content=desc,
                    hashtags=tags,
                    platform="douyin",
                )
    except (json.JSONDecodeError, KeyError):
        pass
    return None


async def _scrape_douyin(page) -> ScrapeResult:
    result = ScrapeResult(platform="douyin")

    # Layer 1: Open Graph meta tags
    og_title = await _extract_meta(page, "og:title")
    og_desc = await _extract_meta(page, "og:description")
    if og_title:
        result.title = og_title
    if og_desc:
        result.content = og_desc

    # Layer 2: RENDER_DATA SSR data
    if not result.content:
        raw_render = await page.evaluate("""() => {
            const el = document.getElementById('RENDER_DATA');
            return el ? el.textContent || '' : '';
        }""")
        if raw_render:
            render_result = _extract_douyin_from_render(raw_render)
            if render_result:
                if not result.title and render_result.title:
                    result.title = render_result.title
                if render_result.content:
                    result.content = render_result.content
                if render_result.hashtags:
                    result.hashtags = render_result.hashtags

    # Layer 3: Expanded DOM selectors
    if not result.title:
        result.title = await page.title() or ""

    if not result.content:
        result.content = await page.evaluate("""() => {
            const selectors = [
                '.video-info-detail', '.desc', '.content',
                '[data-e2e="video-desc"]',
                '[class*="desc"]', '[class*="detail"]', '[class*="caption"]',
                '.video-container', 'main', '#app'
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.innerText.trim().length > 10) return el.innerText.trim();
            }
            // Body fallback
            return (document.body.innerText || '').substring(0, 5000);
        }""") or ""

    # Hashtags from DOM
    if not result.hashtags:
        dom_tags = await page.evaluate("""() => {
            const tags = [];
            const selectors = 'a.hashtag, a[href*="hashtag"], .hashtag-item, [class*="hashtag"], [class*="tag"]';
            document.querySelectorAll(selectors).forEach(el => {
                const t = el.textContent.trim();
                if (t) tags.push(t);
            });
            return tags;
        }""")
        result.hashtags = dom_tags or []

    _extract_hashtags_from_content(result)
    return result
