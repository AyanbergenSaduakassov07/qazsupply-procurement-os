"""Screening name-matching eval (M4). INVENTED entities and queries: no real persons or companies.

Positives are spelling variants of a listed entity that a screener must not miss (script swap,
Kazakh letters, Kazakh Latin, patronymic forms, word order, legal form, one typo, missing
middle name). Negatives share a surname, a first name or a business word with a listed entity
but are different parties; any hit on them is review load (a false positive), not a miss.
Built by the agent on 2026-10-12; locked after it lands (docs/runbooks/agent-harness.md).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Entity:
    id: str
    kind: str  # person | company
    names: tuple[str, ...]


@dataclass(frozen=True)
class Query:
    name: str
    kind: str
    expect: str | None  # entity id, or None for a negative
    variant: str


ENTITIES = [
    Entity("E01", "person", ("SAPAROVA, Aigul Nurlanovna", "Сапарова Айгуль Нурлановна")),
    Entity("E02", "person", ("KIM, Viktor",)),
    Entity("E03", "company", ("Steppe Trade Holding LLP", "ТОО Степь Трейд Холдинг")),
    Entity("E04", "person", ("Abenov Yerlan Maratovich",)),
    Entity("E05", "person", ("Ivanov Pyotr Andreevich", "Иванов Пётр Андреевич")),
    Entity("E06", "company", ("Northern Lights Shipping Ltd",)),
    Entity("E07", "person", ("Tokhtarov Bolat",)),
    Entity("E08", "company", ("Caspian Bridge Trading FZE",)),
    Entity("E09", "person", ("Sergeeva Galina Ivanovna",)),
    Entity("E10", "person", ("Mukanov Daniyar",)),
    Entity("E11", "person", ("Zhunusova Saule Kairatovna",)),
    Entity("E12", "person", ("Shcherbakov Igor Valentinovich",)),
    Entity("E13", "person", ("Yessenova Ainur",)),
    Entity("E14", "person", ("Khodjaev Rustam",)),
    Entity("E15", "company", ("Altyn Zhol Logistics LLP", "ТОО Алтын Жол Логистикс")),
    Entity("E16", "person", ("Nurgaliyev Ermek Bolatovich",)),
    Entity("E17", "person", ("Ospanova Gulnara",)),
    Entity("E18", "company", ("Qazaq Metal Trade JSC", "АО Казак Метал Трейд")),
    Entity("E19", "person", ("Tursunbayev Kanat",)),
    Entity("E20", "person", ("Petrenko Andriy",)),
]

P, C = "person", "company"
QUERIES = [
    # E01
    Query("Сапарова Айгүл Нұрланқызы", P, "E01", "kk_patronymic"),
    Query("Saparova Aigul", P, "E01", "no_patronymic"),
    Query("Айгуль Сапарова", P, "E01", "word_order_script"),
    Query("Saparova Aigyl Nurlanovna", P, "E01", "typo"),
    # E02
    Query("Ким Виктор", P, "E02", "script"),
    Query("Kim Victor", P, "E02", "spelling"),
    Query("Ким Виктор Сергеевич", P, "E02", "extra_patronymic"),
    # E03
    Query("ТОО «Степь Трейд Холдинг»", C, "E03", "legal_form_quotes"),
    Query("Steppe Trade Holding", C, "E03", "no_legal_form"),
    Query("Степь Трейд Холдинг ЖШС", C, "E03", "kk_legal_form"),
    # E04
    Query("Әбенов Ерлан Маратұлы", P, "E04", "kk_patronymic"),
    Query("Abenov Erlan", P, "E04", "ye_e"),
    Query("Абенов Ерлан Маратович", P, "E04", "ru_patronymic"),
    # E05
    Query("Ivanov Petr", P, "E05", "spelling"),
    Query("Иванов Петр Андреевич", P, "E05", "yo_e"),
    Query("Pyotr Ivanov", P, "E05", "word_order"),
    # E06
    Query("Northern Lights Shipping", C, "E06", "no_legal_form"),
    Query("Нозерн Лайтс Шиппинг", C, "E06", "script"),
    # E07
    Query("Тохтаров Болат", P, "E07", "script"),
    Query("Tohtarov Bolat", P, "E07", "kh_h"),
    Query("Toxtarov Bolat", P, "E07", "x_kh"),
    # E08
    Query("Caspian Bridge Trading", C, "E08", "no_legal_form"),
    Query("Каспиан Бридж Трейдинг", C, "E08", "script"),
    # E09
    Query("Сергеева Галина Ивановна", P, "E09", "script"),
    Query("Sergeyeva Galina", P, "E09", "ye_e"),
    # E10
    Query("Мұқанов Данияр", P, "E10", "kk_letters"),
    Query("Mukanov Daniiar", P, "E10", "ya_ia"),
    Query("Muqanov Daniyar", P, "E10", "kk_latin"),
    # E11
    Query("Жунусова Сауле Кайратовна", P, "E11", "script"),
    Query("Junusova Saule", P, "E11", "j_zh"),
    Query("Жүнісова Сәуле Қайратқызы", P, "E11", "kk_patronymic"),
    # E12
    Query("Щербаков Игорь Валентинович", P, "E12", "script"),
    Query("Sherbakov Igor", P, "E12", "shch_sh"),
    Query("Shcherbakov Igor V.", P, "E12", "initial"),
    # E13
    Query("Есенова Айнұр", P, "E13", "kk_letters"),
    Query("Esenova Ainur", P, "E13", "ye_e"),
    # E14
    Query("Ходжаев Рустам", P, "E14", "script"),
    Query("Hodzhaev Rustam", P, "E14", "kh_dzh"),
    Query("Xodjayev Rustam", P, "E14", "uz_latin"),
    # E15
    Query("ТОО «Алтын Жол Логистикс»", C, "E15", "legal_form_quotes"),
    Query("Altyn Jol Logistics", C, "E15", "j_zh"),
    # E16
    Query("Нұрғалиев Ермек Болатұлы", P, "E16", "kk_patronymic"),
    Query("Nurgaliev Ermek", P, "E16", "spelling"),
    # E17
    Query("Оспанова Гүлнар", P, "E17", "kk_letters"),
    Query("Ospanova Gulnar", P, "E17", "spelling"),
    # E18
    Query("АО «Қазақ Метал Трейд»", C, "E18", "kk_letters"),
    Query("Kazakh Metal Trade", C, "E18", "kh_q"),
    # E19
    Query("Тұрсынбаев Қанат", P, "E19", "kk_letters"),
    Query("Tursynbayev Qanat", P, "E19", "kk_latin"),
    # E20
    Query("Петренко Андрей", P, "E20", "ru_form"),
    Query("Petrenko Andrii", P, "E20", "spelling"),
    # Negatives: same surname, other first name / same first name, other surname / shared words.
    Query("Сапаров Ермек", P, None, "shared_surname_root"),
    Query("Kim Elena", P, None, "shared_surname"),
    Query("Ким", P, None, "surname_only"),
    Query("ТОО «Степь Агро»", C, None, "shared_word"),
    Query("Northern Star Logistics", C, None, "shared_word"),
    Query("Абенова Дина", P, None, "shared_surname_root"),
    Query("Иванова Мария", P, None, "shared_surname_root"),
    Query("Болат Серікбаев", P, None, "shared_first_name"),
    Query("Caspian Agro Trading", C, None, "two_shared_words"),
    Query("Галина Петрова", P, None, "shared_first_name"),
    Query("Мұқанова Әсел", P, None, "shared_surname_root"),
    Query("Айнұр Қасымова", P, None, "shared_first_name"),
    Query("Рустам Омаров", P, None, "shared_first_name"),
    Query("ТОО «Алтын Дән»", C, None, "shared_word"),
    Query("Ермек Ахметов", P, None, "shared_first_name"),
    Query("Ospanov Timur", P, None, "shared_surname_root"),
    Query("Qazaq Oil Service", C, None, "shared_word"),
    Query("Kanat Ibraev", P, None, "shared_first_name"),
    Query("Петренко Ольга", P, None, "shared_surname"),
    Query("ТОО «Альфа»", C, None, "unrelated"),
    Query("Жанар Омарова", P, None, "unrelated"),
    Query("Bridge Construction LLP", C, None, "shared_word"),
    Query("Шербаков Олег", P, None, "shared_surname"),
    Query("Tokhtarova Aliya", P, None, "shared_surname_root"),
    Query("Sergeev Nikolai", P, None, "shared_surname_root"),
]
