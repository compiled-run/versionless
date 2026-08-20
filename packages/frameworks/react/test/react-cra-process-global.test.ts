import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createContext, runInContext } from 'node:vm';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import {
	craModuleIsProcessAnalyzable,
	craProcessGlobalShim,
	createCraProcessGlobalPlugin,
	injectProcessGlobalShim,
	mergeProcessGlobalReadings,
	readProcessGlobalUsage,
	type CraProcessGlobalRecord,
} from '../src/react-cra-process-global.ts';

/** Run a shim in an isolated context and expose its scheduled timers. */
function evaluateShim(source: string): {
	read(expression: string): unknown;
	scheduled: Array<() => void>;
} {
	const scheduled: Array<() => void> = [];
	const sandbox: Record<string, unknown> = {
		setTimeout: (fn: () => void) => {
			scheduled.push(fn);
			return scheduled.length;
		},
	};
	const context = createContext(sandbox);
	runInContext(source, context);
	return { read: (expression) => runInContext(expression, context), scheduled };
}

describe('CRA process global — reading the bundle', () => {
	test('records a read member, unread and uncalled', () => {
		const reading = readProcessGlobalUsage('const v = process.version;');
		expect(reading.referenced).toBe(true);
		expect(reading.members.map((usage) => usage.member)).toEqual(['version']);
		expect(reading.members[0]?.called).toBe(false);
		expect(reading.bareReferences).toEqual([]);
	});

	test('records a called member as called', () => {
		const reading = readProcessGlobalUsage('process.nextTick(function () {});');
		expect(reading.members.map((usage) => usage.member)).toEqual(['nextTick']);
		expect(reading.members[0]?.called).toBe(true);
	});

	test('records only the first hop off a deep member chain', () => {
		const reading = readProcessGlobalUsage('const e = process.env.NODE_ENV;');
		expect(reading.members.map((usage) => usage.member)).toEqual(['env']);
		expect(reading.members[0]?.called).toBe(false);
	});

	test('a bare value use and typeof are referenced but name no member', () => {
		const reading = readProcessGlobalUsage(
			'if (typeof process !== "undefined") sink(process);',
		);
		expect(reading.referenced).toBe(true);
		expect(reading.members).toEqual([]);
		expect(reading.bareReferences.length).toBe(2);
	});

	test('a computed member names no member to supply', () => {
		const reading = readProcessGlobalUsage('const k = "env"; const v = process[k];');
		expect(reading.members).toEqual([]);
		expect(reading.bareReferences.length).toBe(1);
	});

	test('a locally bound process is not the global and is ignored', () => {
		const reading = readProcessGlobalUsage(
			'function run(process) { return process.cwd(); }\nfunction other() { const process = {}; return process.pid; }',
		);
		expect(reading.referenced).toBe(false);
		expect(reading.members).toEqual([]);
	});

	test('a module that never mentions process reads as empty', () => {
		const reading = readProcessGlobalUsage('export const answer = 1 + 1;', 'input.ts');
		expect(reading.referenced).toBe(false);
	});

	test('unparseable source is refused rather than guessed at', () => {
		const reading = readProcessGlobalUsage('const = = process.version', 'broken.js');
		expect(reading.referenced).toBe(false);
	});

	test('merges per-module readings, unioning call flags', () => {
		const merged = mergeProcessGlobalReadings([
			readProcessGlobalUsage('const v = process.version;', 'a.js'),
			readProcessGlobalUsage('process.nextTick(fn); const b = process.browser;', 'b.js'),
			readProcessGlobalUsage('const v2 = process.version;', 'c.js'),
		]);
		expect(merged.members.map((usage) => usage.member)).toEqual([
			'browser',
			'nextTick',
			'version',
		]);
		expect(merged.members.find((usage) => usage.member === 'nextTick')?.called).toBe(true);
		expect(merged.members.find((usage) => usage.member === 'version')?.references.length).toBe(
			2,
		);
	});
});

