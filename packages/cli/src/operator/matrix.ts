/**
 * The `supported-matrix` flow: render the derived support matrix an operator is
 * allowed to quote, and refuse to print anything else.
 *
 * The matrix is not built here. It is read out of the published enterprise
 * report — the one `report:enterprise` re-derives from the canonical receipts —
 * and the trust package is verified before the file is read, so what reaches
 * stdout is the verified artifact rather than whatever happens to be on disk.
 *
 * The rendered text is then handed to the enterprise surface's own honesty
 * guard before it is returned. That guard is what makes this flow safe to point
 * at a customer: a bounded outcome string restated as a generic pass, a dropped
 * boundary prevalence figure, or blanket-support vocabulary each stop the
 * render instead of being printed.
 */

import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	ENTERPRISE_REPORT_JSON,
	assertEnterpriseSurfaceHonesty,
	type EnterpriseSupportMatrix,
} from '../../../trust/src/enterprise.ts';
import { verifyTrustPackage } from '../../../trust/src/verify.ts';

export type MatrixReading = Readonly<{
	trustDigest: string;
	source: string;
	matrix: EnterpriseSupportMatrix;
	certification: Readonly<Record<string, string>>;
}>;

export type MatrixOptions = Readonly<{
	rootDir?: string;
	trustDir?: string;
	environment?: NodeJS.ProcessEnv;
}>;

/** Verify the trust package, then read the support matrix out of it. */
export async function readSupportedMatrix(options: MatrixOptions = {}): Promise<MatrixReading> {
	const trustDir = options.trustDir ?? 'evidence/trust/current';
	const trust = await verifyTrustPackage({
		outputDir: trustDir,
		rootDir: options.rootDir,
		environment: {
			...(options.environment ?? process.env),
			VERSIONLESS_NETWORK_MODE: 'offline',
		},
	});
	if (!trust.valid)
		throw new Error('supported-matrix: the trust package did not verify; nothing is quotable.');
	const source = path.join(trustDir, ENTERPRISE_REPORT_JSON);
	const report = JSON.parse(
		await readFile(path.join(path.resolve(options.rootDir ?? '.'), source), 'utf8'),
	) as {
		certification: Record<string, string>;
		results: { supportMatrix: EnterpriseSupportMatrix };
	};
	return Object.freeze({
		trustDigest: trust.digest,
		source,
		matrix: report.results.supportMatrix,
		certification: report.certification,
	});
}

/**
 * The one key a declared boundary carries that this surface may not print.
 *
 * `neverPublishedAs` records the rounded prevalence figure the boundary ruling
 * forbids publishing — it is in the record so that a verifier can check the
 * figure never appears, which means a renderer that dumped the boundary
 * verbatim would publish exactly the number the record exists to withhold.
 */
export const WITHHELD_BOUNDARY_KEYS: readonly string[] = Object.freeze(['neverPublishedAs']);

/**
 * Flatten a declared boundary into `key: value` lines, scalars only. Nested
 * records are walked rather than dumped, so no forbidden figure rides along
 * inside a JSON blob.
 */
export function flattenBoundary(value: unknown, prefix = ''): readonly string[] {
	if (value === null || value === undefined) return [];
	if (typeof value !== 'object') return [`${prefix}: ${String(value)}`];
	if (Array.isArray(value))
		return value.flatMap((item, index) => flattenBoundary(item, `${prefix}[${String(index)}]`));
	const lines: string[] = [];
	for (const key of Object.keys(value as Record<string, unknown>).sort()) {
		if (WITHHELD_BOUNDARY_KEYS.includes(key)) continue;
		lines.push(
			...flattenBoundary(
				(value as Record<string, unknown>)[key],
				prefix === '' ? key : `${prefix}.${key}`,
			),
		);
	}
	return lines;
}

/**
 * Render the matrix as text. Every outcome, counting note, boundary and
 * prevalence figure is quoted exactly as the record carries it: this renderer
 * concatenates strings and never paraphrases one.
 */
