import { describe, expect, it } from 'vitest';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import {
	assertWitnessAngularSuperProductivityServiceWorker,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER,
} from '../../core/src/receipts/witness-angular-super-productivity.ts';
import {
	WITNESS_REAL_SERVICE_WORKER_PHASES,
	type WitnessRealServiceWorkerCheckpoint,
} from '../../core/src/receipts/witness-real-app.ts';
import {
	createPlaywrightWitnessHost,
	readWitnessIndexedDbKeys,
	witnessIndexedDbStringKeys,
	type ServiceWorkerTelemetry,
} from '../src/witness/playwright-host.ts';
import {
	buildRealServiceWorkerEvidence,
	realServiceWorkerCheckpoint,
} from '../src/witness/real-app-run.ts';

/**
 * A synthetic IndexedDB, in process.
 *
 * The reader is exported as one self-contained function precisely so this is
 * possible: the host hands that exact function to the live page, and what runs
 * below is the same source rather than a second implementation written to agree
 * with it. Everything the fixture provides is what the DOM interface provides —
 * requests whose handlers are assigned after the call returns and fire on a
 * later turn, which is the ordering the real interface has and the reader has to
 * cope with.
 */
type FakeStore = {
	keyPath: string | string[] | null;
	autoIncrement: boolean;
	keys: IDBValidKey[];
};
type FakeDatabase = { version: number; stores: Record<string, FakeStore> };
type Handler = (() => void) | null;

function fakeIndexedDb(
	databases: Record<string, FakeDatabase>,
	options: { upgradeNeeded?: boolean; openFails?: boolean; readFails?: boolean } = {},
): IDBFactory {
	const request = <Value>(
		result: Value,
		settle: 'success' | 'error' | 'upgrade',
	): { result: Value; onsuccess: Handler; onerror: Handler; onupgradeneeded: Handler } => {
		const pending = {
			result,
			onsuccess: null as Handler,
			onerror: null as Handler,
			onupgradeneeded: null as Handler,
		};
		queueMicrotask(() => {
			if (settle === 'success') pending.onsuccess?.();
			else if (settle === 'error') pending.onerror?.();
			else pending.onupgradeneeded?.();
		});
		return pending;
	};
	const factory = {
		databases: async () =>
			Object.keys(databases).map((name) => ({ name, version: databases[name]!.version })),
		open: (name: string) => {
			const database = databases[name]!;
			const storeNames = Object.keys(database.stores);
			const handle = {
				version: database.version,
				objectStoreNames: storeNames,
				transaction: (requested: string[]) => ({
					objectStore: (storeName: string) => {
						const store = database.stores[storeName]!;
						if (!requested.includes(storeName))
							throw new Error(`store outside the transaction: ${storeName}`);
						return {
							keyPath: store.keyPath,
							autoIncrement: store.autoIncrement,
							getAllKeys: () =>
								request(
									store.keys,
									options.readFails === true ? 'error' : 'success',
								),
						};
					},
				}),
				close: () => undefined,
			};
			return request(
				handle,
				options.openFails === true
					? 'error'
					: options.upgradeNeeded === true
						? 'upgrade'
						: 'success',
			);
		},
	};
	return factory as unknown as IDBFactory;
}

async function withIndexedDb<Value>(
	factory: IDBFactory | undefined,
	read: () => Promise<Value>,
): Promise<Value> {
	const scope = globalThis as unknown as { indexedDB?: IDBFactory };
	const restore = Object.hasOwn(scope, 'indexedDB');
	const previous = scope.indexedDB;
	if (factory === undefined) delete scope.indexedDB;
	else scope.indexedDB = factory;
	try {
		return await read();
	} finally {
		if (restore) scope.indexedDB = previous;
		else delete scope.indexedDB;
	}
}

/** The localforage shape this corpus's first IndexedDB application actually uses. */
const LOCALFORAGE = {
	SUP: {
		version: 2,
		stores: {
			SUP_STORE: {
				keyPath: null,
				autoIncrement: false,
				keys: ['TASK_STATE', 'GLOBAL_CFG', 'PROJECT_STATE'],
			},
		},
	},
} satisfies Record<string, FakeDatabase>;

