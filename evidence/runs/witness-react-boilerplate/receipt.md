# React Boilerplate direct-Witness receipt

- Result: **pass**
- Canonical SHA-256: `bfa48f718ee86566f120cb0bc42645b22c989a27d87c102b9c2f256d15661ed7`
- Bound migration receipt: `52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21`
- Qualification runs: 2 baseline + 2 migrated production-static passes
- Interaction coverage per run: click, type, press, hover, scroll
- Behavioral parity: `06a81d050598507a093bfe3d413f5b70991bc88de816c9c38dc26207e5481b35`
- Mutation-red/restoration: missing original German heading assertion; byte-identical restoration; restored run passed
- Successful non-loopback requests: 0
- React lineage readiness: 0/4, candidate not counted pending Judge audit
- Angular lineage readiness: 1/4
- Harness readiness: 0/4

## Boundaries

- One immutable React Boilerplate lineage is a candidate only and does not establish generic React support or advance readiness before Judge audit.
- API fulfillment is synthetic and online-only; API caching, Redux persistence and prior-result persistence are not claimed.
- Drag is not-tested because the selected journey has no genuine drag surface.
- Locality is process-scoped and does not establish OS-wide isolation.
- Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.
