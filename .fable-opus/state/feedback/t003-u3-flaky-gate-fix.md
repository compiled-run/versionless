verify failed: pnpm exec vp test --project node (exit 1)

Output tail:
son":null,"responseTimeMs":1786384338509,"startTimeMs":1786384338502,"status":200},{"durationMs":7,"endTimeMs":1786384338544,"failedReason":null,"responseTimeMs":1786384338544,"startTimeMs":1786384338537,"status":200},{"durationMs":8,"endTimeMs":1786384338135,"failedReason":null,"responseTimeMs":1786384338135,"startTimeMs":1786384338127,"status":200},{"durationMs":8,"endTimeMs":1786384338376,"failedReason":null,"responseTimeMs":1786384338376,"startTimeMs":1786384338368,"status":200},{"durationMs":9,"endTimeMs":1786384338719,"failedReason":null,"responseTimeMs":1786384338719,"startTimeMs":1786384338710,"status":200}],"method":"GET","reason":"net::ERR*ABORTED","url":{"queryOrFragmentRedacted":false,"url":"http://127.0.0.1:54462/api/contacts","urlDigest":"9ed10946ce91eb386a7f13cbcd380768ff5b2e530decd59fe9bab676f007428c"}}],"totalInteractions":{"click":6,"press":2,"type":4},"totalNavigations":1},"expected":{"consoleErrors":0,"locality":"loopback-only","minimumInteractions":{"click":5,"press":2,"type":4},"minimumNavigations":1,"pageErrors":0,"requestFailures":0,"requiredNetworkMethods":["DELETE","GET","PATCH","POST"],"serviceWorkerEventsPerClient":0},"mismatches":["requestFailures"]}
❯ verifyAngularContactsLinkedWitnessRuntime packages/cli/src/witness/angular-contacts-run.ts:374:9
372| const diagnostic = diagnoseAngularContactsLinkedWitnessRuntime(client…
373| if (diagnostic.mismatches.length !== 0)
374| throw new Error(
| ^
375| `Angular Contacts actual linked Witness runtime evidence differs: $…
376| );
❯ runAngularContactsLinkedWitnessProbe packages/cli/src/witness/angular-contacts-run.ts:481:28
❯ packages/cli/test/witness-angular-contacts-run.test.ts:411:18
❯ .versionless/cache/pnpm-virtual-store/@voidzero-dev+vite-plus-test@0.1.20*@types+node@24.12.2_typescript@5.9.3_vite@8.0.16_@types+node@24.12.2_/node_modules/@voidzero-dev/vite-plus-test/dist/@vitest/runner/chunk-artifact.js:1903:22

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
