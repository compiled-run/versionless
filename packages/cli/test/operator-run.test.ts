/**
 * `run`: the whole pipeline in one command.
 *
 * What is checked here is the chaining, not the stages. Each stage has its own
 * spec elsewhere and none of them is re-proven: what this file is accountable
 * for is that the stages are composed in order, that the first refusing stage
 * settles the exit code and carries its own string verbatim, that every stage
 * after it is recorded as not run rather than dropped, and that the refusing
 * defaults survive the chain instead of being widened on the way through.
 */

import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { coverageReportDigest, type CoverageReport } from '../../trust/src/coverage-report.ts';
import { runOperatorCommand } from '../src/operator/flows.ts';
import {
	readCoverageReportSlot,
	RUN_COVERAGE_REPORT_SLOT,
	RUN_SCHEMA,
	RUN_STAGES,
} from '../src/operator/run.ts';
import type { RunRecord } from '../src/operator/run.ts';
import { EXIT_PROCEEDED, EXIT_REFUSAL } from '../src/operator/refusals.ts';

/** A work area this repository already carries, with no Git metadata of its own. */
const MYCRYPTO = '.versionless/work/react-mycrypto/baseline';

/** The Papercups work area: a repository root with a licence and a lane beside it. */
const PAPERCUPS_SOURCE = '.versionless/work/react-papercups-v1-0-0';
const PAPERCUPS_APP = `${PAPERCUPS_SOURCE}/baseline`;

/** A small React work area, copied per test so the lane writes are isolated. */
const COVERVIEW = '.versionless/work/react-coverview-a1470b01/baseline';

/**
 * The two Papercups legs install the lane closure, and npm reaches a registry
 * to do it: the peer-resolution refusal is npm reporting ERESOLVE, and the
 * proceeding leg resolves the whole closure and builds it. Neither is a
 * reading this suite may take on a host with no registry, so both are declared
 * rather than attempted — `VERSIONLESS_RUN_LANE_TESTS=1` is the declaration
 * that this host has one and is willing to spend the minutes.
 */
const LANE_TESTS_DECLARED = process.env.VERSIONLESS_RUN_LANE_TESTS === '1';

async function laneDirectory(): Promise<string> {
	const area = await mkdtemp(path.join(tmpdir(), 'versionless-run-'));
	return path.join(area, 'lane');
}

async function exists(target: string): Promise<boolean> {
	try {
		await access(target);
		return true;
	} catch {
		return false;
	}
}

async function runPipeline(
	args: readonly string[],
): Promise<Readonly<{ record: RunRecord; exitCode: number }>> {
	const outcome = await runOperatorCommand('run', args);
	return { record: outcome.json as RunRecord, exitCode: outcome.exitCode };
}

describe('operator run — the stage plan', () => {
	it('lists the nine stages in order and runs none of them', async () => {
		const lane = await laneDirectory();
		const { record, exitCode } = await runPipeline([MYCRYPTO, '--out', lane, '--dry-run']);
		expect(exitCode).toBe(EXIT_PROCEEDED);
		expect(record.schema).toBe(RUN_SCHEMA);
		expect(record.dryRun).toBe(true);
		expect(record.stagePlan.map((row) => row.name)).toEqual([
			'analyze',
			'ingest',
			'license-at-pin',
			'era-cell',
			'plan',
			'apply',
			'install',
			'build',
			'witness',
		]);
		expect(record.stagePlan.map((row) => row.name)).toEqual([...RUN_STAGES]);
		expect(record.stages).toEqual([]);
		/** A dry run declares nothing was executed, and nothing was. */
		expect(await exists(lane)).toBe(false);
	});

	it('reports the declarations each stage is given, and no flag no stage owns', async () => {
		const lane = await laneDirectory();
		const { record } = await runPipeline([
			MYCRYPTO,
			'--out',
			lane,
			'--dry-run',
			'--revision',
			'0000000000000000000000000000000000000000',
			'--node',
			'24',
			'--allow-peer-conflicts',
		]);
		const forwards = new Map(record.stagePlan.map((row) => [row.name, row.forwards]));
		expect(forwards.get('ingest')).toContain('--revision');
		expect(forwards.get('era-cell')).toContain('--node');
		expect(forwards.get('install')).toContain('--allow-peer-conflicts');
		expect(forwards.get('analyze')).toEqual([]);
		/** Every forwarded flag belongs to exactly one stage. */
		const forwarded = record.stagePlan.flatMap((row) => row.forwards);
		expect(new Set(forwarded).size).toBe(forwarded.length);
		await rm(path.dirname(lane), { recursive: true, force: true });
	});
});

