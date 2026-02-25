"""
独立抓取测试脚本 — 支持单篇、多篇、主页抓取

用法:
  # 单篇文章
  python test_scraper.py "https://v.douyin.com/xxx"
  python test_scraper.py "整段分享文本 https://v.douyin.com/xxx 后面的文字"

  # 多篇文章（多个链接）
  python test_scraper.py --multi "url1" "url2" "url3"

  # 博主主页（自动提取最新文章）
  python test_scraper.py --profile "https://www.douyin.com/user/xxx"
  python test_scraper.py --profile "https://www.xiaohongshu.com/user/profile/xxx"
"""
import asyncio
import re
import sys
import json
import argparse

sys.path.insert(0, "backend")

from services.scraper import (
    scrape_url,
    scrape_multiple,
    scrape_profile_links,
    detect_platform,
    detect_url_type,
    resolve_short_url,
)


def extract_url(text: str) -> str:
    """从分享文本中提取 URL"""
    match = re.search(r'https?://[^\s\u4e00-\u9fff]+', text)
    return match.group(0) if match else text.strip()


def print_result(result, index=None):
    prefix = f"[{index}] " if index is not None else ""
    print(f"\n{prefix}{'='*50}")
    print(f"  标题: {result.title}")
    print(f"  内容: {result.content[:150]}{'...' if len(result.content) > 150 else ''}")
    print(f"  标签: {', '.join(result.hashtags) if result.hashtags else '无'}")
    print(f"  平台: {result.platform}")
    print(f"  字数: {len(result.content)}")


async def cmd_single(raw_text: str):
    """智能抓取：自动判断单篇/主页"""
    url = extract_url(raw_text)

    print(f"原始输入: {raw_text[:80]}...")
    print(f"提取URL:  {url}")

    # 解析短链获取真实URL
    real_url = await resolve_short_url(url)
    if real_url != url:
        print(f"真实URL:  {real_url}")
        url = real_url

    platform, url_type = detect_url_type(url)
    print(f"平台:     {platform or '未识别'}")
    print(f"类型:     {url_type or '未识别'}")
    print("-" * 50)

    if url_type == "profile":
        print("🔍 检测到主页链接，自动切换到主页抓取模式...")
        await cmd_profile(url)
        return

    result = await scrape_url(url)
    print_result(result)
    print("\n完整 JSON:")
    print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))


async def cmd_multi(raw_texts: list[str]):
    """多篇批量抓取"""
    urls = [extract_url(t) for t in raw_texts]

    print(f"共 {len(urls)} 个链接:")
    for i, u in enumerate(urls, 1):
        p = detect_platform(u)
        print(f"  {i}. [{p or '?'}] {u}")
    print("-" * 50)

    def on_progress(done, total, current):
        if current != "done":
            print(f"\n⏳ [{done+1}/{total}] 正在抓取: {current[:60]}...")

    results = await scrape_multiple(urls, on_progress=on_progress)

    print(f"\n{'='*50}")
    print(f"✅ 抓取完成: {len(results)}/{len(urls)} 篇成功")
    for i, r in enumerate(results, 1):
        print_result(r, index=i)

    print(f"\n完整 JSON:")
    print(json.dumps([r.to_dict() for r in results], ensure_ascii=False, indent=2))


async def cmd_profile(raw_text: str, max_count: int = 10):
    """主页抓取 → 自动提取文章链接 → 批量抓取"""
    url = extract_url(raw_text)

    # 解析短链获取真实URL
    real_url = await resolve_short_url(url)
    if real_url != url:
        print(f"真实URL:  {real_url}")
        url = real_url

    platform, url_type = detect_url_type(url)

    print(f"提取URL:  {url}")
    print(f"平台:     {platform or '未识别'}")
    print(f"类型:     {url_type or '未识别'}")
    print("-" * 50)

    if url_type != "profile":
        print("⚠️  这不是主页链接，尝试作为单篇抓取...")
        result = await scrape_url(url)
        print_result(result)
        return

    print(f"📋 正在从主页提取文章链接 (最多{max_count}篇)...")
    links = await scrape_profile_links(url, max_count=max_count)

    if not links:
        print("❌ 未能从主页提取到文章链接")
        print("")
        if platform == "douyin":
            print("💡 抖音主页有验证码拦截，建议改用多链接模式:")
            print("   在抖音 app 里逐个分享视频，然后用 --multi 模式:")
            print("   python3 test_scraper.py --multi \"链接1\" \"链接2\" \"链接3\" ...")
        else:
            print("💡 主页可能有反爬限制，建议改用多链接模式:")
            print("   python3 test_scraper.py --multi \"链接1\" \"链接2\" \"链接3\" ...")
        return

    print(f"📋 找到 {len(links)} 篇文章:")
    for i, link in enumerate(links, 1):
        print(f"  {i}. {link}")
    print("-" * 50)

    def on_progress(done, total, current):
        if current != "done":
            print(f"\n⏳ [{done+1}/{total}] 正在抓取: {current[:60]}...")

    results = await scrape_multiple(links, on_progress=on_progress)

    print(f"\n{'='*50}")
    print(f"✅ 抓取完成: {len(results)}/{len(links)} 篇成功")
    for i, r in enumerate(results, 1):
        print_result(r, index=i)

    print(f"\n完整 JSON:")
    print(json.dumps([r.to_dict() for r in results], ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description="RE调香室 抓取测试工具")
    parser.add_argument("urls", nargs="*", help="URL 或分享文本")
    parser.add_argument("--multi", action="store_true", help="多篇批量抓取模式")
    parser.add_argument("--profile", action="store_true", help="主页自动抓取模式")
    parser.add_argument("--max", type=int, default=10, help="主页模式最大抓取篇数 (默认10)")

    args = parser.parse_args()

    if not args.urls:
        parser.print_help()
        sys.exit(1)

    if args.profile:
        asyncio.run(cmd_profile(args.urls[0], max_count=args.max))
    elif args.multi:
        asyncio.run(cmd_multi(args.urls))
    else:
        asyncio.run(cmd_single(" ".join(args.urls)))


if __name__ == "__main__":
    main()
