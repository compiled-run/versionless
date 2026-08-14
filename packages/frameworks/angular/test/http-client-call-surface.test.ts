import { describe, expect, it } from 'vitest';
import type { RootSurfaceReading } from '../src/removed-entry-point-symbol-successor.ts';
import {
	ANGULAR_HTTP_CALL_SURFACE,
	migrateHttpClientCallSurface,
	type SuccessorClassSurfaceReading,
} from '../src/http-client-call-surface.ts';

/** What `@angular/common/http` publishes, reduced to the names this claim names. */
const reading: RootSurfaceReading = Object.freeze({
	package: '@angular/common/http',
	version: '16.2.12',
	specifier: '@angular/http',
	specifierResolves: false,
	rootExports: Object.freeze(['HttpClient', 'HttpClientModule', 'HttpHeaders', 'HttpResponse']),
	complete: true,
});

/**
 * The installed declarations, as the driver reads them: `get` publishes no
 * `body` and `request` does, and every `HttpHeaders` mutator returns the class.
 */
const surfaces: readonly SuccessorClassSurfaceReading[] = Object.freeze([
	Object.freeze({
		package: '@angular/common/http',
		version: '16.2.12',
		symbol: 'HttpClient',
		members: Object.freeze([
			Object.freeze({
				member: 'get',
				returns: 'Observable<ArrayBuffer>',
				optionKeys: Object.freeze(['headers', 'observe', 'params', 'responseType']),
			}),
			Object.freeze({
				member: 'post',
				returns: 'Observable<ArrayBuffer>',
				optionKeys: Object.freeze(['headers', 'observe', 'params', 'responseType']),
			}),
			Object.freeze({
				member: 'request',
				returns: 'Observable<HttpEvent<R>>',
				optionKeys: Object.freeze(['body', 'headers', 'observe', 'params', 'responseType']),
			}),
		]),
		complete: true,
	}),
	Object.freeze({
		package: '@angular/common/http',
		version: '16.2.12',
		symbol: 'HttpHeaders',
		members: Object.freeze([
			Object.freeze({ member: 'append', returns: 'HttpHeaders', optionKeys: Object.freeze([]) }),
			Object.freeze({ member: 'set', returns: 'HttpHeaders', optionKeys: Object.freeze([]) }),
			Object.freeze({ member: 'delete', returns: 'HttpHeaders', optionKeys: Object.freeze([]) }),
		]),
		complete: true,
	}),
]);

/** The era service every positive case below is cut down from. */
function service(body: readonly string[]): string {
	return [
		"import { Http, Headers } from '@angular/http';",
		"import { Observable } from 'rxjs';",
		"import { map } from 'rxjs/operators';",
		'',
		'export class SecurityService {',
		'    private headers: Headers;',
		'    constructor(private _http: Http) {',
		'        this.headers = new Headers();',
		'    }',
		...body,
		'}',
		'',
	].join('\n');
}

const migrate = (path: string, source: string) =>
	migrateHttpClientCallSurface(path, source, ANGULAR_HTTP_CALL_SURFACE, [reading], surfaces);