describe('the IndexedDB key reader', () => {
	it('reads databases, object stores and keys, sorted, from the live origin', async () => {
		const inventory = await withIndexedDb(
			fakeIndexedDb({
				...LOCALFORAGE,
				journal: {
					version: 1,
					stores: {
						entries: { keyPath: 'id', autoIncrement: true, keys: [10, 2] },
						empty: { keyPath: null, autoIncrement: false, keys: [] },
					},
				},
			}),
			readWitnessIndexedDbKeys,
		);
		expect(inventory).toEqual({
			state: 'read-keys-only',
			databases: [
				{
					name: 'SUP',
					version: 2,
					stores: [
						{
							name: 'SUP_STORE',
							keyPath: null,
							autoIncrement: false,
							keys: [
								{ kind: 'string', key: 'GLOBAL_CFG' },
								{ kind: 'string', key: 'PROJECT_STATE' },
								{ kind: 'string', key: 'TASK_STATE' },
							],
						},
					],
				},
				{
					name: 'journal',
					version: 1,
					stores: [
						{ name: 'empty', keyPath: null, autoIncrement: false, keys: [] },
						{
							name: 'entries',
							keyPath: 'id',
							autoIncrement: true,
							keys: [
								{ kind: 'number', key: '10' },
								{ kind: 'number', key: '2' },
							],
						},
					],
				},
			],
		});
	});

	it('reads keys and never values', async () => {
		const inventory = await withIndexedDb(fakeIndexedDb(LOCALFORAGE), readWitnessIndexedDbKeys);
		// The reader is never handed a value to begin with — the fixture holds
		// none, and the shape has nowhere to put one. Both halves are asserted:
		// the state names the discipline, and no store carries a value field.
		expect(inventory.state).toBe('read-keys-only');
		for (const database of inventory.databases)
			for (const store of database.stores)
				expect(Object.keys(store).sort()).toEqual([
					'autoIncrement',
					'keyPath',
					'keys',
					'name',
				]);
	});

	it('refuses a key whose shape it cannot record faithfully', async () => {
		await expect(
			withIndexedDb(
				fakeIndexedDb({
					dated: {
						version: 1,
						stores: {
							rows: {
								keyPath: null,
								autoIncrement: false,
								keys: [new Date(0)],
							},
						},
					},
				}),
				readWitnessIndexedDbKeys,
			),
		).rejects.toThrow(/refuses a key it cannot record faithfully/);
	});

	it('refuses to create the database it was asked to read', async () => {
		await expect(
			withIndexedDb(
				fakeIndexedDb(LOCALFORAGE, { upgradeNeeded: true }),
				readWitnessIndexedDbKeys,
			),
		).rejects.toThrow(/refuses to create a database it reads/);
	});

	it('refuses an origin whose IndexedDB cannot be enumerated', async () => {
		await expect(withIndexedDb(undefined, readWitnessIndexedDbKeys)).rejects.toThrow(
			/found no enumerable IndexedDB/,
		);
	});

	it('reports a failed open and a failed read as failures rather than as emptiness', async () => {
		await expect(
			withIndexedDb(
				fakeIndexedDb(LOCALFORAGE, { openFails: true }),
				readWitnessIndexedDbKeys,
			),
		).rejects.toThrow(/could not open a database/);
		await expect(
			withIndexedDb(
				fakeIndexedDb(LOCALFORAGE, { readFails: true }),
				readWitnessIndexedDbKeys,
			),
		).rejects.toThrow(/could not read a store/);
	});

	it('resolves the string keys of a named store, and refuses everything else', async () => {
		const inventory = await withIndexedDb(
			fakeIndexedDb({
				...LOCALFORAGE,
				journal: {
					version: 1,
					stores: { entries: { keyPath: 'id', autoIncrement: true, keys: [1] } },
				},
			}),
			readWitnessIndexedDbKeys,
		);
		expect(witnessIndexedDbStringKeys(inventory, 'SUP', 'SUP_STORE')).toEqual([
			'GLOBAL_CFG',
			'PROJECT_STATE',
			'TASK_STATE',
		]);
		expect(() => witnessIndexedDbStringKeys(inventory, 'OTHER', 'SUP_STORE')).toThrow(
			/found no database: OTHER/,
		);
		expect(() => witnessIndexedDbStringKeys(inventory, 'SUP', 'OTHER_STORE')).toThrow(
			/found no object store: OTHER_STORE/,
		);
		// Silently dropping the numeric keys would publish a shorter list than
		// the store holds, which is why this is a refusal and not a filter.
		expect(() => witnessIndexedDbStringKeys(inventory, 'journal', 'entries')).toThrow(
			/is not string-keyed: entries/,
		);
	});

	it('refuses every reading where the application declared none', async () => {
		await expect(
			createPlaywrightWitnessHost({ chromiumExecutable: '/nonexistent' }).indexedDbKeys(),
		).rejects.toThrow(/IndexedDB key reading is not declared/);
	});

	it('requires exactly one live page where the application did declare it', async () => {
		await expect(
			createPlaywrightWitnessHost({
				chromiumExecutable: '/nonexistent',
				indexedDb: 'read-keys',
			}).indexedDbKeys(),
		).rejects.toThrow(/requires exactly one live page/);
	});
});

