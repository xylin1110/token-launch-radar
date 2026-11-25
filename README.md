# Token Launch Radar

A token launch radar for the make.fun `token-radar-01` bounty: it reads a sealed
snapshot of every protocol DefiLlama tracks, ranks the ones that record no token yet
by what a launch would be worth, and shows a reader how to farm each one.

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/xylin1110/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/xylin1110/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

## What it does

- **Fitted value model (`radar-fit-1`)** — no hand-picked constants. At run time the
  program fits category mcap/TVL multiples from the 94 live-token peers in the
  snapshot (winsorised, shrunk toward the global median), a log-log size term, and
  scores every pre-token protocol as
  `TVL × multiple × size × growth × maturity`.
- **Launch odds as a range** — each protocol's cohort (age band × TVL tier) token
  share with a Wilson 90% interval. A range, never a point claim.
- **Held-out checks** — leave-one-out and walk-forward validation of the fitted
  model against the live peers' market caps, computed at build time and shown on
  the Model tab.
- **Costed farm plans** — seven steps per protocol with capital, gas per week,
  minutes per week and dollars of gas per hour of the farmer's time.
- **Integrity strip** — all 758 protocols accounted for: 178 ranked, 20 above the
  floor left off the house watchlist, 144 excluded pre-token protocols, 416 live.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22.18 or later, standard library only. The run is deterministic: the same
snapshot always writes the same bytes to `out/` (`board.json`, `data.js`,
`dashboard/`, `screenshots/`, `dossier.json`).

## Layout

- `main.ts` — the entry program (Node 22, TypeScript run as-is)
- `lib/model.ts` — the fitted model, cohort odds, validation and farm plans
- `vendor/makefun-board.ts` — make.fun's dashboard-dossier library, byte for byte
  from the kit
- `dashboard/` — the static page (no network): board, detail view, filters,
  model sandbox, live-token peers
- `screenshots/` — the board, a protocol detail view and a filtered view

## Standing

Implied values and launch odds are this radar's own claims, fitted from the
snapshot at run time. A protocol "records no token" — the list is DefiLlama's
record, not proof. Nothing here is investment advice.
