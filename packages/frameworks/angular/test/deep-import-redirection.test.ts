import { describe, expect, it } from 'vitest';
import { readEntryPointSurface } from '../src/barrel-entry-point-split.ts';
import {
	redirectUnreachableImports,
	type DeepImportReading,
} from '../src/deep-import-redirection.ts';

/**
 * A package that gained an exports map: the root publishes two symbols, one
 * secondary entry point publishes a third, and `./src/anything` — the path an
 * era application reached through — is on neither.
 */
const reading: DeepImportReading = Object.freeze({
	surface: Object.freeze({
		name: '@scope/worker',
		version: '16.2.12',
		entryPoints: Object.freeze([
			readEntryPointSurface(
				'@scope/worker',
				'.',
				'export declare class WorkerUpdate {}\nexport declare interface UpdateEvent {}\n',
			),
			readEntryPointSurface(
				'@scope/worker',
				'./config',
				'export declare class WorkerConfig {}\n',
			),
		]),
	}),
	reachableSpecifiers: Object.freeze([
		'@scope/worker',
		'@scope/worker/config',
		'@scope/worker/worker.js',
	]),
});

describe('deep import redirection', () => {
	it('moves a symbol reached through an unpublished subpath onto the entry point that publishes it', () => {
		const migration = redirectUnreachableImports(
			'src/app.ts',
			"import {UpdateEvent} from '@scope/worker/src/low_level';\n",
			reading,
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).toBe("import {UpdateEvent} from '@scope/worker';\n");
		expect(migration.changes).toHaveLength(1);
		expect(migration.changes[0]?.from).toBe('@scope/worker/src/low_level');
		expect(migration.changes[0]?.to).toBe('@scope/worker');
		expect(migration.unhandled).toEqual([]);
	});

	it('splits one unreachable import across the entry points that own its symbols', () => {
		const migration = redirectUnreachableImports(
			'src/app.ts',
			"import {WorkerUpdate, WorkerConfig} from '@scope/worker/src/internal';\n",
			reading,
		);
		expect(migration.source).toBe(
			"import {WorkerUpdate} from '@scope/worker';\nimport {WorkerConfig} from '@scope/worker/config';\n",
		);
	});

	it('keeps each specifier its own text, so an alias survives the move', () => {
		const migration = redirectUnreachableImports(
			'src/app.ts',
			"import {UpdateEvent as Event} from '@scope/worker/src/low_level';\n",
			reading,
		);
		expect(migration.source).toBe("import {UpdateEvent as Event} from '@scope/worker';\n");
	});

	it('leaves a reachable subpath alone, including one the surface cannot type', () => {
		const source =
			"import {WorkerConfig} from '@scope/worker/config';\nimport '@scope/worker/worker.js';\n";
		const migration = redirectUnreachableImports('src/app.ts', source, reading);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});

	it('refuses the whole declaration when one of its symbols is on no published surface', () => {
		const source = "import {UpdateEvent, GoneEvent} from '@scope/worker/src/low_level';\n";
		const migration = redirectUnreachableImports('src/app.ts', source, reading);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toHaveLength(1);
		expect(migration.unhandled[0]).toContain('GoneEvent');
	});

	it('refuses a namespace binding, whose members cannot be resolved by name', () => {
		const migration = redirectUnreachableImports(
			'src/app.ts',
			"import * as internals from '@scope/worker/src/low_level';\n",
			reading,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('namespace binding');
	});

	it('refuses a side-effect-only deep import rather than inventing an entry point for it', () => {
		const migration = redirectUnreachableImports(
			'src/app.ts',
			"import '@scope/worker/src/patch';\n",
			reading,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('names no symbol');
	});

	it('reports nothing for a module that imports some other package', () => {
		const migration = redirectUnreachableImports(
			'src/app.ts',
			"import {UpdateEvent} from '@other/worker/src/low_level';\n",
			reading,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});
});
