import json
import re

with open('input/snapshot.json') as f:
    snap = json.load(f)

wl = set(snap['watchlist'])
cats = {'bridge', 'canonical bridge', 'liquid staking', 'liquid restaking', 'restaked btc', 'cex', 'bridged'}
word_re = re.compile(r'\b(wrapped|staked|staking|bridged)\b', re.I)
ver_re = re.compile(r'\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$')

def is_wrapped_deriv(p):
    no_token = p['gecko_id'] is None and p['symbol'] is None
    cat = (p['category'] or '').lower().strip()
    cat_match = cat in cats
    word_match = bool(word_re.search(p['name']))
    ver_match = bool(ver_re.search(p['name']))
    return no_token and (cat_match or word_match or ver_match)

print("Matching protocols (no_token AND (cat_match OR word_match OR ver_match)):")
for p in sorted([p for p in snap['protocols'] if not p['slug'] in wl and is_wrapped_deriv(p)], key=lambda x: x['tvl_usd'], reverse=True)[:25]:
    print(f"  {p['slug']} | {p['name']} | Cat: {p['category']} | TVL: {p['tvl_usd']}")
