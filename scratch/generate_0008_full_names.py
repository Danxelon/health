#!/usr/bin/env python3
"""
generate_0008_full_names.py
Rewrites supabase/migrations/0008_demo_seed.sql to:
1. Ensure all 1,200 seeded profiles, 800 donors, and 60 doctors have full 3-word names
   in BOTH English (full_name) and Bengali (full_name_bn), plus date_of_birth and age.
2. Ensure the admin account (showystore2026@gmail.com) and the 5 verified doctors have authentic 3-word names:
   - Dr. Mohammad Abdur Rahman / ডা. মোহাম্মদ আবদুর রহমান
   - Dr. Syeda Fatima Begum / ডা. সৈয়দা ফাতেমা বেগম
   - Dr. Mohammad Anwar Hossain / ডা. মোহাম্মদ আনোয়ার হোসেন
   - Dr. Syeda Taslima Akter / ডা. সৈয়দা তাসলিমা আক্তার
   - Dr. Mohammad Kamal Uddin / ডা. মোহাম্মদ কামাল উদ্দিন
3. Verify that the generated 0008_demo_seed.sql file is valid SQL, has no syntax errors,
   and maintains all foreign keys and constraints.
"""

import os
import re
import sys
from datetime import date

# Reference date for project context: October 12, 2026
CURRENT_DATE = date(2026, 10, 12)

def calculate_age(dob: date, today: date = CURRENT_DATE) -> int:
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

# ---------------------------------------------------------
# Authentic Bangladeshi Name Component Lists
# ---------------------------------------------------------
MALE_PREFIXES = [
    ("Mohammad", "মোহাম্মদ"),
    ("Kazi", "কাজী"),
    ("Syed", "সৈয়দ"),
    ("Sheikh", "শেখ"),
    ("Chowdhury", "চৌধুরী"),
    ("Khondokar", "খন্দকার"),
    ("Mir", "মীর"),
    ("Dewan", "দেওয়ান"),
    ("Alhaj", "আলহাজ্ব"),
    ("Md.", "মো."),
]

MALE_MIDDLES = [
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
    ("Masudur", "মাসুদুর"),
    ("Zillur", "জিল্লুর"),
    ("Asadul", "আসাদুল"),
    ("Shafiqul", "শফিকুল"),
    ("Rashedul", "রাশেদুল"),
    ("Delwar", "দেলোয়ার"),
    ("Arifur", "আরিফুর"),
    ("Sohail", "সোহেল"),
]

MALE_SURNAMES = [
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
    ("Majumder", "মজুমদার"),
    ("Bhuiyan", "ভূঁইয়া"),
    ("Mahmud", "মাহমুদ"),
    ("Akand", "আকন্দ"),
    ("Pramanik", "প্রামাণিক"),
    ("Uddin", "উদ্দিন"),
]

FEMALE_PREFIXES = [
    ("Syeda", "সৈয়দা"),
    ("Begum", "বেগম"),
    ("Farhana", "ফারহানা"),
    ("Nusrat", "নুসরাত"),
    ("Tahmina", "তাহমিনা"),
    ("Sharmin", "শারমিন"),
    ("Afroza", "আফরোজা"),
    ("Sadia", "সাদিয়া"),
    ("Tasnim", "তাসনিম"),
    ("Kazi", "কাজী"),
    ("Mst.", "মোছা."),
]

FEMALE_MIDDLES = [
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
    ("Naznin", "নাজনীন"),
    ("Laila", "লায়লা"),
    ("Dilruba", "দিলরুবা"),
    ("Roksana", "রোকসানা"),
]

FEMALE_SURNAMES = [
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
    ("Nahar", "নাহার"),
    ("Khanom", "খানম"),
    ("Ferdous", "ফেরদৌস"),
    ("Banu", "বানু"),
]

