Fable-Opus-Unit: lrapr-t006/u20c2c-binding-reorder-capability
Fable-Opus-Timeout-Minutes: 35

## Goal

Land the PM-ruled generic template-binding-reorder capability, repair the super-productivity migrated lane's split.component regression, and rebuild in /Users/jacksm5pro/dev/open-source/versionless (commit `a1c427c`; u20c2b proved the cause: Ivy applies `@Input` setters in template-binding order, VE applied them in class-declaration order; `set splitPos` derefs the not-yet-populated `this.splitTopEl` → classList throw; no vendor mechanism restores VE ordering; source is byte-identical, our transforms exonerated).

PM ruling (Option A): implement a GENERIC, analyzer-proven, semantics-preserving **template-binding-reorder** capability in `packages/frameworks/angular`. Signature (from u20c2b): an `@Input() set <name>` accessor whose body dereferences another element/input-typed member `this.<dep>` of the same directive (passed to Renderer2 addClass/removeClass/setStyle or a `.classList`/DOM read), where `<dep>` is another `@Input()` of that directive, at a call site whose template binds `[<name>]` before `[<dep>]`. Repair: reorder so every such `[<dep>]` precedes its dependent `[<name>]` — a topological order of the call site's bindings by setter-dependency. Refuse when: `<dep>` is not a same-directive input, the setter's dereference isn't provable, the binding order is already safe, or the dependencies cannot all be satisfied simultaneously (cycle). App binding VALUES are unchanged; only source order of adjacent attribute bindings moves. Record the reorder as a migration edit (applicationFilesChanged increments — capability-driven, itemized, NOT a manual accommodation). Tests: positive on the split shape (splitPos derefs splitTopEl; reorder proven), refusal negatives (non-input dep, unprovable deref, already-safe, cycle).

Then:

1. Apply through the composed changeset; rebuild ×2 offline-guarded per u23 (deterministic-modulo the recorded Sass-random files); superseding build record over u23.
2. **Behavior check** (the u20c2b discriminator): the migrated lane produces 0 page errors on load, matching era — the split.component throw is GONE. The two declared style differences (header-icon/body font-family) stay as recorded declared differences.
3. Truthful `applicationFilesChanged` (the reordered template file added); whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- The reorder is the ONLY app-source change and only via the generic capability (no null-guards, no hand edits); no packages/core/src changes; no packages/frameworks/react/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- Prior records immutable; no fabricated evidence; truthful reds; no test weakening. Offline-guarded rebuild (no network). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If the reorder cannot be made generic without over-fitting (name the shape), the topological order is unsatisfiable for this call site (bring it), the error persists after the reorder (bring the new page error), or the rebuild goes red for a new reason, return status "blocked" with specifics in open_questions instead of improvising.
