import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../core/src/receipts/canonicalize.ts';
import { assertEnterpriseSurfaceHonesty } from '../../trust/src/enterprise.ts';
import { ADAPTER_FREEZE_COMPOSITE } from '../../trust/src/freeze.ts';
import {
	ANGULAR_16_BROWSER_CELL,
	ANGULAR_TARGET_CELLS,
} from '../../frameworks/angular/src/index.ts';
import { analyzeApplication, readCellVerdicts } from '../src/operator/analyze.ts';
import { applyPlan, assertSeparateLane } from '../src/operator/apply.ts';
import {
	flattenBoundary,
	readSupportedMatrix,
	renderSupportedMatrix,
} from '../src/operator/matrix.ts';
import { composeAngularPlan, composeReactPlan, planApplication } from '../src/operator/plan.ts';
import {
	operatorHelp,
	parseOperatorArguments,
	runOperatorCommand,
	OPERATOR_COMMANDS,
} from '../src/operator/flows.ts';
import { DESCRIBED_CELLS, describedCell } from '../src/operator/era-cell.ts';
import { RUN_STAGE_FLAGS } from '../src/operator/run.ts';
import { pipelineRefusalOf } from '../src/operator/refusals.ts';
import { runOperatorVerification } from '../src/operator/verify.ts';
import {
	APPLICATION_SOURCE_DIRECTORIES,
	APPLIED_TREE,
	ERA_CLOSURE_TREE,
	PREVIOUS_BUILD_LOG,
	SOURCE_TREE,
	composeMigration,
	readDeepImportReadings,
	readEraClosureTypePackages,
	readMissingMemberDiagnostics,
} from '../src/fixture/angular-pigallery2-migration-run.ts';
import { cypressRwaWorkArea } from '../src/fixture/react-cypress-rwa-migration-run.ts';

async function temporaryDirectory(): Promise<string> {
	return mkdtemp(path.join(tmpdir(), 'versionless-operator-'));
}

/** A minimal React tree with nothing a frozen adapter claims. */
async function writeUnclaimedReactTree(root: string): Promise<void> {
	await mkdir(root, { recursive: true });
	await writeFile(
		path.join(root, 'package.json'),
		`${JSON.stringify({ name: 'unclaimed', dependencies: { react: '16.0.0' } }, null, '\t')}\n`,
	);
}

describe('operator flow arguments', () => {
	it('publishes help for every command and prints the invocation line', () => {
		for (const command of OPERATOR_COMMANDS) {
			const help = operatorHelp(command);
			expect(help.startsWith(`versionless ${command}`)).toBe(true);
			expect(help.endsWith('\n')).toBe(true);
		}
	});

	it('refuses an unknown flag by name rather than ignoring it', () => {
		expect(() => parseOperatorArguments('analyze', ['app', '--verbose'])).toThrow('--verbose');
		expect(() => parseOperatorArguments('verify', ['--source-dir', 'src'])).toThrow(
			'--source-dir',
		);
	});

	it('refuses a value flag with no value and a repeated single-value flag', () => {
		expect(() => parseOperatorArguments('plan', ['app', '--entry'])).toThrow(
			'requires a value',
		);
		expect(() =>
			parseOperatorArguments('plan', ['app', '--entry', 'a.tsx', '--entry', 'b.tsx']),
		).toThrow('at most once');
	});

	it('refuses the wrong number of application roots', () => {
		expect(() => parseOperatorArguments('analyze', [])).toThrow('exactly one application root');
		expect(() => parseOperatorArguments('analyze', ['a', 'b'])).toThrow(
			'exactly one application root',
		);
		expect(() => parseOperatorArguments('verify', ['a'])).toThrow('no positional arguments');
	});

	it('refuses migrate without an output lane, because it never writes in place', () => {
		expect(() => parseOperatorArguments('migrate', ['app'])).toThrow('--out');
		expect(parseOperatorArguments('migrate', ['app', '--out', 'lane']).flags['--out']).toEqual([
			'lane',
		]);
	});

	it('collects repeatable directory flags in order and reads --json and --help', () => {
		const parsed = parseOperatorArguments('plan', [
			'app',
			'--source-dir',
			'frontend',
			'--source-dir',
			'common',
			'--json',
		]);
		expect(parsed.flags['--source-dir']).toEqual(['frontend', 'common']);
		expect(parsed.json).toBe(true);
		expect(parseOperatorArguments('plan', ['--help']).help).toBe(true);
	});
});