export function renderSupportedMatrix(reading: MatrixReading): string {
	const lines: string[] = [];
	lines.push('Versionless derived support matrix');
	lines.push(`source: ${reading.source} (trust package digest ${reading.trustDigest})`);
	lines.push(`certification: ${reading.certification.state ?? 'unknown'}`);
	for (const key of Object.keys(reading.certification).sort())
		if (key !== 'state') lines.push(`  ${key}: ${reading.certification[key] as string}`);
	lines.push('');
	lines.push(`derivation: ${reading.matrix.derivation}`);
	for (const lineage of Object.keys(reading.matrix.counted).sort()) {
		const counted = reading.matrix.counted[lineage];
		if (counted === undefined) continue;
		lines.push('');
		lines.push(
			`${lineage}: ${String(counted.ready)} counted of ${String(counted.total)} proven cells`,
		);
		for (const cell of counted.cells) {
			lines.push(`  - ${cell.cell} — ${cell.application}`);
			lines.push(`    acceptance: ${cell.acceptance}`);
			lines.push(`    witness receipt: ${cell.witnessReceipt}`);
			for (const vertical of cell.verticals)
				lines.push(
					`    vertical ${vertical.vertical}: runtime ${vertical.runtime}, bundler ${vertical.bundler}, migration ${vertical.migrationTrack}, browser proof ${vertical.browserProof}, behavior digest ${vertical.behaviorDigest}`,
				);
		}
	}
	if (reading.matrix.demoted.length > 0) {
		lines.push('');
		lines.push('demoted cells');
		for (const entry of reading.matrix.demoted)
			lines.push(`  - ${entry.cell} (${entry.lineage}): ${entry.reason}`);
	}
	lines.push('');
	lines.push('holdouts');
	for (const holdout of reading.matrix.holdouts) {
		lines.push(`  - ${holdout.id} — ${holdout.application} (${holdout.lineage})`);
		lines.push(`    outcome: ${holdout.outcome}`);
		lines.push(`    counting: ${holdout.countingNote}`);
		lines.push(`    reason: ${holdout.reason}`);
		if (holdout.provenSurface !== undefined)
			lines.push(`    proven surface: ${holdout.provenSurface}`);
		for (const surface of holdout.surfacesNotCovered ?? [])
			lines.push(`    not covered: ${surface.surface} — ${surface.state}`);
		lines.push(`    receipt: ${holdout.receipt} (${holdout.digest})`);
	}
	lines.push('');
	lines.push('permanent falsification history');
	for (const entry of reading.matrix.falsificationHistory)
		lines.push(
			`  - ${entry.id} — ${entry.application}, lane ${entry.lane}, state ${entry.state}, frozen adapter ${entry.frozenAdapterFingerprint}, receipt ${entry.receipt} (${entry.digest})`,
		);
	if (reading.matrix.declaredBoundaries.length > 0) {
		lines.push('');
		lines.push('declared boundaries');
		for (const boundary of reading.matrix.declaredBoundaries)
			for (const line of flattenBoundary(boundary)) lines.push(`  ${line}`);
	}
	lines.push('');
	lines.push('boundary prevalence');
	lines.push(`  published: ${reading.matrix.boundaryPrevalence.published}`);
	lines.push(`  ${reading.matrix.boundaryPrevalence.statement}`);
	lines.push(`  ${reading.matrix.boundaryPrevalence.populationStatement}`);
	lines.push('');
	lines.push(
		`out of matrix: ${String(reading.matrix.outOfMatrixCapabilities.experimental)} experimental and ${String(reading.matrix.outOfMatrixCapabilities.crossProven)} cross-proven of ${String(reading.matrix.outOfMatrixCapabilities.total)} capabilities`,
	);
	lines.push(`  ${reading.matrix.outOfMatrixCapabilities.note}`);
	lines.push('');
	lines.push(`tranche two: ${reading.matrix.trancheTwoCommitment}`);
	const text = `${lines.join('\n')}\n`;
	assertEnterpriseSurfaceHonesty(text, 'supported-matrix');
	return text;
}
