/**
 * The era-cell stage.
 *
 * The claim under test is the one spike C left open: which toolchain era an
 * application needs is a reading, not a decision an operator makes by watching
 * an install fail. `evidence/spikes/thin-wrapper-cost/verdict.json` recorded a
 * `darwin-arm64` host carrying exactly one Node era cell and a node-sass 4.x
 * closure that refuses arm64 outright; this file checks that the same shape of
 * closure is refused by name, before anything is installed, and that a cell the
 * host already carries is recorded as present rather than provisioned.
 *
 * The host reading is supplied to the stage rather than taken from the machine
 * the tests run on. A test whose outcome depends on which architecture CI
 * happens to use is not a test of the refusal — it is a test of the CI fleet.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	ARCHITECTURE_BINDINGS,
	DEFAULT_ERA_CELL_DECLARATIONS,
	DESCRIBED_CELLS,
	ERA_CELL_RECORD_SCHEMA,
	ERA_NOT_READ_CLAIM,
	LANE_RUNTIME_BASIS,
	LANE_RUNTIME_READ_FROM,
	NGCC_ANGULAR_13_CELL,
	NODE_MAJOR_SOURCE_SLOTS,
	declaredRangeAdmitsMajor,
	describedCell,
	establishEraCell,
	eraCellNotRequested,
	eraCellRefused,
	leadingMajor,
	nodeMajorsOfDeclaration,
	readArchitectureRequirements,
	readHostCell,
	renderEraCell,
	runtimeDirectoryName,
	translationFor,
	type EraCellDeclarations,
	type HostCellReading,
	type InstalledRuntime,
} from '../src/operator/era-cell.ts';
import {
	ANGULAR_16_BROWSER_CELL,
	ANGULAR_TARGET_CELLS,
} from '../../frameworks/angular/src/index.ts';
import { cypressRwaWorkArea } from '../src/fixture/react-cypress-rwa-migration-run.ts';
import { runOperatorCommand } from '../src/operator/flows.ts';
import { resolveAngularTargetCell } from '../src/operator/plan.ts';
import {
	EXIT_REFUSAL,
	PIPELINE_STAGES,
	pipelineRefusalOf,
	refusalRecord,
} from '../src/operator/refusals.ts';

async function temporaryDirectory(): Promise<string> {
	return mkdtemp(path.join(tmpdir(), 'versionless-era-cell-'));
}

const declaring = (values: Partial<EraCellDeclarations>): EraCellDeclarations =>
	Object.freeze({ ...DEFAULT_ERA_CELL_DECLARATIONS, ...values });

/** A runtime as a host reading carries one. */
function runtime(
	version: string,
	architecture: string,
	supplier: string,
	location: string,
): InstalledRuntime {
	return Object.freeze({
		version,
		major: leadingMajor(version) ?? 0,
		platform: 'darwin',
		architecture,
		supplier,
		location,
	});
}

/**
 * The host spike C measured, as a reading rather than as this machine.
 *
 * `darwin-arm64`, one installed Node era cell, which is exactly the shape the
 * spike recorded in its `host` block.
 */
function measuredArmHost(installed: readonly InstalledRuntime[]): HostCellReading {
	return Object.freeze({
		platform: 'darwin',
		architecture: 'arm64',
		runningNodeVersion: 'v24.15.0',
		runningNodeMajor: 24,
		suppliers: Object.freeze(['running-process']),
		installed: Object.freeze([...installed]),
	});
}

const RUNNING_ARM_24 = runtime(
	'v24.15.0',
	'arm64',
	'running-process',
	'the process this stage is running in',
);

/** A create-react-app tree whose lockfile pins node-sass at its 4.x line. */
async function writeNodeSassTree(root: string, nodeEra: string | null): Promise<void> {
	await mkdir(root, { recursive: true });
	await writeFile(
		path.join(root, 'package.json'),
		`${JSON.stringify(
			{
				name: 'era-cell-node-sass',
				dependencies: { react: '16.14.0' },
				devDependencies: { 'node-sass': '~4.14.0' },
			},
			null,
			'\t',
		)}\n`,
	);
	await writeFile(
		path.join(root, 'package-lock.json'),
		`${JSON.stringify(
			{
				name: 'era-cell-node-sass',
				lockfileVersion: 2,
				packages: {
					'': { name: 'era-cell-node-sass' },
					'node_modules/node-sass': { version: '4.14.1', hasInstallScript: true },
					'node_modules/react': { version: '16.14.0' },
				},
			},
			null,
			'\t',
		)}\n`,
	);
	if (nodeEra !== null) await writeFile(path.join(root, '.nvmrc'), `${nodeEra}\n`);
}

