import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
	ANGULAR_HTTP_SUCCESSORS,
	APPLICATION_SOURCE_DIRECTORIES,
	APPLICATION_SUBPATH,
	ERA_WORKSPACE_FACTS,
	SURFACE_PROBE_TREE,
	driveAngularHttpSeam,
	buildSeamProbeRecord,
} from '../src/fixture/angular-eshop-webspa-migration-run.ts';
import {
	ATTEMPT_FILE,
	CAPABILITY_COMPOSITION,
	ERA_FACTS_NOT_CARRIED,
	GAPS,
	GAP_DISPOSITIONS,
	HOP_CLASS_FINDINGS,
	LANE_INSTALL,
	RERUN,
	SEAM_ANSWER,
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
		const bootstrap = ecosystemDispositionOf('@ng-bootstrap/ng-bootstrap', ANGULAR_16_BROWSER_CELL);
		expect(bootstrap?.kind).toBe('aligned');
		expect(alignedVersionRange('@ng-bootstrap/ng-bootstrap', ANGULAR_16_BROWSER_CELL)).toBe('^15.1.2');
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
		const surfaced = alignment.unhandled.filter((line) => line.startsWith('dependencies.ts-helpers'));
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
		const result = succeedRemovedEntryPointSymbols('shared.module.ts', source, ANGULAR_HTTP_SUCCESSORS, [
			SUCCESSOR_SURFACE,
		]);
		expect(result.changed).toBe(false);
		expect(result.unhandled.some((reason) => reason.includes('no successor is written down for JsonpModule'))).toBe(
			true,
		);
	});

	it('writes down no claim for JsonpModule, because its successor is not a rename', () => {
		expect(ANGULAR_HTTP_SUCCESSORS.some((claim) => claim.from === 'JsonpModule')).toBe(false);
		expect(SEAM_ANSWER.claimsNotWrittenDown.join(' ')).toContain('HttpClientJsonpModule');
	});

	it('leaves the frozen adapter table untouched — the claims are the driver\'s', () => {
		expect(DOCUMENTED_SYMBOL_SUCCESSORS.some((claim) => claim.specifier === '@angular/http')).toBe(false);
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
