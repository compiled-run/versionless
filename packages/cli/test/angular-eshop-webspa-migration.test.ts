import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	ANGULAR_HTTP_SUCCESSORS,
	APPLICATION_SOURCE_DIRECTORIES,
	APPLICATION_SUBPATH,
	EMPTY_LANE_READINGS,
	ERA_WORKSPACE_FACTS,
	SURFACE_PROBE_TREE,
	driveAngularHttpSeam,
	buildSeamProbeRecord,
	readPackageExports,
} from '../src/fixture/angular-eshop-webspa-migration-run.ts';
import { compareInventories } from '../src/fixture/angular-eshop-webspa-build-inventory.ts';
import {
	ATTEMPT_FILE,
	CAPABILITY_COMPOSITION,
	ERA_FACTS_NOT_CARRIED,
	GAPS,
	GAP_DISPOSITIONS,
	HOP_CLASS_FINDINGS,
	INGEST_DIRECTORY,
	LANE_INSTALL,
	OUTPUT_INVENTORY,
	RERUN,
	SEAM_ANSWER,
	buildExportsMapBlock,
	buildExportsMapRecord,
	buildMigrationBlock,
	buildMigrationRecord,
	buildRerunBlock,
} from '../src/fixture/angular-eshop-webspa-migration-record.ts';
import {
	ANGULAR_16_BROWSER_CELL,
	DOCUMENTED_SYMBOL_SUCCESSORS,
	alignAngularPackageManifest,
	alignedVersionRange,
	ecosystemDispositionOf,
	succeedRemovedEntryPointSymbols,
	type RootSurfaceReading,
} from '../../frameworks/angular/src/index.ts';

async function readAttempt(): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(ATTEMPT_FILE, 'utf8')) as Record<string, unknown>;
}

/** The successor surface as the probe tree answered it, reduced to what the gates read. */
const SUCCESSOR_SURFACE: RootSurfaceReading = Object.freeze({
	package: '@angular/common/http',
	version: '16.2.12',
	specifier: '@angular/http',
	specifierResolves: false,
	rootExports: Object.freeze(['HttpClient', 'HttpClientModule', 'HttpHeaders', 'HttpResponse']),
	complete: true,
});

describe('eShopOnContainers WebSPA Angular holdout migration record', () => {
	it('records a red migration as red and claims no target build', () => {
		const block = buildMigrationBlock();
		expect(block['outcome']).toBe('red-migration-gaps-itemised');
		const target = block['targetBuild'] as Record<string, unknown>;
		expect(target['produced']).toBe(false);
		expect(target['attempted']).toBe(false);
		expect(LANE_INSTALL.attempts.every((attempt) => attempt.exitStatus === 1)).toBe(true);
		expect(LANE_INSTALL.packagesInstalled).toBe(0);
	});

	it('carries no parity, determinism, readiness or output claim, because nothing was emitted', () => {
		const block = buildMigrationBlock();
		expect(block['parity']).toBeUndefined();
		expect(block['determinism']).toBeUndefined();
		expect(block['outputInventory']).toBeUndefined();
		expect(block['witness']).toBeUndefined();
	});

	it('reached the red without forcing peer resolution or narrowing the manifest', () => {
		expect(LANE_INSTALL.forcedFlagsUsed).toBe(false);
		expect(LANE_INSTALL.narrowingApplied).toBe(false);
		for (const attempt of LANE_INSTALL.attempts)
			expect(attempt.command).not.toContain('legacy-peer-deps');
	});

	it('states every gap as site, subject, library, evidence, quoted diagnostic, era reason and transform', () => {
		expect(GAPS.length).toBeGreaterThan(3);
		for (const gap of GAPS) {
			expect(gap.id).not.toBe('');
			expect(gap.site).not.toBe('');
			expect(gap.subject).not.toBe('');
			expect(gap.library).not.toBe('');
			expect(gap.observed.length).toBeGreaterThan(40);
			expect(gap.whyTheEraToolchainAccepted.length).toBeGreaterThan(40);
			expect(gap.whyTheEngineCannotCarryIt.length).toBeGreaterThan(40);
			expect(gap.neededTransform.length).toBeGreaterThan(40);
		}
		expect(new Set(GAPS.map((gap) => gap.id)).size).toBe(GAPS.length);
	});

	it('separates a gap a tool reported from a gap read off a declaration', () => {
		const byLog = GAPS.filter((gap) => gap.evidence === 'lane-log');
		const byDeclaration = GAPS.filter((gap) => gap.evidence !== 'lane-log');
		expect(byLog.length).toBeGreaterThan(0);
		expect(byDeclaration.length).toBeGreaterThan(0);
		const preboot = GAPS.find((gap) => gap.site === 'preboot');
		expect(preboot?.evidence).toBe('era-closure-declaration');
		expect(preboot?.observed).toContain('npm never reported it');
	});
});

