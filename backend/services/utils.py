import json
from typing import Any


def parse_llm_json(text: str) -> Any:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    if cleaned.startswith("json"):
        cleaned = cleaned[4:]
    return json.loads(cleaned.strip())
