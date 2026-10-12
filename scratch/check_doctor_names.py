import re

with open('supabase/migrations/0008_demo_seed.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

profiles_match = re.search(r'INSERT INTO profiles\s*\((.*?)\)\s*VALUES\s*(.*?);(?=\s*(\n--|\nINSERT|\Z))', sql, re.DOTALL)
rows_text = profiles_match.group(2).strip()
rows = [r.strip() for r in rows_text.split('\n') if r.strip().startswith('(')]

doctor_names = []
for r in rows:
    m = re.match(r"\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'", r)
    if m and m.group(2) == 'doctor':
        doctor_names.append((m.group(3), m.group(4)))

print(f"Total doctors in 1200: {len(doctor_names)}")
for en, bn in doctor_names[:10]:
    print(f"EN: {en:<30} | BN: {bn}")
