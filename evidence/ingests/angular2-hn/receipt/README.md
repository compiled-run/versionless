# Angular2-HN acquisition readiness

The pinned source and official Node 12.22.12 Linux-x64 archive were acquired and verified under consent `T335-angular2-hn-source-runtime-acquisition`. The source archive, tree, all 102 Git blobs, lock bytes, and Node checksum match. No package was fetched or executed; no install, build, browser, migration, or publication occurred.

Readiness is blocked. There is no retained strongly hashed Yarn 1 runtime with exact license evidence. Yarn v1 does not provide artifact sizes, license metadata, lifecycle scripts, native-addon facts, or platform constraints, so exact dependency ceilings and closure safety cannot yet be established. The pinned PWA configuration also references an absent `src/manifest.webmanifest`; all source bytes are sealed and must remain unchanged. Node 12.22.12 is EOL historical compatibility evidence requiring a verified isolated Linux-x64 executor, not a maintained or supported runtime.
