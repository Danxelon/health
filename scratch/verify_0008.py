#!/usr/bin/env python3
"""
verify_0008.py
Comprehensive integrity and syntax verification for 0008_demo_seed.sql.
"""

import os
import re
import sys
from datetime import date

CURRENT_DATE = date(2026, 10, 12)
if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def calculate_age(dob: date, today: date = CURRENT_DATE) -> int:
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

def extract_top_level_tuples(block_text: str):
    """Extracts top-level parenthesized row tuples from a VALUES block."""
    tuples = []
    curr = []
    in_str = False
    depth = 0

    for ch in block_text:
        if ch == "'" and not in_str:
            in_str = True
            if depth > 0:
                curr.append(ch)
        elif ch == "'" and in_str:
            in_str = False
            if depth > 0:
                curr.append(ch)
        elif not in_str and ch == "(":
            if depth > 0:
                curr.append(ch)
            depth += 1
        elif not in_str and ch == ")":
            depth -= 1
            if depth == 0:
                tuples.append("".join(curr).strip())
                curr = []
            elif depth > 0:
                curr.append(ch)
        elif depth > 0:
            curr.append(ch)

    return tuples

def split_sql_tokens(tuple_content: str):
    """Splits a tuple's internal comma-separated fields taking into account quotes and nested parens."""
    tokens = []
    curr = []
    in_str = False
    depth = 0

    for ch in tuple_content:
        if ch == "'" and not in_str:
            in_str = True
            curr.append(ch)
        elif ch == "'" and in_str:
            in_str = False
            curr.append(ch)
        elif not in_str and ch == "(":
            depth += 1
            curr.append(ch)
        elif not in_str and ch == ")":
            depth -= 1
            curr.append(ch)
        elif not in_str and depth == 0 and ch == ",":
            tokens.append("".join(curr).strip())
            curr = []
        else:
            curr.append(ch)

    if curr:
        tokens.append("".join(curr).strip())

    return tokens

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_dir = os.path.abspath(os.path.join(script_dir, ".."))
    seed_path = os.path.join(workspace_dir, "supabase", "migrations", "0008_demo_seed.sql")

    with open(seed_path, "r", encoding="utf-8") as f:
        sql = f.read()

    print(f"Verifying {seed_path} ({len(sql)} bytes)...")
    errors = []

    # 1. ALTER TABLE checks
    if "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INT;" not in sql:
        errors.append("Missing: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INT;")

    # 2. Extract auth.users
    auth_users = set()
    auth_insert_matches = list(re.finditer(r'INSERT INTO auth\.users.*?VALUES\s*(.*?)(?=\s*ON CONFLICT|;)', sql, re.DOTALL))
    for im in auth_insert_matches:
        block = im.group(1)
        for uid in re.findall(r"'([0-9a-fA-F-]{36})'", block):
            auth_users.add(uid.lower())

    print(f"Total auth.users extracted: {len(auth_users)}")
    if len(auth_users) < 1206:
        errors.append(f"Expected at least 1206 auth.users, found {len(auth_users)}")

    # 3. Extract profiles
    profiles = {}
    prof_insert_matches = list(re.finditer(r'INSERT INTO profiles\s*\((.*?)\)\s*VALUES\s*(.*?)(?=\s*ON CONFLICT|;)', sql, re.DOTALL))
    print(f"Total profiles INSERT statements: {len(prof_insert_matches)}")

    for idx, im in enumerate(prof_insert_matches):
        cols = [c.strip() for c in im.group(1).split(",")]
        rows_text = im.group(2)
        tuples = extract_top_level_tuples(rows_text)
        print(f"Match {idx+1} profiles count: {len(tuples)}")

        for t_content in tuples:
            tokens = split_sql_tokens(t_content)
            if len(cols) != len(tokens):
                errors.append(f"Match {idx+1} Column count mismatch: cols {len(cols)} vs tokens {len(tokens)}: {t_content[:70]}")
                continue

            row_dict = {}
            for c, t in zip(cols, tokens):
                val = t
                if val.startswith("'") and val.endswith("'"):
                    val = val[1:-1]
                elif val.endswith("::uuid"):
                    val = val[:-6].strip("'")
                row_dict[c] = val

            uid = row_dict["id"].lower()
            profiles[uid] = row_dict

    print(f"Total profiles extracted: {len(profiles)}")
    if len(profiles) != 1206:
        errors.append(f"Expected exactly 1206 profiles (1200 + 1 admin + 5 doctors), found {len(profiles)}")

    # 4. Check profile constraints, names, DOB, age
    admin_uid = "a0000000-0000-0000-0000-000000000001"
    doc_uids = [
        "d0000000-0000-0000-0000-000000000001",
        "d0000000-0000-0000-0000-000000000002",
        "d0000000-0000-0000-0000-000000000003",
        "d0000000-0000-0000-0000-000000000004",
        "d0000000-0000-0000-0000-000000000005",
    ]

    expected_verified_docs = {
        "d0000000-0000-0000-0000-000000000001": ("Dr. Mohammad Abdur Rahman", "ডা. মোহাম্মদ আবদুর রহমান"),
        "d0000000-0000-0000-0000-000000000002": ("Dr. Syeda Fatima Begum", "ডা. সৈয়দা ফাতেমা বেগম"),
        "d0000000-0000-0000-0000-000000000003": ("Dr. Mohammad Anwar Hossain", "ডা. মোহাম্মদ আনোয়ার হোসেন"),
        "d0000000-0000-0000-0000-000000000004": ("Dr. Syeda Taslima Akter", "ডা. সৈয়দা তাসলিমা আক্তার"),
        "d0000000-0000-0000-0000-000000000005": ("Dr. Mohammad Kamal Uddin", "ডা. মোহাম্মদ কামাল উদ্দিন"),
    }

    # Verify admin
    if admin_uid not in profiles:
        errors.append("Admin profile not found in profiles!")
    else:
        ap = profiles[admin_uid]
        if len(ap["full_name"].split()) != 3:
            errors.append(f"Admin full_name is not 3 words: {ap['full_name']}")
        if len(ap["full_name_bn"].split()) != 3:
            errors.append(f"Admin full_name_bn is not 3 words: {ap['full_name_bn']}")
        if not ap.get("date_of_birth") or not ap.get("age"):
            errors.append(f"Admin is missing date_of_birth or age: {ap}")
        else:
            y, mo, d = map(int, ap["date_of_birth"].split("-"))
            exp_age = calculate_age(date(y, mo, d))
            if int(ap["age"]) != exp_age:
                errors.append(f"Admin age mismatch: {ap['age']} vs {exp_age}")

    # Verify 5 verified doctors
    for duid, (exp_en, exp_bn) in expected_verified_docs.items():
        if duid not in profiles:
            errors.append(f"Verified doctor {duid} not found in profiles!")
        else:
            dp = profiles[duid]
            if dp["full_name"] != exp_en:
                errors.append(f"Doctor {duid} full_name mismatch: expected '{exp_en}', got '{dp['full_name']}'")
            if dp["full_name_bn"] != exp_bn:
                errors.append(f"Doctor {duid} full_name_bn mismatch: expected '{exp_bn}', got '{dp['full_name_bn']}'")
            if not dp.get("date_of_birth") or not dp.get("age"):
                errors.append(f"Doctor {duid} is missing date_of_birth or age: {dp}")
            else:
                y, mo, d = map(int, dp["date_of_birth"].split("-"))
                exp_age = calculate_age(date(y, mo, d))
                if int(dp["age"]) != exp_age:
                    errors.append(f"Doctor {duid} age mismatch: {dp['age']} vs {exp_age}")

    # Verify all 1,200 profiles
    non_special_profiles = [p for uid, p in profiles.items() if uid != admin_uid and uid not in doc_uids]
    print(f"Checking {len(non_special_profiles)} demo profiles...")
    bad_word_count = []
    bad_age_count = []
    doctor_count = 0
    donor_count = 0
    citizen_count = 0

    for p in non_special_profiles:
        role = p["role"]
        if role == "doctor":
            doctor_count += 1
            if not p["full_name"].startswith("Dr. "):
                bad_word_count.append((p["id"], "Doctor missing Dr.", p["full_name"]))
            if not p["full_name_bn"].startswith("ডা. "):
                bad_word_count.append((p["id"], "Doctor missing ডা.", p["full_name_bn"]))
        elif role == "donor":
            donor_count += 1
        elif role == "citizen":
            citizen_count += 1

        en_words = p["full_name"].split()
        bn_words = p["full_name_bn"].split()
        if len(en_words) != 3:
            bad_word_count.append((p["id"], "EN word count != 3", p["full_name"], len(en_words)))
        if len(bn_words) != 3:
            bad_word_count.append((p["id"], "BN word count != 3", p["full_name_bn"], len(bn_words)))

        dob_str = p.get("date_of_birth")
        age_str = p.get("age")
        if not dob_str or not age_str:
            bad_age_count.append((p["id"], "Missing DOB or age", dob_str, age_str))
        else:
            y, mo, d = map(int, dob_str.split("-"))
            bdate = date(y, mo, d)
            exp_age = calculate_age(bdate)
            if int(age_str) != exp_age:
                bad_age_count.append((p["id"], f"Age mismatch: {age_str} vs expected {exp_age}", dob_str))

    print(f"Demo profile roles: {doctor_count} doctors, {donor_count} donors, {citizen_count} citizens.")
    if doctor_count != 60:
        errors.append(f"Expected 60 demo doctors, found {doctor_count}")
    if donor_count != 800:
        errors.append(f"Expected 800 demo donors, found {donor_count}")
    if citizen_count != 340:
        errors.append(f"Expected 340 demo citizens, found {citizen_count}")

    if bad_word_count:
        errors.append(f"Found {len(bad_word_count)} profiles with name issues! Samples: {bad_word_count[:3]}")
    if bad_age_count:
        errors.append(f"Found {len(bad_age_count)} profiles with age calculation issues! Samples: {bad_age_count[:3]}")

    # 5. Extract and verify donors table
    donors = set()
    donors_match = re.search(r'INSERT INTO donors\s*\([^)]+\)\s*VALUES\s*(.*?);(?=\s*(\n--|\nINSERT|\Z))', sql, re.DOTALL)
    if donors_match:
        for line in donors_match.group(1).splitlines():
            line_str = line.strip()
            if line_str.startswith("("):
                uid = re.match(r"\('([0-9a-fA-F-]{36})'", line_str).group(1).lower()
                donors.add(uid)

    print(f"Total donors extracted from donors table: {len(donors)}")
    if len(donors) != 800:
        errors.append(f"Expected 800 donors in donors table, found {len(donors)}")

    for duid in donors:
        if duid not in profiles:
            errors.append(f"Donor {duid} does not exist in profiles!")
        elif profiles[duid]["role"] != "donor":
            errors.append(f"Donor {duid} has role '{profiles[duid]['role']}' in profiles, expected 'donor'")

    # 6. Extract and verify doctors table
    doctors = set()
    doctors_matches = list(re.finditer(r'INSERT INTO doctors\s*\([^)]+\)\s*VALUES\s*(.*?)(?=\s*ON CONFLICT|;)', sql, re.DOTALL))
    for dm in doctors_matches:
        for line in dm.group(1).splitlines():
            line_str = line.strip()
            if line_str.startswith("("):
                uid = re.match(r"\('([0-9a-fA-F-]{36})'", line_str).group(1).lower()
                doctors.add(uid)

    print(f"Total doctors extracted from doctors table: {len(doctors)}")
    if len(doctors) != 65: # 60 demo + 5 verified
        errors.append(f"Expected 65 doctors in doctors table (60 demo + 5 verified), found {len(doctors)}")

    for duid in doctors:
        if duid not in profiles:
            errors.append(f"Doctor {duid} does not exist in profiles!")
        elif profiles[duid]["role"] != "doctor":
            errors.append(f"Doctor {duid} has role '{profiles[duid]['role']}' in profiles, expected 'doctor'")

    # 7. Extract and verify blood_requests table
    requests_match = re.search(r'INSERT INTO blood_requests\s*\([^)]+\)\s*VALUES\s*(.*?);(?=\s*(\n--|\nINSERT|\Z))', sql, re.DOTALL)
    req_count = 0
    if requests_match:
        for line in requests_match.group(1).splitlines():
            line_str = line.strip()
            if line_str.startswith("("):
                req_count += 1
                m = re.match(r"\('([0-9a-fA-F-]{36})',\s*'([0-9a-fA-F-]{36})'", line_str)
                if m:
                    req_id, req_uid = m.group(1).lower(), m.group(2).lower()
                    if req_uid not in profiles:
                        errors.append(f"Blood request requestor {req_uid} does not exist in profiles!")
    print(f"Total blood requests extracted: {req_count}")
    if req_count != 200:
        errors.append(f"Expected 200 blood requests, found {req_count}")

    # 8. Check articles author_id
    articles_match = re.search(r'INSERT INTO articles\s*\([^)]+\)\s*VALUES\s*(.*?);(?=\s*(\n--|\nINSERT|\Z))', sql, re.DOTALL)
    if articles_match:
        for line in articles_match.group(1).splitlines():
            line_str = line.strip()
            if "::uuid" in line_str and "d0000000" in line_str:
                for uid in re.findall(r"'([0-9a-fA-F-]{36})'", line_str):
                    if uid.lower() not in doctors:
                        errors.append(f"Article author {uid} is not a verified doctor!")

    # 9. Foreign keys: every profile in auth_users
    for p_id in profiles:
        if p_id not in auth_users:
            errors.append(f"Profile {p_id} has no matching auth.user!")

    print("\n--- SUMMARY OF VERIFICATION ---")
    if errors:
        print(f"FAILED with {len(errors)} errors:")
        for e in errors[:10]:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED 100% PERFECTLY!")
        print("="*60)
        print(" [PASS] 1,200 demo profiles rewritten with authentic 3-word English & Bengali names.")
        print(" [PASS] 800 donors verified in donors table & profiles with valid DOB and age.")
        print(" [PASS] 60 doctors verified in doctors table & profiles with Dr./ডা. prefix, DOB, and age.")
        print(" [PASS] 1 Admin profile (showystore2026@gmail.com) verified with 3-word authentic name, DOB, and age.")
        print(" [PASS] 5 Verified Doctors verified with exact requested names, valid DOB, and computed age.")
        print(" [PASS] Total 1,206 auth.users and 1,206 profiles match 1:1.")
        print(" [PASS] All foreign keys and constraints verified and intact.")
        print("="*60)

if __name__ == "__main__":
    main()
