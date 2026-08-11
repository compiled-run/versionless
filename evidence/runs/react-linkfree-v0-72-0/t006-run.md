# LinkFree create-react-app 5 to Vite 8 — build lanes

Unit: lrapr-t006/u8-linkfree-migration-lanes. Fixture: react-linkfree-v0-72-0.

Build profile canonical digest: `fd423413aba0d87a394c7bb0031fc5c4fa8e9638b5c2fdfdc0567a7c4aeb8497`
Run receipt canonical digest: `971b4d8c9b94760d973d8c417780ee8f8c009582dc09e16ac900bc511cb36dd8`

## What is established

- The era baseline — create-react-app 5.0.1 / webpack 5.73.0 on Node 16.20.2, the major its own CI declares — was rebuilt twice from the restored closure and was byte-stable: true.
- The migrated lane — Vite 8.0.16 on Node 24.15.0 over the generic create-react-app adapter — was built twice and was deterministic: true.
- Build-level parity only: 571 shared emitted paths, of which 570 are byte identical. The differing shared path is the entry document, which differs by construction between bundlers.
- No application source was edited. The two application files the migrated lane writes are the repository’s own codegen output and the Vite entry document derived from the immutable create-react-app template.

## The one runtime break, and the generic capability that closed it

1. Vite 8 stopped at parse time: "Unexpected JSX expression … JSX syntax is disabled and should be enabled via the parser options", raised on the application entry module.
   - Fix: createCraJavaScriptJsxPlugin — raises an application-source JavaScript module to the JSX module type, changing no code. Dependencies are excluded, matching create-react-app’s own babel-preset-react-app/dependencies rule, which carries no React preset.

## The declared build steps

- Codegen prebuild (`node generate.js`): run by the migrated lane unmodified, before Vite. It emits the uncommitted index the home and search routes read.
- Postbuild purge (`purgecss`): declared OUT of the Vite build’s scope, and measured both ways rather than asserted.

| lane | CSS before purge | CSS after purge | reduction |
| --- | --- | --- | --- |
| baseline | 619824 | 50728 | 91.82% |
| target | 587122 | 43283 | 92.63% |

The baseline ships 50728 bytes of CSS because its postbuild hook rewrites the stylesheet in place; the migrated lane ships 587122 unpurged bytes. The purge is post-build asset optimisation over emitted files, its config is written against create-react-app’s output layout, and its correctness rests on an application-authored extractor — so it belongs to the application, not to a webpack-compatibility adapter.

## What is NOT established

- Nothing here was loaded in a browser. No route was rendered, no journey was exercised, and the upstream cypress suite was not run.
- Two deterministic builds and a shared artifact inventory establish build-level parity only. They establish no behavioural parity, no runtime equivalence, and no visual equivalence.
- The migrated lane ships an unpurged stylesheet by declared decision. That is a recorded difference from the baseline, not an equivalence claim about the emitted CSS.
- No production-readiness, pilot, certification, or migration-completeness claim is made for this application.

