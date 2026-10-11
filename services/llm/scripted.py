"""Deterministic local provider for end-to-end tests (`LLM_PROVIDER=scripted`, local DB only).

It reads the escaped findings block of the `ask` prompt and answers about the top finding, plus
one deliberately uncited figure, so the UI path (citations, dropped sentences, refusal) can be
tested without a model. It is not a model and is never used outside the local stack.
"""

import json
import re

from services.llm.gateway import Completion

TOP = re.compile(r"\[(F1)\] type=[^;]*; item=([^;]*); supplier=[^;]*; saving_kzt=([\d.]+)")
OUT_OF_SCOPE = re.compile(r"(?i)weather|погод|ауа райы")


class ScriptedProvider:
    def complete(self, *, model: str, prompt: str, max_tokens: int, timeout_s: float) -> Completion:
        question = prompt.split('<data name="question">')[-1]
        top = TOP.search(prompt)
        if OUT_OF_SCOPE.search(question) or not top:
            reply: dict[str, object] = {"answerable": False, "sentences": []}
        else:
            ref, item, saving = top.groups()
            reply = {
                "answerable": True,
                "sentences": [
                    {
                        "text": f"The largest finding is {item}: {saving} KZT.",
                        "evidence_ids": [ref],
                    },
                    {"text": "Next year you will save 999 999 KZT.", "evidence_ids": []},
                ],
            }
        return Completion(json.dumps(reply, ensure_ascii=False), len(prompt) // 4, 40)