describe('CRA process global — the parity shim', () => {
	/** The exact surface the holdout's migrated bundle reaches. */
	const bundleReading = mergeProcessGlobalReadings([
		readProcessGlobalUsage(
			[
				'process.nextTick(function () {});',
				'const a = process.version;',
				'const b = process.browser;',
				'const c = process.stdout;',
				'const d = process.stderr;',
				'const e = process.versions;',
				'const f = process.cwd();',
				'const g = process.traceDeprecation;',
				'const h = process.throwDeprecation;',
				'const i = process.pid;',
				'const j = process.noDeprecation;',
				'const k = process.env;',
			].join('\n'),
			'bundle.js',
		),
	]);

	test('supplies exactly the reached process/browser members and leaves the rest undefined', () => {
		const shim = craProcessGlobalShim(bundleReading);
		expect(shim.source).not.toBeNull();
		const supplied = shim.members
			.filter((entry) => entry.kind !== 'leaf')
			.map((entry) => entry.member)
			.sort();
		expect(supplied).toEqual(['browser', 'cwd', 'env', 'nextTick', 'version', 'versions']);
		const leaves = shim.members
			.filter((entry) => entry.kind === 'leaf')
			.map((entry) => entry.member)
			.sort();
		expect(leaves).toEqual([
			'noDeprecation',
			'pid',
			'stderr',
			'stdout',
			'throwDeprecation',
			'traceDeprecation',
		]);
		// Nothing the bundle never touches is supplied: `platform` is a read the
		// baseline left undefined, and it is absent because no read of it was found.
		expect(shim.members.some((entry) => entry.member === 'platform')).toBe(false);
	});

	test('the shim installs a functional process global with process/browser values', () => {
		const shim = craProcessGlobalShim(bundleReading);
		const evaluated = evaluateShim(shim.source ?? '');
		expect(evaluated.read('typeof process.nextTick')).toBe('function');
		expect(evaluated.read('process.browser')).toBe(true);
		expect(evaluated.read('process.version')).toBe('');
		expect(evaluated.read('process.cwd()')).toBe('/');
		expect(evaluated.read('JSON.stringify(process.versions)')).toBe('{}');
		expect(evaluated.read('JSON.stringify(process.env)')).toBe('{}');
		// Honest leaves: the read yields undefined, exactly what the baseline had.
		expect(evaluated.read('process.stdout')).toBe(undefined);
		expect(evaluated.read('process.pid')).toBe(undefined);
	});

	test('nextTick defers a callback onto a macrotask and forwards its arguments', () => {
		const shim = craProcessGlobalShim(bundleReading);
		const evaluated = evaluateShim(shim.source ?? '');
		evaluated.read('globalThis.witness = null;');
		evaluated.read('process.nextTick(function (v) { globalThis.witness = v; }, 42);');
		// Deferred, not run synchronously.
		expect(evaluated.read('globalThis.witness')).toBe(null);
		expect(evaluated.scheduled.length).toBe(1);
		evaluated.scheduled[0]?.();
		expect(evaluated.read('globalThis.witness')).toBe(42);
	});

	test('does not clobber a process the host already supplies', () => {
		const shim = craProcessGlobalShim(bundleReading);
		const scheduled: Array<() => void> = [];
		const sandbox: Record<string, unknown> = {
			setTimeout: (fn: () => void) => scheduled.push(fn),
			process: { version: 'v20.0.0', browser: false },
		};
		const context = createContext(sandbox);
		runInContext(shim.source ?? '', context);
		expect(runInContext('process.version', context)).toBe('v20.0.0');
		expect(runInContext('process.browser', context)).toBe(false);
	});

	test('a called member process/browser leaves undefined is surfaced, not invented', () => {
		const shim = craProcessGlobalShim(readProcessGlobalUsage('process.exit(0);'));
		expect(shim.unsupportedCalls).toEqual(['exit']);
		const evaluated = evaluateShim(shim.source ?? '');
		expect(evaluated.read('process.exit')).toBe(undefined);
	});

	test('the noop event-emitter surface is reproduced only when reached', () => {
		const shim = craProcessGlobalShim(
			readProcessGlobalUsage('process.on("exit", fn); process.emit("x");'),
		);
		const evaluated = evaluateShim(shim.source ?? '');
		expect(evaluated.read('typeof process.on')).toBe('function');
		expect(evaluated.read('process.on()')).toBe(undefined);
		expect(evaluated.read('typeof process.emit')).toBe('function');
		// A member not reached stays absent even though process/browser defines it.
		expect(evaluated.read('process.umask')).toBe(undefined);
	});

	test('a reading that reached nothing yields no shim', () => {
		const shim = craProcessGlobalShim(readProcessGlobalUsage('const x = 1;'));
		expect(shim.source).toBeNull();
		expect(shim.members).toEqual([]);
	});

	test('the shim is deterministic for a given reading', () => {
		expect(craProcessGlobalShim(bundleReading).source).toBe(
			craProcessGlobalShim(bundleReading).source,
		);
	});
});

