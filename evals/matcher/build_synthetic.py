"""Build the SYNTHETIC matcher golden set (evals/matcher/golden_synthetic.csv).

Owner decision 2026-10-09: until real ЕНС ТРУ data and the owner's 300 hand-labelled lines
exist, M2 is measured on this generated set. It is optimistic by construction (same author as
the matcher); the M2 gate is NOT passed on it. Deterministic: same seed, same file.

Usage: uv run python evals/matcher/build_synthetic.py
"""

import csv
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CODES = json.loads((ROOT / "connectors/enstru/fixtures/sample_codes.json").read_text())["codes"]
OUT = Path(__file__).parent / "golden_synthetic.csv"
SEED, N_LINES = 20261009, 300

# Real-world style abbreviations seen in Russian procurement exports (generic, not item-specific).
ABBREV = {
    "нитриловые": "нитрил.",
    "хлопчатобумажные": "х/б",
    "защитные": "защ.",
    "защитная": "защ.",
    "сигнальный": "сигн.",
    "шариковый": "шарик.",
    "роликовый": "ролик.",
    "сферический": "сфер.",
    "дизельное": "диз.",
    "моторное": "мот.",
    "гидравлическое": "гидр.",
    "пластичная": "пласт.",
    "силовой": "сил.",
    "светодиодная": "светодиод.",
    "автоматический": "автомат.",
    "конвейерная": "конв.",
    "стальные": "стал.",
    "стальной": "стал.",
    "сварочные": "свар.",
    "технический": "техн.",
    "офисная": "офис.",
    "бутилированная": "бутил.",
    "питьевая": "пит.",
}
KK_LOOKALIKE = str.maketrans("әғқңөұүһіӘҒҚҢӨҰҮҺІ", "агкноуухиАГКНОУУХИ")
LATIN = str.maketrans(
    {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ж": "zh",
        "з": "z",
        "и": "i",
        "й": "y",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "kh",
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "sch",
        "ы": "y",
        "э": "e",
        "ю": "yu",
        "я": "ya",
        "ь": "",
        "ъ": "",
    }
)
SUFFIXES = [
    "",
    "",
    "",
    " L",
    " р-р 10",
    " уп. 100 шт",
    " (по ГОСТ)",
    ", импорт",
    " (аналог)",
    " кор.",
    " №5",
    " 1 сорт",
]
NO_MATCH = [
    "Стол офисный",
    "Услуги связи",
    "Песок строительный",
    "Чайник электрический",
    "Кресло руководителя",
    "Аренда спецтехники",
    "Ноутбук 15 дюймов",
    "Краска фасадная",
    "Услуги охраны",
    "Дрель аккумуляторная",
    "Мешки полипропиленовые",
    "Огнетушитель ОП-4",
]


def typo(text: str, rng: random.Random) -> str:
    letters = [i for i, ch in enumerate(text) if ch.isalpha()]
    if len(letters) < 6:
        return text
    i = rng.choice(letters[1:-1])
    op = rng.choice(["drop", "swap", "dup"])
    if op == "drop":
        return text[:i] + text[i + 1 :]
    if op == "swap" and i + 1 < len(text):
        return text[:i] + text[i + 1] + text[i] + text[i + 2 :]
    return text[:i] + text[i] + text[i:]


def render(code: dict[str, str], rng: random.Random) -> tuple[str, str]:
    style = rng.choices(
        ["ru", "ru_abbrev", "kk", "kk_lookalike", "latin", "mixed"],
        weights=[25, 25, 15, 10, 10, 15],
    )[0]
    ru, kk = code["name_ru"], code["name_kk"]
    if style == "ru":
        text, lang = ru, "ru"
    elif style == "ru_abbrev":
        text = " ".join(ABBREV.get(w.lower(), w) for w in ru.split())
        lang = "ru"
    elif style == "kk":
        text, lang = kk, "kk"
    elif style == "kk_lookalike":
        text, lang = kk.translate(KK_LOOKALIKE), "kk"
    elif style == "latin":
        text, lang = ru.lower().translate(LATIN), "latin"
    else:
        ru_words, kk_words = ru.split(), kk.split()
        text, lang = f"{ru_words[0]} / {' '.join(kk_words[:2])}", "mixed"
    if rng.random() < 0.3:
        text = typo(text, rng)
    if rng.random() < 0.15 and len(text.split()) > 1:
        words = text.split()
        text = " ".join(words[1:] + words[:1])
    if rng.random() < 0.4:
        text = text.upper() if rng.random() < 0.5 else text.lower()
    return text + rng.choice(SUFFIXES), lang


def main() -> None:
    rng = random.Random(SEED)
    rows = []
    for i in range(N_LINES):
        roll = rng.random()
        if roll < 0.10:
            text, label, lang = rng.choice(NO_MATCH) + rng.choice(SUFFIXES), "NONE", "ru"
        elif roll < 0.14:
            a, b = rng.sample(CODES, 2)
            text, label, lang = (
                f"{a['name_ru']} + {b['name_ru'].lower()} (комплект)",
                "BUNDLED",
                "ru",
            )
        else:
            code = rng.choice(CODES)
            text, lang = render(code, rng)
            label = code["code"]
        split = "train" if i % 2 == 0 else "test"
        rows.append({"id": f"S{i:03d}", "text": text, "label": label, "lang": lang, "split": split})
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "text", "label", "lang", "split"])
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()
