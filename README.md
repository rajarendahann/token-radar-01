# token-radar-01

Token launch radar: ranks pre-token protocols by implied value, with a per-protocol detail view and step-by-step farm plans.

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/rajarendahann/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/rajarendahann/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

## Run

    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json

Writes `out/board.json` (180 ranked rows, full watchlist covered), the dashboard in `out/dashboard/`, three screenshots, and `out/dossier.json`. Node.js 22.18+, standard library only, no network at run time.

## Layout

- `main.ts` — reads the sealed snapshot, ranks protocols, writes the board and dashboard data
- `lib/model.ts` — implied-value model: TVL power scaling, 7d momentum, category weights, chain diversity, age multiplier, and a wrapped-derivative penalty
- `dashboard/` — static dark dashboard: ranked board, protocol detail view, search + category + chain filters
- `screenshots/` — board, detail and filtered views

Built for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01).
