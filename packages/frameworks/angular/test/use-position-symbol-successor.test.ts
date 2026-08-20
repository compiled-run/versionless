import { describe, expect, it } from 'vitest';
import type { RootSurfaceReading } from '../src/removed-entry-point-symbol-successor.ts';
import {
	ANGULAR_HTTP_USE_POSITION_SUCCESSORS,
	readRemovedSpecifierImports,
	succeedRemovedSymbolUses,
} from '../src/use-position-symbol-successor.ts';

/** What `@angular/common/http` publishes, reduced to the names these claims name. */
const reading: RootSurfaceReading = Object.freeze({
	package: '@angular/common/http',
	version: '16.2.12',
	specifier: '@angular/http',
	specifierResolves: false,
	rootExports: Object.freeze([
		'HttpClient',
		'HttpClientJsonpModule',
		'HttpClientModule',
		'HttpHeaders',
		'HttpResponse',
	]),
	complete: true,
});

const claims = ANGULAR_HTTP_USE_POSITION_SUCCESSORS;

/**
 * A claim that *does* state a type-reference rule, so the position class is
 * exercised on its own terms. The documented table states none for `Response`,
 * and that refusal is measured in the test beside this one.
 */
const TYPE_POSITION_CLAIMS = Object.freeze([
	Object.freeze({
		package: '@angular/common/http',
		specifier: '@angular/http',
		from: 'Response',
		to: 'HttpResponse',
		since: 'a caller\u2019s own claim',
		rules: Object.freeze([
			Object.freeze({
				position: 'type-reference' as const,
				text: 'HttpResponse<any>',
				reason: 'the successor is generic and the removed type\u2019s body was untyped',
			}),
		]),
		note: 'stated by the caller, not by this adapter',
	}),
]);

