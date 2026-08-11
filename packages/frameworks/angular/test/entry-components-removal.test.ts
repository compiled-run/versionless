import { describe, expect, it } from 'vitest';
import { removeEntryComponents } from '../src/entry-components-removal.ts';

const moduleSource = (body: string): string =>
	`import {NgModule} from '@angular/core';\n` +
	`import {A} from './a';\nimport {B} from './b';\nimport {Root} from './root';\n\n` +
	`@NgModule({\n${body}})\nexport class AppModule {}\n`;

describe('entry components removal', () => {
	it('drops the property when declarations already reaches every component it names', () => {
		const migration = removeEntryComponents(
			'src/app.module.ts',
			moduleSource(
				'  declarations: [A, B, Root],\n  entryComponents: [A, B],\n  bootstrap: [Root]\n',
			),
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).not.toContain('entryComponents');
		expect(migration.source).toContain('  declarations: [A, B, Root],\n  bootstrap: [Root]\n');
		expect(migration.changes[0]?.symbols).toEqual(['A', 'B']);
		expect(migration.unhandled).toEqual([]);
	});

	it('accepts a component reached only by bootstrap', () => {
		const migration = removeEntryComponents(
			'src/app.module.ts',
			moduleSource('  declarations: [A],\n  entryComponents: [Root],\n  bootstrap: [Root]\n'),
		);
		expect(migration.changed).toBe(true);
	});

	it('removes the separator when the property is last in the literal', () => {
		const migration = removeEntryComponents(
			'src/app.module.ts',
			moduleSource('  declarations: [A],\n  entryComponents: [A]\n'),
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain('  declarations: [A]\n})');
	});

	it('refuses when a component is named by entryComponents and by nothing else', () => {
		const migration = removeEntryComponents(
			'src/app.module.ts',
			moduleSource('  declarations: [A],\n  entryComponents: [A, B],\n  bootstrap: [Root]\n'),
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('B');
	});

	it('resolves bindings rather than spellings, so a shadowing local does not count as reach', () => {
		const source =
			`import {NgModule} from '@angular/core';\n` +
			`import {A} from './a';\n\n` +
			`function outer() {\n  class B {}\n  return B;\n}\n` +
			`import {B} from './b';\n\n` +
			`@NgModule({\n  declarations: [A],\n  entryComponents: [B]\n})\nexport class AppModule {}\n`;
		const migration = removeEntryComponents('src/app.module.ts', source);
		expect(migration.changed).toBe(false);
	});

	it('refuses a literal it cannot read, rather than editing around the part it can', () => {
		const source =
			`import {NgModule} from '@angular/core';\nimport {A} from './a';\nconst extra = {};\n\n` +
			`@NgModule({\n  ...extra,\n  declarations: [A],\n  entryComponents: [A]\n})\nexport class AppModule {}\n`;
		const migration = removeEntryComponents('src/app.module.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('spread');
	});

	it('refuses an entryComponents that is not a plain array of identifiers', () => {
		const migration = removeEntryComponents(
			'src/app.module.ts',
			moduleSource('  declarations: [A],\n  entryComponents: [...others]\n'),
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('not a plain array');
	});

	it('reports nothing for a post-Ivy module, and nothing for some other decorator named NgModule', () => {
		const post = removeEntryComponents(
			'src/app.module.ts',
			moduleSource('  declarations: [A],\n  bootstrap: [Root]\n'),
		);
		expect(post.changed).toBe(false);
		expect(post.unhandled).toEqual([]);
		const foreign = removeEntryComponents(
			'src/app.module.ts',
			`import {NgModule} from 'some-other-framework';\nimport {A} from './a';\n\n` +
				`@NgModule({\n  declarations: [A],\n  entryComponents: [A]\n})\nexport class AppModule {}\n`,
		);
		expect(foreign.changed).toBe(false);
		expect(foreign.unhandled).toEqual([]);
	});
});
