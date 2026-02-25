import os
from contextlib import contextmanager

from openai import OpenAI

from config import settings

_PROXY_KEYS = ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "grpc_proxy")


@contextmanager
def _no_proxy():
    """Temporarily remove proxy env vars so DeepSeek (domestic API) connects directly."""
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
        api_key=settings.DEEPSEEK_API_KEY,
        base_url="https://api.deepseek.com",
    )


def deepseek_chat(
    user_prompt: str,
    system_prompt: str = "",
    timeout: int = 120,
) -> str:
    """Call DeepSeek API and return the response text."""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})

    with _no_proxy():
        client = _get_client()
        resp = client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,
            messages=messages,
            timeout=timeout,
        )
    return resp.choices[0].message.content