const WORKER_EVENTS = [
	{ kind: 'registration' as const, scopePath: '/' },
	{
		kind: 'version' as const,
		scriptPath: '/ngsw-worker.js',
		status: 'activated',
		runningStatus: 'running',
	},
];

const OUTPUT_FILES = [
	{ path: 'index.html', sha256: sha256('index') },
	{ path: 'ngsw-worker.js', sha256: sha256('ngsw') },
	{ path: 'safety-worker.js', sha256: sha256('safety') },
];

function telemetry(overrides: Partial<ServiceWorkerTelemetry> = {}): ServiceWorkerTelemetry {
	return {
		state: 'ready',
		registration: {
			scriptPath: '/ngsw-worker.js',
			scope: '/',
			installing: null,
			waiting: null,
			active: 'activated',
		},
		controller: 'activated',
		cacheNames: ['ngsw:/:1:cache', 'ngsw:/:db:control'],
		cacheEntries: [],
		workerEvents: WORKER_EVENTS,
		...overrides,
	};
}

const checkpoints: WitnessRealServiceWorkerCheckpoint[] = WITNESS_REAL_SERVICE_WORKER_PHASES.map(
	(phase) => ({
		phase,
		telemetry: {
			...telemetry(phase === 'before-interactions' ? { controller: null } : {}),
			state: 'ready',
		},
	}),
);

const evidence = (
	overrides: Partial<Parameters<typeof buildRealServiceWorkerEvidence>[0]> = {},
): ReturnType<typeof buildRealServiceWorkerEvidence> =>
	buildRealServiceWorkerEvidence({
		script: 'ngsw-worker.js',
		shippedWorkerFiles: ['ngsw-worker.js', 'safety-worker.js'],
		checkpoints,
		before: OUTPUT_FILES,
		after: OUTPUT_FILES,
		workerEvents: WORKER_EVENTS,
		...overrides,
	});

