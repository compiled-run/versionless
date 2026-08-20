verify failed: pnpm exec vp test --project node (exit 1)

Output tail:
/@voidzero-dev/vite-plus-test/dist/@vitest/runner/chunk-artifact.js:302:14
 ❯ .versionless/cache/pnpm-virtual-store/@voidzero-dev+vite-plus-test@0.1.20_@types+node@24.12.2_typescript@5.9.3_vite@8.0.16_@types+node@24.12.2_/node_modules/@voidzero-dev/vite-plus-test/dist/@vitest/runner/chunk-artifact.js:1903:28
 ❯ .versionless/cache/pnpm-virtual-store/@voidzero-dev+vite-plus-test@0.1.20_@types+node@24.12.2_typescript@5.9.3_vite@8.0.16_@types+node@24.12.2_/node_modules/@voidzero-dev/vite-plus-test/dist/@vitest/runner/chunk-artifact.js:2326:24
 ❯ runWithCancel .versionless/cache/pnpm-virtual-store/@voidzero-dev+vite-plus-test@0.1.20_@types+node@24.12.2_typescript@5.9.3_vite@8.0.16_@types+node@24.12.2_/node_modules/@voidzero-dev/vite-plus-test/dist/@vitest/runner/chunk-artifact.js:2323:12
 ❯ .versionless/cache/pnpm-virtual-store/@voidzero-dev+vite-plus-test@0.1.20_@types+node@24.12.2_typescript@5.9.3_vite@8.0.16_@types+node@24.12.2_/node_modules/@voidzero-dev/vite-plus-test/dist/@vitest/runner/chunk-artifact.js:2305:24

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  |node| packages/trust/test/trust-package.test.ts > offline-first trust package > replays the deterministic core while keeping observations outside it
AssertionError: expected { verticals: 20, …(2) } to deeply equal { verticals: 20, …(2) }

- Expected
+ Received

  {
    "designatedPilotsVerified": 0,
-   "sourceApplications": 13,
+   "sourceApplications": 15,
    "verticals": 20,
  }

 ❯ packages/trust/test/trust-package.test.ts:993:32
    991|     * off the rows rather than declared.
    992|     */
    993|    expect(conformance.summary).toEqual({
       |                                ^
    994|     verticals: 20,
    995|     sourceApplications: 13,
 ❯ .versionless/cache/pnpm-virtual-store/@voidzero-dev+vite-plus-test@0.1.20_@types+node@24.12.2_typescript@5.9.3_vite@8.0.16_@types+node@24.12.2_/node_modules/@voidzero-dev/vite-plus-test/dist/@vitest/runner/chunk-artifact.js:1903:22

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

