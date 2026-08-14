import { describe, expect, it } from 'vitest';
import {
	DOCUMENTED_STATIC_MODULE_METHOD_REMOVALS,
	removeRemovedStaticModuleMethods,
	type ModuleClassSurfaceReading,
} from '../src/removed-static-module-method.ts';

const claims = DOCUMENTED_STATIC_MODULE_METHOD_REMOVALS;

/** The aligned line's own declaration: the class, without the method. */
const reading: ModuleClassSurfaceReading = Object.freeze({
	package: '@ng-bootstrap/ng-bootstrap',
	version: '15.1.2',
	symbol: 'NgbModule',
	statics: Object.freeze(['ɵfac', 'ɵmod', 'ɵinj']),
	complete: true,
});

function moduleSource(member: string): string {
	return [
		"import { NgModule } from '@angular/core';",
		"import { NgbModule } from '@ng-bootstrap/ng-bootstrap';",
		'',
		'@NgModule({',
		'\timports: [',
		'\t\tCommonModule,',
		`\t\t${member},`,
		'\t\tRouterModule',
		'\t],',
		'\texports: [NgbModule]',
		'})',
		'export class SharedModule {}',
		'',
	].join('\n');
}

describe('removed static module method', () => {
	it('drops the call the installed declaration no longer publishes', () => {
		const migration = removeRemovedStaticModuleMethods(
			'shared.module.ts',
			moduleSource('NgbModule.forRoot()'),
			claims,
			[reading],
		);
		expect(migration.unhandled).toEqual([]);
		expect(migration.changed).toBe(true);
		expect(migration.source).not.toContain('forRoot()');
		expect(migration.source).toContain('\t\tNgbModule,');
		expect(migration.changes).toEqual([
			{
				kind: 'removed-static-module-method',
				line: 7,
				package: '@ng-bootstrap/ng-bootstrap',
				symbol: 'NgbModule',
				method: 'forRoot',
				from: 'NgbModule.forRoot()',
				to: 'NgbModule',
			},
		]);
	});

	it('refuses a call that carries arguments', () => {
		const migration = removeRemovedStaticModuleMethods(
			'shared.module.ts',
			moduleSource('NgbModule.forRoot({ animation: false })'),
			claims,
			[reading],
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('is called with 1 argument(s)');
	});

	it('refuses when the installed declaration still publishes the method', () => {
		const still: ModuleClassSurfaceReading = Object.freeze({
			...reading,
			version: '3.1.0',
			statics: Object.freeze(['forRoot']),
		});
		const migration = removeRemovedStaticModuleMethods(
			'shared.module.ts',
			moduleSource('NgbModule.forRoot()'),
			claims,
			[still],
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('still declares NgbModule.forRoot');
	});

	it('refuses on no reading and on an incomplete one', () => {
		const source = moduleSource('NgbModule.forRoot()');
		expect(
			removeRemovedStaticModuleMethods('a.ts', source, claims, []).unhandled.join(' '),
		).toContain('no declaration of NgbModule was read');
		const partial: ModuleClassSurfaceReading = Object.freeze({ ...reading, complete: false });
		expect(
			removeRemovedStaticModuleMethods('a.ts', source, claims, [partial]).unhandled.join(' '),
		).toContain('is incomplete');
	});

	it('refuses the same call outside an NgModule imports array', () => {
		const source = [
			"import { NgbModule } from '@ng-bootstrap/ng-bootstrap';",
			'',
			'export const configured = NgbModule.forRoot();',
			'',
		].join('\n');
		const migration = removeRemovedStaticModuleMethods('a.ts', source, claims, [reading]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('is not a member of an NgModule');
	});

	it('leaves a module that never names the package byte-identical', () => {
		const source = "import { NgModule } from '@angular/core';\n";
		const migration = removeRemovedStaticModuleMethods('a.ts', source, claims, [reading]);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
	});
});