describe('the succeeding-service-worker shape', () => {
	it('round-trips through the schema parser that will judge it', () => {
		const built = evidence();
		expect(built.outputFiles).toEqual([
			{
				path: 'ngsw-worker.js',
				beforeSha256: sha256('ngsw'),
				afterSha256: sha256('ngsw'),
			},
			{
				path: 'safety-worker.js',
				beforeSha256: sha256('safety'),
				afterSha256: sha256('safety'),
			},
		]);
		expect(built.checkpoints.map((checkpoint) => checkpoint.phase)).toEqual([
			...WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER.checkpointPhases,
		]);
		expect(() =>
			assertWitnessAngularSuperProductivityServiceWorker(built, 'round-trip'),
		).not.toThrow();
	});

	it('is refused by that parser once any of its facts stops holding', () => {
		/**
		 * The corruptions are applied through a loose view of the same object on
		 * purpose: each one is a shape the producer's own types forbid, and the
		 * point of the exercise is that the parser refuses it anyway rather than
		 * relying on the producer having been well typed.
		 */
		type Loose = {
			script: string;
			checkpoints: Array<{
				phase: string;
				telemetry: {
					state: string;
					registration: { scriptPath: string | null; scope: string | null };
				};
			}>;
			outputFiles: Array<{ path: string; beforeSha256: string; afterSha256: string }>;
			workerEvents: unknown[];
		};
		const cases: Array<[string, (built: Loose) => void]> = [
			[
				'two checkpoints',
				(built) => void (built.checkpoints = built.checkpoints.slice(0, 2)),
			],
			[
				'a checkpoint that never settled',
				(built) => void (built.checkpoints[0]!.telemetry.state = 'timeout'),
			],
			[
				'a registration naming another script',
				(built) =>
					void (built.checkpoints[0]!.telemetry.registration.scriptPath = '/sw.js'),
			],
			[
				'a registration with no scope',
				(built) => void (built.checkpoints[0]!.telemetry.registration.scope = null),
			],
			['no shipped worker files', (built) => void (built.outputFiles = [])],
			[
				'a worker file the run rewrote',
				(built) => void (built.outputFiles[0]!.afterSha256 = sha256('rewritten')),
			],
			['an empty observer trace', (built) => void (built.workerEvents = [])],
			['a script the application never asked for', (built) => void (built.script = '/sw.js')],
		];
		for (const [label, corrupt] of cases) {
			const built = structuredClone(evidence()) as unknown as Loose;
			corrupt(built);
			expect(
				() =>
					assertWitnessAngularSuperProductivityServiceWorker(
						built as unknown as ReturnType<typeof evidence>,
						label,
					),
				label,
			).toThrow(/service-worker evidence differs/);
		}
	});

	it('refuses to build a record whose checkpoints are not the three settled phases', () => {
		expect(() => evidence({ checkpoints: checkpoints.slice(0, 2) })).toThrow(
			/not three settled phased checkpoints/,
		);
		expect(() => evidence({ checkpoints: [...checkpoints].reverse() })).toThrow(
			/not three settled phased checkpoints/,
		);
		expect(() =>
			evidence({
				checkpoints: checkpoints.map((checkpoint) => ({
					...checkpoint,
					telemetry: {
						...checkpoint.telemetry,
						registration: { ...checkpoint.telemetry.registration, scope: null },
					},
				})),
			}),
		).toThrow(/not three settled phased checkpoints/);
	});

	it('refuses a served tree the run changed underneath it, and a worker file that is not in it', () => {
		expect(() =>
			evidence({
				after: OUTPUT_FILES.map((file) =>
					file.path === 'ngsw-worker.js'
						? { ...file, sha256: sha256('rewritten') }
						: file,
				),
			}),
		).toThrow(/changed during the run: ngsw-worker\.js/);
		expect(() =>
			evidence({ shippedWorkerFiles: ['ngsw-worker.js', 'absent-worker.js'] }),
		).toThrow(/absent from the served tree: absent-worker\.js/);
		expect(() => evidence({ shippedWorkerFiles: [] })).toThrow(
			/no distinct shipped worker files/,
		);
		expect(() =>
			evidence({ shippedWorkerFiles: ['ngsw-worker.js', 'ngsw-worker.js'] }),
		).toThrow(/no distinct shipped worker files/);
	});

	it('refuses a record with no registered script and one with an empty trace', () => {
		expect(() => evidence({ script: '' })).toThrow(/names no registered script/);
		expect(() => evidence({ workerEvents: [] })).toThrow(/empty observer trace/);
	});
});

describe('the succeeding-service-worker checkpoint', () => {
	const lifecycle = (reading: ServiceWorkerTelemetry) => ({
		serviceWorkerTelemetry: async (): Promise<ServiceWorkerTelemetry> => reading,
	});

	it('records a settled reading at the named phase', async () => {
		await expect(
			realServiceWorkerCheckpoint(
				lifecycle(telemetry()),
				'after-interactions',
				'ngsw-worker.js',
			),
		).resolves.toEqual({ phase: 'after-interactions', telemetry: telemetry() });
	});

	it('refuses the timeout every absence shape records, and every unsettled registration', async () => {
		const refusals: Array<[string, ServiceWorkerTelemetry]> = [
			['timed out', telemetry({ state: 'timeout' })],
			[
				'no script',
				telemetry({
					registration: {
						scriptPath: null,
						scope: '/',
						installing: null,
						waiting: null,
						active: 'activated',
					},
				}),
			],
			[
				'another script',
				telemetry({
					registration: {
						scriptPath: '/sw.js',
						scope: '/',
						installing: null,
						waiting: null,
						active: 'activated',
					},
				}),
			],
			[
				'nothing active',
				telemetry({
					registration: {
						scriptPath: '/ngsw-worker.js',
						scope: '/',
						installing: 'installing',
						waiting: null,
						active: null,
					},
				}),
			],
			['no observer trace', telemetry({ workerEvents: [] })],
		];
		for (const [label, reading] of refusals)
			await expect(
				realServiceWorkerCheckpoint(
					lifecycle(reading),
					'before-interactions',
					'ngsw-worker.js',
				),
				label,
			).rejects.toThrow(/real-service-worker checkpoint failed/);
	});
});
