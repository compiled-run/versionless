# eShop WebSPA holdout — browser-parity Witness

- Result: pass
- Unit: lrapr-t024/u6-eshop-witness-journeys
- Fixture: angular-eshop-webspa-netcore2-2
- Source: dotnet-architecture/eShopOnContainers@a387f21029f0b2d49614d165d5384717d2398f8e
- Adapter composite: 27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234
- Behavior parity digest: 585ae9ecdf637ace7031624b00750a3c03c7f8f900e60017c55b8ee4f973a363
- Canonical digest: 92fa51439620c5801ad9c14edd6883fa3b387f08f9de56f7acdebca50b214449

## Lanes

| Lane | Output | Files | Inventory sha256 | Semantic digest |
| --- | --- | --- | --- | --- |
| baseline | .versionless/work/angular-eshop-webspa/build-run1 | 25 | 73e265d981f0a1cca5c339ecb331c28dd41572d43855bc392f28532290325158 | 6dc103f894d5675893cc3b7d21f8c9fd573c10c35e1313d00cda8979c98cfc0c |
| migrated | .versionless/work/angular-eshop-webspa/target/app/wwwroot | 25 | 3b859e5b508c1e3fada6dea2addc0d42120861a2364cb0cd13fa79187fc5ecad | ed7ee72271f55ea09cebf4b1ed0240faa40312a0e4488d404553980db4a9cec7 |

## Declared same-origin projection

- Label: synthetic-fixture-evidence-data
- Transport: same-origin-bounded-loopback-api
- Behavior digest: 747dc5258b30703c9b29f3c0087e1728e93fc160f1cbf3c53f9589ee09aad849
- Seed: fixtures/angular-eshop-webspa/witness-projection-seed.json (0331b52060f5d9e3cba94108536ed5e854f98c3e4652dffcb7c78aceacdeac08)
- Ledger: 8 served, 0 refused-unknown, 0 refused-unprojected, 18 declined-non-api
- Identical across both lanes: yes

## Surface limits

- **identity** (out-of-surface) — SecurityService.Authorize() navigates the document to an IdentityServer '/connect/authorize' endpoint; no identity provider is projected, so Login is never exercised and nothing behind it is claimed.
- **basket** (out-of-surface) — the add-to-cart control renders disabled for an anonymous visitor and esh-basket-status is not rendered at all, so no basket behavior is exercised or claimed.
- **orders** (out-of-surface) — the orders routes are reachable only from the authenticated identity menu.
- **campaigns** (out-of-surface) — campaigns are gated behind both identity and the configuration switch, which the declared payload leaves off.
- **signalr** (not-reached) — SignalrService.init() returns before building a hub connection unless the visitor is authorized, so the anonymous run opens no socket.
- **text-entry** (not-tested) — the anonymous catalog surface has no text input; the journey drives clicks, keyboard selection and a genuine wheel scroll, and claims no typing coverage.
- **drag** (not-tested) — the anonymous catalog surface has no drag affordance.

## Mutation

- Seam: ` products - Page ` in main.f02d2dbc7ec47246.js
- Before: d8338270edad07a2f37828def4369e9325f761c787b992c68dd03177a7f710bf
- Mutated: 65f40188b0b7641632ecbdde6e29147c468a23c029695213bd6733459bbf4588
- After restore: d8338270edad07a2f37828def4369e9325f761c787b992c68dd03177a7f710bf
- Restored run: pass

## Non-claims

- This is one Angular holdout under direct Witness. It does not establish generic Angular support, a designated pilot, or readiness beyond this exact lineage cell, and it is not counted in any lineage numerator.
- The API this journey talks to is a frozen synthetic same-origin loopback projection authored for this fixture, NOT the eShopOnContainers .NET microservices. No captured production payload, no real catalogue, no real account and no real user data are involved, and nothing here is evidence about those services.
- The synthetic catalogue deliberately does not reproduce the upstream seed data, so nothing here should be read as evidence about the real catalog service or its contents.
- Identity is out of surface. No IdentityServer is projected, Login is never exercised, and every surface behind it — basket, orders, campaigns, the SignalR hub — is unproven rather than proven absent.
- Text entry and drag are not tested, because the anonymous catalog surface offers neither.
- The application's own test suites were not run; this is a browser proof of the journeys named above, not a substitute for the upstream suite.
- Locality is process-scoped and does not establish operating-system-wide isolation.
- Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.
