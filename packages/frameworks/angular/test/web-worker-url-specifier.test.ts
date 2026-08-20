import { describe, expect, it } from 'vitest';
import {
	declaredWorkerType,
	rewriteWorkerUrlSpecifiers,
	type WorkerTreeReading,
} from '../src/web-worker-url-specifier.ts';

/** A workspace that declares worker support and a tree carrying one worker source. */
const reading: WorkerTreeReading = Object.freeze({
	declaresWorkerSupport: true,
	workerSourceFor: (specifier: string): string | null =>
		specifier === './lz.worker' ? 'src/app/core/compression/lz.worker.ts' : null,
});

const undeclared: WorkerTreeReading = Object.freeze({
	declaresWorkerSupport: false,
	workerSourceFor: reading.workerSourceFor,
});

const migrate = (
	source: string,
	tree: WorkerTreeReading = reading,
): ReturnType<typeof rewriteWorkerUrlSpecifiers> =>
	rewriteWorkerUrlSpecifiers('src/app/core/compression/compression.service.ts', source, tree);

const eraForm = `export class CompressionService {
  private _w: Worker;
  constructor() {
    this._w = new Worker('./lz.worker', {
      name: 'lz',
      type: 'module'
    });
  }
}
`;

describe('web worker url specifier', () => {
	it('writes the URL form the bundler detects and keeps the specifier and the options', () => {
		const migration = migrate(eraForm);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain("new Worker(new URL('./lz.worker', import.meta.url), {");
		expect(migration.source).toContain("name: 'lz'");
		expect(migration.source).toContain("type: 'module'");
		expect(migration.changes).toHaveLength(1);
		expect(migration.changes[0]?.specifier).toBe('./lz.worker');
		expect(migration.changes[0]?.resolved).toBe('src/app/core/compression/lz.worker.ts');
		expect(migration.changes[0]?.line).toBe(4);
		expect(migration.unhandled).toEqual([]);
	});

	it('keeps the quote style the module already wrote', () => {
		const migration = migrate('const w = new Worker("./lz.worker", {type: "module"});\n');
		expect(migration.source).toBe(
			'const w = new Worker(new URL("./lz.worker", import.meta.url), {type: "module"});\n',
		);
	});

	it('refuses every site when the workspace declares no worker support', () => {
		const migration = migrate(eraForm, undeclared);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(eraForm);
		expect(migration.unhandled.join(' ')).toContain('declares no web-worker support');
	});

	it('refuses a specifier the tree carries no worker source for', () => {
		const migration = migrate("const w = new Worker('./missing.worker', {type: 'module'});\n");
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('resolves to no worker source');
	});

	it('refuses a specifier this reader cannot read, rather than guessing it', () => {
		const computed = migrate(
			"const name = './lz.worker';\nconst w = new Worker(name, {type: 'module'});\n",
		);
		expect(computed.changed).toBe(false);
		expect(computed.unhandled.join(' ')).toContain('not a string literal');
		const template = migrate('const w = new Worker(`./${kind}.worker`, {type: "module"});\n');
		expect(template.changed).toBe(false);
		expect(template.unhandled.join(' ')).toContain('not a string literal');
	});

	it('refuses a construction whose options do not say the worker is a module', () => {
		const none = migrate("const w = new Worker('./lz.worker');\n");
		expect(none.changed).toBe(false);
		expect(none.unhandled.join(' ')).toContain('no readable options `type`');
		const classic = migrate("const w = new Worker('./lz.worker', {type: 'classic'});\n");
		expect(classic.changed).toBe(false);
		expect(classic.unhandled.join(' ')).toContain("type: 'classic'");
	});

	it('refuses an options object whose membership is not static', () => {
		const migration = migrate(
			"const w = new Worker('./lz.worker', {...base, type: 'module'});\n",
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('no readable options `type`');
		expect(declaredWorkerType(undefined)).toBeNull();
	});

	it('refuses a Worker that is not the global one, by binding rather than by name', () => {
		const migration = migrate(
			[
				'class Worker { constructor(_url: string, _options: unknown) {} }',
				"const w = new Worker('./lz.worker', {type: 'module'});",
				'',
			].join('\n'),
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('binds the name Worker');
	});

	it('passes over a construction already written in the URL form, in silence', () => {
		const source =
			"const w = new Worker(new URL('./lz.worker', import.meta.url), {type: 'module'});\n";
		const migration = migrate(source);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled).toEqual([]);
	});

	it('is idempotent: a second pass over its own output changes nothing', () => {
		const once = migrate(eraForm);
		const twice = migrate(once.source);
		expect(twice.changed).toBe(false);
		expect(twice.source).toBe(once.source);
		expect(twice.unhandled).toEqual([]);
	});

	it('answers two sites in one module independently', () => {
		const migration = migrate(
			[
				"const a = new Worker('./lz.worker', {type: 'module'});",
				"const b = new Worker('./other.worker', {type: 'module'});",
				'',
			].join('\n'),
		);
		expect(migration.changes).toHaveLength(1);
		expect(migration.unhandled).toHaveLength(1);
		expect(migration.source).toContain("new URL('./lz.worker', import.meta.url)");
		expect(migration.source).toContain("new Worker('./other.worker'");
	});
});
