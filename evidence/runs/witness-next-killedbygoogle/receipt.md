# KilledByGoogle Next 12 direct-Witness receipt

- Result: **pass**
- Canonical SHA-256: `da376ad77386a9f48c9be076fbe2131ebc249338df8f38f415e5830659a3f2ef`
- Bound migration receipt: `a018c6490cd559fab74ea402ff93660f053503dbed1a52ba9b68ed7fdc086b7c`
- Qualification runs: 2 baseline + 2 migrated production-static passes
- Meaningful journey: 263 rows; one Google+ search result; keyboard reset; Apps (50) and 50 rows; hover and scroll
- Raw navigation events per run: 0
- Behavioral parity: `1c13575d9aacddcfe159f54b48d390cdcbbb9ac98b788dd21de9fa5524c8dfe7`
- Mutation-red/restoration: exact missing Google+ assertion; zero unrelated errors; byte-identical restoration; restored run passed
- Successful non-loopback requests: 0
- Older Next readiness: 0/4, candidate not counted pending Judge audit
- React lineage readiness: 1/4
- Angular lineage readiness: 1/4
- Harness readiness: 0/4

## Exact prerender support

- baseline: build `syVkoUOI9y_1eQpBWrx_a`; manifest `d028a7b1b4c69e38d2c6a91911f19eceb9d3d8530b450ffd0e1cd84b5af3e455`; source/staged payload `9c438dbfa8ba2c6c9e17fbacd9503134ff0f947cbb30f3d4f0b5cb5d4afb0c25` (86917 bytes); GET `/_next/data/syVkoUOI9y_1eQpBWrx_a/index.json` -> 200 `application/json`
- migrated: build `Ta8U_1AmFceOdWrITQBKm`; manifest `4a5ea4c87d9556f128d6409f397c2562195f11523ea2bdf5785f488e5a1f68b6`; source/staged payload `9c438dbfa8ba2c6c9e17fbacd9503134ff0f947cbb30f3d4f0b5cb5d4afb0c25` (86917 bytes); GET `/_next/data/Ta8U_1AmFceOdWrITQBKm/index.json` -> 200 `application/json`

## Boundaries

- One immutable Next 12 Pages fixture is a candidate only and does not establish generic Next support or advance older Next readiness before Judge audit.
- Empty navigation events reflect the raw Witness record; an initial route was not synthesized.
- Drag is not-tested because the selected journey has no genuine drag surface.
- Locality is process-scoped and does not establish OS-wide isolation.
- Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.
