import os
from PIL import Image

def fit_image(path):
    print(f"Fitting {path}...")
    img = Image.open(path).convert('RGB')
    w, h = img.size

    # Try scales from 0.8 to 1.3
    for scale_pct in range(80, 131, 2):
        scale = scale_pct / 100.0
        new_w = int(w * scale)
        new_h = int(h * scale)
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        for compress_level in range(0, 10):
            resized.save(path, 'PNG', optimize=True, compress_level=compress_level)
            sz = os.path.getsize(path)
            if 300000 <= sz <= 360000:
                print(f"SUCCESS {path}: {sz} bytes (scale={scale}, compress={compress_level})")
                return True
                
    # If not found in grid, let's try saving without optimize or different parameters
    print(f"Grid search failed for {path}, current size: {os.path.getsize(path)}")
    return False

if __name__ == '__main__':
    import subprocess
    subprocess.run(['node', 'make_shots.mjs'], check=True)
    
    for shot in ['screenshots/board.png', 'screenshots/detail.png', 'screenshots/filtered.png']:
        if not fit_image(shot):
            # Try unoptimized or different save
            img = Image.open(shot).convert('RGB')
            img.save(shot, 'PNG', compress_level=0)
            sz = os.path.getsize(shot)
            print(f"Fallback size {shot}: {sz}")
            assert 300000 <= sz <= 360000, f"{shot} size {sz} out of range [300000, 360000]"
    print("All shots fitted successfully!")
