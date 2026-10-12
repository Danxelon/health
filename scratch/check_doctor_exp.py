import re
from datetime import date

with open('supabase/migrations/0008_demo_seed.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

today = date(2026, 10, 12)

# Parse profiles
profiles_match = re.search(r'INSERT INTO profiles\s*\((.*?)\)\s*VALUES\s*(.*?);(?=\s*(\n--|\nINSERT|\Z))', sql, re.DOTALL)
rows_text = profiles_match.group(2).strip()
rows = [r.strip() for r in rows_text.split('\n') if r.strip().startswith('(')]

profile_map = {}
for r in rows:
    m = re.match(r"\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'", r)
    if m:
        uid, role, en, bn, phone, nid, last4, dob = m.groups()
        y, mo, d = map(int, dob.split('-'))
        bdate = date(y, mo, d)
        age = today.year - bdate.year - ((today.month, today.day) < (bdate.month, bdate.day))
        profile_map[uid] = {'role': role, 'age': age, 'dob': dob, 'en': en}

# Parse doctors
doctors_match = re.search(r'INSERT INTO doctors\s*\((.*?)\)\s*VALUES\s*(.*?);(?=\s*(\n--|\nINSERT|\Z))', sql, re.DOTALL)
doc_rows = [r.strip() for r in doctors_match.group(2).strip().split('\n') if r.strip().startswith('(')]

doc_issues = []
for r in doc_rows:
    m = re.match(r"\('([^']+)',\s*'([^']+)',\s*(\d+),\s*'(\{[^}]+\})',\s*(\d+),", r)
    if m:
        uid, bmdc, spec, deg, exp = m.groups()
        exp = int(exp)
        prof = profile_map.get(uid)
        if prof:
            # age should be >= exp + 23
            if prof['age'] < exp + 23:
                doc_issues.append((uid, prof['en'], prof['age'], exp, prof['dob']))

print(f"Doctor issues where age < exp + 23: {len(doc_issues)}")
for iss in doc_issues[:5]:
    print(iss)
