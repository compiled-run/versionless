# cypress-realworld-app — two-lane browser parity + pass-twice determinism (GREEN)

**Unit** `lrapr-t017b/g2g-two-lane-parity-determinism` · **Role** holdout · **Result** migrated lane
**full green**, both lanes reach one behavior digest, each lane deterministic across two passes.
Measured 2026-08-13 by the in-contract calibrate driver; **not** a published or canonical witness
receipt (that re-freeze + Judge re-bless + publish is the follow-up phase).

## What this closes

g1 proved the migrated Vite lane BUILDS (transform through emit). g2f added the CRA process-global
parity capability so it BOOTS, renders, and reaches the signup form. This unit drives the FULL
calibrated journey on the migrated lane against the live Express/lowdb backend and proves it is
behaviourally indistinguishable from the baseline, deterministically, twice per lane. No RED: the
migrated lane revealed **no** behavioural divergence, so no pin, exception, or adapter change was
invented, and the frozen adapter was not touched.

## The journey (51 legs, both lanes)

signup → signin → onboarding first-bank-account (`POST /graphql`) → settings write (mutating
`PATCH /users/{created-user-id}`) → money-movement to a placeholdered peer (`POST /transactions`)
→ the minted transaction round-trips lowdb into the personal feed (`versionless-proof-payment`
asserted present, balance settled) → public/contacts/personal feed filter → notifications. Every
anchor is a settled-reaction wait, never a sleep. The backend is booted in the application's own
Node 14.16.1 era cell and reseeded from its frozen snapshot before **each** pass.

## Measured result — per lane, per pass

| lane | pass | legs | console | page | failed req | successfulNonLoopback | mockedNonLoopback |
|------|------|------|---------|------|-----------|----------------------|-------------------|
| baseline | 1 | 51/51 | 0 | 0 | 0 | 0 | 17 |
| baseline | 2 | 51/51 | 0 | 0 | 0 | 0 | 17 |
| migrated | 1 | 51/51 | 0 | 0 | 0 | 0 | 17 |
| migrated | 2 | 51/51 | 0 | 0 | 0 | 0 | 17 |

Tracked-event outcomes, identical on all four passes: `click 16, input 232, change 15, keydown 232,
mouseover 27`. Recorded navigation sequence, identical on all four:
`/signin · / · /user/settings · /transaction/new · / · /personal · / · /contacts · /personal · /notifications`.

Live loopback-backend category, identical on all four (the one server-minted id normalized):

```
GET   /checkAuth               x2 [200]
GET   /notifications           x2 [200]
GET   /transactions            x2 [200]
GET   /transactions/contacts   x1 [200]
GET   /transactions/public     x3 [200]
GET   /users                   x1 [200]
PATCH /users/{created-user-id} x1 [204]
POST  /graphql                 x3 [200]
POST  /login                   x1 [200]
POST  /transactions            x1 [200]
POST  /users                   x1 [201]
```

## The two digests carry the two guarantees

- **Two-lane parity** — the lane-independent behavior digest is one value across all four passes:

  ```
  behaviorDigest = 963785426eb0c56e8d2f929b5462d35e9a7a8d123fa9d8d01a765c6cb35ebe26   (baseline == migrated)
  ```

- **Pass-twice determinism** — the semantic digest (behavior folded with the lane's own byte
  identity) is byte-identical across a lane's two reseeded passes, and DIFFERS between the lanes,
  which is what makes the parity non-trivial: two genuinely different builds, one behavior.

  ```
  baseline semanticDigest = 5c3285f1c402920f358bed9cacedaac07d3ed4800251ed264f20a3f0030d49cf   (pass-1 == pass-2)
  migrated semanticDigest = 54313316fef5eac37d098a207bd1f140805f68b126291e62a69f99a75981e6ed   (pass-1 == pass-2)
  ```

## The one declared per-lane difference (kept OUT of the shared digest)

The only thing that legitimately differs between the lanes is the production bundle itself — a
webpack-4 tree and a rolldown tree are not the same bytes — and it is the sole member of the
per-lane `presentation` block, excluded from the behavior digest by construction:

```
baseline lane   84 files   57cea24966c61963914da814e8348c970f11468127228c070def6c6472980028
migrated lane   18 files   13f71830eb0fc79b37c546c59f5437d3c3b381c7e87ed8ebd844f8d1f6a95897
```

No behavioural or DOM presentation delta was measured; the migrated DOM behaves identically, so no
per-lane behaviour exception was declared.

## Locality + redaction (both lanes)

`successfulNonLoopback = 0` on every pass — the live loopback backend plus the one declared
non-loopback seam (the S3 avatar SVGs, answered in-context, counted as `mockedNonLoopback = 17`) are
the only origins reached, and every non-loopback request is to the declared
`cypress-realworld-app-svgs.s3.amazonaws.com` host. No seed PII reaches the evidence: the actor is
a fresh non-seed corpus identity, the created user id is normalized to `{created-user-id}`, and the
forbidden seed markers (`s3cret`, `$2a$`, `$2b$`, `$2y$`) are absent from the entire artifact.

## Gate

The guarantee is node-gate-enforced, not merely recorded:

- `packages/core/test/witness-react-cypress-rwa-parity.test.ts` — the parity/determinism gate and
  its falsification power: a dropped route, a different backend interaction, a within-lane
  pass-twice drift, a console/page/failed break, an undeclared backend endpoint, a leaked seed
  marker, a byte-identical (trivial) parity, and a missing/duplicated pass each fail the gate; the
  declared per-lane byte identity stays out of the shared behavior digest.
- `packages/cli/test/react-cypress-rwa-calibrate.test.ts` — the driver's minted-id capture and the
  normalization that makes two reseeded passes reach one behavior digest.

`pnpm exec tsc --noEmit` clean · `pnpm exec vp lint` 0 errors · `pnpm exec vp test --project node`.

## Reproduce

```
node --experimental-strip-types packages/cli/src/fixture/react-cypress-rwa-calibrate-run.ts parity
```

writes `evidence/runs/react-cypress-rwa/two-lane-parity.json` (the full per-pass measurement and
verdict) and prints the canonical verdict. Single lanes: `... react-cypress-rwa-calibrate-run.ts
baseline|migrated`.

## What is not claimed, and what comes next

No published or canonical witness receipt is written here, and no frozen SPA byte inventory is
claimed — the calibration phase asserts only browser-measured behaviour. The re-freeze at a fresh
boundary, the Judge re-bless, and the PASSING holdout receipt (superseding the RED record by
reference) are the follow-up units.
