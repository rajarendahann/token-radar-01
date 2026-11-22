import os
from PIL import Image

def target_size(input_path, output_path, target_min=300000, target_max=360000):
    img = Image.open(input_path)
    # If image has alpha, convert to RGB
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        bg = Image.new('RGB', img.size, (15, 23, 18))
        bg.paste(img, mask=img.splitval()[-1] if img.mode == 'RGBA' else None) # wait, handle alpha safely
        img = img.convert('RGB')

    # Let's try different heights or compression levels or scaling to hit the target size range
    # First let's check base save with compress_level=6
    for scale in [1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7]:
        w, h = img.size
        new_w = int(w * scale)
        new_h = int(h * scale)
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        for compress_level in range(0, 10):
            resized.save(output_path, 'PNG', optimize=True, compress_level=compress_level)
            sz = os.path.getsize(output_path)
            print(f"scale={scale}, compress={compress_level} -> {sz} bytes")
            if target_min <= sz <= target_max:
                print(f"SUCCESS: {output_path} is {sz} bytes")
                return True
    
    # If exact hit not found by scale/compress, let's find the closest or adjust
    print(f"Could not hit exact range for {input_path}")
    return False

# Let's test on board.png if it exists
if os.path.exists('screenshots/board.png'):
    print("Testing optimization...")
    # target_size('screenshots/board.png', 'screenshots/board.png')
