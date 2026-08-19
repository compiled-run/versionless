import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { analyzeCorpusConformance } from '../../../core/src/corpus/conformance.ts';
import { buildCapabilityCoverage } from '../../../core/src/receipts/capability-coverage.ts';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { readRunRecords } from '../../../trust/src/coverage-report.ts';
import {
	ENTERPRISE_REPORT_JSON,
	ENTERPRISE_REPORT_MARKDOWN,
	verifyEnterpriseSurfaces,
	type EnterpriseSurfaceInputs,
} from '../../../trust/src/enterprise.ts';
import { adapterFreezeRecord } from '../../../trust/src/freeze.ts';
import { writeEnterpriseSurfaces } from '../../../trust/src/generate.ts';
import { verifyTrustPackage } from '../../../trust/src/verify.ts';

/**
 * The operator flow that hands an enterprise reviewer exactly two files.
 *
 * It verifies the trust package before it reads anything out of it, so the
 * inputs the enterprise surfaces are derived from are the verified ones rather
 * than whatever happens to be on disk. `verifyOnly` re-derives and compares
 * without writing, which is the mode a reviewer runs against a package they did
 * not generate.
 */
export interface EnterpriseReportOptions {
	rootDir?: string;
	outputDir: string;
	verifyOnly: boolean;
	environment?: NodeJS.ProcessEnv;
}

export interface EnterpriseReportResult {
	result: 'pass';
	mode: 'generated' | 'verified';
	trustDigest: string;
	machineArtifact: string;
	humanDocument: string;
	machineArtifactSha256: string;
	humanDocumentSha256: string;
	certification: 'not-certified';
}

export async function runEnterpriseReport(
	options: EnterpriseReportOptions,
): Promise<EnterpriseReportResult> {
	const root = path.resolve(options.rootDir ?? '.');
	const output = path.resolve(root, options.outputDir);
	const trust = await verifyTrustPackage({
		outputDir: options.outputDir,
		rootDir: options.rootDir,
		environment: options.environment,
	});
	const readJson = async (name: string): Promise<Record<string, unknown>> =>
		JSON.parse(await readFile(path.join(output, name), 'utf8')) as Record<string, unknown>;
	const inputs: EnterpriseSurfaceInputs = {
		root,
		output,
		manifest: (await readJson('manifest.json')) as unknown as EnterpriseSurfaceInputs['manifest'],
		/**
		 * Re-derived with the run records, exactly as `generate.ts` and
		 * `verify.ts` read them. The published enterprise report is a function of
		 * the corpus source *and* the run-record directory; re-deriving from the
		 * source alone compares a thirteen-application corpus against a twelve-
		 * application one and calls the missing row a mismatch.
		 */
		conformance: await analyzeCorpusConformance({
			rootDir: root,
			runRecords: await readRunRecords(root),
		}),
		capabilityCoverage: buildCapabilityCoverage(),
		matrix: await readJson('matrix.json'),
		controls: await readJson('controls.json'),
		licenses: await readJson('licenses.json'),
		freeze: adapterFreezeRecord(),
		scriptSurface: await readJson('script-surface.json'),
		runtimeScriptObservation: await readJson('runtime-script-observation.json'),
	};
	if (options.verifyOnly) await verifyEnterpriseSurfaces(inputs);
	else await writeEnterpriseSurfaces(inputs);
	return {
		result: 'pass',
		mode: options.verifyOnly ? 'verified' : 'generated',
		trustDigest: trust.digest,
		machineArtifact: path.join(options.outputDir, ENTERPRISE_REPORT_JSON),
		humanDocument: path.join(options.outputDir, ENTERPRISE_REPORT_MARKDOWN),
		machineArtifactSha256: sha256(await readFile(path.join(output, ENTERPRISE_REPORT_JSON))),
		humanDocumentSha256: sha256(await readFile(path.join(output, ENTERPRISE_REPORT_MARKDOWN))),
		certification: 'not-certified',
	};
}
