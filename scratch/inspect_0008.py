import re

with open('supabase/migrations/0008_demo_seed.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Find all occurrences of INSERT INTO profiles
all_prof = list(re.finditer(r'INSERT INTO profiles\s*\((.*?)\)\s*VALUES', sql, re.DOTALL))
print(f"Total INSERT INTO profiles: {len(all_prof)}")
for i, m in enumerate(all_prof):
    cols = [c.strip() for c in m.group(1).split(',')]
    print(f"Match {i+1} cols: {cols}")
