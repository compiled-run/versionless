import { describe, expect, it } from 'vitest';
import {
	enableSyntheticDefaultImports,
	readModuleInterop,
	type ExportAssignmentReading,
	type ModuleInteropReading,
} from '../src/synthetic-default-import-interop.ts';

const tsconfig = `${JSON.stringify(
	{
		compileOnSave: false,
		compilerOptions: {
			baseUrl: './',
			module: 'ES2022',
			target: 'ES2022',
			useDefineForClassFields: false,
		},
	},
	null,
	2,
)}\n`;

const component = [
	"import Clipboard from 'clipboard';",
	"import * as moment from 'moment';",
	"import {unique} from '../../util/unique';",
	'',
	'export class WorklogExportComponent {',
	'  copy() {',
	'    const c = new Clipboard(this.el);',
	'    return moment(unique([]));',
	'  }',
	'}',
	'',
].join('\n');

const clipboard: ExportAssignmentReading = Object.freeze({
	package: 'clipboard',
	version: '2.0.11',
	declarationFile: 'src/clipboard.d.ts',
	exportAssignment: true,
	esDefaultExport: false,
	complete: true,
});

function readings(): readonly ModuleInteropReading[] {
	return [readModuleInterop('src/app/worklog-export.component.ts', component)];
}

describe('readModuleInterop', () => {
	it('reads bare default imports and the namespace imports the module calls', () => {
		const reading = readModuleInterop('src/app/worklog-export.component.ts', component);
		expect(reading.defaultImports).toEqual([
			{
				path: 'src/app/worklog-export.component.ts',
				line: 1,
				specifier: 'clipboard',
				local: 'Clipboard',
			},
		]);
		expect(reading.calledNamespaceImports).toEqual([
			{
				path: 'src/app/worklog-export.component.ts',
				line: 2,
				specifier: 'moment',
				local: 'moment',
			},
		]);
	});

	it('ignores a relative default import, which is the application’s own module', () => {
		const reading = readModuleInterop('a.ts', "import own from './own';\nnew own();\n");
		expect(reading.defaultImports).toEqual([]);
	});

	it('does not count a namespace import that is only read through', () => {
		const reading = readModuleInterop('a.ts', "import * as ns from 'pkg';\nexport const x = ns.y;\n");
		expect(reading.calledNamespaceImports).toEqual([]);
	});
});

describe('enableSyntheticDefaultImports', () => {
	it('writes the type-only flag, naming the site and the declaration that demanded it', () => {
		const result = enableSyntheticDefaultImports(tsconfig, readings(), [clipboard]);
		expect(result.changed).toBe(true);
		expect(result.changes).toEqual([
			{
				kind: 'synthetic-default-import-interop',
				path: 'compilerOptions.allowSyntheticDefaultImports',
				from: null,
				to: 'true',
				requiredBy: [
					"src/app/worklog-export.component.ts line 1: default import of 'clipboard' — " +
						"'clipboard'@2.0.11 declares `export =` in src/clipboard.d.ts",
				],
			},
		]);
		const written = JSON.parse(result.config) as {
			compilerOptions: Record<string, unknown>;
		};
		expect(written.compilerOptions['allowSyntheticDefaultImports']).toBe(true);
		expect(written.compilerOptions['useDefineForClassFields']).toBe(false);
		expect(written.compilerOptions['esModuleInterop']).toBeUndefined();
	});

	it('records why the emit-changing flag was not the answer', () => {
		const result = enableSyntheticDefaultImports(tsconfig, readings(), [clipboard]);
		const refusal = result.unhandled.find((entry) => entry.includes('esModuleInterop'));
		expect(refusal).toBeDefined();
		expect(refusal).toContain('1 namespace import(s)');
		expect(refusal).toContain('moment');
	});

	it('refuses a package whose declaration already names an ES default export', () => {
		const result = enableSyntheticDefaultImports(tsconfig, readings(), [
			{ ...clipboard, exportAssignment: false, esDefaultExport: true },
		]);
		expect(result.changed).toBe(false);
		expect(result.unhandled.some((entry) => entry.includes('already legal'))).toBe(true);
	});

	it('refuses a package that publishes no typings at all', () => {
		const result = enableSyntheticDefaultImports(tsconfig, readings(), [
			{ ...clipboard, declarationFile: null, exportAssignment: false },
		]);
		expect(result.changed).toBe(false);
		expect(result.unhandled.some((entry) => entry.includes('publishes no typings'))).toBe(true);
	});

	it('refuses an unread declaration surface', () => {
		const result = enableSyntheticDefaultImports(tsconfig, readings(), [
			{ ...clipboard, complete: false },
		]);
		expect(result.changed).toBe(false);
		expect(result.unhandled.some((entry) => entry.includes('could not be read'))).toBe(true);
	});

	it('refuses when nothing in the tree demands the flag', () => {
		const result = enableSyntheticDefaultImports(tsconfig, [], []);
		expect(result.changed).toBe(false);
		expect(result.config).toBe(tsconfig);
		expect(
			result.unhandled.some((entry) => entry.includes('nothing demands the flag')),
		).toBe(true);
	});

	it('does not overturn an explicit false', () => {
		const declared = `${JSON.stringify(
			{ compilerOptions: { allowSyntheticDefaultImports: false } },
			null,
			2,
		)}\n`;
		const result = enableSyntheticDefaultImports(declared, readings(), [clipboard]);
		expect(result.changed).toBe(false);
		expect(result.unhandled.some((entry) => entry.includes('explicit decision'))).toBe(true);
	});

	it('leaves a configuration that already implies the flag alone', () => {
		const declared = `${JSON.stringify({ compilerOptions: { esModuleInterop: true } }, null, 2)}\n`;
		const result = enableSyntheticDefaultImports(declared, readings(), [clipboard]);
		expect(result.changed).toBe(false);
		expect(
			result.unhandled.some((entry) => entry.includes('implies allowSyntheticDefaultImports')),
		).toBe(true);
	});

	it('refuses a tsconfig with no compilerOptions rather than synthesising one', () => {
		const result = enableSyntheticDefaultImports('{}\n', readings(), [clipboard]);
		expect(result.changed).toBe(false);
		expect(result.unhandled.some((entry) => entry.includes('no compilerOptions'))).toBe(true);
	});
});
