import { describe, expect, it } from 'vitest';
import { migrateNgrxEffectDecorators } from '../src/ngrx-effects-migration.ts';

const effectsClass = (body: string): string =>
	`import { Effect, Actions, ofType } from '@ngrx/effects';\n\nexport class Fx {\n${body}\n  constructor(private actions$: Actions) {}\n}\n`;

describe('NgRx @Effect() decorator migration', () => {
	it('rewrites a bare decorator into a createEffect factory and fixes the import', () => {
		const migration = migrateNgrxEffectDecorators(
			'src/app/store/a.effects.ts',
			effectsClass('  @Effect()\n  load$ = this.actions$.pipe(ofType("LOAD"));\n'),
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain(
			"import { Actions, ofType, createEffect } from '@ngrx/effects';",
		);
		expect(migration.source).toContain(
			'load$ = createEffect(() => this.actions$.pipe(ofType("LOAD")));',
		);
		expect(migration.source).not.toContain('@Effect');
		expect(migration.changes).toEqual([
			{
				kind: 'ngrx-effect-decorator',
				line: 4,
				from: '@Effect() load$',
				to: 'load$ = createEffect(() => …)',
			},
		]);
	});

	it('carries the decorator configuration through as the factory second argument', () => {
		const migration = migrateNgrxEffectDecorators(
			'src/app/store/b.effects.ts',
			effectsClass('  @Effect({ dispatch: false })\n  tap$ = this.actions$.pipe();\n'),
		);
		expect(migration.source).toContain(
			'tap$ = createEffect(() => this.actions$.pipe(), { dispatch: false });',
		);
	});

	it('rewrites the sole named import without leaving a dangling comma', () => {
		const migration = migrateNgrxEffectDecorators(
			'src/app/store/c.effects.ts',
			"import { Effect } from '@ngrx/effects';\nexport class Fx {\n  @Effect()\n  a$ = source;\n}\n",
		);
		expect(migration.source).toBe(
			"import { createEffect } from '@ngrx/effects';\nexport class Fx {\n  a$ = createEffect(() => source);\n}\n",
		);
	});

	it('follows an aliased decorator import and reuses an already-imported factory', () => {
		const migration = migrateNgrxEffectDecorators(
			'src/app/store/d.effects.ts',
			"import { Effect as NgRxEffect, createEffect } from '@ngrx/effects';\nexport class Fx {\n  @NgRxEffect()\n  a$ = source;\n  b$ = createEffect(() => other);\n}\n",
		);
		expect(migration.source).toBe(
			"import { createEffect } from '@ngrx/effects';\nexport class Fx {\n  a$ = createEffect(() => source);\n  b$ = createEffect(() => other);\n}\n",
		);
	});

	it('leaves a module that never imported the decorator byte-identical', () => {
		const source =
			"import { Actions, createEffect } from '@ngrx/effects';\nexport class Fx {\n  a$ = createEffect(() => source);\n}\n";
		const migration = migrateNgrxEffectDecorators('src/app/store/e.effects.ts', source);
		expect(migration.source).toBe(source);
		expect(migration.changed).toBe(false);
		expect(migration.changes).toEqual([]);
	});

	it('leaves an Effect imported from somewhere else alone', () => {
		const source =
			"import { Effect } from 'some-other-library';\nexport class Fx {\n  @Effect()\n  a$ = source;\n}\n";
		expect(migrateNgrxEffectDecorators('src/app/x.ts', source).source).toBe(source);
	});

	it('refuses to shadow an existing binding of the factory name', () => {
		const source =
			"import { Effect } from '@ngrx/effects';\nfunction createEffect() {}\nexport class Fx {\n  @Effect()\n  a$ = source;\n}\n";
		const migration = migrateNgrxEffectDecorators('src/app/store/f.effects.ts', source);
		expect(migration.source).toBe(source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('already binds the name createEffect');
	});

	it('reports a namespace import instead of rewriting through it', () => {
		const source =
			"import * as effects from '@ngrx/effects';\nexport class Fx {\n  @effects.Effect()\n  a$ = source;\n}\n";
		const migration = migrateNgrxEffectDecorators('src/app/store/g.effects.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('namespace or default binding');
	});

	it('leaves a decorator carrying more than one argument in place and reports it', () => {
		const migration = migrateNgrxEffectDecorators(
			'src/app/store/h.effects.ts',
			effectsClass('  @Effect({ dispatch: false }, extra)\n  a$ = source;\n'),
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('more than one Effect argument');
	});

	it('is idempotent: migrating the migrated module changes nothing further', () => {
		const first = migrateNgrxEffectDecorators(
			'src/app/store/i.effects.ts',
			effectsClass('  @Effect()\n  a$ = source;\n'),
		);
		const second = migrateNgrxEffectDecorators('src/app/store/i.effects.ts', first.source);
		expect(second.changed).toBe(false);
		expect(second.source).toBe(first.source);
	});

	it('fails loudly on a module it cannot parse rather than counting it unchanged', () => {
		expect(() =>
			migrateNgrxEffectDecorators(
				'src/app/store/broken.effects.ts',
				"import { Effect } from '@ngrx/effects';\nconst = ;",
			),
		).toThrow('does not parse');
	});
});
