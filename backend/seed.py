from database import SessionLocal
from models import SceneTemplate


BUILTIN_SCENES = [
    {
        "name": "情人节",
        "type": "festival",
        "description": "2月14日情人节，浪漫告白、情侣礼物推荐场景",
        "keywords": ["情人节", "浪漫", "告白", "爱情", "礼物", "约会"],
        "prompt_hint": "以情人节浪漫氛围为背景，强调香水作为爱情信物的意义，营造甜蜜心动的感觉",
    },
    {
        "name": "七夕",
        "type": "festival",
        "description": "中国传统情人节，牛郎织女的浪漫传说",
        "keywords": ["七夕", "鹊桥", "浪漫", "中式浪漫", "告白", "爱情"],
        "prompt_hint": "融入中式浪漫元素，以七夕为背景，体现含蓄优雅的东方爱情观",
    },
    {
        "name": "520",
        "type": "festival",
        "description": "网络情人节，谐音我爱你",
        "keywords": ["520", "我爱你", "表白", "甜蜜", "恋爱"],
        "prompt_hint": "以520谐音我爱你为灵感，语气甜蜜活泼，适合年轻情侣",
    },
    {
        "name": "圣诞节",
        "type": "festival",
        "description": "12月25日圣诞节，温馨节日氛围，礼物交换",
        "keywords": ["圣诞", "礼物", "温馨", "冬日", "浪漫", "节日"],
        "prompt_hint": "营造圣诞温馨氛围，强调节日仪式感和送礼场景",
    },
    {
        "name": "母亲节",
        "type": "festival",
        "description": "感恩母亲，送礼表达爱意",
        "keywords": ["母亲节", "感恩", "妈妈", "温柔", "优雅", "礼物"],
        "prompt_hint": "以感恩母亲为主题，语气温柔有情感，强调优雅成熟的香气",
    },
    {
        "name": "新年/春节",
        "type": "festival",
        "description": "农历新年，辞旧迎新，新年新气象",
        "keywords": ["新年", "春节", "焕新", "好运", "开运", "红色"],
        "prompt_hint": "以新年焕新为主题，积极向上，可融入中国红、好运等元素",
    },
    {
        "name": "38女神节",
        "type": "festival",
        "description": "三八妇女节/女神节，女性力量与自我宠爱",
        "keywords": ["女神节", "女性力量", "宠爱自己", "独立", "优雅"],
        "prompt_hint": "以女性独立自信为主题，强调宠爱自己，展现女性魅力",
    },
    {
        "name": "约会",
        "type": "scene",
        "description": "约会场景，初次见面或浪漫约会",
        "keywords": ["约会", "心动", "初见", "浪漫", "吸引力"],
        "prompt_hint": "以约会场景切入，强调香水带来的吸引力和自信感，描述令人心动的嗅觉印象",
    },
    {
        "name": "职场",
        "type": "scene",
        "description": "办公室/商务场景，专业干练的形象",
        "keywords": ["职场", "办公室", "专业", "干练", "高级感", "通勤"],
        "prompt_hint": "以职场形象为切入点，强调专业感和高级感，适度留香不张扬",
    },
    {
        "name": "送礼",
        "type": "scene",
        "description": "礼物推荐场景，送朋友/闺蜜/伴侣",
        "keywords": ["送礼", "礼物", "闺蜜", "伴侣", "惊喜", "仪式感"],
        "prompt_hint": "以送礼推荐的角度写，强调包装精美、仪式感、适合不同对象",
    },
    {
        "name": "夏日清爽",
        "type": "scene",
        "description": "夏天适用的清新香气，降温消暑",
        "keywords": ["夏天", "清爽", "清新", "降温", "海洋", "柑橘"],
        "prompt_hint": "以炎热夏天为背景，强调香水的清新凉爽感，营造清风拂面的意境",
    },
    {
        "name": "冬日温暖",
        "type": "scene",
        "description": "冬天适用的温暖香气，温暖治愈",
        "keywords": ["冬天", "温暖", "治愈", "木质", "甜暖", "拥抱"],
        "prompt_hint": "以冬日寒冷为背景，强调香水的温暖包裹感，营造被拥抱的治愈感",
    },
    {
        "name": "日常种草",
        "type": "scene",
        "description": "日常好物推荐，种草安利风格",
        "keywords": ["种草", "好物", "推荐", "回购", "必入", "安利"],
        "prompt_hint": "以日常好物分享的口吻，真实自然，强调使用感受和性价比",
    },
    {
        "name": "专业测评",
        "type": "scene",
        "description": "专业角度的香水测评，详细分析香调",
        "keywords": ["测评", "香调", "留香", "扩散", "性价比", "对比"],
        "prompt_hint": "以专业测评角度写，详细描述前中后调变化、留香时间、扩散力等",
    },
]


def seed_scenes():
    db = SessionLocal()
    try:
        existing = db.query(SceneTemplate).filter(
            SceneTemplate.is_builtin == True
        ).count()
        if existing > 0:
            print(f"Built-in scenes already exist ({existing}), skipping seed.")
            return
        for data in BUILTIN_SCENES:
            scene = SceneTemplate(**data, is_builtin=True)
            db.add(scene)
        db.commit()
        print(f"Seeded {len(BUILTIN_SCENES)} built-in scenes.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_scenes()