describe('use position symbol successor', () => {
	it('writes a stated type-reference substitution, type argument included', () => {
		const source = [
			"import { Response } from '@angular/http';",
			'',
			'export function read(): void {',
			'\tthis.service.get(url).pipe(map((response: Response) => response.status));',
			'}',
			'',
		].join('\n');
		const migration = succeedRemovedSymbolUses('a.ts', source, TYPE_POSITION_CLAIMS, [reading]);
		expect(migration.unhandled).toEqual([]);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain("import { HttpResponse } from '@angular/common/http';");
		expect(migration.source).toContain('(response: HttpResponse<any>)');
		expect(migration.source).not.toContain('@angular/http');
		const change = migration.changes[0];
		expect(change?.positions).toEqual(['type-reference']);
		expect(change?.useSites).toBe(1);
	});

	it('refuses the type position the documented table states no rule for', () => {
		const source =
			"import { Response } from '@angular/http';\nexport const r: Response = null;\n";
		const migration = succeedRemovedSymbolUses('a.ts', source, claims, [reading]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('type-reference');
		expect(migration.unhandled.join(' ')).toContain('emits the parsed body');
	});

	it('substitutes an NgModule imports member and drops the one with no successor', () => {
		const source = [
			"import { NgModule } from '@angular/core';",
			"import { HttpModule, JsonpModule } from '@angular/http';",
			'',
			'@NgModule({',
			'\timports: [',
			'\t\tCommonModule,',
			'\t\tHttpModule,',
			'\t\tJsonpModule',
			'\t]',
			'})',
			'export class SharedModule {}',
			'',
		].join('\n');
		const migration = succeedRemovedSymbolUses('shared.module.ts', source, claims, [reading]);
		expect(migration.unhandled).toEqual([]);
		expect(migration.source).toContain(
			"import { HttpClientModule } from '@angular/common/http';",
		);
		expect(migration.source).toContain('HttpClientModule');
		expect(migration.source).not.toContain('JsonpModule');
		expect(migration.source).not.toContain('@angular/http');
		expect(migration.declaredDifferences.join(' ')).toContain('JsonpModule was dropped');
		expect(migration.changes.map((entry) => entry.kind)).toContain(
			'use-position-symbol-removal',
		);
	});

	it('refuses the drop when the application injects what the module provided', () => {
		const source = [
			"import { NgModule } from '@angular/core';",
			"import { JsonpModule } from '@angular/http';",
			'',
			'@NgModule({ imports: [JsonpModule] })',
			'export class SharedModule {}',
			'',
		].join('\n');
		const injecting = readRemovedSpecifierImports(
			[
				{ path: 'shared.module.ts', source },
				{
					path: 'legacy.service.ts',
					source: "import { Jsonp } from '@angular/http';\nexport const j: Jsonp = null;\n",
				},
			],
			['@angular/http'],
		);
		expect(injecting).toEqual([
			{ specifier: '@angular/http', names: ['Jsonp', 'JsonpModule'] },
		]);
		const migration = succeedRemovedSymbolUses(
			'shared.module.ts',
			source,
			claims,
			[reading],
			injecting,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('the application imports Jsonp');
	});

	it('refuses a constructor parameter type whose successor has another call surface', () => {
		const source = [
			"import { Http } from '@angular/http';",
			'',
			'export class SecurityService {',
			'\tconstructor(private http: Http) {}',
			'}',
			'',
		].join('\n');
		const migration = succeedRemovedSymbolUses('security.service.ts', source, claims, [
			reading,
		]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('constructor-parameter-type');
		expect(migration.unhandled.join(' ')).toContain('hands over the parsed body');
	});

	it('refuses a new target whose successor is immutable where the removed class was not', () => {
		const source = [
			"import { Headers } from '@angular/http';",
			'',
			'export const headers = new Headers();',
			'',
		].join('\n');
		const migration = succeedRemovedSymbolUses('headers.ts', source, claims, [reading]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('new-target');
		expect(migration.unhandled.join(' ')).toContain('immutable');
	});

	it('refuses the whole declaration when one of its names cannot be placed', () => {
		const source = [
			"import { Response } from '@angular/http';",
			'',
			'export const held = Response;',
			'',
		].join('\n');
		const migration = succeedRemovedSymbolUses('held.ts', source, claims, [reading]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('a position this capability does not read');
	});

	it('refuses every claim when the removed specifier still resolves', () => {
		const source =
			"import { Response } from '@angular/http';\nexport const r: Response = null;\n";
		const still: RootSurfaceReading = Object.freeze({ ...reading, specifierResolves: true });
		const migration = succeedRemovedSymbolUses('a.ts', source, TYPE_POSITION_CLAIMS, [still]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('still answers @angular/http');
	});

	it('refuses when no surface was read, and when the reading is incomplete', () => {
		const source =
			"import { Response } from '@angular/http';\nexport const r: Response = null;\n";
		expect(
			succeedRemovedSymbolUses('a.ts', source, TYPE_POSITION_CLAIMS, []).unhandled.join(' '),
		).toContain('no successor surface was read');
		const partial: RootSurfaceReading = Object.freeze({ ...reading, complete: false });
		expect(
			succeedRemovedSymbolUses('a.ts', source, TYPE_POSITION_CLAIMS, [
				partial,
			]).unhandled.join(' '),
		).toContain('is incomplete');
	});

	it('refuses a successor the installed surface does not publish', () => {
		const source =
			"import { Response } from '@angular/http';\nexport const r: Response = null;\n";
		const without: RootSurfaceReading = Object.freeze({
			...reading,
			rootExports: Object.freeze(['HttpClient']),
		});
		expect(
			succeedRemovedSymbolUses('a.ts', source, TYPE_POSITION_CLAIMS, [
				without,
			]).unhandled.join(' '),
		).toContain('does not publish HttpResponse');
	});

	it('refuses an aliased import rather than renaming the binding', () => {
		const source =
			"import { Response as Res } from '@angular/http';\nexport const r: Res = null;\n";
		const migration = succeedRemovedSymbolUses('a.ts', source, claims, [reading]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('is imported as Res');
	});

	it('leaves a module that names no claimed specifier byte-identical', () => {
		const source = "import { HttpClient } from '@angular/common/http';\n";
		const migration = succeedRemovedSymbolUses('a.ts', source, claims, [reading]);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled).toEqual([]);
	});
});
