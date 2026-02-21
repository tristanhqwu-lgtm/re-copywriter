import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Optional, Callable, Tuple, List
from urllib.parse import unquote, urlparse

from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_DELAY = 2  # seconds


@dataclass
class ScrapeResult:
    title: str = ""
    content: str = ""
    hashtags: List[str] = field(default_factory=list)
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


def detect_url_type(url: str) -> Tuple[str, str]:
    """Detect platform and whether URL is a profile or article.

    Returns:
        ("xiaohongshu", "profile") / ("douyin", "article") / ("", "")
    """
    platform = detect_platform(url)
    if not platform:
        return ("", "")

    parsed = urlparse(url)
    path = parsed.path.rstrip("/")

    if platform == "xiaohongshu":
        # Profile: /user/profile/xxx
        if "/user/profile/" in path:
            return ("xiaohongshu", "profile")
        return ("xiaohongshu", "article")

    if platform == "douyin":
        # Profile: /user/xxx (but NOT /video/xxx)
        if re.match(r"^/user/", path) and "/video/" not in path:
            return ("douyin", "profile")
        return ("douyin", "article")

    return (platform, "article")


# ── Public entry points ──


async def resolve_short_url(url: str) -> str:
    """Follow redirects on a short URL (e.g. v.douyin.com) to get the real URL."""
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()

    # Only resolve known short-link domains
    if hostname not in {"v.douyin.com", "xhslink.com", "www.xhslink.com"}:
        return url

    logger.info("Resolving short URL: %s", url)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context()
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(2000)
            real_url = page.url
            logger.info("Resolved to: %s", real_url)
            return real_url
        finally:
            await browser.close()


async def scrape_profile_links(url: str, max_count: int = 10) -> List[str]:
    """Scrape a profile page and return article/video URLs."""
    platform, url_type = detect_url_type(url)
    if not platform:
        raise ValueError(f"Unsupported platform URL: {url}")
    if url_type != "profile":
        raise ValueError(f"Not a profile URL: {url}")

    logger.info("Scraping profile links from %s (%s)", url, platform)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = await context.new_page()
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)

            # Scroll down to load more content
            for _ in range(3):
                await page.evaluate("window.scrollBy(0, 800)")
                await page.wait_for_timeout(1500)

            if platform == "xiaohongshu":
                links = await _extract_xhs_profile_links(page)
            elif platform == "douyin":
                links = await _extract_douyin_profile_links(page)
            else:
                links = []

            # Deduplicate while preserving order
            seen = set()
            unique = []
            for link in links:
                if link not in seen:
                    seen.add(link)
                    unique.append(link)

            result = unique[:max_count]
            logger.info("Found %d article links from profile", len(result))
            return result
        finally:
            await browser.close()


async def _extract_xhs_profile_links(page) -> List[str]:
    """Extract note links from a Xiaohongshu profile page."""
    return await page.evaluate("""() => {
        const links = [];
        // Try multiple selectors for note links on profile
        const selectors = [
            'a[href*="/explore/"]',
            'a[href*="/note/"]',
            'a[href*="/discovery/item/"]',
            'section a[href]',
        ];
        for (const sel of selectors) {
            document.querySelectorAll(sel).forEach(el => {
                const href = el.href || el.getAttribute('href') || '';
                if (href && (href.includes('/explore/') || href.includes('/note/') || href.includes('/discovery/'))) {
                    // Normalize to full URL
                    const full = href.startsWith('http') ? href : 'https://www.xiaohongshu.com' + href;
                    links.push(full);
                }
            });
            if (links.length > 0) break;
        }
        return links;
    }""")


async def _extract_douyin_profile_links(page) -> List[str]:
    """Extract video links from a Douyin profile page."""
    return await page.evaluate("""() => {
        const links = [];
        // Try multiple selectors for video links on profile
        const selectors = [
            'a[href*="/video/"]',
            'a[href*="/note/"]',
            'li a[href]',
            '[data-e2e="user-post-list"] a[href]',
        ];
        for (const sel of selectors) {
            document.querySelectorAll(sel).forEach(el => {
                const href = el.href || el.getAttribute('href') || '';
                if (href && (href.includes('/video/') || href.includes('/note/'))) {
                    const full = href.startsWith('http') ? href : 'https://www.douyin.com' + href;
                    links.push(full);
                }
            });
            if (links.length > 0) break;
        }
        return links;
    }""")


async def scrape_multiple(
    urls: List[str],
    on_progress: Optional[Callable] = None,
) -> List[ScrapeResult]:
    """Scrape multiple URLs using a shared browser instance.

    Args:
        urls: List of article/video URLs to scrape.
        on_progress: Optional callback(completed, total, current_url) for progress.

    Returns:
        List of successful ScrapeResult objects. Failed URLs are skipped.
    """
    if not urls:
        return []

    results: List[ScrapeResult] = []
    total = len(urls)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for i, url in enumerate(urls):
                platform = detect_platform(url)
                if not platform:
                    logger.warning("Skipping unsupported URL: %s", url)
                    continue

                if on_progress:
                    on_progress(i, total, url)

                context = await browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                        "Version/16.0 Mobile/15E148 Safari/604.1"
                    ),
                    viewport={"width": 390, "height": 844},
                )
                try:
                    page = await context.new_page()
                    await page.goto(url, wait_until="networkidle", timeout=30000)
                    await page.wait_for_timeout(3000)

                    if platform == "xiaohongshu":
                        result = await _scrape_xiaohongshu(page)
                    elif platform == "douyin":
                        result = await _scrape_douyin(page)
                    else:
                        continue

                    if result.content.strip():
                        results.append(result)
                        logger.info(
                            "[%d/%d] ✅ %s (%d chars)",
                            i + 1, total, result.title[:30], len(result.content),
                        )
                    else:
                        logger.warning("[%d/%d] ⚠️ Empty content: %s", i + 1, total, url)

                except Exception as exc:
                    logger.warning("[%d/%d] ❌ Failed %s: %s", i + 1, total, url, exc)
                finally:
                    await context.close()

                # Small delay between requests to be polite
                if i < total - 1:
                    await asyncio.sleep(1)

        finally:
            await browser.close()

    if on_progress:
        on_progress(total, total, "done")

    logger.info("Batch scrape complete: %d/%d succeeded", len(results), total)
    return results


async def scrape_url(url: str) -> ScrapeResult:
    """Scrape with up to MAX_RETRIES retries. Empty content counts as failure."""
    platform = detect_platform(url)
    if not platform:
        raise ValueError(f"Unsupported platform URL: {url}")

    last_error: Optional[Exception] = None
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


def _extract_xhs_from_state(raw_json: str) -> Optional[ScrapeResult]:
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


def _extract_douyin_from_render(raw_json: str) -> Optional[ScrapeResult]:
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
