import { access, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	deriveCorpusTransactionState,
	verifyWitnessReactMemosEvidence,
	witnessReactMemosAggregateMember,
	WITNESS_REACT_MEMOS_RECEIPT_PATH,
} from '../../../core/src/index.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const aggregatePath = path.join(root, 'evidence/runs/aggregate.json');

/** Every state in which the memos member is already published. */
const APPENDED_KINDS = new Set([
	'react-memos-browser-proof',
	'next-killedbygoogle-v3-browser-proof',
	'react-linkfree-browser-proof',
]);

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`React memos aggregate ${label} must be an object`);
	return value as Record<string, unknown>;
}

async function exists(file: string): Promise<boolean> {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
}

/**
 * The single memos member is derived from the published evidence, never
 * authored by hand: verifying the browser proof re-hashes the build-lane
 * receipt it seals and returns the Witness receipt's own canonical digest,
 * which is the only digest the member carries.
 *
 * Like the Angular verticals, and unlike the create-react-app pairs, this lane
 * appends one member rather than two. Its build-lane receipt is bound inside
 * the Witness receipt by the sha256 of its exact bytes — that receipt declares
 * no canonical digest of its own — so a second aggregate row would restate a
 * binding that already exists instead of adding evidence.
 */
export async function reactMemosAggregateMembers(rootDir = root): Promise<{
	witness: ReturnType<typeof witnessReactMemosAggregateMember>;
}> {
	const verified = await verifyWitnessReactMemosEvidence(rootDir);
	return { witness: witnessReactMemosAggregateMember(verified.digest) };
}

function memosPaths(fixtures: Array<Record<string, unknown>>): string[] {
	return fixtures
		.map((fixture) => fixture.receipt)
		.filter((value): value is string => value === WITNESS_REACT_MEMOS_RECEIPT_PATH);
}

/**
 * Appends the memos member to the canonical aggregate and refuses anything
 * other than the exact jira-clone browser-proof predecessor state or a state in
 * which this member is already published. The append is atomic: the composed
 * aggregate is staged, re-derived, and only then renamed into place.
 */
export async function appendReactMemosAggregateMembers(rootDir = root): Promise<{
	kind: string;
	receipts: number;
	appended: boolean;
}> {
	const target = path.join(rootDir, 'evidence/runs/aggregate.json');
	const aggregate = record(JSON.parse(await readFile(target, 'utf8')), 'document');
	if (
		aggregate.schemaVersion !== 'versionless.aggregate.v1' ||
		!Array.isArray(aggregate.fixtures) ||
		!Array.isArray(aggregate.unsupported) ||
		aggregate.unsupported.length !== 0
	)
		throw new Error('React memos aggregate shape differs');
	const fixtures = aggregate.fixtures.map((item) => record(item, 'member'));
	const members = await reactMemosAggregateMembers(rootDir);
	if (memosPaths(fixtures).length === 1) {
		const state = deriveCorpusTransactionState(fixtures);
		if (!APPENDED_KINDS.has(state.kind))
			throw new Error('React memos aggregate membership is already inconsistent');
		return { kind: state.kind, receipts: state.receipts, appended: false };
	}
	if (deriveCorpusTransactionState(fixtures).kind !== 'angular-jira-clone-browser-proof')
		throw new Error('React memos append requires the jira-clone browser-proof predecessor');
	const composed = { ...aggregate, fixtures: [...fixtures, members.witness] };
	const state = deriveCorpusTransactionState(composed.fixtures);
	if (state.kind !== 'react-memos-browser-proof' || state.receipts !== composed.fixtures.length)
		throw new Error('React memos append does not derive the browser-proof state');
	const staged = `${target}.t006.tmp`;
	if (await exists(staged)) throw new Error('React memos aggregate staging residue exists');
	try {
		await writeFile(staged, `${JSON.stringify(composed, null, 2)}\n`, { flag: 'wx' });
		const restaged = record(JSON.parse(await readFile(staged, 'utf8')), 'staged document');
		if (!Array.isArray(restaged.fixtures)) throw new Error('React memos staging differs');
		const restagedState = deriveCorpusTransactionState(
			restaged.fixtures.map((item) => record(item, 'staged member')),
		);
		if (restagedState.kind !== 'react-memos-browser-proof')
			throw new Error('React memos staged aggregate does not re-derive');
		await rename(staged, target);
	} catch (error) {
		await unlink(staged).catch(() => undefined);
		throw error;
	}
	return { kind: state.kind, receipts: state.receipts, appended: true };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1) throw new Error('React memos aggregate append requires one mode');
	const result =
		args[0] === '--append'
			? await appendReactMemosAggregateMembers()
			: args[0] === '--verify-only'
				? await (async () => {
						const aggregate = record(
							JSON.parse(await readFile(aggregatePath, 'utf8')),
							'document',
						);
						if (!Array.isArray(aggregate.fixtures))
							throw new Error('React memos aggregate shape differs');
						const state = deriveCorpusTransactionState(
							aggregate.fixtures.map((item) => record(item, 'member')),
						);
						if (!APPENDED_KINDS.has(state.kind))
							throw new Error('React memos aggregate membership is absent');
						return { kind: state.kind, receipts: state.receipts, appended: false };
					})()
				: (() => {
						throw new Error('React memos aggregate append mode differs');
					})();
	process.stdout.write(`${JSON.stringify({ result: 'pass', ...result })}\n`);
}

if (process.argv[1]?.endsWith('react-memos-aggregate-append.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