describe('the install refusal is a reading of the frozen cell, not an accident', () => {
	/**
	 * T023 recorded that the cell had read no line for either package, which is
	 * what made the refusal silent. T024 read them. The test that pinned the
	 * absence is kept as the test that pins the readings, because the record it
	 * belongs to is the one that says the absence was the defect.
	 */
	it('carries a reading for each package that refused, of the kind the bytes support', () => {
		const bootstrap = ecosystemDispositionOf(
			'@ng-bootstrap/ng-bootstrap',
			ANGULAR_16_BROWSER_CELL,
		);
		expect(bootstrap?.kind).toBe('aligned');
		expect(alignedVersionRange('@ng-bootstrap/ng-bootstrap', ANGULAR_16_BROWSER_CELL)).toBe(
			'^15.1.2',
		);
		expect(bootstrap?.fact).toContain('^16.0.0');
		const preboot = ecosystemDispositionOf('preboot', ANGULAR_16_BROWSER_CELL);
		expect(preboot?.kind).toBe('no-successor');
		expect(preboot?.fact).toContain('ngcc');
		expect(alignedVersionRange('preboot', ANGULAR_16_BROWSER_CELL)).toBeNull();
	});

	it('refuses silence for a declaration it has read no line for', () => {
		const alignment = alignAngularPackageManifest(
			{ dependencies: { '@angular/core': '6.1.4', 'ts-helpers': '1.1.2' } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect((alignment.manifest['dependencies'] as Record<string, string>)['ts-helpers']).toBe(
			'1.1.2',
		);
		const surfaced = alignment.unhandled.filter((line) =>
			line.startsWith('dependencies.ts-helpers'),
		);
		expect(surfaced).toHaveLength(1);
		expect(surfaced[0]).toContain('declared at 1.1.2');
		expect(surfaced[0]).toContain('has read no line for it');
	});

	it('confirms @angular/http is dropped by a reading the cell states out loud', () => {
		const disposition = ecosystemDispositionOf('@angular/http', ANGULAR_16_BROWSER_CELL);
		expect(disposition?.kind).toBe('no-successor');
		expect(disposition?.fact).toContain('@angular/common');
	});
});

describe('the @angular/http seam answer', () => {
	it('answers the measured question No, and names the gate that refused', () => {
		expect(SEAM_ANSWER.answer).toBe('No.');
		expect(SEAM_ANSWER.modulesChanged).toBe(0);
		expect(SEAM_ANSWER.gateThatRefused).toContain('call-shape');
		expect(SEAM_ANSWER.gatesPassed.length).toBeGreaterThan(3);
	});

	it('refuses each documented @angular/http symbol on use position, not on the reading', () => {
		const source = [
			"import { Http, Response, Headers } from '@angular/http';",
			'',
			'export class SecurityService {',
			'  constructor(private http: Http) {}',
			'  headers(): Headers { return new Headers(); }',
			'  extract(response: Response): unknown { return response; }',
			'}',
			'',
		].join('\n');
		const result = succeedRemovedEntryPointSymbols(
			'security.service.ts',
			source,
			ANGULAR_HTTP_SUCCESSORS,
			[SUCCESSOR_SURFACE],
		);
		expect(result.changed).toBe(false);
		expect(result.source).toBe(source);
		expect(result.unhandled.length).toBeGreaterThan(0);
		for (const reason of result.unhandled) {
			expect(reason).toContain('other than as the callee of a call');
			expect(reason).not.toContain('incomplete');
			expect(reason).not.toContain('still answers');
		}
	});

	it('refuses a symbol no successor is written down for, by name', () => {
		const source = "import { HttpModule, JsonpModule } from '@angular/http';\n";
		const result = succeedRemovedEntryPointSymbols(
			'shared.module.ts',
			source,
			ANGULAR_HTTP_SUCCESSORS,
			[SUCCESSOR_SURFACE],
		);
		expect(result.changed).toBe(false);
		expect(
			result.unhandled.some((reason) =>
				reason.includes('no successor is written down for JsonpModule'),
			),
		).toBe(true);
	});

	it('writes down no claim for JsonpModule, because its successor is not a rename', () => {
		expect(ANGULAR_HTTP_SUCCESSORS.some((claim) => claim.from === 'JsonpModule')).toBe(false);
		expect(SEAM_ANSWER.claimsNotWrittenDown.join(' ')).toContain('HttpClientJsonpModule');
	});

	it("leaves the frozen adapter table untouched — the claims are the driver's", () => {
		expect(
			DOCUMENTED_SYMBOL_SUCCESSORS.some((claim) => claim.specifier === '@angular/http'),
		).toBe(false);
		for (const claim of ANGULAR_HTTP_SUCCESSORS) expect(claim.specifier).toBe('@angular/http');
	});

	it('drives no module and writes no byte when the composed changeset has no @angular/http site', () => {
		const outcomes = driveAngularHttpSeam(
			Object.freeze({
				cell: ANGULAR_16_BROWSER_CELL.id,
				files: Object.freeze([
					Object.freeze({
						path: 'Client/main.ts',
						kind: 'application' as const,
						changed: false,
						sha256Before: '',
						sha256After: '',
						source: "import { enableProdMode } from '@angular/core';\n",
						changes: Object.freeze([]),
					}),
				]),
				applicationFilesChanged: 0,
				workspaceFilesChanged: 0,
				applicationFilesScanned: 1,
				unhandled: Object.freeze([]),
				declaredDifferences: Object.freeze([]),
				removedFiles: Object.freeze([]),
			}),
			SUCCESSOR_SURFACE,
		);
		expect(outcomes).toHaveLength(0);
		const record = buildSeamProbeRecord(SUCCESSOR_SURFACE, outcomes, SURFACE_PROBE_TREE);
		expect(record['modulesOffered']).toBe(0);
	});
});

describe('the capability composition and the hop-class readings', () => {
	it('records which capabilities fired, stood down and refused, with none unaccounted', () => {
		expect(CAPABILITY_COMPOSITION.fired.length).toBeGreaterThan(5);
		expect(CAPABILITY_COMPOSITION.stoodDown.length).toBeGreaterThan(3);
		expect(CAPABILITY_COMPOSITION.refused).toHaveLength(1);
		expect(CAPABILITY_COMPOSITION.refused[0]).toContain('removed-entry-point-symbol-successor');
	});

	it('names the workspace generation and the source root this driver was pointed at', () => {
		expect(APPLICATION_SUBPATH).toBe('src/Web/WebSPA');
		expect(APPLICATION_SOURCE_DIRECTORIES).toEqual(['Client']);
		expect(ERA_WORKSPACE_FACTS.join(' ')).toContain('"version": 1');
	});

	it('records that the angular.json v1 generation cost nothing, rather than implying it', () => {
		expect(HOP_CLASS_FINDINGS.length).toBeGreaterThan(4);
		expect(HOP_CLASS_FINDINGS.some((finding) => finding.includes('there is none'))).toBe(true);
	});

	it('declares every era fact the hop dropped', () => {
		expect(ERA_FACTS_NOT_CARRIED.length).toBeGreaterThan(4);
		expect(ERA_FACTS_NOT_CARRIED.join(' ')).toContain('@angular/http');
	});
});

describe('the T024 re-run', () => {
	it('records an install that cleared and a build that did not', () => {
		const block = buildRerunBlock();
		expect(block['outcome']).toBe('install-green-build-red-itemised');
		expect(RERUN.install.exitStatus).toBe(0);
		expect(RERUN.install.forcedFlagsUsed).toBe(false);
		expect(RERUN.install.narrowingApplied).toBe(false);
		expect(RERUN.build.exitStatus).toBe(1);
		expect(RERUN.build.attempts).toBe(1);
		expect(RERUN.build.artifactsEmitted).toBe(0);
		expect(block['parity']).toBeUndefined();
		expect(block['determinism']).toBeUndefined();
	});

	it('leaves G3 open and says so, with every other gap closed by a named transform', () => {
		expect(GAP_DISPOSITIONS.map((gap) => gap.id)).toEqual(GAPS.map((gap) => gap.id));
		const open = GAP_DISPOSITIONS.filter((gap) => gap.state === 'open');
		expect(open.map((gap) => gap.id)).toEqual(['G3']);
		for (const gap of GAP_DISPOSITIONS.filter((entry) => entry.state === 'closed'))
			expect(gap.by.length).toBeGreaterThan(10);
	});

	it('names the construct classes the build reached rather than counting them', () => {
		expect(RERUN.build.constructClassesBehindTheWall.length).toBeGreaterThan(3);
		const named = RERUN.build.constructClassesBehindTheWall.join(' ');
		expect(named).toContain('NgbModule');
		expect(named).toContain("Property 'throw' does not exist");
		expect(named).toContain('~bootstrap/scss/bootstrap');
		expect(RERUN.build.notEstablished.join(' ')).toContain('no determinism');
	});

	it('states that no counted vertical changeset shifted, and what did', () => {
		expect(RERUN.greenVerticalSurfacing).toContain('No counted vertical');
		expect(RERUN.greenVerticalSurfacing).toContain('pako');
	});
});

describe('the published attempt record', () => {
	it('carries the migration block, sealed and re-sealable', async () => {
		const attempt = await readAttempt();
		const block = attempt['migration'] as Record<string, unknown> | undefined;
		expect(block).toBeDefined();
		expect(block?.['outcome']).toBe('red-migration-gaps-itemised');
		expect(block?.['digest']).toBe(buildMigrationRecord()['digest']);
	});

	it('leaves the baseline block exactly as the previous unit wrote it', async () => {
		const attempt = await readAttempt();
		const baseline = attempt['baseline'] as Record<string, unknown>;
		expect(baseline['unit']).toBe('lrapr-t023/u4-eshop-webspa-baseline');
		expect((baseline['productionBuild'] as Record<string, unknown>)['errors']).toBe(
			'none — neither run emitted an Angular, TypeScript, sass or webpack error',
		);
	});

	it('states what the red does not establish', () => {
		const block = buildMigrationBlock();
		const claims = block['notEstablished'] as readonly string[];
		expect(claims.length).toBeGreaterThan(4);
		expect(claims.join(' ')).toContain('No compiler read this application on the target line');
	});
});

describe('the T024 u4 wiring: where the exports reading is taken, and why there', () => {
	it('takes it driver-side, on the ground that it needs the lane’s installed closure', () => {
		const block = buildExportsMapBlock();
		const wiring = block['wiringDecision'] as Record<string, string>;
		expect(wiring['answer']).toBe('driver');
		expect(wiring['reasoning']).toContain('T021-u1');
		expect(wiring['reasoning']).toContain('needs the closure');
		expect(wiring['genericity']).toContain('names no package');
	});

	it('stands the capability down when the lane has no closure to read', () => {
		expect(EMPTY_LANE_READINGS.packageExports).toEqual([]);
	});

	it('reads every dependency that publishes an exports map, and no other', async () => {
		const tree = await mkdtemp(path.join(tmpdir(), 'eshop-exports-'));
		try {
			await writeFile(
				path.join(tree, 'package.json'),
				JSON.stringify({
					dependencies: { alpha: '^1.0.0', beta: '^2.0.0', gamma: '^3.0.0' },
				}),
			);
			const install = async (
				name: string,
				manifest: Record<string, unknown>,
				stylesheet?: string,
			): Promise<void> => {
				const at = path.join(tree, 'node_modules', name);
				await mkdir(at, { recursive: true });
				await writeFile(path.join(at, 'package.json'), JSON.stringify(manifest));
				if (stylesheet !== undefined)
					await writeFile(path.join(at, 'theme.scss'), stylesheet);
			};
			await install(
				'alpha',
				{ version: '1.2.3', exports: { './theme': { default: './theme.scss' } } },
				'.a { color: red; }',
			);
			await install('beta', { version: '2.0.0', main: './index.js' });
			const readings = await readPackageExports(tree);
			expect(readings.map((reading) => reading.name)).toEqual(['alpha']);
			expect(readings[0]?.version).toBe('1.2.3');
			expect(readings[0]?.fileSizes?.['theme.scss']).toBe(18);
		} finally {
			await rm(tree, { recursive: true, force: true });
		}
	});

	it('reads nothing at all from a tree with no manifest, rather than throwing', async () => {
		const tree = await mkdtemp(path.join(tmpdir(), 'eshop-exports-empty-'));
		try {
			expect(await readPackageExports(tree)).toEqual([]);
		} finally {
			await rm(tree, { recursive: true, force: true });
		}
	});
});

describe('the T024 u4 green', () => {
	it('records a build that completed, and no remaining diagnostic', () => {
		const block = buildExportsMapBlock();
		expect(block['outcome']).toBe('green-build-twice-byte-identical');
		const build = block['targetBuild'] as Record<string, unknown>;
		expect(build['exitStatus']).toBe(0);
		expect(build['produced']).toBe(true);
		expect(build['remainingDiagnostics']).toEqual([]);
		expect((build['g7DiagnosticsClosed'] as readonly string[]).length).toBe(2);
	});

	it('claims determinism from two runs compared, not from one run repeated in words', () => {
		const build = buildExportsMapBlock()['targetBuild'] as Record<string, unknown>;
		expect(build['runs']).toBe(2);
		expect(build['byteIdenticalAcrossRuns']).toBe(true);
		expect(String(build['runsNote'])).toContain('hashed filenames are the same in both runs');
		expect(build['secondRunLog']).toBe('migration/u4-t024-target-build-run2.log');
	});

	it('says the wiring alone would not have closed G7, and what else was needed', () => {
		const capability = buildExportsMapBlock()['capabilityExtended'] as Record<string, string>;
		expect(capability['whyExtensionAndNotWiringAlone']).toContain('did refuse it');
		expect(capability['rule']).toBe('republished subpath — the exact successor');
		expect(capability['whyItDeclaresNothing']).toContain('same file');
		expect(capability['whyAllOrNothing']).toContain('twice');
	});

	it('proves the repaired import was compiled rather than resolved to nothing', () => {
		const build = buildExportsMapBlock()['targetBuild'] as Record<string, unknown>;
		expect(String(build['emittedProof'])).toContain('.toast-*');
	});

	it('records the inventory with no file appearing in one lane and not the other', () => {
		expect(OUTPUT_INVENTORY.files).toBe(OUTPUT_INVENTORY.baselineFiles);
		expect(OUTPUT_INVENTORY.onlyInEra).toEqual([]);
		expect(OUTPUT_INVENTORY.onlyInMigrated).toEqual([]);
		expect(OUTPUT_INVENTORY.carriedByteIdentical.length).toBe(19);
		expect(OUTPUT_INVENTORY.differingFromBaseline.length).toBe(6);
		expect(
			OUTPUT_INVENTORY.carriedByteIdentical.length +
				OUTPUT_INVENTORY.differingFromBaseline.length,
		).toBe(OUTPUT_INVENTORY.files);
	});

	it('states what a green build still does not establish', () => {
		const claims = buildExportsMapBlock()['notEstablished'] as readonly string[];
		expect(claims.length).toBeGreaterThan(4);
		expect(claims.join(' ')).toContain('no witness has run');
		expect(claims.join(' ')).toContain('one cell on one machine');
	});

	it('carries the u4 block into the attempt record, sealed, beside every red', async () => {
		const attempt = await readAttempt();
		const block = attempt['t024U4Rerun'] as Record<string, unknown> | undefined;
		expect(block).toBeDefined();
		expect(block?.['outcome']).toBe('green-build-twice-byte-identical');
		expect(block?.['digest']).toBe(buildExportsMapRecord()['digest']);
		for (const prior of ['migration', 't024Rerun', 't024U2Rerun', 't024U3Rerun'])
			expect(attempt[prior]).toBeDefined();
		expect((attempt['t024U3Rerun'] as Record<string, unknown>)['outcome']).toBe(
			'install-green-build-red-one-remaining-class-beyond-g6',
		);
	});
});

describe('the twice-build comparison', () => {
	const entry = (at: string, bytes: number, digest: string): Record<string, unknown> => ({
		path: at,
		bytes,
		sha256: digest,
	});
	const inventory = (
		dirLabel: string,
		entries: readonly Record<string, unknown>[],
	): Parameters<typeof compareInventories>[0] =>
		({
			dirLabel,
			files: entries.length,
			totalBytes: entries.reduce((total, item) => total + Number(item['bytes']), 0),
			entries,
		}) as unknown as Parameters<typeof compareInventories>[0];

	it('calls two runs identical only when every path and every digest matches', () => {
		const runA = inventory('run1', [
			entry('main.aaa.js', 10, 'd1'),
			entry('index.html', 5, 'd2'),
		]);
		expect(compareInventories(runA, inventory('run2', [...runA.entries]))).toEqual({
			byteIdentical: true,
			onlyInRunA: [],
			onlyInRunB: [],
			differingContent: [],
		});
	});

	it('names a hashed filename that moved between runs rather than counting it', () => {
		const runA = inventory('run1', [entry('main.aaa.js', 10, 'd1')]);
		const runB = inventory('run2', [entry('main.bbb.js', 10, 'd1')]);
		const comparison = compareInventories(runA, runB);
		expect(comparison.byteIdentical).toBe(false);
		expect(comparison.onlyInRunA).toEqual(['main.aaa.js']);
		expect(comparison.onlyInRunB).toEqual(['main.bbb.js']);
	});

	it('names a file whose content changed under an unchanged name', () => {
		const runA = inventory('run1', [entry('index.html', 5, 'd1')]);
		const runB = inventory('run2', [entry('index.html', 5, 'd9')]);
		const comparison = compareInventories(runA, runB);
		expect(comparison.byteIdentical).toBe(false);
		expect(comparison.differingContent).toEqual(['index.html']);
	});

	it('agrees with the record this unit published for the two runs it ran', async () => {
		const record = JSON.parse(
			await readFile(
				path.join(INGEST_DIRECTORY, 'migration/u4-t024-build-inventory-run1-vs-run2.json'),
				'utf8',
			),
		) as Record<string, unknown>;
		const runA = record['runA'] as Record<string, unknown>;
		const runB = record['runB'] as Record<string, unknown>;
		expect(record['comparison']).toEqual({
			byteIdentical: true,
			onlyInRunA: [],
			onlyInRunB: [],
			differingContent: [],
		});
		expect(runA['files']).toBe(OUTPUT_INVENTORY.files);
		expect(runA['totalBytes']).toBe(OUTPUT_INVENTORY.totalBytes);
		expect(runB['totalBytes']).toBe(runA['totalBytes']);
	});
});
