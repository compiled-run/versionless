import { describe, expect, it } from 'vitest';
import {
	HOST_PROVIDED_GLOBAL_NAMES,
	declarePolyfillEntryPoint,
	readRuntimeGlobalReferences,
	supplyNodeCoreRuntimeGlobals,
	type NodeCoreModuleDeclaration,
} from '../src/node-core-runtime-globals.ts';

const declarationOf = (source: string, module = 'util'): NodeCoreModuleDeclaration => ({
	module,
	version: '0.12.5',
	range: '^0.12.5',
	files: [{ path: `node_modules/${module}/${module}.js`, source }],
});

/**
 * The shape of the read that killed the migrated tiny-translator bundle:
 * `util@0.12.5` reading `process.env.NODE_DEBUG` at its top level.
 */
const UTIL_TOP_LEVEL_READ = [
	"var inherits = require('inherits');",
	'var debugEnvRegex = /^$/;',
	'if (process.env.NODE_DEBUG) {',
	'  var debugEnv = process.env.NODE_DEBUG;',
	"  debugEnv = debugEnv.replace(/[|\\\\{}()[\\]^$+?.]/g, '\\\\$&');",
	'  debugEnvRegex = new RegExp(debugEnv, "i");',
	'}',
	'exports.debuglog = function (set) {',
	'  if (typeof process !== "undefined" && process.noDeprecation) { return function () {}; }',
	'  return function () { console.error(set); };',
	'};',
].join('\n');

describe('readRuntimeGlobalReferences', () => {
	it('proves the module-evaluation read of process.env and the containers it walks', () => {
		const reading = readRuntimeGlobalReferences([
			{ path: 'node_modules/util/util.js', source: UTIL_TOP_LEVEL_READ },
		]);
		expect(reading.proven).toHaveLength(1);
		const [globalRead] = reading.proven;
		expect(globalRead?.name).toBe('process');
		expect(globalRead?.containers).toEqual(['process', 'process.env']);
		expect(globalRead?.dereferences.map((entry) => entry.line)).toEqual([3, 4]);
		expect(globalRead?.dereferences[0]?.path).toEqual(['env', 'NODE_DEBUG']);
		expect(reading.refused).toEqual([]);
	});

	it('binds nothing for the names every host and every CommonJS wrapper already binds', () => {
		const reading = readRuntimeGlobalReferences([
			{
				path: 'node_modules/thing/index.js',
				source: [
					'var keys = Object.keys(exports);',
					'var stamp = JSON.stringify({ at: Date.now(), keys: keys });',
					'module.exports = { stamp: stamp, dir: __dirname };',
				].join('\n'),
			},
		]);
		expect(reading.proven).toEqual([]);
		expect(reading.refused).toEqual([]);
		expect(HOST_PROVIDED_GLOBAL_NAMES).toContain('Object');
		expect(HOST_PROVIDED_GLOBAL_NAMES).toContain('module');
	});

	it('refuses by name a global whose only reaches are deferred or typeof-guarded', () => {
		const reading = readRuntimeGlobalReferences([
			{
				path: 'node_modules/thing/index.js',
				source: [
					'exports.read = function (value) {',
					'  if (Buffer.isBuffer(value)) { return value.toString(); }',
					'  return String(value);',
					'};',
					'exports.hasProcess = typeof process !== "undefined";',
				].join('\n'),
			},
		]);
		expect(reading.proven).toEqual([]);
		expect(reading.refused).toHaveLength(2);
		expect(reading.refused[0]).toContain('Buffer is referenced by this module');
		expect(reading.refused[0]).toContain('does not prove it is needed');
		expect(reading.refused[1]).toContain('process is referenced by this module');
	});

	it('refuses by name a global an object graph cannot stand in for', () => {
		const called = readRuntimeGlobalReferences([
			{ path: 'a.js', source: 'var now = process.hrtime();' },
		]);
		expect(called.proven).toEqual([]);
		expect(called.refused[0]).toContain('its member hrtime is called at module evaluation');

		const computed = readRuntimeGlobalReferences([
			{
				path: 'b.js',
				source: ['var key = "NODE_DEBUG";', 'var mode = process[key];'].join('\n'),
			},
		]);
		expect(computed.proven).toEqual([]);
		expect(computed.refused[0]).toContain('computed member');

		const written = readRuntimeGlobalReferences([{ path: 'c.js', source: 'process = {};' }]);
		expect(written.proven).toEqual([]);
		expect(written.refused[0]).toContain('assigns to it at evaluation');

		const bare = readRuntimeGlobalReferences([
			{ path: 'd.js', source: 'exports.p = process;' },
		]);
		expect(bare.proven).toEqual([]);
		expect(bare.refused[0]).toContain('bare value with no member read');
	});

	it('refuses a name entirely when one evaluation-time reach is unsatisfiable', () => {
		const reading = readRuntimeGlobalReferences([
			{
				path: 'node_modules/util/util.js',
				source: ['var mode = process.env.NODE_DEBUG;', 'var at = process.hrtime();'].join(
					'\n',
				),
			},
		]);
		expect(reading.proven).toEqual([]);
		expect(reading.refused[0]).toContain('process is dereferenced at module evaluation');
		expect(reading.refused[0]).toContain('hrtime is called');
	});
});