describe('HttpClient call surface', () => {
	it('carries the injected service, the header class and the declaration in one changeset', () => {
		const migration = migrate('a.ts', service([]));
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain(
			"import { HttpClient, HttpHeaders } from '@angular/common/http';",
		);
		expect(migration.source).toContain('constructor(private _http: HttpClient)');
		expect(migration.source).toContain('private headers: HttpHeaders;');
		expect(migration.source).toContain('this.headers = new HttpHeaders();');
		expect(migration.unhandled).toEqual([]);
	});

	it('assigns a discarded mutator call back to its receiver', () => {
		const migration = migrate(
			'a.ts',
			service(['    private set() {', "        this.headers.append('Accept', 'text/plain');", '    }']),
		);
		expect(migration.source).toContain(
			"this.headers = this.headers.append('Accept', 'text/plain');",
		);
		expect(migration.changes.some((change) => change.kind === 'http-headers-immutable-mutation')).toBe(
			true,
		);
		expect(migration.declaredDifferences.join(' ')).toContain('mutated the receiver');
	});

	it('refuses the module when the successor mutator was not read as returning a new instance', () => {
		const mutating = surfaces.map((entry) =>
			entry.symbol !== 'HttpHeaders'
				? entry
				: {
						...entry,
						members: entry.members.map((member) => ({ ...member, returns: 'void' })),
					},
		);
		const migration = migrateHttpClientCallSurface(
			'a.ts',
			service(['    private set() {', "        this.headers.append('Accept', 'text/plain');", '    }']),
			ANGULAR_HTTP_CALL_SURFACE,
			[reading],
			mutating,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('was not read as returning a new');
	});

	it('refuses a mutator call whose value the era code did not discard', () => {
		const migration = migrate(
			'a.ts',
			service([
				'    private set() {',
				"        return this.headers.append('Accept', 'text/plain');",
				'    }',
			]),
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('is not a discarded statement');
	});

	it('removes the body accessor and states the emitted type the application declared', () => {
		const migration = migrate(
			'a.ts',
			service([
				'    read(): Observable<string[]> {',
				'        return this._http.get(this.url, { headers: this.headers })',
				'            .pipe(map(res => res.json()));',
				'    }',
			]),
		);
		expect(migration.source).toContain('this._http.get<string[]>(this.url,');
		expect(migration.source).toContain('.pipe(map(res => res));');
		expect(migration.changes.map((change) => change.kind)).toContain(
			'http-client-body-accessor-removal',
		);
		expect(migration.changes.map((change) => change.kind)).toContain('http-client-element-type');
	});

	it('refuses to remove a body accessor from a flow the application never typed', () => {
		const migration = migrate(
			'a.ts',
			service([
				'    read() {',
				'        return this._http.get(this.url, { headers: this.headers })',
				'            .pipe(map(res => res.json()));',
				'    }',
			]),
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('declares no `Observable<T>` return type');
	});

	it('moves a GET that carries a body to the member that publishes one', () => {
		const migration = migrate(
			'a.ts',
			service([
				'    read(): Observable<string[]> {',
				"        return this._http.get(this.url, { headers: this.headers, body: '' })",
				'            .pipe(map(res => res.json()));',
				'    }',
			]),
		);
		expect(migration.source).toContain("this._http.request<string[]>('GET', this.url,");
		expect(migration.declaredDifferences.join(' ')).toContain('moved rather than the option dropped');
	});

	it('leaves a call whose options the successor still publishes on the member it was written on', () => {
		const migration = migrate(
			'a.ts',
			service([
				'    read(): Observable<string[]> {',
				'        return this._http.get(this.url, { headers: this.headers })',
				'            .pipe(map(res => res.json()));',
				'    }',
			]),
		);
		expect(migration.source).toContain('this._http.get<string[]>(');
		expect(migration.changes.some((change) => change.kind === 'http-client-request-relocation')).toBe(
			false,
		);
	});

	it('refuses a call carrying an option no member of the successor publishes', () => {
		const migration = migrate(
			'a.ts',
			service([
				'    read(): Observable<string[]> {',
				'        return this._http.get(this.url, { headers: this.headers, search: this.query })',
				'            .pipe(map(res => res.json()));',
				'    }',
			]),
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('would drop what the era request sent');
	});

	it('carries a response annotation to the type the era body accessor returned', () => {
		const source = [
			"import { Response } from '@angular/http';",
			"import { Observable } from 'rxjs';",
			"import { map } from 'rxjs/operators';",
			'',
			'export class CatalogService {',
			'    getCatalog(): Observable<ICatalog> {',
			'        return this.service.get(this.url).pipe(map((response: Response) => {',
			'            return response;',
			'        }));',
			'    }',
			'}',
			'',
		].join('\n');
		const migration = migrate('a.ts', source);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain('map((response: any) =>');
		expect(migration.source).not.toContain('@angular/http');
		expect(migration.source).not.toContain('import {  } from');
		expect(migration.declaredDifferences.join(' ')).toContain('no longer checked');
	});

	it('refuses a response annotation that is not on an operator callback parameter', () => {
		const source = [
			"import { Response } from '@angular/http';",
			'',
			'export class CatalogService {',
			'    private last: Response;',
			'}',
			'',
		].join('\n');
		const migration = migrate('a.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('not the parameter of an operator callback');
	});

	it('refuses the module where the removed specifier still resolves', () => {
		const migration = migrateHttpClientCallSurface(
			'a.ts',
			service([]),
			ANGULAR_HTTP_CALL_SURFACE,
			[{ ...reading, specifierResolves: true }],
			surfaces,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('still answers it');
	});

	it('refuses the module where no successor declaration was read', () => {
		const migration = migrateHttpClientCallSurface(
			'a.ts',
			service([]),
			ANGULAR_HTTP_CALL_SURFACE,
			[reading],
			[],
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('no complete declaration of HttpClient');
	});

	it('refuses a name no rule of the capability is written for', () => {
		const source = ["import { RequestOptions } from '@angular/http';", ''].join('\n');
		const migration = migrate('a.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('no rule of this capability is written for');
	});

	it('leaves a module that never imported the removed specifier alone', () => {
		const source = ["import { HttpClient } from '@angular/common/http';", ''].join('\n');
		const migration = migrate('a.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.changes).toEqual([]);
		expect(migration.unhandled).toEqual([]);
	});
});
