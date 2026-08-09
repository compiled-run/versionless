# React Boilerplate harness exclusion

- Result: **excluded**
- Classification: `invalid-cross-build-cache-expectation`
- Candidate status: terminal, non-retriable, and not counted
- Canonical evidence digest: `11b50eba1425d3491d49ecb61056c2f83de4335102deb0a06b0f5fc5d47a2828`

The fresh service worker used the expected deterministic cache name and described the current build: 4 main paths, 17 additional paths, and 1 metadata path, for 22 paths total. Its path-list digest is `b4ba0382b25cb1cb8dd3615cff84591a0ac322542fc288a535c60a19fdf3dc4d`. The observed static-ledger projection contains 37 rows and 22 unique paths with canonical digest `9fe8ff1ae6ba04ebdd80e46abaeb125c9808c3963c8088d23e2c1074b97f1bf4`.

The harness compared these current-build content hashes with filenames fixed to the older T060 build. This establishes an invalid cross-build expectation, not application divergence. Raw receipt, HTML, screenshot, and service-worker bytes are not published; the machine receipt retains only logical references and SHA-256 identities.

Missing proof remains explicit: controlled offline behavior, the migrated lane, cross-lane parity, mutation and restoration, candidate publication, and aggregate/receipt/trust linkage. This exclusion does not change corpus, harness, pilot, or readiness counts and does not establish certification, signer authenticity, compliance, or application parity.