/**
 * `run` composes every stage, and the stages after `apply` read the lane as a
 * tree: install looks there for the application's own lockfile and build
 * compiles its sources. A changeset lane carries neither, so a composition-only
 * default made every `run` refuse at install for a reason that was a property of
 * the lane shape rather than a reading of the application. The lane is
 * materialized here, through `applyPlan`'s own option — the same writer
 * `migrate --materialize` uses, not a second one — and `--compose-only` is the
 * opt-out. The apply row records which of the two was written.
 */
describe('operator run — the lane is materialized unless the opt-out is declared', () => {
	/** A copy of a small work area, with its licence where the source root wants it. */
	async function frontendCopy(
		extra: Readonly<Record<string, string>> = {},
		removed: readonly string[] = [],
	): Promise<Readonly<{ area: string; app: string; source: string }>> {
		const area = await mkdtemp(path.join(tmpdir(), 'versionless-run-materialize-'));
		const source = path.join(area, 'source');
		const app = path.join(source, 'baseline');
		await mkdir(source, { recursive: true });
		await cp(COVERVIEW, app, { recursive: true });
		await cp(path.join(COVERVIEW, 'LICENSE'), path.join(source, 'LICENSE'));
		for (const name of removed) await rm(path.join(app, name), { force: true });
		for (const [name, contents] of Object.entries(extra))
			await writeFile(path.join(app, name), contents);
		return { area, app, source };
	}

	const declared = (source: string) =>
		[
			'--source-root',
			source,
			'--frontend-root',
			'baseline',
			'--revision',
			'0000000000000000000000000000000000000000',
			'--node',
			'24',
		] as const;

	/** The apply record the run filed, as the stage itself returned it. */
	function applyMode(record: RunRecord): string | undefined {
		const row = record.stages.find((stage) => stage.name === 'apply');
		const applied = (row?.record as { applied?: { mode?: string } } | undefined)?.applied;
		return applied?.mode;
	}

	it('copies the application into the lane by default, so install reads its lockfile', async () => {
		const { area, app, source } = await frontendCopy({ 'yarn.lock': '\n' }, [
			'package-lock.json',
		]);
		try {
			const lane = path.join(area, 'lane');
			const { record, exitCode } = await runPipeline([
				app,
				'--out',
				lane,
				...declared(source),
			]);
			expect(applyMode(record)).toBe('materialized');
			/** The tree is there: sources, the public directory, and the lockfile. */
			expect(await exists(path.join(lane, 'src'))).toBe(true);
			expect(await exists(path.join(lane, 'public'))).toBe(true);
			expect(await exists(path.join(lane, 'yarn.lock'))).toBe(true);
			/** The composition is still written over it. */
			expect(await exists(path.join(lane, 'vite.config.ts'))).toBe(true);
			/**
			 * And the install stage now reaches a reading about the application
			 * rather than about the lane shape: this tree pins its closure with a
			 * lockfile this stage does not read, and that is what it says.
			 */
			expect(exitCode).toBe(EXIT_REFUSAL);
			expect(record.refusal?.stage).toBe('install');
			expect(record.refusal?.code).toBe('install.lockfile-foreign');
			expect(record.refusal?.message).toContain('yarn.lock');
		} finally {
			await rm(area, { recursive: true, force: true });
		}
	}, 120_000);

	it('writes the changeset lane instead when --compose-only is declared', async () => {
		const { area, app, source } = await frontendCopy();
		try {
			const lane = path.join(area, 'lane');
			const { record, exitCode } = await runPipeline([
				app,
				'--out',
				lane,
				'--compose-only',
				...declared(source),
			]);
			expect(applyMode(record)).toBe('changeset-lane');
			expect(await exists(path.join(lane, 'src'))).toBe(false);
			expect(await exists(path.join(lane, 'package-lock.json'))).toBe(false);
			expect(await exists(path.join(lane, 'vite.config.ts'))).toBe(true);
			/** The lockfile the application ships never reached the lane. */
			expect(exitCode).toBe(EXIT_REFUSAL);
			expect(record.refusal?.code).toBe('install.lockfile-absent');
		} finally {
			await rm(area, { recursive: true, force: true });
		}
	}, 120_000);

	it('gives the apply stage both lane declarations and no other stage either', async () => {
		const lane = await laneDirectory();
		const { record } = await runPipeline([
			MYCRYPTO,
			'--out',
			lane,
			'--dry-run',
			'--compose-only',
		]);
		const forwards = new Map(record.stagePlan.map((row) => [row.name, row.forwards]));
		expect(forwards.get('apply')).toContain('--compose-only');
		expect(forwards.get('install')).not.toContain('--compose-only');
	});
});