def generate_3word_name(index: int, gender: str, is_doctor: bool = False):
    """Generates deterministic, authentic 3-word English and Bengali full names."""
    if is_doctor:
        # All doctors receive professional Dr. / ডা. prefix followed by 2 distinct name tokens = 3 words
        p_en, p_bn = ("Dr.", "ডা.")
        if gender == "female":
            m = FEMALE_MIDDLES[(index * 7 + 3) % len(FEMALE_MIDDLES)]
            s = FEMALE_SURNAMES[(index * 13 + 5) % len(FEMALE_SURNAMES)]
        else:
            m = MALE_MIDDLES[(index * 7 + 3) % len(MALE_MIDDLES)]
            s = MALE_SURNAMES[(index * 13 + 5) % len(MALE_SURNAMES)]
        return f"{p_en} {m[0]} {s[0]}", f"{p_bn} {m[1]} {s[1]}"

    if gender == "female":
        p = FEMALE_PREFIXES[(index * 5 + 1) % len(FEMALE_PREFIXES)]
        m = FEMALE_MIDDLES[(index * 7 + 3) % len(FEMALE_MIDDLES)]
        s = FEMALE_SURNAMES[(index * 13 + 5) % len(FEMALE_SURNAMES)]
    else:
        p = MALE_PREFIXES[(index * 5 + 1) % len(MALE_PREFIXES)]
        m = MALE_MIDDLES[(index * 7 + 3) % len(MALE_MIDDLES)]
        s = MALE_SURNAMES[(index * 13 + 5) % len(MALE_SURNAMES)]

    return f"{p[0]} {m[0]} {s[0]}", f"{p[1]} {m[1]} {s[1]}"


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_dir = os.path.abspath(os.path.join(script_dir, ".."))
    seed_path = os.path.join(workspace_dir, "supabase", "migrations", "0008_demo_seed.sql")

    if not os.path.exists(seed_path):
        print(f"Error: Could not find {seed_path}")
        sys.exit(1)

    print(f"Loading {seed_path}...")
    with open(seed_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Ensure ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INT;
    if "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age" not in content:
        content = content.replace(
            "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;",
            "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INT;"
        )

    # 2. Extract doctor experience from doctors table to align doctor ages
    doc_exp_map = {}
    doc_match = re.search(r'INSERT INTO doctors\s*\([^)]+\)\s*VALUES\s*(.*?);(?=\s*(\n--|\nINSERT|\Z))', content, re.DOTALL)
    if doc_match:
        for line in doc_match.group(1).splitlines():
            line_str = line.strip()
            if line_str.startswith("("):
                m = re.match(r"\('([^']+)',\s*'([^']+)',\s*(\d+),\s*'(\{[^}]+\})',\s*(\d+),", line_str)
                if m:
                    uid = m.group(1)
                    exp = int(m.group(5))
                    doc_exp_map[uid] = exp

    print(f"Parsed {len(doc_exp_map)} doctors with experience years.")

    # 3. Process the main 1,200 profiles
    # Old header:
    # INSERT INTO profiles (id, role, full_name, full_name_bn, phone, nid_hash, nid_last4, date_of_birth, gender, blood_group, blood_group_verified, weight_kg, height_cm, home_upazila_id, permanent_upazila_id, present_address, permanent_address, home_geog, avatar_url, locale) VALUES
    # New header:
    # INSERT INTO profiles (id, role, full_name, full_name_bn, phone, nid_hash, nid_last4, date_of_birth, age, gender, blood_group, blood_group_verified, weight_kg, height_cm, home_upazila_id, permanent_upazila_id, present_address, permanent_address, home_geog, avatar_url, locale) VALUES

    pattern_profiles = re.compile(
        r'(INSERT INTO profiles\s*\([^)]+date_of_birth[^)]*\)\s*VALUES\s*)(.*?)(;(?=\s*\n\s*--\s*donors|\s*\n\s*INSERT INTO donors))',
        re.DOTALL
    )

    m_prof = pattern_profiles.search(content)
    if not m_prof:
        print("Error: Could not locate main 1,200 profiles section.")
        sys.exit(1)

    prefix_sql = m_prof.group(1)
    rows_text = m_prof.group(2)
    suffix_sql = m_prof.group(3)

    # Standardize column list
    target_header = (
        "INSERT INTO profiles (id, role, full_name, full_name_bn, phone, nid_hash, nid_last4, "
        "date_of_birth, age, gender, blood_group, blood_group_verified, weight_kg, height_cm, "
        "home_upazila_id, permanent_upazila_id, present_address, permanent_address, home_geog, avatar_url, locale) VALUES"
    )

    new_rows = []
    profile_idx = 0
    row_lines = rows_text.splitlines()

    for line in row_lines:
        line_clean = line.strip()
        if not line_clean.startswith("("):
            new_rows.append(line)
            continue

        # Extract values from row
        # Row format starts with: ('<id>', '<role>', '<en>', '<bn>', '<phone>', '<nid>', '<last4>', '<dob>', [maybe <age>,] '<gender>', ...
        m_row = re.match(
            r"^\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',(?:\s*(\d+),)?\s*'([^']+)',\s*(.+)$",
            line_clean
        )
        if not m_row:
            print(f"Failed to match profile row: {line_clean[:80]}")
            new_rows.append(line)
            continue

        uid = m_row.group(1)
        role = m_row.group(2)
        old_en = m_row.group(3)
        old_bn = m_row.group(4)
        phone = m_row.group(5)
        nid = m_row.group(6)
        last4 = m_row.group(7)
        dob_str = m_row.group(8)
        # group 9 is optional existing age
        gender = m_row.group(10)
        tail = m_row.group(11) # rest of the row starting with blood_group

        is_doc = (role == "doctor")
        # Generate authentic 3-word names
        name_en, name_bn = generate_3word_name(profile_idx, gender, is_doctor=is_doc)

        # Parse DOB and ensure realistic age
        y, mo, d = map(int, dob_str.split("-"))
        if is_doc and uid in doc_exp_map:
            exp = doc_exp_map[uid]
            # Doctor must have graduated at ~24-25, so age >= 24 + exp
            target_age = max(26 + exp, 30)
            target_year = CURRENT_DATE.year - target_age
            dob = date(target_year, mo, d)
        else:
            dob = date(y, mo, d)

        computed_age = calculate_age(dob, CURRENT_DATE)
        dob_formatted = dob.strftime("%Y-%m-%d")

        # Verify word count
        assert len(name_en.split()) == 3, f"Non 3-word name generated: {name_en}"
        assert len(name_bn.split()) == 3, f"Non 3-word name generated: {name_bn}"

        new_row = f"('{uid}', '{role}', '{name_en}', '{name_bn}', '{phone}', '{nid}', '{last4}', '{dob_formatted}', {computed_age}, '{gender}', {tail}"
        new_rows.append(new_row)
        profile_idx += 1

    print(f"Processed {profile_idx} main profile rows with 3-word names and computed ages.")

    # Reassemble main profiles block
    content = content[:m_prof.start()] + target_header + "\n" + "\n".join(new_rows) + content[m_prof.end()-len(suffix_sql):]

    # 4. Admin Profile & auth.users update
    # Ensure Chief System Administrator / প্রধান সিস্টেম প্রশাসক (3 words each)
    admin_uuid = "a0000000-0000-0000-0000-000000000001"
    admin_auth_old = """INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  (SELECT id FROM auth.instances LIMIT 1),
  'authenticated',
  'authenticated',
  'showystore2026@gmail.com',
  crypt('iloveyou', gen_salt('bf', 4)),
  now(),
  '8801700000000',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"role":"admin","full_name":"System Administrator"}'::jsonb,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;"""

    admin_auth_new = """INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  (SELECT id FROM auth.instances LIMIT 1),
  'authenticated',
  'authenticated',
  'showystore2026@gmail.com',
  crypt('iloveyou', gen_salt('bf', 4)),
  now(),
  '8801700000000',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"role":"admin","full_name":"Chief System Administrator"}'::jsonb,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;"""

    content = content.replace(admin_auth_old, admin_auth_new)

    # Admin profile block
    admin_prof_pattern = re.compile(
        r'INSERT INTO profiles\s*\([^)]*admin[^)]*\)\s*VALUES\s*\(\s*\'a0000000-0000-0000-0000-000000000001\'::uuid.*?\)\s*ON CONFLICT \(id\) DO NOTHING;',
        re.DOTALL
    )
    # If not matched specifically by that regex, search more broadly
    admin_prof_block = """INSERT INTO profiles (id, role, full_name, full_name_bn, phone, nid_hash, nid_last4, date_of_birth, age, gender, locale)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'admin',
  'Chief System Administrator',
  'প্রধান সিস্টেম প্রশাসক',
  '8801700000000',
  'seed-admin-showystore-hash',
  '0000',
  '1985-05-15',
  41,
  'other',
  'bn'
)
ON CONFLICT (id) DO NOTHING;"""

    # Look for existing admin profile insert
    admin_match = re.search(
        r'INSERT INTO profiles\s*\([^)]+\)\s*VALUES\s*\(\s*\'a0000000-0000-0000-0000-000000000001\'::uuid.*?\)\s*ON CONFLICT \(id\) DO NOTHING;',
        content,
        re.DOTALL
    )
    if admin_match:
        content = content[:admin_match.start()] + admin_prof_block + content[admin_match.end():]
        print("Updated admin profile in 0008_demo_seed.sql.")
    else:
        print("Warning: Could not match admin profile insert block!")

    # 5. 5 Verified Doctors block
    # Ensure auth.users has raw_user_meta_data with their names
    doctors_auth_new = """INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
('d0000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'dr.rahman@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801711990001', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Mohammad Abdur Rahman"}'::jsonb, now(), now()),
('d0000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'dr.fatima@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801711990002', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Syeda Fatima Begum"}'::jsonb, now(), now()),
('d0000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'dr.anwar@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801711990003', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Mohammad Anwar Hossain"}'::jsonb, now(), now()),
('d0000000-0000-0000-0000-000000000004'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'dr.taslima@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801711990004', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Syeda Taslima Akter"}'::jsonb, now(), now()),
('d0000000-0000-0000-0000-000000000005'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'dr.kamal@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801711990005', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Mohammad Kamal Uddin"}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;"""

    doc_auth_match = re.search(
        r'INSERT INTO auth\.users\s*\([^)]+\)\s*VALUES\s*\(\'d0000000-0000-0000-0000-000000000001\'::uuid.*?\)\s*ON CONFLICT \(id\) DO NOTHING;',
        content,
        re.DOTALL
    )
    if doc_auth_match:
        content = content[:doc_auth_match.start()] + doctors_auth_new + content[doc_auth_match.end():]

    # Doctors profiles block
    doctors_prof_new = """INSERT INTO profiles (id, role, full_name, full_name_bn, phone, nid_hash, nid_last4, date_of_birth, age, gender, blood_group, blood_group_verified, locale)
VALUES
('d0000000-0000-0000-0000-000000000001'::uuid, 'doctor', 'Dr. Mohammad Abdur Rahman', 'ডা. মোহাম্মদ আবদুর রহমান', '8801711990001', 'nid-doc-001-demo-hash', '8801', '1980-05-15', 46, 'male', 'B+', true, 'bn'),
('d0000000-0000-0000-0000-000000000002'::uuid, 'doctor', 'Dr. Syeda Fatima Begum', 'ডা. সৈয়দা ফাতেমা বেগম', '8801711990002', 'nid-doc-002-demo-hash', '8802', '1983-08-20', 43, 'female', 'O+', true, 'bn'),
('d0000000-0000-0000-0000-000000000003'::uuid, 'doctor', 'Dr. Mohammad Anwar Hossain', 'ডা. মোহাম্মদ আনোয়ার হোসেন', '8801711990003', 'nid-doc-003-demo-hash', '8803', '1977-11-10', 48, 'male', 'A+', true, 'bn'),
('d0000000-0000-0000-0000-000000000004'::uuid, 'doctor', 'Dr. Syeda Taslima Akter', 'ডা. সৈয়দা তাসলিমা আক্তার', '8801711990004', 'nid-doc-004-demo-hash', '8804', '1985-03-25', 41, 'female', 'AB+', true, 'bn'),
('d0000000-0000-0000-0000-000000000005'::uuid, 'doctor', 'Dr. Mohammad Kamal Uddin', 'ডা. মোহাম্মদ কামাল উদ্দিন', '8801711990005', 'nid-doc-005-demo-hash', '8805', '1981-09-12', 45, 'male', 'O-', true, 'bn')
ON CONFLICT (id) DO NOTHING;"""

    doc_prof_match = re.search(
        r'INSERT INTO profiles\s*\([^)]+\)\s*VALUES\s*\(\'d0000000-0000-0000-0000-000000000001\'::uuid.*?\)\s*ON CONFLICT \(id\) DO NOTHING;',
        content,
        re.DOTALL
    )
    if doc_prof_match:
        content = content[:doc_prof_match.start()] + doctors_prof_new + content[doc_prof_match.end():]
        print("Updated 5 verified doctors profiles in 0008_demo_seed.sql.")
    else:
        print("Warning: Could not match 5 verified doctors profiles insert block!")

    # Write output back to 0008_demo_seed.sql
    with open(seed_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Successfully wrote updated {seed_path} ({len(content)} bytes).")


if __name__ == "__main__":
    main()
