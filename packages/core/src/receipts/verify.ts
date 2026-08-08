import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { assertSyntheticEvidence } from '../policy/payment-signals.ts';
import { receiptDigest, sha256 } from './canonicalize.ts';
import { parseMigrationReceipt } from './schema.ts';

function markdownPath(jsonPath: string): string {
	return jsonPath.endsWith('.json')
		? `${jsonPath.slice(0, -'.json'.length)}.md`
		: `${jsonPath}.md`;
}

export type ReceiptPathBase = 'repository' | 'versionless';

export interface VerifyReceiptOptions {
	repositoryRoot?: string;
	receiptPathBase?: ReceiptPathBase;
	artifactPathBase?: ReceiptPathBase;
	requireAggregate?: boolean;
}

export function resolveReceiptPath(
	value: string,
	repositoryRoot: string,
	base: ReceiptPathBase,
): string {
	if (path.isAbsolute(value)) return path.normalize(value);
	const explicitBase =
		base === 'repository'
			? path.normalize(repositoryRoot)
			: path.join(path.normalize(repositoryRoot), '.versionless');
	return path.resolve(explicitBase, value);
}

export async function verifyReceipt(
	file: string,
	options: VerifyReceiptOptions = {},
): Promise<{ valid: true; digest: string; artifacts: number }> {
	const explicitRoot = options.repositoryRoot
		? path.normalize(options.repositoryRoot)
		: undefined;
	const absolute = explicitRoot
		? resolveReceiptPath(file, explicitRoot, options.receiptPathBase ?? 'repository')
		: path.resolve(file);
	const receipt = parseMigrationReceipt(JSON.parse(await readFile(absolute, 'utf8')));
	assertSyntheticEvidence(receipt);
	const calculated = receiptDigest(receipt);
	if (calculated !== receipt.integrity.canonicalDigest)
		throw new Error(`Canonical digest mismatch: ${calculated}`);
	const root = explicitRoot ?? path.resolve(path.dirname(absolute), '../../..');
	for (const artifact of receipt.artifacts) {
		const artifactFile = explicitRoot
			? resolveReceiptPath(
					artifact.path,
					explicitRoot,
					options.artifactPathBase ?? 'repository',
				)
			: path.join(root, artifact.path);
		const actual = sha256(await readFile(artifactFile));
		if (actual !== artifact.sha256)
			throw new Error(`Artifact digest mismatch: ${artifact.path}`);
	}
	const report = await readFile(markdownPath(absolute), 'utf8');
	if (!report.includes(receipt.integrity.canonicalDigest))
		throw new Error('Derived Markdown is not linked to canonical digest');
	if (options.requireAggregate ?? true) {
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as {
			fixtures?: Array<{ receipt?: string; digest?: string }>;
		};
		const receiptRelative = path.relative(root, absolute);
		if (
			!aggregate.fixtures?.some(
				(item) =>
					item.receipt === receiptRelative &&
					item.digest === receipt.integrity.canonicalDigest,
			)
		)
			throw new Error('Aggregate is not linked to the canonical receipt');
	}
	return { valid: true, digest: calculated, artifacts: receipt.artifacts.length };
}
