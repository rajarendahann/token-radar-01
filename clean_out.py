import os, shutil

if os.path.exists('out'):
    shutil.rmtree('out')
os.makedirs('out', exist_ok=True)
print("Cleaned out/")