/** A React tree with no native dependency and a declared Node era. */
async function writePlainReactTree(root: string, nodeEra: string | null): Promise<void> {
	await mkdir(root, { recursive: true });
	await writeFile(
		path.join(root, 'package.json'),
		`${JSON.stringify({ name: 'era-cell-plain', dependencies: { react: '16.14.0' } }, null, '\t')}\n`,
	);
	if (nodeEra !== null) await writeFile(path.join(root, '.nvmrc'), `${nodeEra}\n`);
}

describe('era-cell — the architecture the closure requires', () => {
	it('refuses a node-sass closure on an arm64 host by name, with exit 2', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await writeNodeSassTree(application, '24');
			/** The measured host: arm64, one era cell installed, no x64 runtime. */
			const host = measuredArmHost([RUNNING_ARM_24]);
			let raised: unknown = null;
			try {
				await establishEraCell(application, DEFAULT_ERA_CELL_DECLARATIONS, host);
			} catch (error) {
				raised = error;
			}
			const refusal = pipelineRefusalOf(raised);
			expect(refusal?.code).toBe('era-cell.arch-not-available');
			expect(refusal?.stage).toBe('era-cell');
			expect(refusal?.origin).toBe('pipeline');
			/** The refusal carries the reading it was made from, verbatim. */
			expect(refusal?.message).toContain('node-sass@4.14.1');
			expect(refusal?.message).toContain('package-lock.json');
			expect(refusal?.message).toContain('Unsupported architecture (arm64)');
			expect(refusal?.message).toContain('rosetta-2');
			/** A refusal is exit 2 — a defect is 1, and this is not one. */
			expect(refusalRecord('era-cell', refusal as never).exitCode).toBe(EXIT_REFUSAL);
			const record = eraCellRefused(refusal as never, host);
			expect(record.outcome).toBe('refused');
			expect(record.schemaVersion).toBe(ERA_CELL_RECORD_SCHEMA);
			expect(record.host?.architecture).toBe('arm64');
			expect(renderEraCell(record)).toContain('era-cell.arch-not-available');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('takes the x64 runtime under translation when the host carries one', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await writeNodeSassTree(application, '14');
			const host = measuredArmHost([
				RUNNING_ARM_24,
				runtime(
					'v14.16.1',
					'x64',
					'workspace-runtime-cache',
					'cache/node-v14.16.1-darwin-x64',
				),
			]);
			const record = await establishEraCell(application, DEFAULT_ERA_CELL_DECLARATIONS, host);
			expect(record.outcome).toBe('provisioned');
			expect(record.required?.architecture).toBe('x64');
			expect(record.required?.architectureSource).toBe('inferred');
			expect(record.provision?.version).toBe('v14.16.1');
			expect(record.provision?.supplier).toBe('workspace-runtime-cache');
			expect(record.provision?.translation).toBe('rosetta-2');
			expect(record.determination.inferred).toContain('architecture');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('reads the requirement out of the lockfile and the manifest alike', async () => {
		const directory = await temporaryDirectory();
		try {
			const locked = path.join(directory, 'locked');
			await writeNodeSassTree(locked, null);
			const fromLock = await readArchitectureRequirements(locked);
			expect(fromLock.length).toBe(1);
			expect(fromLock[0]?.version).toBe('4.14.1');
			expect(fromLock[0]?.readFrom).toBe('package-lock.json');

			const declared = path.join(directory, 'declared');
			await mkdir(declared, { recursive: true });
			await writeFile(
				path.join(declared, 'package.json'),
				`${JSON.stringify({ name: 'd', devDependencies: { 'node-sass': '^4.12.0' } })}\n`,
			);
			const fromManifest = await readArchitectureRequirements(declared);
			expect(fromManifest[0]?.readFrom).toBe('package.json');
			expect(fromManifest[0]?.version).toBe('^4.12.0');

			/** A version past the measured line is not a requirement this stage makes. */
			const modern = path.join(directory, 'modern');
			await mkdir(modern, { recursive: true });
			await writeFile(
				path.join(modern, 'package.json'),
				`${JSON.stringify({ name: 'm', devDependencies: { 'node-sass': '^9.0.0' } })}\n`,
			);
			expect((await readArchitectureRequirements(modern)).length).toBe(0);
			/** The reading is of a table, not of one hard-coded name. */
			expect(ARCHITECTURE_BINDINGS.map((binding) => binding.package)).toContain('node-sass');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});

describe('era-cell — a cell the host already carries', () => {
	it('records already-present when the required major is the running one', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await writePlainReactTree(application, '24');
			const host = measuredArmHost([RUNNING_ARM_24]);
			const record = await establishEraCell(application, DEFAULT_ERA_CELL_DECLARATIONS, host);
			expect(record.ran).toBe(true);
			expect(record.outcome).toBe('already-present');
			expect(record.required?.nodeMajor).toBe(24);
			expect(record.required?.nodeMajorSource).toBe('inferred');
			expect(record.required?.nodeMajorReadFrom).toBe('.nvmrc');
			expect(record.required?.cell).toBe('node-24');
			expect(record.required?.architecture).toBe('arm64');
			expect(record.provision?.supplier).toBe('running-process');
			expect(record.provision?.translation).toBe(null);
			/** Nothing was installed, and the record says which claim it is not making. */
			expect(record.notEstablished.join(' ')).toContain(
				'It is not an installation of the cell',
			);
			expect(record.notEstablished.join(' ')).toContain('No network was opened');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('reads the Angular cell’s own nodeLine rather than writing a second one', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await mkdir(application, { recursive: true });
			await writeFile(
				path.join(application, 'package.json'),
				`${JSON.stringify({ name: 'era-cell-angular', dependencies: { '@angular/core': '8.1.2' } })}\n`,
			);
			const host = measuredArmHost([
				RUNNING_ARM_24,
				runtime(
					'v16.20.2',
					'arm64',
					'workspace-runtime-cache',
					'cache/node-v16.20.2-darwin-arm64',
				),
			]);
			const record = await establishEraCell(application, DEFAULT_ERA_CELL_DECLARATIONS, host);
			expect(record.required?.cell).toBe('angular-16-browser-builder');
			expect(record.required?.nodeMajor).toBe(16);
			expect(record.required?.nodeMajorReadFrom).toBe('angular-16-browser-builder#nodeLine');
			expect(record.outcome).toBe('provisioned');
			expect(record.provision?.version).toBe('v16.20.2');

			/**
			 * The ngcc-feasible Angular 13 cell is describable as a target. Nothing
			 * here provisions its toolchain: what is recorded is the Node runtime.
			 */
			const thirteen = await establishEraCell(
				application,
				declaring({ cell: NGCC_ANGULAR_13_CELL.id }),
				host,
			);
			expect(thirteen.required?.cell).toBe('angular-13.4.0');
			expect(thirteen.required?.cellSource).toBe('declared');
			expect(thirteen.required?.nodeMajor).toBe(16);
			expect(thirteen.required?.cellBasis).toContain('ngcc-1213-feasibility');
			expect(NGCC_ANGULAR_13_CELL.published).toBe(false);
			expect(NGCC_ANGULAR_13_CELL.provides).toContain('not installed');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a described cell the host carries no runtime for', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await writePlainReactTree(application, null);
			const host = measuredArmHost([RUNNING_ARM_24]);
			let raised: unknown = null;
			try {
				await establishEraCell(
					application,
					declaring({ cell: NGCC_ANGULAR_13_CELL.id }),
					host,
				);
			} catch (error) {
				raised = error;
			}
			const refusal = pipelineRefusalOf(raised);
			expect(refusal?.code).toBe('era-cell.required-node-not-installed');
			expect(refusal?.stage).toBe('era-cell');
			expect(refusal?.message).toContain('Node 16');
			/** A refusal, never a documented fetch: nothing here acquires a runtime. */
			expect(refusal?.message).toContain('opens no network');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});

/** A React tree that states its Node line in whichever places the test names. */
async function writeEraSourceTree(
	root: string,
	files: Readonly<Record<string, string>>,
	manifest: Record<string, unknown> = {},
): Promise<void> {
	await mkdir(root, { recursive: true });
	await writeFile(
		path.join(root, 'package.json'),
		`${JSON.stringify({ name: 'era-sources', dependencies: { react: '16.14.0' }, ...manifest }, null, '\t')}\n`,
	);
	for (const [relative, contents] of Object.entries(files)) {
		await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
		await writeFile(path.join(root, relative), contents);
	}
}

const HOST_MAJOR = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);

describe('era-cell — every place a tree states its Node line', () => {
	const cases: readonly Readonly<{
		name: string;
		files: Record<string, string>;
		manifest?: Record<string, unknown>;
		source: string;
		text: string;
	}>[] = [
		{
			name: 'package.json#volta.node',
			files: {},
			manifest: { volta: { node: `${String(HOST_MAJOR)}.1.0` } },
			source: 'package.json#volta.node',
			text: `${String(HOST_MAJOR)}.1.0`,
		},
		{
			name: '.tool-versions',
			files: { '.tool-versions': `nodejs ${String(HOST_MAJOR)}.1.0\npython 3.9.1\n` },
			source: '.tool-versions#nodejs',
			text: `${String(HOST_MAJOR)}.1.0`,
		},
		{
			name: 'a Dockerfile FROM a numeric node image',
			files: { Dockerfile: `FROM node:${String(HOST_MAJOR)}-alpine\nRUN npm ci\n` },
			source: `Dockerfile#FROM line 1`,
			text: `node:${String(HOST_MAJOR)}-alpine`,
		},
		{
			name: 'a workflow node-version',
			files: {
				'.github/workflows/ci.yml': `jobs:\n  build:\n    steps:\n      - uses: actions/setup-node@v2\n        with:\n          node-version: '${String(HOST_MAJOR)}.x'\n`,
			},
			source: '.github/workflows/ci.yml#node-version',
			text: `'${String(HOST_MAJOR)}.x'`,
		},
	];

	for (const scenario of cases)
		it(`reads the era out of ${scenario.name}, naming the source it read`, async () => {
			const directory = await temporaryDirectory();
			try {
				const application = path.join(directory, 'app');
				await writeEraSourceTree(application, scenario.files, scenario.manifest);
				const record = await establishEraCell(application, DEFAULT_ERA_CELL_DECLARATIONS);
				expect(record.required?.nodeMajor).toBe(HOST_MAJOR);
				expect(record.required?.nodeMajorSource).toBe('inferred');
				expect(record.required?.nodeMajorReadFrom).toBe(scenario.source);
				/** The winner is on the record as one of the consulted sources. */
				expect(
					record.required?.nodeMajorSources.map((reading) => reading.source),
				).toContain(scenario.source);
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		});

	it('prefers .nvmrc over every later source, and still records all of them', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await writeEraSourceTree(
				application,
				{
					'.nvmrc': `${String(HOST_MAJOR)}\n`,
					'.tool-versions': `nodejs ${String(HOST_MAJOR)}.0.0\n`,
					Dockerfile: `FROM node:${String(HOST_MAJOR)}\n`,
				},
				{ engines: { node: `${String(HOST_MAJOR)}.x` } },
			);
			const record = await establishEraCell(application, DEFAULT_ERA_CELL_DECLARATIONS);
			expect(record.required?.nodeMajorReadFrom).toBe('.nvmrc');
			/**
			 * Every slot is on the record, the absent ones included: "this tree
			 * declares nothing here" and "this stage did not look" are different
			 * statements and used to be the same empty array.
			 */
			expect(record.required?.era.consultedSources.map((reading) => reading.source)).toEqual([
				'.nvmrc',
				'.node-version',
				'package.json#volta.node',
				'.tool-versions#nodejs',
				'Dockerfile#FROM line 1',
				'.github/workflows/*#node-version',
				'package.json#engines.node',
			]);
			expect(
				record.required?.era.consultedSources.find(
					(reading) => reading.source === '.node-version',
				),
			).toEqual({ source: '.node-version', text: null, majors: null, present: false });
			/** Rendering an operator reads names every consulted source, not the winner alone. */
			expect(renderEraCell(record)).toContain(
				'era source consulted: package.json#engines.node',
			);
			expect(renderEraCell(record)).toContain(
				'era source consulted: .node-version is not present in this tree',
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('reads a floating image tag as residue rather than as a major', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await writeEraSourceTree(application, {
				Dockerfile: 'FROM circleci/node:latest-browsers\n',
				'Dockerfile.dev': 'FROM node:lts\n',
			});
			/**
			 * T027 §1: residue is still residue — no major is taken out of it —
			 * but the era being unread is not a reason to decline to name the
			 * runtime the lane will be installed and built in.
			 */
			const record = await establishEraCell(application, DEFAULT_ERA_CELL_DECLARATIONS);
			expect(record.required?.era.outcome).toBe('not-read');
			expect(record.required?.era.declared).toBeNull();
			expect(record.required?.era.claim).toBe(ERA_NOT_READ_CLAIM);
			expect(record.required?.runtime.major).toBe(HOST_MAJOR);
			expect(record.required?.runtime.readFrom).toBe(LANE_RUNTIME_READ_FROM);
			expect(record.required?.runtime.basis).toBe(LANE_RUNTIME_BASIS);
			expect(record.required?.cell).toBe('react-vite-lane');
			const consulted = record.required?.era.consultedSources ?? [];
			expect(consulted.map((reading) => reading.text)).toContain(
				'circleci/node:latest-browsers',
			);
			expect(consulted.map((reading) => reading.text)).toContain('node:lts');
			expect(renderEraCell(record)).toContain('names no numeric Node major');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a CI matrix naming several majors rather than picking one', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await writeEraSourceTree(application, {
				'.github/workflows/ci.yml':
					'jobs:\n  build:\n    strategy:\n      matrix:\n        node_version: [12.x, 14.x]\n',
			});
			/**
			 * A matrix names several majors and this stage still picks from none
			 * of them. It records what the matrix literally says beside a runtime
			 * that is neither of those majors, and does not let one imply the
			 * other — the ant-design-pro shape T027 §2 named.
			 */
			const record = await establishEraCell(application, DEFAULT_ERA_CELL_DECLARATIONS);
			expect(record.required?.era.outcome).toBe('not-read');
			expect(record.required?.runtime.major).toBe(HOST_MAJOR);
			expect(renderEraCell(record)).toContain('[12.x, 14.x]');
			expect(renderEraCell(record)).toContain('naming 2 major lines (12, 14)');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses two sources that each name a different single major, listing both', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await writeEraSourceTree(application, {
				'.nvmrc': '12\n',
				Dockerfile: 'FROM node:14-alpine\n',
			});
			let raised: unknown = null;
			try {
				await establishEraCell(application, DEFAULT_ERA_CELL_DECLARATIONS);
			} catch (error) {
				raised = error;
			}
			const refusal = pipelineRefusalOf(raised);
			expect(refusal?.code).toBe('era-cell.node-major-sources-disagree');
			expect(refusal?.message).toContain('.nvmrc reads 12');
			expect(refusal?.message).toContain('Dockerfile#FROM line 1 reads node:14-alpine');
			expect(refusal?.message).toContain('--node <major>');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('reads an open engines range as a satisfaction boolean and never as a floor', async () => {
		/** T008 §5(b) stands: the era reading takes no major out of an open range. */
		expect(nodeMajorsOfDeclaration('>=10.0.0')).toBeNull();
		/** T027 §2: the satisfaction check is a different question with a boolean answer. */
		expect(declaredRangeAdmitsMajor('>=10.0.0', 24)).toBe(true);
		expect(declaredRangeAdmitsMajor('>=24.x', 24)).toBe(true);
		expect(declaredRangeAdmitsMajor('>= 6.9 <11.0', 24)).toBe(false);
		expect(declaredRangeAdmitsMajor('lts/gallium', 24)).toBeNull();
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await writeEraSourceTree(application, {}, { engines: { node: '>=10.0.0' } });
			const record = await establishEraCell(application, DEFAULT_ERA_CELL_DECLARATIONS);
			expect(record.required?.era.outcome).toBe('not-read');
			expect(record.required?.runtime.declaredRange).toBe('>=10.0.0');
			expect(record.required?.runtime.declaredRangeSource).toBe('package.json#engines.node');
			expect(record.required?.runtime.satisfiedByDeclaredRange).toBe(true);
			expect(record.required?.runtime.major).toBe(HOST_MAJOR);
			/** No number left the range: the era field carries none. */
			expect(record.required?.era.declared).toBeNull();
			expect(record.required?.era.readFrom).toBeNull();
			expect(record.notEstablished.join(' ')).toContain(
				'it names no era, and no Node major was read out of it',
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('names every slot it looks in, present or not', () => {
		expect(NODE_MAJOR_SOURCE_SLOTS).toContain('package.json#engines.node');
		expect(NODE_MAJOR_SOURCE_SLOTS).toContain('Dockerfile*#FROM a node image');
		expect(NODE_MAJOR_SOURCE_SLOTS).toHaveLength(7);
	});
});

describe('era-cell — what it will not infer', () => {
	it('refuses a declared range that excludes the runtime the lane would run in', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await mkdir(application, { recursive: true });
			await writeFile(
				path.join(application, 'package.json'),
				`${JSON.stringify({
					name: 'era-cell-range',
					dependencies: { react: '16.14.0' },
					engines: { node: '>= 6.9 <11.0' },
				})}\n`,
			);
			const outcome = await runOperatorCommand('era-cell', [application, '--json']);
			expect(outcome.exitCode).toBe(EXIT_REFUSAL);
			const json = outcome.json as {
				refusal: { code: string; stage: string; message: string };
				eraCell: { outcome: string };
			};
			expect(json.refusal.code).toBe('era-cell.declared-range-excludes-the-lane-runtime');
			expect(json.refusal.stage).toBe('era-cell');
			expect(json.refusal.message).toContain('which that range does not admit');
			expect(json.refusal.message).toContain('--node <major>');
			expect(json.eraCell.outcome).toBe('refused');

			/** Declaring the major is what settles it, and the record says so. */
			const declared = await runOperatorCommand('era-cell', [
				application,
				'--node',
				String(process.versions.node.split('.')[0] ?? ''),
				'--json',
			]);
			const settled = declared.json as { required: { nodeMajorSource: string } };
			expect(declared.exitCode).toBe(0);
			expect(settled.required.nodeMajorSource).toBe('declared');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('proceeds on the lane runtime when a lineage publishes no cell and no era is read', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await writePlainReactTree(application, null);
			const record = await establishEraCell(
				application,
				DEFAULT_ERA_CELL_DECLARATIONS,
				measuredArmHost([RUNNING_ARM_24]),
			);
			expect(record.ran).toBe(true);
			expect(record.outcome).toBe('already-present');
			expect(record.required?.cell).toBe('react-vite-lane');
			expect(record.required?.cellBasis).toContain('publishes no target-cell registry');
			expect(record.required?.runtime.major).toBe(24);
			expect(record.required?.runtime.claim).toBe(
				'the migrated lane will be installed and built in this runtime',
			);
			expect(record.required?.era.outcome).toBe('not-read');
			expect(record.required?.era.claim).toBe(ERA_NOT_READ_CLAIM);
			/** Every slot was looked in, and all seven are on the record as absent. */
			expect(record.required?.era.consultedSources).toHaveLength(7);
			expect(record.required?.era.consultedSources.every((reading) => !reading.present)).toBe(
				true,
			);
			expect(record.notEstablished.join(' ')).toContain(
				'It is not the era this application was authored for',
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('keeps cell-not-declared-for-framework for a lineage with no lane either', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await mkdir(application, { recursive: true });
			await writeFile(
				path.join(application, 'package.json'),
				`${JSON.stringify({ name: 'era-cell-no-lineage', dependencies: { lodash: '4.17.21' } })}\n`,
			);
			let raised: unknown = null;
			try {
				await establishEraCell(
					application,
					DEFAULT_ERA_CELL_DECLARATIONS,
					measuredArmHost([RUNNING_ARM_24]),
				);
			} catch (error) {
				raised = error;
			}
			const refusal = pipelineRefusalOf(raised);
			expect(refusal?.code).toBe('era-cell.cell-not-declared-for-framework');
			expect(refusal?.message).toContain('--cell <id>');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a declaration it cannot read a major or a cell out of', async () => {
		const directory = await temporaryDirectory();
		try {
			const application = path.join(directory, 'app');
			await writePlainReactTree(application, '20');
			const host = measuredArmHost([RUNNING_ARM_24]);
			for (const [declarations, code] of [
				[declaring({ node: 'lts/gallium' }), 'era-cell.declared-node-not-a-version'],
				[declaring({ cell: 'angular-99' }), 'era-cell.declared-cell-not-described'],
				[
					declaring({ node: '24', architecture: 'ppc64' }),
					'era-cell.declared-architecture-not-recognised',
				],
			] as const) {
				let raised: unknown = null;
				try {
					await establishEraCell(application, declarations, host);
				} catch (error) {
					raised = error;
				}
				expect(pipelineRefusalOf(raised)?.code).toBe(code);
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('reads a Node era declaration as the majors it names, or as none', () => {
		expect(nodeMajorsOfDeclaration('16')).toEqual([16]);
		expect(nodeMajorsOfDeclaration('v16.20.2')).toEqual([16]);
		expect(nodeMajorsOfDeclaration('^16.14.0')).toEqual([16]);
		expect(nodeMajorsOfDeclaration('~18.12.0')).toEqual([18]);
		expect(nodeMajorsOfDeclaration('18.x')).toEqual([18]);
		expect(nodeMajorsOfDeclaration('>=14.0.0 <15.0.0')).toEqual([14]);
		/** A range spanning majors names several, so it names no cell. */
		expect(nodeMajorsOfDeclaration('>= 6.9 <11.0')).toEqual([6, 7, 8, 9, 10]);
		/** An open bound names every major above it, which is not a reading. */
		expect(nodeMajorsOfDeclaration('>=16.10.0')).toBe(null);
		expect(nodeMajorsOfDeclaration('^12.20.0 || ^14.15.0 || >=16.10.0')).toBe(null);
		expect(nodeMajorsOfDeclaration('lts/*')).toBe(null);
		expect(nodeMajorsOfDeclaration('current')).toBe(null);
		expect(nodeMajorsOfDeclaration('')).toBe(null);
		expect(nodeMajorsOfDeclaration('^12.0.0 || ^14.0.0')).toEqual([12, 14]);
	});
});

describe('era-cell — what the host reading is', () => {
	it('reads runtime directory names, and rejects what is not one', () => {
		expect(runtimeDirectoryName('node-v16.20.2-darwin-arm64')).toEqual({
			version: 'v16.20.2',
			platform: 'darwin',
			architecture: 'arm64',
		});
		expect(runtimeDirectoryName('node-v14.16.1-darwin-x64')?.architecture).toBe('x64');
		expect(runtimeDirectoryName('node-version.txt')).toBe(null);
		expect(runtimeDirectoryName('rebuild')).toBe(null);
	});

	it('reads this checkout without opening a socket, and names its suppliers', async () => {
		const host = await readHostCell();
		expect(host.platform).toBe(process.platform);
		expect(host.architecture).toBe(process.arch);
		expect(host.runningNodeVersion).toBe(process.version);
		expect(host.suppliers).toContain('running-process');
		const running = host.installed.filter(
			(candidate) => candidate.supplier === 'running-process',
		);
		expect(running.length).toBe(1);
		for (const candidate of host.installed) {
			expect(candidate.major).toBeGreaterThan(0);
			/** A record is evidence, and evidence carries no absolute host path. */
			expect(candidate.location.startsWith('/')).toBe(false);
		}
	});

	it('offers exactly one translation, and only where the spike measured it', () => {
		const arm = measuredArmHost([RUNNING_ARM_24]);
		expect(translationFor(arm, 'x64')).toBe('rosetta-2');
		expect(translationFor(arm, 'arm64')).toBe(null);
		const linux: HostCellReading = Object.freeze({ ...arm, platform: 'linux' });
		expect(translationFor(linux, 'x64')).toBe(null);
	});
});

describe('era-cell — the stage in the pipeline', () => {
	it('is a declared pipeline stage and a described set of cells', () => {
		expect(PIPELINE_STAGES).toContain('era-cell');
		expect(DESCRIBED_CELLS.map((cell) => cell.id)).toContain('angular-16-browser-builder');
		expect(DESCRIBED_CELLS.map((cell) => cell.id)).toContain('angular-13.4.0');
		for (const cell of DESCRIBED_CELLS) {
			expect(cell.nodeMajor).toBeGreaterThan(0);
			expect(cell.describedBy.length).toBeGreaterThan(0);
		}
	});

	it('records a run that did not ask for the stage as not run, not as provisioned', () => {
		const record = eraCellNotRequested('--era-cell was not declared.');
		expect(record.ran).toBe(false);
		expect(record.outcome).toBe('not-run');
		expect(record.required).toBe(null);
		expect(record.provision).toBe(null);
		expect(renderEraCell(record)).toContain('not run');
	});

	it('keeps migrate cell-agnostic unless the stage is declared', async () => {
		const directory = await temporaryDirectory();
		try {
			const outcome = await runOperatorCommand('migrate', [
				cypressRwaWorkArea.target,
				'--out',
				path.join(directory, 'lane'),
				'--json',
			]);
			expect(outcome.exitCode).toBe(0);
			const json = outcome.json as {
				eraCell: { ran: boolean; outcome: string; reason: string };
			};
			expect(json.eraCell.ran).toBe(false);
			expect(json.eraCell.outcome).toBe('not-run');
			expect(json.eraCell.reason).toContain('--era-cell was not declared');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});

/**
 * Describable is not plannable.
 *
 * Two vocabularies meet at `--cell` and they are deliberately different sizes.
 * This file's stage describes every cell it can read a Node line for, published
 * or not; the plan stage resolves only the cells a frozen adapter publishes as
 * a migration target. The defect that produced the seam was the gap between
 * them going unread: a cell this stage described happily, and the plan then
 * aligned to the default cell under the declared cell's name.
 *
 * The assertions below are derived from the two lists rather than written
 * against today's membership, because the membership is expected to move — a
 * cell published later must resolve here with no edit to this test, and the
 * rule it would then satisfy is the same rule. What is pinned is the rule:
 * every described id an adapter publishes resolves to that adapter's own cell,
 * and every one it does not is a named refusal.
 */
describe('era-cell — describable is not plannable', () => {
	/** The refusal a resolution raised, or `null` when it resolved. */
	function refusalOfResolving(id: string) {
		try {
			resolveAngularTargetCell(id);
			return null;
		} catch (error) {
			const refusal = pipelineRefusalOf(error);
			if (refusal === null) throw error;
			return refusal;
		}
	}

	const publishedCellOf = (id: string) =>
		ANGULAR_TARGET_CELLS.find((cell) => cell.id === id) ?? null;

	it('resolves every described cell an adapter publishes, and refuses every one it does not', () => {
		expect(DESCRIBED_CELLS.length).toBeGreaterThan(0);
		for (const described of DESCRIBED_CELLS) {
			const published = publishedCellOf(described.id);
			if (published === null) {
				const refusal = refusalOfResolving(described.id);
				expect(refusal?.code).toBe('plan.angular.declared-cell-not-published');
				expect(refusal?.stage).toBe('plan');
				expect(refusal?.origin).toBe('pipeline');
				expect(refusal?.message).toContain(described.id);
				continue;
			}
			/** The adapter's own object, not a copy of it built here. */
			expect(resolveAngularTargetCell(described.id)).toBe(published);
			expect(described.nodeLine).toBe(published.nodeLine);
		}
	});

	/**
	 * The other direction of the same rule. A cell the plan can resolve is one
	 * the era-cell stage can also describe, so an operator never reaches a plan
	 * through a declaration this stage would have refused to read a Node line
	 * for. This holds by construction today — `DESCRIBED_CELLS` is derived from
	 * the published registry — and pinning it keeps a later hand-written entry
	 * from separating the two.
	 */
	it('describes every cell the plan stage can resolve', () => {
		expect(ANGULAR_TARGET_CELLS.length).toBeGreaterThan(0);
		for (const published of ANGULAR_TARGET_CELLS) {
			expect(describedCell(published.id)?.id).toBe(published.id);
			expect(resolveAngularTargetCell(published.id)).toBe(published);
		}
	});

	/**
	 * An identifier outside both vocabularies, which no unit is going to publish
	 * later: the refusal has to name what was declared and what is available,
	 * because an operator who mistyped a cell has no other way to see the list.
	 */
	it('refuses an identifier no adapter will ever publish, naming it and the published cells', () => {
		const never = 'angular-0.0.0-never-published';
		expect(describedCell(never)).toBe(null);
		expect(publishedCellOf(never)).toBe(null);
		const refusal = refusalOfResolving(never);
		expect(refusal?.code).toBe('plan.angular.declared-cell-not-published');
		expect(refusal?.stage).toBe('plan');
		expect(refusal?.origin).toBe('pipeline');
		expect(refusal?.message).toContain(never);
		for (const published of ANGULAR_TARGET_CELLS)
			expect(refusal?.message).toContain(published.id);
		/** A refusal is exit 2. Declaring a cell that does not exist is not a defect. */
		expect(refusalRecord('plan', refusal as never).exitCode).toBe(EXIT_REFUSAL);
	});

	/**
	 * Declaring the default cell by name is resolution, not a second path into
	 * the plan: the resolver hands back the very object the undeclared path
	 * uses. An equal-looking copy would be a second definition of the cell, and
	 * the changeset would then depend on which of the two a caller got.
	 */
	it('resolves the default cell to the same object nothing-declared resolves to', () => {
		expect(resolveAngularTargetCell(ANGULAR_16_BROWSER_CELL.id)).toBe(ANGULAR_16_BROWSER_CELL);
		expect(resolveAngularTargetCell(undefined)).toBe(ANGULAR_16_BROWSER_CELL);
		expect(resolveAngularTargetCell(null)).toBe(ANGULAR_16_BROWSER_CELL);
		expect(resolveAngularTargetCell('')).toBe(ANGULAR_16_BROWSER_CELL);
	});
});