describe('CRA process global — document injection', () => {
	const document = [
		'<!DOCTYPE html>',
		'<html>',
		'  <head>',
		'    <title>App</title>',
		'    <script type="module" crossorigin src="/assets/index.js"></script>',
		'  </head>',
		'  <body><div id="root"></div></body>',
		'</html>',
		'',
	].join('\n');

	test('injects a classic script ahead of the module entry', () => {
		const injected = injectProcessGlobalShim(document, 'globalThis.process = {};');
		const scriptIndex = injected.indexOf('<script>');
		const moduleIndex = injected.indexOf('<script type="module"');
		expect(scriptIndex).toBeGreaterThan(-1);
		expect(scriptIndex).toBeLessThan(moduleIndex);
	});

	test('falls back to before the head close when there is no module script', () => {
		const bare =
			'<html>\n  <head>\n    <title>x</title>\n  </head>\n  <body></body>\n</html>\n';
		const injected = injectProcessGlobalShim(bare, 'globalThis.process = {};');
		expect(injected.indexOf('<script>')).toBeLessThan(injected.indexOf('</head>'));
	});
});

describe('CRA process global — the Vite plugin', () => {
	test('classifies analysable module ids', () => {
		expect(craModuleIsProcessAnalyzable('/app/src/index.tsx')).toBe(true);
		expect(craModuleIsProcessAnalyzable('/app/dep/browser.js?commonjs-proxy')).toBe(true);
		expect(craModuleIsProcessAnalyzable('\0virtual:something')).toBe(false);
		expect(craModuleIsProcessAnalyzable('/app/styles.css')).toBe(false);
	});

	test('accumulates usage across modules and injects the shim into the emitted document', async () => {
		const directory = await mkdtemp(path.join(tmpdir(), 'cra-process-global-'));
		try {
			const outDir = path.join(directory, 'build');
			await mkdir(outDir, { recursive: true });
			await writeFile(
				path.join(outDir, 'index.html'),
				'<!DOCTYPE html>\n<html>\n  <head>\n    <script type="module" src="/assets/index.js"></script>\n  </head>\n  <body></body>\n</html>\n',
			);
			const observed: CraProcessGlobalRecord[] = [];
			const plugin = createCraProcessGlobalPlugin({
				observe: (record) => observed.push(record),
			});
			plugin.configResolved({ build: { outDir } });
			expect(plugin.transform('const v = process.version;', '/app/src/a.ts')).toBeNull();
			expect(
				plugin.transform('process.nextTick(fn);', '/app/node_modules/dep/b.js'),
			).toBeNull();
			expect(plugin.transform('export const x = 1;', '/app/src/c.ts')).toBeNull();
			await plugin.closeBundle.handler();
			const html = await readFile(path.join(outDir, 'index.html'), 'utf8');
			expect(html).toContain('versionless-cra-process-global-shim');
			expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('<script type="module"'));
			expect(observed.length).toBe(1);
			expect(observed[0]?.members.map((entry) => entry.member).sort()).toEqual([
				'nextTick',
				'version',
			]);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('a build that never reaches process leaves the document byte-identical', async () => {
		const directory = await mkdtemp(path.join(tmpdir(), 'cra-process-global-'));
		try {
			const outDir = path.join(directory, 'build');
			await mkdir(outDir, { recursive: true });
			const original = '<!DOCTYPE html>\n<html><head></head><body></body></html>\n';
			await writeFile(path.join(outDir, 'index.html'), original);
			const plugin = createCraProcessGlobalPlugin();
			plugin.configResolved({ build: { outDir } });
			plugin.transform('export const x = 1;', '/app/src/only.ts');
			await plugin.closeBundle.handler();
			expect(await readFile(path.join(outDir, 'index.html'), 'utf8')).toBe(original);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('re-running the injection does not double-install the shim', async () => {
		const directory = await mkdtemp(path.join(tmpdir(), 'cra-process-global-'));
		try {
			const outDir = path.join(directory, 'build');
			await mkdir(outDir, { recursive: true });
			await writeFile(
				path.join(outDir, 'index.html'),
				'<!DOCTYPE html>\n<html>\n  <head>\n    <script type="module" src="/assets/index.js"></script>\n  </head>\n  <body></body>\n</html>\n',
			);
			const plugin = createCraProcessGlobalPlugin();
			plugin.configResolved({ build: { outDir } });
			plugin.transform('const v = process.version;', '/app/src/a.ts');
			await plugin.closeBundle.handler();
			await plugin.closeBundle.handler();
			const html = await readFile(path.join(outDir, 'index.html'), 'utf8');
			const occurrences = html.split('versionless-cra-process-global-shim').length - 1;
			expect(occurrences).toBe(1);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('refuses to inject before the build output directory is resolved', async () => {
		const plugin = createCraProcessGlobalPlugin();
		plugin.transform('const v = process.version;', '/app/src/a.ts');
		await expect(plugin.closeBundle.handler()).rejects.toThrow('outDir is unresolved');
	});
});
