# cypress-realworld-app — holdout PASS receipt (re-run under the frozen adapter)

- Outcome: **passed** — the frozen adapter carries this application at this revision, end to end
- Kind: witness-journey-under-frozen-adapter
- Canonical SHA-256: 76f0b5bd0d8a3fa0596d3c5d190c764ee7402f4e5c27870d36bdb3fa5f04a73e
- Unit: `lrapr-t019/u1-refreeze-rerun-publish`
- Advances by reference: `evidence/runs/holdout-react-cypress-rwa/rerun-2026-08-12/receipt.json` — Advances the T017 RED re-run by reference; the tranche-one and T017 FAIL records stay immutable and published.
- Source: https://github.com/cypress-io/cypress-realworld-app at `refs/tags/v1.0.18` (`f6b5cf3a1799998dab71181eeed59460f8ada5f4`, MIT), create-react-app 4.0.3 over webpack 4.44.2, React 17.0.2, TypeScript 4.3.4
- Frozen adapter fingerprint: `4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7` over 5 subtrees, recomputed by this unit; adapter bytes changed: 0; reopened in this unit: false
- Derived from committed run evidence: `evidence/runs/react-cypress-rwa/two-lane-parity.json` (`689952c7216b562bf3df52516683aa2e15aff3beb393a2c1654d03d967b50288`), `evidence/runs/react-cypress-rwa/green-2026-08-13/build-profile.json` (`f831eba3f19d1e401aa14f6c64dbfe93aa08fd1fa55a363d6c062d9cc79762f5`)

## The migrated build under the frozen adapter

createCraViteAdapter applied through fixtures/react-cypress-rwa/vite.config.ts, nothing holdout-specific in the config — **green**, rolldown 1.0.3 under vite 8.0.16, 2 attempts, deterministic: true. 10182 modules transformed (transform complete, emit complete), 18 output files, output digest `7051b8489abcaea1bd18ae99a082acf0c8d88596f1dfd82d6b4bac222e37dc18`.

## The measured journey — two lanes, twice each, live loopback backend

- Behaviour digest (shared across both lanes and both passes): `963785426eb0c56e8d2f929b5462d35e9a7a8d123fa9d8d01a765c6cb35ebe26` — two-lane behaviour parity: true, over genuinely distinct builds: true
- Baseline lane: 51/51 legs, semantic digest `5c3285f1c402920f358bed9cacedaac07d3ed4800251ed264f20a3f0030d49cf` (deterministic across 2 passes), 84 SPA files, bundle digest `57cea24966c61963914da814e8348c970f11468127228c070def6c6472980028`
- Migrated lane: 51/51 legs, semantic digest `54313316fef5eac37d098a207bd1f140805f68b126291e62a69f99a75981e6ed` (deterministic across 2 passes), 18 SPA files, bundle digest `13f71830eb0fc79b37c546c59f5437d3c3b381c7e87ed8ebd844f8d1f6a95897`
- Recorded navigations: `/signin` → `/` → `/user/settings` → `/transaction/new` → `/` → `/personal` → `/` → `/contacts` → `/personal` → `/notifications`
- Locality: successful non-loopback requests: 0; mocked non-loopback (in-context avatar SVGs): 17; live-backend category endpoints: 11

## Determinism and locality

- Re-seeded from the frozen snapshot before every pass: true; minted values placeholdered: true; pass-twice semantic digest stable: true
- Locality mode: live-loopback-backend; successful non-loopback: 0; OS-wide isolation: false

## Counting and non-claims

Legs per lane: 51; lanes measured: 2; passes per lane: 2; counted in lineage numerator: false. This holdout passed, and it is still counted in no lineage numerator: a passing holdout shows the frozen adapter carrying one further application, not a migrated-application product count. It is published rather than folded into any numerator.

- This is a holdout, not a certification: it shows the frozen adapter carrying one further application end to end, not generic support.
- It is counted in no lineage numerator. A holdout that passes is still evidence about the adapter, not a migrated-application count.
- Build-level byte parity across the two lanes is not claimed: the two production bundles are genuinely distinct builds, which is exactly what makes the behaviour parity non-trivial. The only per-lane fact is each lane’s own bundle byte identity, kept out of the shared behaviour digest by construction.
- Nothing is claimed about the four external auth provider modes; only the local passport-local mode is exercisable offline and only it was exercised.
- The live loopback backend is the application’s own Express-over-lowdb server, re-seeded from its frozen snapshot before every pass and held out of the byte inventory; the frontend SPA dist is byte-identical before and after each pass.
