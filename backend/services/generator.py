import google.generativeai as genai

from config import settings
from services.utils import parse_llm_json

genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel(
    model_name=settings.GEMINI_MODEL,
    system_instruction="你是一位顶尖的社交媒体香水文案写手，为「RE调香室」品牌服务。你的文案既能精准传达香水的嗅觉体验，又能打动读者的情感。你熟悉各社交媒体平台的内容生态，懂得如何创作高互动的种草内容。",
)

PLATFORM_CONFIGS = {
    "xiaohongshu": {
        "label": "小红书",
        "content_length": "300-500字",
        "title_length": "15-25字",
        "hint": "适合种草笔记，图文并茂，情感丰富，善用emoji和段落分隔",
    },
    "wechat_moments": {
        "label": "微信朋友圈",
        "content_length": "50-150字",
        "title_length": "10-15字",
        "hint": "简短精炼，像朋友间的分享，口语化，一两段即可，不宜过长",
    },
    "douyin": {
        "label": "抖音短文案",
        "content_length": "100-200字",
        "title_length": "10-20字",
        "hint": "节奏感强，适合短视频配文，吸引眼球，带话题标签引流",
    },
    "video_script": {
        "label": "视频脚本",
        "content_length": "500-800字",
        "title_length": "15-25字",
        "hint": "分镜头/段落结构，包含开场hook、产品展示、使用感受、总结推荐，适合口播或vlog",
    },
}

GENERATE_PROMPT = """请按照以下要求创作{count}个版本的{platform_label}香水文案。

## 平台要求
- 目标平台：{platform_label}
- 正文长度：{content_length}
- 标题长度：{title_length}
- 平台特点：{platform_hint}

## 写作风格要求
{style_section}

## 产品信息
- 产品名称：{product_name}
- 前调：{top_notes}
- 中调：{middle_notes}
- 后调：{base_notes}
- 价格：{price}
- 规格：{spec}
- 品牌故事：{brand_story}

{scene_section}

## 输出要求
请为每个版本输出以下内容，严格按照JSON数组格式：
[
  {{
    "title": "文案标题（{title_length}，必须含emoji，要吸引眼球）",
    "content": "文案正文（{content_length}，严格遵循上述风格要求，段落之间用\\n\\n分隔）",
    "hashtags": ["#话题标签1", "#话题标签2", "...（5-8个）"]
  }}
]

{count}个版本之间要有明显差异（不同的切入角度、不同的标题风格）。
只输出JSON数组，不要其他内容。"""

REFINE_PROMPT = """请根据用户反馈，在原文案基础上进行微调。

## 原文案
标题：{original_title}
正文：{original_content}

## 用户修改意见
{feedback}

## 输出要求
请输出修改后的版本，严格按照JSON格式：
{{
  "title": "修改后的标题",
  "content": "修改后的正文",
  "hashtags": ["#话题标签1", "..."]
}}

只输出JSON，不要其他内容。"""


def build_style_section(style_features, sample_texts):
    parts = []
    if style_features:
        parts.append("### 风格特征")
        if style_features.get("tone"):
            parts.append(f"- 语气调性：{style_features['tone']}")
        if style_features.get("vocabulary"):
            vocab = "、".join(style_features["vocabulary"][:10])
            parts.append(f"- 常用词汇：{vocab}")
        if style_features.get("sentence_patterns"):
            patterns = "；".join(style_features["sentence_patterns"])
            parts.append(f"- 句式特点：{patterns}")
        if style_features.get("emoji_style"):
            parts.append(f"- Emoji风格：{style_features['emoji_style']}")
        if style_features.get("structure"):
            parts.append(f"- 文章结构：{style_features['structure']}")
        if style_features.get("emotional_expression"):
            parts.append(f"- 情感表达：{style_features['emotional_expression']}")
        if style_features.get("title_style"):
            parts.append(f"- 标题风格：{style_features['title_style']}")
        if style_features.get("summary"):
            parts.append(f"\n**风格总结**：{style_features['summary']}")
    if sample_texts:
        parts.append("\n### 参考原文（模仿此风格）")
        for i, text in enumerate(sample_texts[:2], 1):
            truncated = text[:800] + "..." if len(text) > 800 else text
            parts.append(f"**样本{i}**：\n{truncated}")
    return "\n".join(parts)


def build_scene_section(scene_name, scene_desc, keywords, prompt_hint):
    if not scene_name:
        return ""
    parts = ["## 场景要求"]
    parts.append(f"- 场景：{scene_name}")
    if scene_desc:
        parts.append(f"- 描述：{scene_desc}")
    if keywords:
        parts.append(f"- 关键词：{'、'.join(keywords)}")
    if prompt_hint:
        parts.append(f"- 写作提示：{prompt_hint}")
    return "\n".join(parts)


def generate_copies(
    style_features, sample_texts, product_name, top_notes, middle_notes,
    base_notes, price, spec, brand_story, scene_name="", scene_desc="",
    scene_keywords=None, scene_prompt_hint="", count=1,
    platform="xiaohongshu",
):
    platform_cfg = PLATFORM_CONFIGS.get(platform, PLATFORM_CONFIGS["xiaohongshu"])

    style_section = build_style_section(style_features, sample_texts)
    scene_section = build_scene_section(
        scene_name, scene_desc, scene_keywords or [], scene_prompt_hint
    )
    prompt = GENERATE_PROMPT.format(
        count=count, style_section=style_section, product_name=product_name,
        top_notes=top_notes or "未指定", middle_notes=middle_notes or "未指定",
        base_notes=base_notes or "未指定", price=f"¥{price}" if price else "未指定",
        spec=spec or "未指定", brand_story=brand_story or "暂无",
        scene_section=scene_section,
        platform_label=platform_cfg["label"],
        content_length=platform_cfg["content_length"],
        title_length=platform_cfg["title_length"],
        platform_hint=platform_cfg["hint"],
    )
    response = model.generate_content(prompt)
    copies = parse_llm_json(response.text)
    if isinstance(copies, dict):
        copies = [copies]
    return copies


def refine_copy(original_title, original_content, feedback):
    prompt = REFINE_PROMPT.format(
        original_title=original_title, original_content=original_content,
        feedback=feedback,
    )
    response = model.generate_content(prompt)
    return parse_llm_json(response.text)
