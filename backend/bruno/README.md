# PoS Backend — Bruno collection

One-click integration run for the whole API (mirrors `scripts/e2e.mjs`).

## Setup (once)

1. Open Bruno → **Open Collection** → select this `bruno/` folder.
2. Top-right environment dropdown → **`local`** (`baseUrl: http://localhost:3000`).
3. Start backend + redis.

## Run

Right-click the collection → **Run**. Requests fire in folder/`seq` order;
IDs chain automatically via `bru.setVar` scripts. Re-runs are safe: every
run mints a fresh `stamp`, so users/shops never collide.

## Notes

- Bruno shares one cookie jar per run, so session switches are explicit
  `signin` requests ("restore session" / "switch session" steps).
- Skipped here, covered by `npm run test:e2e`: anonymous-401 checks (the jar
  always carries a session) and the expired-invite case (needs a DB tweak).
- Keeps behind for manual poking: owner user, `Bruno Shop A Renamed`.
