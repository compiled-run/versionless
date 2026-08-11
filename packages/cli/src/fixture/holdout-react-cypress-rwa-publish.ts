import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	deriveHoldoutReactCypressRwaReceipt,
	HOLDOUT_REACT_CYPRESS_RWA_MARKDOWN_PATH,
	HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH,
	renderHoldoutReactCypressRwaReceipt,
	verifyHoldoutReactCypressRwaEvidence,
} from '../../../core/src/index.ts';

const root = path.resolve(import.meta.dirname, '../../../..');

/**
 * Publishes the canonical holdout falsification receipt.
 *
 * Nothing here authors evidence: the receipt is derived from the committed
 * `evidence/runs/react-cypress-rwa` run profile, whose exact bytes are bound
 * inside the derivation, and the Markdown is rendered from that receipt. Re-
 * publishing after an edit to either file therefore fails rather than quietly
 * restating a claim the run does not support.
 */
export async function publishHoldoutReactCypressRwaReceipt(rootDir = root): Promise<{
	digest: string;
	written: string[];
}> {
	const resolved = path.resolve(rootDir);
	const receipt = await deriveHoldoutReactCypressRwaReceipt(resolved);
	const jsonPath = path.join(resolved, HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH);
	const markdownPath = path.join(resolved, HOLDOUT_REACT_CYPRESS_RWA_MARKDOWN_PATH);
	await mkdir(path.dirname(jsonPath), { recursive: true });
	await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`);
	await writeFile(markdownPath, renderHoldoutReactCypressRwaReceipt(receipt));
	const verified = await verifyHoldoutReactCypressRwaEvidence(resolved);
	if (verified.digest !== receipt.integrity.canonicalDigest)
		throw new Error('Cypress RWA holdout receipt does not verify after publication');
	return {
		digest: verified.digest,
		written: [HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH, HOLDOUT_REACT_CYPRESS_RWA_MARKDOWN_PATH],
	};
}

/**
 * The holdout record as the aggregate carries it, read back from the published
 * aggregate rather than re-derived, so the caller sees what is actually
 * committed.
 */
export async function publishedHoldoutAggregateRecord(rootDir = root): Promise<unknown> {
	const aggregate = JSON.parse(
		await readFile(path.join(path.resolve(rootDir), 'evidence/runs/aggregate.json'), 'utf8'),
	) as { holdouts?: unknown[] };
	return aggregate.holdouts?.[0];
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1) throw new Error('Cypress RWA holdout publication requires one mode');
	const result =
		args[0] === '--publish'
			? await publishHoldoutReactCypressRwaReceipt()
			: args[0] === '--verify-only'
				? await (async () => {
						const verified = await verifyHoldoutReactCypressRwaEvidence(root);
						return { digest: verified.digest, written: [] as string[] };
					})()
				: (() => {
						throw new Error('Cypress RWA holdout publication mode differs');
					})();
	process.stdout.write(`${JSON.stringify({ result: 'pass', ...result })}\n`);
}

if (process.argv[1]?.endsWith('holdout-react-cypress-rwa-publish.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