describe('operator run — the two roots are printed side by side', () => {
	it('records the acquisition root and the frontend root the ingest reading chose', async () => {
		const lane = await laneDirectory();
		const { record } = await runPipeline([PAPERCUPS_APP, '--out', lane, '--dry-run']);
		expect(record.roots.source).toBe(PAPERCUPS_APP);
		/** This tree carries its manifest at its own root, so the two coincide. */
		expect(record.roots.frontend).toBe(PAPERCUPS_APP);
		expect(record.roots.frontendSource).toBe('read');
		expect(record.roots.frontendBasis).toContain('declares react');
	});

	it('records why there is no frontend reading when the reading refuses', async () => {
		const area = await mkdtemp(path.join(tmpdir(), 'versionless-run-roots-'));
		try {
			await mkdir(path.join(area, 'app'), { recursive: true });
			await writeFile(
				path.join(area, 'app', 'package.json'),
				`${JSON.stringify({ name: 'server', dependencies: { express: '^4.17.1' } })}\n`,
			);
			const { record, exitCode } = await runPipeline([
				path.join(area, 'app'),
				'--out',
				path.join(area, 'lane'),
			]);
			expect(exitCode).toBe(EXIT_REFUSAL);
			expect(record.refusal?.stage).toBe('ingest');
			expect(record.refusal?.code).toBe('ingest.frontend-root-declares-no-framework');
			expect(record.roots.frontendSource).toBe('not-read');
			expect(record.roots.frontendBasis).toContain(
				'the ingest stage below states which refusal',
			);
		} finally {
			await rm(area, { recursive: true, force: true });
		}
	});
});