describe('supplyNodeCoreRuntimeGlobals', () => {
	it('writes the narrowest shim the reading spells, and cites every read', () => {
		const supplied = supplyNodeCoreRuntimeGlobals(declarationOf(UTIL_TOP_LEVEL_READ));
		const shim = supplied.shim ?? '';
		expect(supplied.globals.map((entry) => entry.name)).toEqual(['process']);
		expect(shim).toContain('runtimeGlobals["process"] ??= {};');
		expect(shim).toContain('(runtimeGlobals["process"] as RuntimeGlobalObject)["env"] ??= {};');
		expect(shim).toContain('node_modules/util/util.js line 3');
		expect(shim).toContain('util@0.12.5');
		expect(shim.trimEnd().endsWith('export {};')).toBe(true);
		expect(supplied.changes).toEqual([
			'process supplied as an empty object when the host binds nothing there',
			'process.env supplied as an empty object when the host binds nothing there',
		]);
		expect(supplied.declaredDifferences).toHaveLength(1);
		expect(supplied.declaredDifferences[0]).toContain('globalThis.process exists');
	});

	it('supplies nothing at all for a node-core module whose evaluation reads no global', () => {
		const supplied = supplyNodeCoreRuntimeGlobals(
			declarationOf(
				[
					"var inherits = require('inherits');",
					'exports.format = function (f) { return String(f); };',
				].join('\n'),
			),
		);
		expect(supplied.shim).toBeNull();
		expect(supplied.globals).toEqual([]);
		expect(supplied.changes).toEqual([]);
		expect(supplied.declaredDifferences).toEqual([]);
		expect(supplied.unhandled).toEqual([]);
	});

	it('reports the refused globals rather than supplying them', () => {
		const supplied = supplyNodeCoreRuntimeGlobals(
			declarationOf('exports.read = function (v) { return Buffer.isBuffer(v); };'),
		);
		expect(supplied.shim).toBeNull();
		expect(supplied.unhandled).toHaveLength(1);
		expect(supplied.unhandled[0]).toContain('Buffer');
	});
});

const workspace = (polyfills: unknown): string =>
	`${JSON.stringify(
		{
			version: 1,
			projects: {
				anything: {
					architect: {
						build: {
							builder: '@angular-devkit/build-angular:browser',
							options: { main: 'src/main.ts', polyfills },
						},
						lint: {
							builder: '@angular-eslint/builder:lint',
							options: { lintFilePatterns: [] },
						},
					},
				},
			},
		},
		null,
		2,
	)}\n`;

describe('declarePolyfillEntryPoint', () => {
	it('puts the entry point first in every target that takes the option', () => {
		const declaration = declarePolyfillEntryPoint(
			workspace(['src/polyfills.ts']),
			'src/node-core-runtime-globals.ts',
		);
		expect(declaration.changes).toHaveLength(1);
		expect(declaration.changes[0]?.path).toBe(
			'projects.anything.architect.build.options.polyfills',
		);
		expect(JSON.parse(declaration.config)).toMatchObject({
			projects: {
				anything: {
					architect: {
						build: {
							options: {
								polyfills: ['src/node-core-runtime-globals.ts', 'src/polyfills.ts'],
							},
						},
					},
				},
			},
		});
		expect(declaration.unhandled).toEqual([]);
	});

	it('is idempotent when the entry point is already declared', () => {
		const config = workspace(['src/node-core-runtime-globals.ts', 'src/polyfills.ts']);
		const declaration = declarePolyfillEntryPoint(config, 'src/node-core-runtime-globals.ts');
		expect(declaration.changes).toEqual([]);
		expect(declaration.config).toBe(config);
	});

	it('refuses the pre-v15 string form rather than converting it', () => {
		const declaration = declarePolyfillEntryPoint(
			workspace('src/polyfills.ts'),
			'src/node-core-runtime-globals.ts',
		);
		expect(declaration.changes).toEqual([]);
		expect(declaration.unhandled[0]).toContain('is a string');
	});

	it('refuses a workspace with no target that takes the option', () => {
		const config = `${JSON.stringify({ version: 1, projects: { anything: { architect: {} } } }, null, 2)}\n`;
		const declaration = declarePolyfillEntryPoint(config, 'src/node-core-runtime-globals.ts');
		expect(declaration.changes).toEqual([]);
		expect(declaration.config).toBe(config);
		expect(declaration.unhandled.at(-1)).toContain('no builder target');
	});
});
