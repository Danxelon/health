import shutil, os

src = r"H:\creativity\health\scratch\generate_0008_full_names.py"
dst_dir = r"C:\Users\MCC_CL 04\.gemini\antigravity-cli\brain\bd825415-6e8d-4bbd-ab49-e9c447b29482\scratch"
os.makedirs(dst_dir, exist_ok=True)
dst = os.path.join(dst_dir, "generate_0008_full_names.py")
shutil.copyfile(src, dst)

parent_dst_dir = r"C:\Users\MCC_CL 04\.gemini\antigravity-cli\brain\3b3f1257-9fbd-43e7-90d8-4f54602369f3\scratch"
os.makedirs(parent_dst_dir, exist_ok=True)
parent_dst = os.path.join(parent_dst_dir, "generate_0008_full_names.py")
shutil.copyfile(src, parent_dst)
print("Copied successfully to brain scratch directories.")