describe('operator analyze', () => {
	it('reads the Angular holdout corpus as Angular, with its era declarations', async () => {
		const analysis = await analyzeApplication(SOURCE_TREE);
		expect(analysis.lineage).toBe('angular');
		expect(analysis.detectedFrom).toBe('@angular/core');
		expect(analysis.frameworkVersionDeclared).toBe('8.1.2');
		expect(analysis.builder).toBe('@angular-devkit/build-angular:browser');
		expect(analysis.builderSource).toBe('angular.json');
		expect(analysis.nodeEra.declared).toBe('>= 6.9 <11.0');
		expect(analysis.packageManager.manager).toBe('npm');
		expect(analysis.cellReadings.cell).toBe('angular-16-browser-builder');
	});

	it('reads the React holdout lane as create-react-app on its own declared runtime', async () => {
		const analysis = await analyzeApplication(cypressRwaWorkArea.target);
		expect(analysis.lineage).toBe('react');
		expect(analysis.builder).toBe('react-scripts');
		expect(analysis.nodeEra.source).toBe('.nvmrc');
		expect(analysis.packageManager.manager).toBe('yarn');
		/** The React lineage publishes no cell registry, and says so. */
		expect(analysis.cellReadings.cell).toBeNull();
		expect(analysis.cellReadings.reason).toContain('no target-cell package registry');
		expect(analysis.cellReadings.verdicts).toHaveLength(0);
	});

	it('preserves a dependency the cell has no reading for as unknown', () => {
		const readings = readCellVerdicts('angular', {
			'@angular/core': '8.1.2',
			'ngx-bootstrap': '5.1.0',
			'ng2-slim-loading-bar': '4.0.0',
			'a-package-no-cell-ever-read': '1.0.0',
		});
		const verdicts = Object.fromEntries(
			readings.verdicts.map((entry) => [entry.package, entry.verdict]),
		);
		expect(verdicts['ngx-bootstrap']).toBe('aligned');
		expect(verdicts['ng2-slim-loading-bar']).toBe('no-successor');
		expect(verdicts['a-package-no-cell-ever-read']).toBe('unknown');
		/** An unknown is never promoted to an aligned range. */
		const unknown = readings.verdicts.find(
			(entry) => entry.package === 'a-package-no-cell-ever-read',
		);
		expect(unknown?.alignedRange).toBe('unknown');
		expect(unknown?.fact).toBe('unknown');
		expect(readings.counts.unknown).toBeGreaterThan(0);
	});

	it('refuses a root that carries no manifest', async () => {
		const root = await temporaryDirectory();
		try {
			await expect(analyzeApplication(root)).rejects.toThrow('carries no package.json');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

describe('operator plan', () => {
	/**
	 * The identity this whole surface stands on: pointed at the same tree with
	 * the same readings, the operator flow and the fixture-driven driver compose
	 * one changeset, not two similar ones. The comparison is over the canonical
	 * form of the whole migration — every file, every digest, every declared
	 * difference — so a single changed byte anywhere fails it.
	 */
	it('composes the Angular holdout changeset byte-identically to the fixture driver', async () => {
		const [templateDirectory] = APPLICATION_SOURCE_DIRECTORIES;
		const operator = await composeAngularPlan({
			appRoot: SOURCE_TREE,
			sourceDirectories: APPLICATION_SOURCE_DIRECTORIES,
			templateDirectories: [templateDirectory as string],
			styleSheetDirectories: [templateDirectory as string],
			readings: {
				missingMemberDiagnostics: await readMissingMemberDiagnostics(PREVIOUS_BUILD_LOG),
				deepImportReadings: await readDeepImportReadings(APPLIED_TREE),
				eraClosureTypePackages: await readEraClosureTypePackages(ERA_CLOSURE_TREE),
			},
		});
		const fixture = await composeMigration(SOURCE_TREE);
		expect(canonicalize(operator.migration)).toBe(canonicalize(fixture));
		expect(operator.migration.applicationFilesChanged).toBeGreaterThan(0);
		expect(operator.inputsSupplied).toContain('missingMemberDiagnostics');
	});

	/**
	 * The React half of the same identity. The entry document on disk in the
	 * migrated lane was written by the fixture-driven holdout driver; the
	 * operator flow derives its own from the application's own template and
	 * environment, and the bytes are the same bytes.
	 */
	it('composes the React holdout entry document byte-identically to the fixture driver', async () => {
		const composed = await composeReactPlan({ appRoot: cypressRwaWorkArea.target });
		const [entry] = composed.files;
		expect(entry?.path).toBe('index.html');
		expect(entry?.source).toBe(
			await readFile(path.join(cypressRwaWorkArea.target, 'index.html'), 'utf8'),
		);
		/** Identical bytes are reported as no change rather than as a rewrite. */
		expect(entry?.changed).toBe(false);
		expect(entry?.sha256Before).toBe(entry?.sha256After);
	});

	it('stands down the capabilities whose readings the tree did not supply', async () => {
		const supplied = await composeAngularPlan({
			appRoot: SOURCE_TREE,
			sourceDirectories: APPLICATION_SOURCE_DIRECTORIES,
			readings: {
				missingMemberDiagnostics: await readMissingMemberDiagnostics(PREVIOUS_BUILD_LOG),
			},
		});
		const withheld = await composeAngularPlan({
			appRoot: SOURCE_TREE,
			sourceDirectories: APPLICATION_SOURCE_DIRECTORIES,
		});
		expect(supplied.inputsSupplied).toContain('missingMemberDiagnostics');
		expect(withheld.inputsSupplied).not.toContain('missingMemberDiagnostics');
		/** Standing down changes the changeset, and the plan says which inputs it had. */
		expect(canonicalize(withheld.migration)).not.toBe(canonicalize(supplied.migration));
	});

	it('refuses a lineage no frozen adapter claims rather than guessing one', async () => {
		const root = await temporaryDirectory();
		try {
			await writeUnclaimedReactTree(root);
			await expect(planApplication({ appRoot: root })).rejects.toThrow(
				'declares neither react-scripts nor a Vite configuration',
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('refuses an Angular workspace whose source directories it cannot read', async () => {
		const root = await temporaryDirectory();
		try {
			await writeFile(
				path.join(root, 'package.json'),
				`${JSON.stringify({ dependencies: { '@angular/core': '8.0.0' } })}\n`,
			);
			await writeFile(
				path.join(root, 'angular.json'),
				`${JSON.stringify({ projects: { app: { architect: { build: {} } } } })}\n`,
			);
			await writeFile(path.join(root, 'tsconfig.json'), '{}\n');
			await expect(composeAngularPlan({ appRoot: root })).rejects.toThrow('--source-dir');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('emits a JSON plan whose files carry digests and no file contents', async () => {
		const outcome = await runOperatorCommand('plan', [cypressRwaWorkArea.target, '--json']);
		const json = outcome.json as {
			flow: string;
			plan: { files: Array<Record<string, unknown>>; notEstablished: string[] };
		};
		expect(json.flow).toBe('plan');
		expect(json.plan.files[0]).toBeDefined();
		expect(Object.keys(json.plan.files[0] ?? {}).sort()).toEqual([
			'changed',
			'changes',
			'kind',
			'path',
			'sha256After',
			'sha256Before',
		]);
		expect(json.plan.notEstablished.length).toBeGreaterThan(0);
		expect(JSON.parse(outcome.text) as unknown).toEqual(json);
	});
});

/**
 * `--cell` was an era-cell-stage declaration only: the plan stage never saw it,
 * so an operator could declare a cell, get a green era-cell record naming its
 * Node line, and have the manifest aligned to the default cell anyway. These
 * hold the seam closed at both ends — the declaration reaches the plan, and a
 * declaration the plan cannot honour is refused rather than quietly dropped.
 */
describe('operator plan under a declared cell', () => {
	const angularDirectories = () => {
		const [templateDirectory] = APPLICATION_SOURCE_DIRECTORIES;
		return {
			sourceDirectories: APPLICATION_SOURCE_DIRECTORIES,
			templateDirectories: [templateDirectory as string],
			styleSheetDirectories: [templateDirectory as string],
		};
	};

	it('carries the declared cell into the plan and into the reading that reports it', async () => {
		const { analysis, plan } = await planApplication({
			appRoot: SOURCE_TREE,
			angular: { ...angularDirectories(), cellId: 'angular-16-browser-builder' },
		});
		expect(plan.cell).toBe('angular-16-browser-builder');
		/** The reading names the cell the changeset was composed against. */
		expect(analysis.cellReadings.cell).toBe('angular-16-browser-builder');
	});

	/**
	 * The sealed path. Declaring the cell the plan already defaults to must
	 * compose the same changeset the undeclared path composes, byte for byte:
	 * the seam is new wiring, not a new decision about the 16 target.
	 */
	it('composes the same changeset declared as undeclared, for the default cell', async () => {
		const declared = await planApplication({
			appRoot: SOURCE_TREE,
			angular: { ...angularDirectories(), cellId: 'angular-16-browser-builder' },
		});
		const undeclared = await planApplication({
			appRoot: SOURCE_TREE,
			angular: angularDirectories(),
		});
		expect(canonicalize(declared.plan)).toBe(canonicalize(undeclared.plan));
		expect(canonicalize(declared.analysis)).toBe(canonicalize(undeclared.analysis));
		expect(undeclared.plan.cell).toBe('angular-16-browser-builder');
	});

	it('accepts --cell on the plan command line and composes against it', async () => {
		const { sourceDirectories, templateDirectories, styleSheetDirectories } =
			angularDirectories();
		const outcome = await runOperatorCommand('plan', [
			SOURCE_TREE,
			...sourceDirectories.flatMap((directory) => ['--source-dir', directory]),
			...templateDirectories.flatMap((directory) => ['--template-dir', directory]),
			...styleSheetDirectories.flatMap((directory) => ['--style-dir', directory]),
			'--cell',
			'angular-16-browser-builder',
			'--json',
		]);
		expect(outcome.exitCode).toBe(0);
		const json = outcome.json as {
			detected: { cellReadings: { cell: string | null } };
			plan: { cell: string | null };
		};
		expect(json.plan.cell).toBe('angular-16-browser-builder');
		expect(json.detected.cellReadings.cell).toBe('angular-16-browser-builder');
	});

	/**
	 * The refusal that was the point of the seam. `angular-13.4.0` is a cell the
	 * era-cell stage can describe — the ngcc feasibility spike read a Node line
	 * for it — and no frozen adapter publishes it as a migration target. Being
	 * describable is not being plannable, and the plan says so by name rather
	 * than aligning the manifest to Angular 16 under a 13 label.
	 */
	it('refuses a declared cell no frozen adapter publishes, rather than falling back', async () => {
		expect(describedCell('angular-13.4.0')).not.toBeNull();
		const outcome = await runOperatorCommand('plan', [
			SOURCE_TREE,
			'--cell',
			'angular-13.4.0',
			'--json',
		]);
		expect(outcome.exitCode).toBe(2);
		const json = outcome.json as {
			outcome: string;
			refusal: { code: string; message: string; stage: string; origin: string };
		};
		expect(json.outcome).toBe('refused');
		expect(json.refusal.code).toBe('plan.angular.declared-cell-not-published');
		expect(json.refusal.stage).toBe('plan');
		expect(json.refusal.origin).toBe('pipeline');
		/** The declared identifier and the published ones are both named. */
		expect(json.refusal.message).toContain('angular-13.4.0');
		expect(json.refusal.message).toContain('angular-16-browser-builder');
	});

	it('refuses an identifier nothing describes at all, from the plan stage', async () => {
		const outcome = await runOperatorCommand('plan', [
			SOURCE_TREE,
			'--cell',
			'angular-99-imaginary',
		]);
		expect(outcome.exitCode).toBe(2);
		expect(outcome.text).toContain('refused: plan.angular.declared-cell-not-published');
		expect(outcome.text).toContain('angular-99-imaginary');
	});

	/**
	 * `migrate` and `run` read the same declaration, and both forward it to the
	 * plan stage. `run` lists it under both stages that read it, because both do.
	 */
	it('forwards the declaration from migrate and run, and names both stages that read it', () => {
		expect(
			parseOperatorArguments('plan', ['app', '--cell', 'angular-16-browser-builder']).flags[
				'--cell'
			],
		).toEqual(['angular-16-browser-builder']);
		expect(
			parseOperatorArguments('migrate', ['app', '--out', 'lane', '--cell', 'x']).flags[
				'--cell'
			],
		).toEqual(['x']);
		expect(RUN_STAGE_FLAGS['era-cell']).toContain('--cell');
		expect(RUN_STAGE_FLAGS.plan).toContain('--cell');
	});

	it('documents the declaration on the plan, migrate and run help', () => {
		expect(operatorHelp('plan')).toContain('--cell');
		expect(operatorHelp('migrate')).toContain('--cell');
		expect(operatorHelp('run')).toContain('--cell');
	});
});

/**
 * The trap this seam was cut to close, held shut at the flow level.
 *
 * The defect was not that a cell resolved wrongly — it was that two stages read
 * `--cell` for different things and neither of them said no. The era-cell stage
 * describes a cell and reads the Node line it needs; the plan stage composes a
 * changeset against a cell a frozen adapter publishes. An identifier in the
 * first vocabulary and not the second used to pass the era-cell stage green and
 * then be dropped on the floor: the plan aligned the manifest to Angular 16 and
 * the operator was handed a lane for a cell they never declared.
 *
 * The identifiers are derived from the two registries rather than named here,
 * so publishing a cell later moves it out of the unresolvable set instead of
 * falsifying these tests. `NEVER_PUBLISHED_CELL` keeps the set non-empty
 * whatever gets published: it is outside both vocabularies by construction.
 */
describe('operator plan under a cell no adapter publishes', () => {
	/** An identifier outside both vocabularies, and not a candidate for either. */
	const NEVER_PUBLISHED_CELL = 'angular-0.0.0-never-published';

	const publishedCellIds = ANGULAR_TARGET_CELLS.map((cell) => cell.id);

	/** Described, and not plannable: the exact gap the trap lived in. */
	const describedButUnplannable = DESCRIBED_CELLS.map((cell) => cell.id).filter(
		(id) => !publishedCellIds.includes(id),
	);

	/** Every identifier the plan stage cannot resolve, in the order they matter. */
	const unresolvable = [NEVER_PUBLISHED_CELL, ...describedButUnplannable];

	const ZERO_REVISION = '0000000000000000000000000000000000000000';

	/** The running runtime, declared so the era-cell stage reads this host green. */
	const RUNNING_NODE_MAJOR = process.versions.node.split('.')[0] as string;

	const angularDirectoryFlags = (): readonly string[] => {
		const [templateDirectory] = APPLICATION_SOURCE_DIRECTORIES;
		return [
			...APPLICATION_SOURCE_DIRECTORIES.flatMap((directory) => ['--source-dir', directory]),
			'--template-dir',
			templateDirectory as string,
			'--style-dir',
			templateDirectory as string,
		];
	};

	type RefusedRecord = Readonly<{
		outcome: string;
		refusal: Readonly<{ code: string; message: string; stage: string; origin: string }>;
	}>;

	type StageRow = Readonly<{
		name: string;
		status: string;
		refusal?: Readonly<{ code: string; stage: string }>;
		record?: unknown;
	}>;

	it('refuses every identifier it cannot resolve, and composes no plan at all', async () => {
		expect(unresolvable.length).toBeGreaterThan(0);
		for (const declared of unresolvable) {
			const outcome = await runOperatorCommand('plan', [
				SOURCE_TREE,
				...angularDirectoryFlags(),
				'--cell',
				declared,
				'--json',
			]);
			expect(outcome.exitCode).toBe(2);
			const json = outcome.json as RefusedRecord & Record<string, unknown>;
			expect(json.outcome).toBe('refused');
			expect(json.refusal.code).toBe('plan.angular.declared-cell-not-published');
			expect(json.refusal.stage).toBe('plan');
			expect(json.refusal.origin).toBe('pipeline');
			/**
			 * The record carries a refusal where a plan would be. A plan emitted
			 * beside the refusal — for any cell, and above all for the default one
			 * — would be the original defect wearing a refusal as a label.
			 */
			expect('plan' in json).toBe(false);
			expect('detected' in json).toBe(false);
			/** The declaration and the whole published vocabulary are both named. */
			expect(json.refusal.message).toContain(declared);
			for (const published of publishedCellIds)
				expect(json.refusal.message).toContain(published);
		}
	});

	/**
	 * The end-to-end shape of the original defect: a run in which the era-cell
	 * stage is green for the declared cell. The era-cell stage has a description
	 * of it and this host provides the declared runtime, so nothing before the
	 * plan objects — and the plan stage is where the run stops, with the cell
	 * named, rather than composing a lane against Angular 16 under that name.
	 *
	 * The loop is over the derived gap, so a unit that publishes one of these
	 * cells shrinks it rather than breaking this: the trap it describes only
	 * exists while some cell is describable and not plannable.
	 */
	it('stops a run at the plan stage even after the era-cell stage recorded the cell green', async () => {
		for (const declared of describedButUnplannable) {
			const directory = await temporaryDirectory();
			try {
				const outcome = await runOperatorCommand('run', [
					SOURCE_TREE,
					'--out',
					path.join(directory, 'lane'),
					'--revision',
					ZERO_REVISION,
					'--cell',
					declared,
					'--node',
					RUNNING_NODE_MAJOR,
					'--json',
				]);
				expect(outcome.exitCode).toBe(2);
				const record = outcome.json as Readonly<{
					outcome: string;
					stages: readonly StageRow[];
					refusal?: Readonly<{ code: string; stage: string }>;
				}>;
				const row = (name: string) => record.stages.find((stage) => stage.name === name);
				/** The stage that used to be the whole of the operator's evidence. */
				const eraCell = row('era-cell');
				expect(eraCell?.status).toBe('ran');
				const eraCellRecord = eraCell?.record as {
					outcome: string;
					required: { cell: string };
				};
				expect(eraCellRecord.outcome).toBe('already-present');
				expect(eraCellRecord.required.cell).toBe(declared);
				/** And the stage that now refuses instead of aligning to the default. */
				expect(row('plan')?.status).toBe('refused');
				expect(row('plan')?.refusal?.code).toBe('plan.angular.declared-cell-not-published');
				expect(row('plan')?.record).toBe(undefined);
				expect(record.refusal?.code).toBe('plan.angular.declared-cell-not-published');
				expect(record.refusal?.stage).toBe('plan');
				/** Nothing downstream ran, so no lane was written for the wrong cell. */
				for (const name of ['apply', 'install', 'build', 'witness'])
					expect(row(name)?.status).toBe('not-run');
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		}
	});

	/**
	 * The half of the vocabulary split the era-cell stage owns. An identifier
	 * nothing describes never reaches the plan at all: the run stops one stage
	 * earlier, with the refusal that names the described cells. The two stages
	 * refuse different things and each says which it is.
	 */
	it('stops a run at the era-cell stage when nothing describes the identifier either', async () => {
		expect(describedCell(NEVER_PUBLISHED_CELL)).toBe(null);
		const directory = await temporaryDirectory();
		try {
			const outcome = await runOperatorCommand('run', [
				SOURCE_TREE,
				'--out',
				path.join(directory, 'lane'),
				'--revision',
				ZERO_REVISION,
				'--cell',
				NEVER_PUBLISHED_CELL,
				'--json',
			]);
			expect(outcome.exitCode).toBe(2);
			const record = outcome.json as Readonly<{
				stages: readonly StageRow[];
				refusal?: Readonly<{ code: string; stage: string }>;
			}>;
			const row = (name: string) => record.stages.find((stage) => stage.name === name);
			expect(row('era-cell')?.status).toBe('refused');
			expect(record.refusal?.code).toBe('era-cell.declared-cell-not-described');
			expect(record.refusal?.stage).toBe('era-cell');
			expect(row('plan')?.status).toBe('not-run');
			expect(row('plan')?.record).toBe(undefined);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	/**
	 * Declaring the default cell by its own identifier is the same invocation as
	 * declaring nothing, all the way out to the emitted record. A second code
	 * path for the declared case would be a place for the two to drift, and the
	 * byte comparison is what says there is not one.
	 */
	it('emits the same record for the default cell declared as for nothing declared', async () => {
		const declared = await runOperatorCommand('plan', [
			SOURCE_TREE,
			...angularDirectoryFlags(),
			'--cell',
			ANGULAR_16_BROWSER_CELL.id,
			'--json',
		]);
		const undeclared = await runOperatorCommand('plan', [
			SOURCE_TREE,
			...angularDirectoryFlags(),
			'--json',
		]);
		expect(declared.exitCode).toBe(0);
		expect(undeclared.exitCode).toBe(0);
		expect(canonicalize(declared.json)).toBe(canonicalize(undeclared.json));
	});
});

describe('operator migrate', () => {
	it('refuses a lane inside the application, or an application inside the lane', () => {
		expect(() => assertSeparateLane('/tmp/app', '/tmp/app')).toThrow('must not be');
		expect(() => assertSeparateLane('/tmp/app', '/tmp/app/out')).toThrow(
			'inside the application',
		);
		expect(() => assertSeparateLane('/tmp/app/inner', '/tmp/app')).toThrow('inside --out');
		expect(() => assertSeparateLane('/tmp/app', '/tmp/lane')).not.toThrow();
	});

	it('refuses a lane that already carries files', async () => {
		const lane = await temporaryDirectory();
		const application = await temporaryDirectory();
		try {
			await writeUnclaimedReactTree(application);
			await writeFile(path.join(lane, 'kept.txt'), 'kept\n');
			const plan = {
				lineage: 'react',
				engine: 'test',
				cell: null,
				inputsSupplied: [],
				applicationFilesScanned: 0,
				files: [],
				removedFiles: [],
				unhandled: [],
				declaredDifferences: [],
				notEstablished: [],
			} as const;
			await expect(applyPlan(plan, { appRoot: application, out: lane })).rejects.toThrow(
				'already carries',
			);
			expect(await readFile(path.join(lane, 'kept.txt'), 'utf8')).toBe('kept\n');
		} finally {
			await rm(lane, { recursive: true, force: true });
			await rm(application, { recursive: true, force: true });
		}
	});

	/**
	 * The written bytes are the composed bytes. The lane is checked file by file
	 * against the changeset rather than by counting files.
	 */
	it('writes the composed changeset into a separate lane, unaltered', async () => {
		const lane = path.join(await temporaryDirectory(), 'target');
		try {
			const [templateDirectory] = APPLICATION_SOURCE_DIRECTORIES;
			const { migration } = await composeAngularPlan({
				appRoot: SOURCE_TREE,
				sourceDirectories: APPLICATION_SOURCE_DIRECTORIES,
				templateDirectories: [templateDirectory as string],
				styleSheetDirectories: [templateDirectory as string],
			});
			const { plan } = await planApplication({
				appRoot: SOURCE_TREE,
				angular: {
					sourceDirectories: APPLICATION_SOURCE_DIRECTORIES,
					templateDirectories: [templateDirectory as string],
					styleSheetDirectories: [templateDirectory as string],
				},
			});
			const applied = await applyPlan(plan, { appRoot: SOURCE_TREE, out: lane });
			expect(applied.mode).toBe('changeset-lane');
			expect(applied.copied).toBe(0);
			expect(applied.written.length).toBe(
				migration.files.filter((file) => file.changed).length,
			);
			for (const file of migration.files.filter((entry) => entry.changed))
				expect(await readFile(path.join(lane, file.path), 'utf8')).toBe(file.source);
			/** The application it read is untouched: no lane file was written into it. */
			for (const file of applied.written)
				expect(await readFile(path.join(SOURCE_TREE, file.path), 'utf8')).not.toBe(
					await readFile(path.join(lane, file.path), 'utf8'),
				);
		} finally {
			await rm(path.dirname(lane), { recursive: true, force: true });
		}
	});
});

describe('operator verify', () => {
	it('summarises the offline checks and recomputes the frozen subtrees', async () => {
		const verification = await runOperatorVerification();
		expect(verification.result).toBe('pass');
		const names = verification.checks.map((check) => check.name);
		expect(names).toContain('freeze:subtrees');
		expect(names).toContain('trust:verify');
		expect(names).toContain('corpus:verify');
		expect(names.some((name) => name.startsWith('receipt:verify'))).toBe(true);
		for (const check of verification.checks) expect(check.state).toBe('pass');
		expect(verification.notEstablished.join(' ')).toContain('not certification');
	});

	it('reports a receipt that is not there as a failure rather than throwing', async () => {
		const verification = await runOperatorVerification({
			receipts: ['evidence/runs/operator-flows/no-such-receipt.json'],
		});
		expect(verification.result).toBe('fail');
		expect(
			verification.checks.find((check) => check.name.includes('no-such-receipt'))?.state,
		).toBe('fail');
	});
});

describe('operator byte-identity record', () => {
	it('publishes both lineages as identical, under the freeze it was measured at', async () => {
		const record = JSON.parse(
			await readFile('evidence/runs/operator-flows/byte-identity.json', 'utf8'),
		) as {
			adapterFreezeComposite: string;
			angular: Record<string, unknown>;
			react: Record<string, unknown>;
			notEstablished: string[];
		};
		expect(record.adapterFreezeComposite).toBe(ADAPTER_FREEZE_COMPOSITE);
		expect(record.angular.identical).toBe(true);
		expect(record.react.identical).toBe(true);
		expect(record.angular.operatorDigest).toBe(record.angular.driverDigest);
		expect(record.react.operatorDigest).toBe(record.react.driverDigest);
		expect(record.notEstablished.length).toBeGreaterThan(0);
	});
});

describe('operator refusals as outcomes', () => {
	/**
	 * The refusal is the outcome, not the crash. A fleet report has to be able
	 * to tally the reason an application was declined, so a refusal leaves the
	 * flow as a returned record carrying exit 2 and the string verbatim —
	 * never as a formatted stack trace on stderr.
	 */
	it('returns exit 2 and the verbatim string rather than throwing, for a tree no adapter claims', async () => {
		const application = await temporaryDirectory();
		const lane = path.join(await temporaryDirectory(), 'lane');
		try {
			await writeUnclaimedReactTree(application);
			const outcome = await runOperatorCommand('migrate', [
				application,
				'--out',
				lane,
				'--json',
			]);
			expect(outcome.exitCode).toBe(2);
			const json = outcome.json as {
				outcome: string;
				refusal: { code: string; message: string; stage: string; origin: string };
			};
			expect(json.outcome).toBe('refused');
			expect(json.refusal.message).toBe(
				'React plan: this tree declares neither react-scripts nor a Vite configuration, so no frozen React adapter claims it. This flow refuses rather than guessing an origin toolchain.',
			);
			expect(json.refusal.code).toBe('plan.react.no-frozen-adapter-claims-this-tree');
			expect(json.refusal.stage).toBe('plan');
			expect(json.refusal.origin).toBe('frozen-adapter');
			expect(JSON.parse(outcome.text) as unknown).toEqual(json);
		} finally {
			await rm(application, { recursive: true, force: true });
			await rm(path.dirname(lane), { recursive: true, force: true });
		}
	});

	it('renders a refusal for a reader with its code, stage and origin', async () => {
		const application = await temporaryDirectory();
		const lane = path.join(await temporaryDirectory(), 'lane');
		try {
			await writeUnclaimedReactTree(application);
			const outcome = await runOperatorCommand('migrate', [application, '--out', lane]);
			expect(outcome.exitCode).toBe(2);
			expect(outcome.text).toContain(
				'refused: plan.react.no-frozen-adapter-claims-this-tree',
			);
			expect(outcome.text).toContain('origin: frozen-adapter');
			expect(outcome.text).toContain('not established:');
			expect(outcome.text).not.toContain('    at ');
		} finally {
			await rm(application, { recursive: true, force: true });
			await rm(path.dirname(lane), { recursive: true, force: true });
		}
	});

	it('writes the refusal record, because a refused run is still an outcome to count', async () => {
		const application = await temporaryDirectory();
		const scratch = await temporaryDirectory();
		const record = path.join(scratch, 'record.json');
		try {
			await writeUnclaimedReactTree(application);
			const outcome = await runOperatorCommand('migrate', [
				application,
				'--out',
				path.join(scratch, 'lane'),
				'--record',
				record,
				'--json',
			]);
			expect(outcome.exitCode).toBe(2);
			const written = JSON.parse(await readFile(record, 'utf8')) as {
				refusal: { code: string };
			};
			expect(written.refusal.code).toBe('plan.react.no-frozen-adapter-claims-this-tree');
		} finally {
			await rm(application, { recursive: true, force: true });
			await rm(scratch, { recursive: true, force: true });
		}
	});

	it('names an argument refusal with a code rather than a bare message', () => {
		let refusal: ReturnType<typeof pipelineRefusalOf> = null;
		try {
			parseOperatorArguments('analyze', ['app', '--verbose']);
		} catch (error) {
			refusal = pipelineRefusalOf(error);
		}
		expect(refusal?.code).toBe('arguments.unknown-flag');
		expect(refusal?.stage).toBe('arguments');
		expect(refusal?.message).toContain('--verbose');
	});

	/**
	 * A defect is not a refusal and must not be scored as one. A lane path that
	 * cannot exist is a broken invocation rather than a named reason an
	 * application was declined, so it still throws and the caller scores it 1.
	 */
	it('lets a defect throw, so it is scored 1 rather than counted as a named refusal', async () => {
		const scratch = await temporaryDirectory();
		const blocker = path.join(scratch, 'blocker');
		try {
			await writeFile(blocker, 'not a directory\n');
			const thrown = await runOperatorCommand('migrate', [
				cypressRwaWorkArea.target,
				'--out',
				path.join(blocker, 'lane'),
			]).then(
				() => null,
				(error: unknown) => error,
			);
			expect(thrown).not.toBeNull();
			expect(pipelineRefusalOf(thrown)).toBeNull();
		} finally {
			await rm(scratch, { recursive: true, force: true });
		}
	});
});

describe('operator migrate lane stage', () => {
	/**
	 * The lane the pipeline emits now carries the build configuration it needs.
	 * Spike C's finding C4 was that it did not: "the lane's package.json still
	 * declares react-scripts ^3.4.1 with no Vite configuration".
	 */
	it('writes a generated configuration and a manifest that no longer declares react-scripts', async () => {
		const lane = path.join(await temporaryDirectory(), 'lane');
		try {
			const outcome = await runOperatorCommand('migrate', [
				cypressRwaWorkArea.target,
				'--out',
				lane,
				'--json',
			]);
			expect(outcome.exitCode).toBe(0);
			const configuration = await readFile(path.join(lane, 'vite.config.ts'), 'utf8');
			expect(configuration).toContain('createCraViteAdapter');
			expect(configuration).toContain('craProcessEnvironmentDefines');
			const manifest = JSON.parse(
				await readFile(path.join(lane, 'package.json'), 'utf8'),
			) as {
				dependencies: Record<string, string>;
				devDependencies: Record<string, string>;
				scripts: Record<string, string>;
			};
			expect(manifest.dependencies['react-scripts']).toBeUndefined();
			expect(manifest.devDependencies['react-scripts']).toBeUndefined();
			expect(manifest.scripts.build).toBe('vite build');
			expect(manifest.devDependencies.vite).toBeDefined();
			/** And the lane now reads as a Vite tree to this repository's own detection. */
			const analysis = await analyzeApplication(lane);
			expect(analysis.builder).toBe('vite');
			expect(analysis.builderSource).toBe('vite.config.ts');
		} finally {
			await rm(path.dirname(lane), { recursive: true, force: true });
		}
	});

	it('reports the stages it did not run rather than implying it did', async () => {
		const lane = path.join(await temporaryDirectory(), 'lane');
		try {
			const outcome = await runOperatorCommand('migrate', [
				cypressRwaWorkArea.target,
				'--out',
				lane,
				'--json',
			]);
			const json = outcome.json as {
				install: { ran: boolean; reason: string };
				build: { ran: boolean; reason: string };
				unhandledByStage: { plan: string[]; lane: string[] };
			};
			expect(json.install.ran).toBe(false);
			expect(json.install.reason).toContain('--install was not declared');
			expect(json.build.ran).toBe(false);
			expect(json.build.reason).toContain('--build was not declared');
			/** Findings stay attributed to the stage that made them. */
			expect(json.unhandledByStage.lane.length).toBeGreaterThan(0);
			expect(json.unhandledByStage.plan.length).toBeGreaterThan(0);
		} finally {
			await rm(path.dirname(lane), { recursive: true, force: true });
		}
	});

	it('composes no lane configuration for the Angular lineage, and says why', async () => {
		const lane = path.join(await temporaryDirectory(), 'lane');
		try {
			const [templateDirectory] = APPLICATION_SOURCE_DIRECTORIES;
			const outcome = await runOperatorCommand('migrate', [
				SOURCE_TREE,
				'--out',
				lane,
				'--json',
				'--source-dir',
				APPLICATION_SOURCE_DIRECTORIES[0] as string,
				'--template-dir',
				templateDirectory as string,
			]);
			const json = outcome.json as {
				laneComposition: { composed: boolean; reason: string; files: unknown[] };
			};
			expect(json.laneComposition.composed).toBe(false);
			expect(json.laneComposition.files).toHaveLength(0);
			expect(json.laneComposition.reason).toContain('Angular');
		} finally {
			await rm(path.dirname(lane), { recursive: true, force: true });
		}
	});

	/** A record is evidence, and evidence carries no path from this host. */
	it('keeps the generated sources out of the record it writes', async () => {
		const lane = path.join(await temporaryDirectory(), 'lane');
		try {
			const outcome = await runOperatorCommand('migrate', [
				cypressRwaWorkArea.target,
				'--out',
				lane,
				'--json',
			]);
			const json = outcome.json as {
				laneComposition: { files: Record<string, unknown>[] };
			};
			for (const file of json.laneComposition.files) {
				expect(Object.keys(file).sort()).toEqual(['changes', 'path', 'sha256']);
				expect(JSON.stringify(file)).not.toContain('frameworks/react/src/index.ts');
			}
		} finally {
			await rm(path.dirname(lane), { recursive: true, force: true });
		}
	});
});

describe('operator supported-matrix', () => {
	it('renders the derived matrix and passes the enterprise honesty guard', async () => {
		const reading = await readSupportedMatrix();
		const rendered = renderSupportedMatrix(reading);
		expect(() => {
			assertEnterpriseSurfaceHonesty(rendered, 'supported-matrix');
		}).not.toThrow();
		/** Every holdout outcome is quoted exactly as the record carries it. */
		for (const holdout of reading.matrix.holdouts) {
			expect(rendered).toContain(holdout.outcome);
			expect(rendered).toContain(holdout.countingNote);
		}
		expect(rendered).toContain(reading.matrix.boundaryPrevalence.published);
		expect(rendered).toContain(reading.matrix.boundaryPrevalence.statement);
		expect(rendered).toContain(reading.matrix.boundaryPrevalence.populationStatement);
		/** The figure the boundary ruling forbids publishing never reaches stdout. */
		expect(rendered).not.toContain(reading.matrix.boundaryPrevalence.neverPublishedAs);
		expect(rendered).not.toContain('undefined');
	});

	it('withholds the forbidden prevalence figure when it flattens a boundary', () => {
		const lines = flattenBoundary({
			id: 'boundary',
			prevalence: { published: '5-of-6', neverPublishedAs: '6-of-6' },
		});
		expect(lines).toContain('prevalence.published: 5-of-6');
		expect(lines.join('\n')).not.toContain('6-of-6');
	});

	it('emits the matrix as JSON with the trust digest it was verified under', async () => {
		const outcome = await runOperatorCommand('supported-matrix', ['--json']);
		const json = outcome.json as {
			flow: string;
			trustDigest: string;
			supportMatrix: { counted: Record<string, { ready: number; total: number }> };
		};
		expect(json.flow).toBe('supported-matrix');
		expect(json.trustDigest.length).toBe(64);
		for (const lineage of ['react', 'angular'])
			expect(json.supportMatrix.counted[lineage]?.ready).toBe(
				json.supportMatrix.counted[lineage]?.total,
			);
		expect(outcome.exitCode).toBe(0);
	});
});
