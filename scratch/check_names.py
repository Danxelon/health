import re

with open('supabase/migrations/0008_demo_seed.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

profiles_match = re.search(r'INSERT INTO profiles\s*\((.*?)\)\s*VALUES\s*(.*?);(?=\s*(\n--|\nINSERT|\Z))', sql, re.DOTALL)
rows_text = profiles_match.group(2).strip()
rows = [r.strip() for r in rows_text.split('\n') if r.strip().startswith('(')]

print(f"Total rows: {len(rows)}")

bad_en = []
bad_bn = []
roles_count = {}

for idx, r in enumerate(rows):
    # Regex parse
    m = re.match(r"\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'", r)
    if not m:
        print(f"Row {idx} failed regex: {r[:60]}")
        continue
    pid, role, full_name, full_name_bn, phone, nid, last4, dob, gender = m.groups()
    roles_count[role] = roles_count.get(role, 0) + 1
    
    en_words = full_name.split()
    bn_words = full_name_bn.split()
    
    if len(en_words) != 3:
        bad_en.append((idx, full_name, len(en_words)))
    if len(bn_words) != 3:
        bad_bn.append((idx, full_name_bn, len(bn_words)))

print("Roles count:", roles_count)
print(f"Bad EN count: {len(bad_en)}, Bad BN count: {len(bad_bn)}")
if bad_en:
    print("Sample bad EN:", bad_en[:5])
if bad_bn:
    print("Sample bad BN:", bad_bn[:5])
