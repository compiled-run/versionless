import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	AUTHORING_HOMES,
	authoringHomeOf,
	classifyTerminal,
	cliEntryPath,
	countInterventions,
	INTERVENTION_COUNT_SCHEMA,
	interventionRecordPathFor,
	renderInterventionCount,
	runArgvFor,
	writeInterventionRecord,
	type InterventionCountDeclarations,
} from '../src/operator/intervention-count.ts';
import { OPERATOR_COMMANDS, operatorHelp } from '../src/operator/flows.ts';

async function temporaryDirectory(): Promise<string> {
	return mkdtemp(path.join(tmpdir(), 'versionless-intervention-'));
}

/**
 * A checkout the harness can watch: a tracked-looking tree that is not a Git
 * repository, so the snapshot falls back to a directory walk and the test
 * observes exactly the files it created.
 */
async function checkout(): Promise<{ root: string; app: string; lane: string }> {
	const root = await temporaryDirectory();
	const app = path.join(root, 'app');
	await mkdir(app, { recursive: true });
	await writeFile(path.join(app, 'package.json'), '{"name":"app"}\n');
	await mkdir(path.join(root, 'fixtures'), { recursive: true });
	await writeFile(path.join(root, 'fixtures', 'existing.json'), '{}\n');
	await mkdir(path.join(root, 'lanes'), { recursive: true });
	return { root, app, lane: path.join(root, 'lanes', 'lane') };
}

/** A stand-in child, spawned exactly where `run` is spawned in production. */
async function childScript(root: string, body: string): Promise<string> {
	const file = path.join(root, 'child.mjs');
	await writeFile(file, body);
	return file;
}

function declarationsFor(
	place: { root: string; app: string; lane: string },
	script: string,
	overrides: Partial<InterventionCountDeclarations> = {},
): InterventionCountDeclarations {
	return Object.freeze({
		appRoot: place.app,
		out: place.lane,
		runRecord: path.join(place.root, 'lanes', 'run-record.json'),
		root: place.root,
		evidencePaths: Object.freeze([]),
		attempts: Object.freeze([Object.freeze([script])]),
		stageBudgetMs: 30_000,
		...overrides,
	});
}

