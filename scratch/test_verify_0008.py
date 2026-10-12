import re
import datetime
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent))

from generate_0008_full_names import split_sql_row

def test_migration_file():
    with open("supabase/migrations/0008_demo_seed.sql", "r", encoding="utf-8") as f:
        sql = f.read()

    assert "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INT;" in sql, "age column missing"
    assert "CREATE OR REPLACE FUNCTION set_profile_age()" in sql, "trigger function missing"
    assert "CREATE TRIGGER trg_set_profile_age" in sql, "trigger missing"

    # Find the profiles insert statement
    m = re.search(r"INSERT INTO profiles \((.*?)\) VALUES", sql)
    assert m, "Profiles INSERT statement not found"
    columns = [c.strip() for c in m.group(1).split(",")]
    assert "age" in columns
    assert columns.index("age") == columns.index("date_of_birth") + 1

    # Extract all lines in the profiles VALUES section
    lines = sql.splitlines()
    profile_rows = []
    in_profiles = False
    for line in lines:
        if line.startswith("INSERT INTO profiles (") and "VALUES" in line:
            in_profiles = True
            continue
        if in_profiles:
            trimmed = line.strip()
            if trimmed.startswith("('"):
                profile_rows.append(trimmed)
                if trimmed.endswith(");"):
                    in_profiles = False
                    break

    print(f"Total profile rows found: {len(profile_rows)}")
    assert len(profile_rows) == 1200, f"Expected 1200 rows, found {len(profile_rows)}"

    ref_date = datetime.date(2026, 10, 12)

    for idx, row_line in enumerate(profile_rows):
        toks, is_last = split_sql_row(row_line)
        assert len(toks) == 21, f"Row {idx} has {len(toks)} columns instead of 21"
        if idx == 1199:
            assert is_last, "Last row should end with );"
        else:
            assert not is_last, f"Row {idx} should end with ),"

        en_name = toks[2].strip("'")
        bn_name = toks[3].strip("'")
        dob_str = toks[7].strip("'")
        age_int = int(toks[8])

        en_words = en_name.split()
        bn_words = bn_name.split()

        assert len(en_words) == 3, f"Row {idx}: EN name '{en_name}' is not 3 words"
        assert len(bn_words) == 3, f"Row {idx}: BN name '{bn_name}' is not 3 words"

        dob = datetime.date.fromisoformat(dob_str)
        assert 1965 <= dob.year <= 2005, f"Row {idx}: DOB {dob} out of range"

        expected_age = ref_date.year - dob.year - ((ref_date.month, ref_date.day) < (dob.month, dob.day))
        assert age_int == expected_age, f"Row {idx}: Age {age_int} != expected {expected_age}"

    print("SUCCESS: All 1,200 profile rows verified! 100% compliant with 3-word English/Bengali names, valid DOB (1965-2005), and calculated age.")

if __name__ == "__main__":
    test_migration_file()
