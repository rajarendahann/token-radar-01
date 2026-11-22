import os
from PIL import Image

shots = ['screenshots/board.png', 'screenshots/detail.png', 'screenshots/filtered.png']
for path in shots:
    sz = os.path.getsize(path)
    with Image.open(path) as img:
        print(path, sz, img.size)
