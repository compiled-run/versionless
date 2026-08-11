import { describe, expect, it } from 'vitest';
import {
	migrateRxjsPrototypePatches,
	offsetOf,
	type PatchedCallDiagnostic,
	type RxjsSurfaceReading,
} from '../src/rxjs-prototype-patch-migration.ts';

/** The installed surface, as the closure reader would hand it over. */
const rxjs: RxjsSurfaceReading = Object.freeze({
	version: '7.8.2',
	rootExports: Object.freeze(['Observable', 'Subject', 'combineLatest', 'forkJoin', 'of', 'throwError']),
	operatorExports: Object.freeze(['catchError', 'debounceTime', 'map', 'tap']),
});

/** The compiler's own position of `property` in `source`, so no test counts columns by hand. */
const at = (
	source: string,
	property: string,
	receiverType: string,
	occurrence = 1,
): PatchedCallDiagnostic => {
	let index = -1;
	for (let seen = 0; seen < occurrence; seen += 1) index = source.indexOf(`.${property}(`, index + 1);
	const before = source.slice(0, index + 1);
	const lines = before.split('\n');
	return Object.freeze({
		line: lines.length,
		column: (lines[lines.length - 1] as string).length + 1,
		property,
		receiverType,
	});
};

const migrate = (source: string, diagnostics: readonly PatchedCallDiagnostic[]) =>
	migrateRxjsPrototypePatches('src/app/thing.ts', source, diagnostics, rxjs);

describe('offsetOf', () => {
	it('maps a compiler line and column onto a source offset', () => {
		expect(offsetOf('ab\ncde', 2, 3)).toBe(5);
	});

	it('reports a position the file does not have', () => {
		expect(offsetOf('ab\n', 9, 1)).toBeNull();
		expect(offsetOf('ab\n', 1, 40)).toBeNull();
	});
});

describe('migrateRxjsPrototypePatches', () => {
	it('moves a patched operator call into pipe and imports the operator', () => {
		const source = [
			"import {Observable} from 'rxjs';",
			"import 'rxjs/add/operator/map';",
			'export const flag = source.map((value) => !value);',
		].join('\n');
		const migration = migrate(source, [at(source, 'map', 'Observable<boolean>')]);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain('source.pipe(map((value) => !value))');
		expect(migration.source).toContain("import {map} from 'rxjs/operators';");
		expect(migration.source).not.toContain('rxjs/add/operator/map');
	});

	it('renames the operators whose method name could not be a free function', () => {
		const source = ['export const safe = request.catch((error) => handle(error));'].join('\n');
		const migration = migrate(source, [at(source, 'catch', 'Observable<Response>')]);
		expect(migration.source).toContain('request.pipe(catchError((error) => handle(error)))');
		expect(migration.source).toContain("import {catchError} from 'rxjs/operators';");
	});

	it('moves a patched creation call to the free function of the installed root', () => {
		const source = [
			"import {Observable} from 'rxjs';",
			'export const one = Observable.of(1);',
		].join('\n');
		const diagnostic: PatchedCallDiagnostic = {
			line: 2,
			column: source.split('\n')[1]!.indexOf('of') + 1,
			property: 'of',
			receiverType: 'typeof Observable',
		};
		const migration = migrate(source, [diagnostic]);
		expect(migration.source).toContain('export const one = of(1);');
		expect(migration.source).toContain("import {of} from 'rxjs';");
	});

	it('leaves an array method of the same name exactly where it is', () => {
		const source = [
			"import {Observable} from 'rxjs';",
			'export const keys = Object.keys(errors).map((key) => errors[key]);',
			'export const flag = stream.map((value) => !value);',
		].join('\n');
		const migration = migrate(source, [at(source, 'map', 'Observable<boolean>', 2)]);
		expect(migration.source).toContain('Object.keys(errors).map((key) => errors[key]);');
		expect(migration.source).toContain('stream.pipe(map((value) => !value))');
	});

	it('drops the patch imports of a module whose every named call site moved', () => {
		const source = [
			"import 'rxjs/add/operator/map';",
			"import 'rxjs/add/observable/of';",
			'export const x = 1;',
		].join('\n');
		const migration = migrate(source, []);
		expect(migration.source).toBe('export const x = 1;');
		expect(migration.changes.every((change) => change.kind === 'patch-import')).toBe(true);
	});

	it('keeps the patch imports of a module it refuses', () => {
		const source = [
			"import 'rxjs/add/operator/map';",
			'export const flag = stream.map((value) => !value);',
		].join('\n');
		const migration = migrate(source, [
			{ line: 2, column: 4, property: 'map', receiverType: 'Observable<boolean>' },
		]);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled.join(' ')).toContain('src/app/thing.ts');
	});

	it('refuses an operator the installed surface does not export', () => {
		const source = 'export const s = stream.pairwise();';
		const migration = migrate(source, [at(source, 'pairwise', 'Observable<number>')]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('does not export pairwise');
	});

	it('refuses a creation call whose receiver is not a named import of rxjs', () => {
		const source = 'export const one = Local.of(1);';
		const migration = migrate(source, [
			{
				line: 1,
				column: source.indexOf('of') + 1,
				property: 'of',
				receiverType: 'typeof Observable',
			},
		]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('is not a named import');
	});

	it('refuses a position the file does not carry rather than rewriting a neighbour', () => {
		const source = 'export const flag = stream.map((value) => !value);';
		const migration = migrate(source, [
			{ line: 40, column: 1, property: 'map', receiverType: 'Observable<boolean>' },
		]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('not a position in this file');
	});

	it('refuses a module whose root scope already binds the operator name', () => {
		const source = [
			'const map = new Map();',
			'export const flag = stream.map((value) => !value);',
		].join('\n');
		const migration = migrate(source, [at(source, 'map', 'Observable<boolean>')]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('already binds map');
	});

	it('leaves a module with no diagnostics and no patch imports byte-identical', () => {
		const source = 'export const flag = list.map((value) => !value);\n';
		const migration = migrate(source, []);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
	});
});
