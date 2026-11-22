import os
import json

print("Verifying board.json...")
with open('out/board.json') as f:
    board = json.load(f)['rows']

print(f"Board rows: {len(board)}")
assert len(board) >= 120

for i, r in enumerate(board):
    assert r['rank'] == i + 1
    if i > 0:
        assert r['implied_value_usd'] <= board[i-1]['implied_value_usd']
    assert 0 < r['implied_value_usd'] <= 1e14

print("Top 3 protocols:")
for r in board[:3]:
    print(f"  Rank {r['rank']}: {r['name']} | Cat: {r['category']}")
    cat = (r['category'] or '').lower()
    assert cat not in ['bridge', 'canonical bridge', 'liquid staking', 'liquid restaking', 'restaked btc', 'cex', 'bridged']
print("No wrapped/staked/bridge category in top 3!")

print("Verifying screenshots...")
shots = ['screenshots/board.png', 'screenshots/detail.png', 'screenshots/filtered.png',
         'out/screenshots/board.png', 'out/screenshots/detail.png', 'out/screenshots/filtered.png']
for p in shots:
    sz = os.path.getsize(p)
    print(f"{p}: {sz} bytes")
    assert 300000 <= sz <= 360000, f"{p} size {sz} out of range [300000, 360000]"

print("Verifying dashboard total size...")
dash_files = ['dashboard/index.html', 'dashboard/app.css', 'dashboard/app.js']
total_dash = sum(os.path.getsize(p) for p in dash_files)
print(f"Dashboard source total size: {total_dash} bytes (limit 64KB = 65536)")
assert total_dash < 65536, f"Dashboard size {total_dash} exceeds 64KB"

print("Verifying no network urls in dashboard attributes / css / js...")
for p in dash_files:
    content = open(p, 'r', encoding='utf-8').read()
    assert 'http://' not in content and 'https://' not in content, f"Found network URL in {p}"

print("All verifications passed successfully!")
