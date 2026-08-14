import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	deriveHoldoutReactCypressRwaWitnessReceipt,
	HOLDOUT_REACT_CYPRESS_RWA_WITNESS_MARKDOWN_PATH,
	HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RECEIPT_PATH,
	renderHoldoutReactCypressRwaWitnessReceipt,
	verifyHoldoutReactCypressRwaWitnessEvidence,
} from '../../../core/src/receipts/holdout-react-cypress-rwa-witness.ts';

const root = path.resolve(import.meta.dirname, '../../../..');

/**
 * Publishes the canonical passing cypress-realworld-app holdout receipt — the
 * journey re-run under the adapter re-frozen at composite 4df7bc96.
 *
 * Nothing here authors evidence: the receipt is derived from the committed
 * measured run evidence (the two-lane parity file and the green build profile),
 * whose exact bytes are bound inside the derivation, and the Markdown is
 * rendered from that receipt. Re-publishing after an edit to either file fails
 * rather than quietly restating a claim the run does not support.
 */
export async function publishHoldoutReactCypressRwaWitnessReceipt(rootDir = root): Promise<{
	digest: string;
	written: string[];
}> {
	const resolved = path.resolve(rootDir);
	const receipt = await deriveHoldoutReactCypressRwaWitnessReceipt(resolved);
	const jsonPath = path.join(resolved, HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RECEIPT_PATH);
	const markdownPath = path.join(resolved, HOLDOUT_REACT_CYPRESS_RWA_WITNESS_MARKDOWN_PATH);
	await mkdir(path.dirname(jsonPath), { recursive: true });
	await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`);
	await writeFile(markdownPath, renderHoldoutReactCypressRwaWitnessReceipt(receipt));
	const verified = await verifyHoldoutReactCypressRwaWitnessEvidence(resolved);
	if (verified.digest !== receipt.integrity.canonicalDigest)
		throw new Error('Cypress RWA witness holdout receipt does not verify after publication');
	return {
		digest: verified.digest,
		written: [
			HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RECEIPT_PATH,
			HOLDOUT_REACT_CYPRESS_RWA_WITNESS_MARKDOWN_PATH,
		],
	};
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1) throw new Error('Cypress RWA witness holdout publication requires one mode');
	const result =
		args[0] === '--publish'
			? await publishHoldoutReactCypressRwaWitnessReceipt()
			: args[0] === '--verify-only'
				? await (async () => {
						const verified = await verifyHoldoutReactCypressRwaWitnessEvidence(root);
						return { digest: verified.digest, written: [] as string[] };
					})()
				: (() => {
						throw new Error('Cypress RWA witness holdout publication mode differs');
					})();
	process.stdout.write(`${JSON.stringify({ result: 'pass', ...result })}\n`);
}

if (process.argv[1]?.endsWith('holdout-react-cypress-rwa-witness-publish.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