describe('the intervention-count harness', () => {
	it('asserts four zeros for a child that writes only inside the declared write set', async () => {
		const place = await checkout();
		try {
			const record = path.join(place.root, 'lanes', 'run-record.json');
			const script = await childScript(
				place.root,
				`import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync(${JSON.stringify(place.lane)}, { recursive: true });
writeFileSync(${JSON.stringify(path.join(place.lane, 'index.js'))}, 'lane\\n');
writeFileSync(${JSON.stringify(record)}, JSON.stringify({ schema: 'versionless.run.v1', outcome: 'proceeded', stages: [{ name: 'analyze', status: 'ran' }] }));
process.stdout.write('ran\\n');
`,
			);
			const counted = await countInterventions(declarationsFor(place, script));
			expect(counted.schemaVersion).toBe(INTERVENTION_COUNT_SCHEMA);
			expect(counted.invocations).toBe(1);
			expect(counted.stdinReads).toBe(0);
			expect(counted.mutatedPathsOutsideWriteSet).toEqual([]);
			expect(counted.authoringPathsTouched).toEqual([]);
			/** The zero is the assertion, not the absence of one. */
			expect(counted.interventionCount).toBe(0);
			expect(counted.exitCode).toBe(0);
			expect(counted.terminalClassification).toBe('proven');
			expect(counted.observation.pathsObservedBefore).toBeGreaterThan(0);
			expect(counted.observation.stdio).toBe("['ignore', 'pipe', 'pipe']");
			expect(counted.observation.environment.CI).toBe('1');
			expect(renderInterventionCount(counted)).toContain('intervention count: 0');
		} finally {
			await rm(place.root, { recursive: true, force: true });
		}
	});

	it('names the authoring-home file a child wrote, and counts it once', async () => {
		const place = await checkout();
		try {
			const script = await childScript(
				place.root,
				`import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(path.join(place.root, 'fixtures', 'hand-authored.json'))}, '{"authored":true}\\n');
process.stdout.write('ran\\n');
`,
			);
			const counted = await countInterventions(declarationsFor(place, script));
			expect(counted.authoringPathsTouched).toHaveLength(1);
			expect(counted.authoringPathsTouched[0]).toContain('fixtures/hand-authored.json');
			/** Counted once: the authoring home claims it before C1 sees it. */
			expect(counted.mutatedPathsOutsideWriteSet).toEqual([]);
			expect(counted.interventionCount).toBe(1);
			expect(renderInterventionCount(counted)).toContain('authoring home:');
		} finally {
			await rm(place.root, { recursive: true, force: true });
		}
	});

	it('counts a path changed outside the write set that is not an authoring home', async () => {
		const place = await checkout();
		try {
			const script = await childScript(
				place.root,
				`import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(path.join(place.app, 'package.json'))}, '{"name":"app","edited":true}\\n');
process.stdout.write('ran\\n');
`,
			);
			const counted = await countInterventions(declarationsFor(place, script));
			expect(counted.mutatedPathsOutsideWriteSet).toHaveLength(1);
			expect(counted.mutatedPathsOutsideWriteSet[0]).toContain('package.json');
			expect(counted.interventionCount).toBe(1);
		} finally {
			await rm(place.root, { recursive: true, force: true });
		}
	});

	it('counts a second spawn as one intervention', async () => {
		const place = await checkout();
		try {
			const script = await childScript(place.root, "process.stdout.write('ran\\n');\n");
			const counted = await countInterventions(
				declarationsFor(place, script, {
					attempts: Object.freeze([
						Object.freeze([script]),
						Object.freeze([script, '--allow-remote-tarballs']),
					]),
				}),
			);
			expect(counted.invocations).toBe(2);
			expect(counted.attempts).toHaveLength(2);
			expect(counted.interventionCount).toBe(1);
			expect(counted.mutatedPathsOutsideWriteSet).toEqual([]);
			expect(counted.authoringPathsTouched).toEqual([]);
		} finally {
			await rm(place.root, { recursive: true, force: true });
		}
	});

	it('scores a child that blocks past the stage budget a defect, not an intervention', async () => {
		const place = await checkout();
		try {
			const script = await childScript(
				place.root,
				'setTimeout(() => process.exit(0), 60_000);\n',
			);
			const counted = await countInterventions(
				declarationsFor(place, script, { stageBudgetMs: 400 }),
			);
			expect(counted.terminalClassification).toBe('defect:hang');
			expect(counted.attempts[0]?.hang).toBe(true);
			/** A hang is a defect the charter counts as one; it is not hand-help. */
			expect(counted.interventionCount).toBe(0);
			expect(counted.stdinReads).toBe(0);
		} finally {
			await rm(place.root, { recursive: true, force: true });
		}
	});

	it('reads a refusal as a terminal outcome rather than an intervention', async () => {
		const place = await checkout();
		try {
			const record = path.join(place.root, 'lanes', 'run-record.json');
			const script = await childScript(
				place.root,
				`import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(record)}, JSON.stringify({ schema: 'versionless.run.v1', outcome: 'refused', exitCode: 2, refusal: { code: 'ingest.revision-not-determined', stage: 'ingest' }, stages: [] }));
process.stdout.write('refused\\n');
process.exit(2);
`,
			);
			const counted = await countInterventions(declarationsFor(place, script));
			expect(counted.terminalClassification).toBe('refused:ingest.revision-not-determined');
			expect(counted.exitCode).toBe(2);
			expect(counted.interventionCount).toBe(0);
			expect(counted.invocations).toBe(1);
		} finally {
			await rm(place.root, { recursive: true, force: true });
		}
	});

	it('spawns `versionless run` itself and records the refusal an unseen tree reaches', async () => {
		const place = await checkout();
		try {
			await writeFile(
				path.join(place.app, 'package.json'),
				`${JSON.stringify(
					{
						name: 'unseen-app',
						dependencies: { react: '^17.0.2', 'react-dom': '^17.0.2' },
						devDependencies: { 'react-scripts': '4.0.3' },
					},
					null,
					'\t',
				)}\n`,
			);
			const runRecord = path.join(place.root, 'lanes', 'run-record.json');
			const counted = await countInterventions(
				declarationsFor(place, 'unused', {
					runRecord,
					attempts: Object.freeze([
						runArgvFor(
							cliEntryPath(),
							{ appRoot: place.app, out: place.lane, runRecord },
							[],
						),
					]),
					stageBudgetMs: 120_000,
				}),
			);
			expect(counted.terminalClassification.startsWith('refused:')).toBe(true);
			expect(counted.interventionCount).toBe(0);
			expect(counted.invocations).toBe(1);
			expect(counted.exitCode).toBe(2);
			const filed = await writeInterventionRecord(runRecord, counted);
			expect(filed).toBe(interventionRecordPathFor(runRecord));
			const published: unknown = JSON.parse(await readFile(filed, 'utf8'));
			expect((published as { schemaVersion: string }).schemaVersion).toBe(
				INTERVENTION_COUNT_SCHEMA,
			);
		} finally {
			await rm(place.root, { recursive: true, force: true });
		}
	}, 180_000);

	it('classifies from the run record and never from a count the run states', () => {
		expect(classifyTerminal(null, 0, true)).toBe('defect:hang');
		expect(classifyTerminal(null, 0, false)).toBe('defect:no-run-record');
		expect(
			classifyTerminal(
				{ outcome: 'proceeded', stages: [{ status: 'ran' }, { status: 'ran' }] },
				0,
				false,
			),
		).toBe('proven');
		expect(
			classifyTerminal(
				{ outcome: 'proceeded', stages: [{ status: 'ran' }, { status: 'not-run' }] },
				0,
				false,
			),
		).toBe('defect:stages-not-all-run');
		expect(
			classifyTerminal({ outcome: 'defect', defect: { stage: 'install' } }, 1, false),
		).toBe('defect:install');
	});

	it('names the eight authoring homes and matches paths inside them', () => {
		expect(AUTHORING_HOMES.map((home) => home.home)).toContain('fixtures/**');
		expect(authoringHomeOf('fixtures/a/b.json')).toBe('fixtures/**');
		expect(authoringHomeOf('packages/cli/src/witness/real-app-run.ts')).toBe(
			'packages/cli/src/witness/**',
		);
		expect(authoringHomeOf('packages/core/src/receipts/witness-journey.ts')).toBe(
			'packages/core/src/receipts/witness-*.ts',
		);
		expect(authoringHomeOf('packages/trust/src/generate.ts')).toBe(
			'packages/trust/src/generate.ts',
		);
		expect(authoringHomeOf('.versionless/work/app/helper.mjs')).toBe(
			'.versionless/work/**/*.{mjs,sh}',
		);
		expect(authoringHomeOf('packages/core/src/receipts/canonicalize.ts')).toBeNull();
		expect(authoringHomeOf('.versionless/work/app/package.json')).toBeNull();
	});

	it('is a registered operator command with help of its own', () => {
		expect(OPERATOR_COMMANDS).toContain('intervention-count');
		const help = operatorHelp('intervention-count');
		expect(help).toContain('versionless intervention-count');
		expect(help).toContain('spawns `run` exactly once');
	});
});