describe('operator run — the first refusing stage settles the run', () => {
	/**
	 * The work area is a copy with no Git metadata, so admission looks to the
	 * pipeline's own acquisition journal for the pin — and this lane's journal
	 * digests a different walk of the tree than the one this stage takes, so
	 * the pin it names is not this tree's pin and admission refuses by name.
	 * Admission is ordered before the toolchain cell and before the plan, so it
	 * is the stage that decides — the frozen adapter's own refusal for this tree
	 * is never reached, and the record says so rather than reporting a plan
	 * nobody composed.
	 */
	it('exits 2 with the refusing stage’s own string, and records the rest as not run', async () => {
		const lane = await laneDirectory();
		const { record, exitCode } = await runPipeline([MYCRYPTO, '--out', lane]);
		expect(exitCode).toBe(EXIT_REFUSAL);
		expect(record.exitCode).toBe(EXIT_REFUSAL);
		expect(record.outcome).toBe('refused');
		expect(record.refusal?.stage).toBe('ingest');
		expect(record.refusal?.code).toBe('ingest.acquisition-journal-does-not-match-the-tree');

		/** The string is the stage's own, reproduced with nothing added. */
		const alone = await runOperatorCommand('ingest', [MYCRYPTO]);
		const aloneRefusal = (alone.json as { refusal: { message: string; code: string } }).refusal;
		expect(record.refusal?.message).toBe(aloneRefusal.message);
		expect(record.refusal?.code).toBe(aloneRefusal.code);

		const rows = new Map(record.stages.map((row) => [row.name, row]));
		expect(record.stages.map((row) => row.name)).toEqual([...RUN_STAGES]);
		expect(rows.get('analyze')?.status).toBe('ran');
		expect(rows.get('ingest')?.status).toBe('refused');
		for (const name of [
			'license-at-pin',
			'era-cell',
			'plan',
			'apply',
			'install',
			'build',
			'witness',
		] as const) {
			expect(rows.get(name)?.status).toBe('not-run');
			expect(rows.get(name)?.reason).toBe('not-run-because: ingest refused');
		}
		/** Nothing after the refusal wrote a lane. */
		expect(await exists(lane)).toBe(false);
	});

	it('records a bounded interval for every stage that ran, at the one seam', async () => {
		const lane = await laneDirectory();
		const { record } = await runPipeline([MYCRYPTO, '--out', lane]);
		for (const row of record.stages) {
			expect(Date.parse(row.startedAt)).not.toBeNaN();
			expect(Date.parse(row.endedAt)).not.toBeNaN();
			expect(Date.parse(row.startedAt)).toBeLessThanOrEqual(Date.parse(row.endedAt));
		}
		expect(record.stages.filter((row) => row.status === 'ran').length).toBeGreaterThan(0);
	});

	it('points at the emitted coverage report rather than deriving one', async () => {
		const lane = await laneDirectory();
		const { record } = await runPipeline([MYCRYPTO, '--out', lane, '--dry-run']);
		expect(record.report.slot).toBe(RUN_COVERAGE_REPORT_SLOT);
		expect(record.report.status).toBe('emitted');
		if (record.report.status !== 'emitted') throw new Error('unreachable');
		const published = JSON.parse(
			await readFile(path.resolve(RUN_COVERAGE_REPORT_SLOT), 'utf8'),
		) as CoverageReport;
		expect(record.report.path).toBe(RUN_COVERAGE_REPORT_SLOT);
		expect(record.report.digest).toBe(published.integrity.canonicalDigest);
		expect(coverageReportDigest(published)).toBe(record.report.digest);
	});

	/**
	 * The slot is a pointer, and a pointer that lies is worse than an empty one:
	 * a report that does not recompute to its own digest is reported `stale`
	 * rather than pointed at as if the derivation had produced it.
	 */
	it('reads a report that does not recompute to its own digest as stale', async () => {
		const area = await mkdtemp(path.join(tmpdir(), 'versionless-run-slot-'));
		const target = path.join(area, RUN_COVERAGE_REPORT_SLOT);
		await mkdir(path.dirname(target), { recursive: true });
		const published = JSON.parse(
			await readFile(path.resolve(RUN_COVERAGE_REPORT_SLOT), 'utf8'),
		) as CoverageReport;
		await writeFile(
			target,
			JSON.stringify({
				...published,
				totals: { ...published.totals, proven: published.totals.proven + 1 },
			}),
		);
		const slot = await readCoverageReportSlot(area);
		expect(slot.status).toBe('stale');
		await rm(area, { recursive: true, force: true });
	});

	it('reads an absent report as not yet emitted', async () => {
		const area = await mkdtemp(path.join(tmpdir(), 'versionless-run-slot-'));
		const slot = await readCoverageReportSlot(area);
		expect(slot).toEqual({
			status: 'not-yet-emitted',
			slot: RUN_COVERAGE_REPORT_SLOT,
			reason: 'no coverage report is published at the slot',
		});
		await rm(area, { recursive: true, force: true });
	});
});

describe('operator run — the refusing defaults survive the chain', () => {
	const declared = [
		PAPERCUPS_APP,
		'--materialize',
		'--source-root',
		PAPERCUPS_SOURCE,
		'--frontend-root',
		'baseline',
		'--revision',
		'0000000000000000000000000000000000000000',
		'--node',
		'24',
	] as const;

	it.skipIf(!LANE_TESTS_DECLARED)(
		'refuses at install with the install stage’s own undeclared-policy code',
		async () => {
			const lane = await laneDirectory();
			const { record, exitCode } = await runPipeline([...declared, '--out', lane]);
			expect(exitCode).toBe(EXIT_REFUSAL);
			expect(record.refusal?.stage).toBe('install');
			expect(record.refusal?.code).toMatch(/^install\..*policy-not-declared$/);
			const rows = new Map(record.stages.map((row) => [row.name, row]));
			for (const name of [
				'analyze',
				'ingest',
				'license-at-pin',
				'era-cell',
				'plan',
				'apply',
			] as const)
				expect(rows.get(name)?.status).toBe('ran');
			expect(rows.get('build')?.status).toBe('not-run');
			expect(rows.get('witness')?.status).toBe('not-run');
			await rm(path.dirname(lane), { recursive: true, force: true });
		},
		600_000,
	);

	it.skipIf(!LANE_TESTS_DECLARED)(
		'reaches the stages after install once the policy it named is declared',
		async () => {
			const lane = await laneDirectory();
			const { record } = await runPipeline([
				...declared,
				'--out',
				lane,
				'--allow-peer-conflicts',
			]);
			const rows = new Map(record.stages.map((row) => [row.name, row]));
			expect(rows.get('install')?.status).toBe('ran');
			expect(rows.get('build')?.status).not.toBe('not-run');
			await rm(path.dirname(lane), { recursive: true, force: true });
		},
		1_200_000,
	);
});
