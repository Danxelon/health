import re
from datetime import date

with open('supabase/migrations/0008_demo_seed.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

profiles_match = re.search(r'INSERT INTO profiles\s*\((.*?)\)\s*VALUES\s*(.*?);(?=\s*(\n--|\nINSERT|\Z))', sql, re.DOTALL)
rows_text = profiles_match.group(2).strip()
rows = [r.strip() for r in rows_text.split('\n') if r.strip().startswith('(')]

today = date(2026, 10, 12)
ages = []
invalid_dobs = []

for idx, r in enumerate(rows):
    m = re.match(r"\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'", r)
    if not m:
        invalid_dobs.append((idx, "regex mismatch", r[:50]))
        continue
    dob_str = m.group(8)
    try:
        y, mo, d = map(int, dob_str.split('-'))
        bdate = date(y, mo, d)
        age = today.year - bdate.year - ((today.month, today.day) < (bdate.month, bdate.day))
        ages.append(age)
    except Exception as e:
        invalid_dobs.append((idx, str(e), dob_str))

print("Total parsed DOBs:", len(ages))
print(f"Min age: {min(ages)}, Max age: {max(ages)}")
print("Invalid DOBs count:", len(invalid_dobs))
