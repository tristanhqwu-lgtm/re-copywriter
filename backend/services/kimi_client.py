import os
from contextlib import contextmanager

from openai import OpenAI

from config import settings

_PROXY_KEYS = ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "grpc_proxy")


@contextmanager
def _no_proxy():
    """Temporarily remove proxy env vars so Kimi (domestic API) connects directly."""
    saved = {}
    for key in _PROXY_KEYS:
        if key in os.environ:
            saved[key] = os.environ.pop(key)
    try:
        yield
    finally:
        os.environ.update(saved)


def _get_client() -> OpenAI:
    return OpenAI(
        api_key=settings.KIMI_API_KEY,
        base_url="https://api.moonshot.cn/v1",
    )


def kimi_chat(
    user_prompt: str,
    system_prompt: str = "",
    timeout: int = 120,
) -> str:
    """Call Kimi (moonshot) API and return the response text."""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})

    with _no_proxy():
        client = _get_client()
        resp = client.chat.completions.create(
            model=settings.KIMI_MODEL,
            messages=messages,
            timeout=timeout,
        )
    return resp.choices[0].message.content
