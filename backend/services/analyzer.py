import os

import google.generativeai as genai

from config import settings
from services.utils import parse_llm_json

# Ensure lowercase proxy env vars are set for gRPC compatibility
for _upper, _lower in [("HTTP_PROXY", "http_proxy"), ("HTTPS_PROXY", "https_proxy")]:
    if os.environ.get(_upper) and not os.environ.get(_lower):
        os.environ[_lower] = os.environ[_upper]

genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel(model_name=settings.GEMINI_MODEL)

ANALYZE_PROMPT = """你是一位文案风格分析专家。请仔细阅读以下博主的文章，深入分析其写作风格特征。

{articles_section}

请分析并以JSON格式输出以下风格特征：
{{
  "tone": "整体语气调性描述（如：活泼俏皮、文艺清新、专业理性等）",
  "vocabulary": ["常用特征词汇1", "常用特征词汇2", "...（列出8-12个）"],
  "sentence_patterns": ["典型句式特点1", "典型句式特点2", "...（列出3-5个）"],
  "emoji_style": "emoji使用风格描述（如：大量使用、偶尔点缀、几乎不用等）",
  "structure": "文章结构特点描述（如：总分总、场景引入式、对话体等）",
  "emotional_expression": "情感表达方式描述",
  "title_style": "标题风格描述（如：疑问式、感叹式、数字列表式等）",
  "summary": "一句话总结该博主的整体文风"
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


def analyze_style(articles: list[str], model_choice: str = "gemini") -> dict:
    articles_section = build_articles_section(articles)
    prompt = ANALYZE_PROMPT.format(articles_section=articles_section)

    if model_choice == "kimi":
        from services.kimi_client import kimi_chat
        text = kimi_chat(user_prompt=prompt)
        return parse_llm_json(text)

    if model_choice == "deepseek":
        from services.deepseek_client import deepseek_chat
        text = deepseek_chat(user_prompt=prompt)
        return parse_llm_json(text)

    response = model.generate_content(prompt, request_options={"timeout": 60})
    return parse_llm_json(response.text)
