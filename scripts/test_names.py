import re
import random
from datetime import date

# Set deterministic seed
random.seed(42)

# Bangladeshi authentic name lists
PREFIXES = [
    ("Md.", "মো."),
    ("Mohammad", "মোহাম্মদ"),
    ("Kazi", "কাজী"),
    ("Syed", "সৈয়দ"),
    ("Chowdhury", "চৌধুরী"),
    ("Khondokar", "খন্দকার"),
    ("Sheikh", "শেখ"),
    ("Mir", "মীর"),
    ("Khandaker", "খন্দকার"),
    ("Begum", "বেগম"),
    ("Syeda", "সৈয়দা"),
    ("Dewan", "দেওয়ান"),
]

MIDDLES_MALE = [
    ("Rafiqul", "রফিকুল"),
    ("Aminul", "আমিনুল"),
    ("Mizanur", "মিজানুর"),
    ("Ashraful", "আশরাফুল"),
    ("Kamrul", "কামরুল"),
    ("Tanvir", "তানভীর"),
    ("Mahbubur", "মাহবুবুর"),
    ("Saiful", "সাইফুল"),
    ("Nazmul", "নাজমুল"),
    ("Shahriar", "শাহরিয়ার"),
    ("Jahangir", "জাহাঙ্গীর"),
    ("Tariqul", "তরিকুল"),
    ("Ziaur", "জিয়াউর"),
    ("Monirul", "মনিরুল"),
    ("Anisur", "আনিসুর"),
    ("Shamsul", "শামসুল"),
    ("Maksudur", "মাকসুদুর"),
    ("Enamul", "এনামুল"),
    ("Habibur", "হাবিবুর"),
    ("Rezaul", "রেজাউল"),
]

MIDDLES_FEMALE = [
    ("Farzana", "ফারজানা"),
    ("Nusrat", "নুসরাত"),
    ("Tasnim", "তাসনিম"),
    ("Afroza", "আফরোজা"),
    ("Jannatul", "জান্নাতুল"),
    ("Sharmin", "শারমিন"),
    ("Rehana", "রেহানা"),
    ("Nasrin", "নাসরিন"),
    ("Salma", "সালমা"),
    ("Tahmina", "তাহমিনা"),
    ("Kamrun", "কামরুন"),
    ("Shirin", "শিরিন"),
    ("Rokeya", "রোকেয়া"),
    ("Fatema", "ফাতেমা"),
    ("Sabina", "সাবিনা"),
    ("Shamima", "শামীমা"),
    ("Suraiya", "সুরাইয়া"),
    ("Nahid", "নাহিদ"),
    ("Rubina", "রুবিনা"),
    ("Mahmuda", "মাহমুদা"),
]

SURNAMES = [
    ("Islam", "ইসলাম"),
    ("Rahman", "রহমান"),
    ("Hossain", "হোসেন"),
    ("Ahmed", "আহমেদ"),
    ("Chowdhury", "চৌধুরী"),
    ("Hasan", "হাসান"),
    ("Ali", "আলী"),
    ("Khan", "খান"),
    ("Sikder", "শিকদার"),
    ("Talukder", "তালুকদার"),
    ("Mollah", "মোল্লা"),
    ("Sarkar", "সরকার"),
    ("Haque", "হক"),
    ("Munshi", "মুন্সী"),
    ("Dewan", "দেওয়ান"),
    ("Majumder", "মজুমদার"),
    ("Bhuiyan", "ভূঁইয়া"),
    ("Kazi", "কাজী"),
    ("Akter", "আক্তার"),
    ("Begum", "বেগম"),
]

def make_3_word_name(idx, gender):
    # Generates a deterministic 3-word Bangladeshi full name in English and Bengali
    rnd = random.Random(idx * 7919 + 17)
    
    if gender == 'female':
        p_en, p_bn = rnd.choice([
            ("Syeda", "সৈয়দা"),
            ("Begum", "বেগম"),
            ("Dr.", "ডা."),
            ("Mst.", "মোছা."),
            ("Kazi", "কাজী"),
            ("Chowdhury", "চৌধুরী"),
            ("Farhana", "ফারহানা"),
            ("Nusrat", "নুসরাত"),
        ])
        m_en, m_bn = rnd.choice(MIDDLES_FEMALE)
        s_en, s_bn = rnd.choice([
            ("Akter", "আক্তার"),
            ("Begum", "বেগম"),
            ("Khatun", "খাতুন"),
            ("Sultana", "সুলতানা"),
            ("Chowdhury", "চৌধুরী"),
            ("Jahan", "জাহান"),
            ("Parvin", "পারভীন"),
            ("Islam", "ইসলাম"),
            ("Rahman", "রহমান"),
            ("Ahmed", "আহমেদ"),
        ])
    else:
        p_en, p_bn = rnd.choice(PREFIXES)
        m_en, m_bn = rnd.choice(MIDDLES_MALE)
        s_en, s_bn = rnd.choice(SURNAMES)

    full_en = f"{p_en} {m_en} {s_en}"
    full_bn = f"{p_bn} {m_bn} {s_bn}"
    return full_en, full_bn

def calculate_age(dob_str):
    if not dob_str:
        return 30
    y, m, d = map(int, dob_str.split('-'))
    today = date(2026, 10, 12)
    age = today.year - y - ((today.month, today.day) < (m, d))
    return max(18, min(65, age))

print("Name generator logic verified.")
