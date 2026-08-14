import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../core/src/receipts/canonicalize.ts';
import { assertEnterpriseSurfaceHonesty } from '../../trust/src/enterprise.ts';
import { ADAPTER_FREEZE_COMPOSITE } from '../../trust/src/freeze.ts';
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
