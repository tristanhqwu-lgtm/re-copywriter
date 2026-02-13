import anthropic

from config import settings
from services.utils import parse_llm_json

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

ANALYZE_PROMPT = """你是一位专业的社交媒体内容分析师。请仔细分析以下博主文章，提取其写作风格特征。

{articles_section}

请用JSON格式输出分析结果，包含以下字段：
{{
  "tone": "语气调性描述（如：活泼俏皮/优雅知性/专业理性/文艺清新等）",
  "vocabulary": ["该博主常用的特色词汇/口头禅，列出5-10个"],
  "sentence_patterns": ["句式特点描述，如：短句为主、多用感叹号、反问句多等，列出3-5个"],
  "emoji_style": "emoji使用风格描述（频率、偏好的emoji类型）",
  "structure": "文章整体结构特点（如：开头hook+中间体验+结尾推荐）",
  "emotional_expression": "情感表达方式（如：感性热情/理性克制/幽默风趣）",
  "title_style": "标题写作风格（如：疑问句式、数字开头、emoji开头等）",
  "paragraph_style": "分段和排版特点",
  "summary": "用2-3句话总结这位博主的整体写作风格，要具体到足以让人模仿"
}}

只输出JSON，不要其他内容。"""


def build_articles_section(articles: list[str]) -> str:
    if len(articles) == 1:
        return f"以下是博主的一篇文章：\n\n{articles[0]}"
    sections = []
    for i, article in enumerate(articles, 1):
        sections.append(f"--- 文章 {i} ---\n{article}")
    return (
        f"以下是同一博主的{len(articles)}篇文章，请综合分析其共性风格特征：\n\n"
        + "\n\n".join(sections)
    )


def analyze_style(articles: list[str]) -> dict:
    articles_section = build_articles_section(articles)
    prompt = ANALYZE_PROMPT.format(articles_section=articles_section)

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    return parse_llm_json(response.content[0].text)
