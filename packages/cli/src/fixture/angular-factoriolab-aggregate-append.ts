import { access, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	deriveCorpusTransactionState,
	verifyWitnessAngularFactoriolabEvidence,
	witnessAngularFactoriolabAggregateMember,
	WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
} from '../../../core/src/index.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const aggregatePath = path.join(root, 'evidence/runs/aggregate.json');

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Angular factoriolab aggregate ${label} must be an object`);
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
 * The single factoriolab member is derived from the published evidence, never
 * authored by hand: verifying the browser proof re-hashes the three build-lane
 * receipts it seals and returns the Witness receipt's own canonical digest,
 * which is the only digest the member carries.
 *
 * Unlike the create-react-app verticals this lane appends one member rather
 * than a pair. Its build-lane receipts are bound inside the Witness receipt by
 * canonical digest and exact bytes rather than published as separate aggregate
 * rows, so a second row would restate a binding that already exists instead of
 * adding evidence.
 */
export async function angularFactoriolabAggregateMembers(rootDir = root): Promise<{
	witness: ReturnType<typeof witnessAngularFactoriolabAggregateMember>;
}> {
	const verified = await verifyWitnessAngularFactoriolabEvidence(rootDir);
	return { witness: witnessAngularFactoriolabAggregateMember(verified.digest) };
}

function factoriolabPaths(fixtures: Array<Record<string, unknown>>): string[] {
	return fixtures
		.map((fixture) => fixture.receipt)
		.filter(
			(value): value is string => value === WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
		);
}

/**
 * Appends the factoriolab member to the canonical aggregate and refuses
 * anything other than the exact HospitalRun browser-proof predecessor state or
 * the exact already-appended factoriolab state. The append is atomic: the
 * composed aggregate is staged, re-derived, and only then renamed into place.
 */
export async function appendAngularFactoriolabAggregateMembers(rootDir = root): Promise<{
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
		throw new Error('Angular factoriolab aggregate shape differs');
	const fixtures = aggregate.fixtures.map((item) => record(item, 'member'));
	const members = await angularFactoriolabAggregateMembers(rootDir);
	if (factoriolabPaths(fixtures).length === 1) {
		const state = deriveCorpusTransactionState(fixtures);
		if (
			state.kind !== 'angular-factoriolab-browser-proof' &&
			state.kind !== 'angular-jira-clone-browser-proof' &&
			state.kind !== 'react-memos-browser-proof' &&
			state.kind !== 'next-killedbygoogle-v3-browser-proof' &&
			state.kind !== 'react-linkfree-browser-proof' &&
			state.kind !== 'angular-tiny-translator-browser-proof'
		)
			throw new Error('Angular factoriolab aggregate membership is already inconsistent');
		return { kind: state.kind, receipts: state.receipts, appended: false };
	}
	if (deriveCorpusTransactionState(fixtures).kind !== 'react-hospitalrun-browser-proof')
		throw new Error('Angular factoriolab append requires the HospitalRun browser-proof predecessor');
	const composed = { ...aggregate, fixtures: [...fixtures, members.witness] };
	const state = deriveCorpusTransactionState(composed.fixtures);
	if (
		state.kind !== 'angular-factoriolab-browser-proof' ||
		state.receipts !== composed.fixtures.length
	)
		throw new Error('Angular factoriolab append does not derive the browser-proof state');
	const staged = `${target}.t005.tmp`;
	if (await exists(staged)) throw new Error('Angular factoriolab aggregate staging residue exists');
	try {
		await writeFile(staged, `${JSON.stringify(composed, null, 2)}\n`, { flag: 'wx' });
		const restaged = record(JSON.parse(await readFile(staged, 'utf8')), 'staged document');
		if (!Array.isArray(restaged.fixtures))
			throw new Error('Angular factoriolab staging differs');
		const restagedState = deriveCorpusTransactionState(
			restaged.fixtures.map((item) => record(item, 'staged member')),
		);
		if (restagedState.kind !== 'angular-factoriolab-browser-proof')
			throw new Error('Angular factoriolab staged aggregate does not re-derive');
		await rename(staged, target);
	} catch (error) {
		await unlink(staged).catch(() => undefined);
		throw error;
	}
	return { kind: state.kind, receipts: state.receipts, appended: true };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1) throw new Error('Angular factoriolab aggregate append requires one mode');
	const result =
		args[0] === '--append'
			? await appendAngularFactoriolabAggregateMembers()
			: args[0] === '--verify-only'
				? await (async () => {
						const aggregate = record(
							JSON.parse(await readFile(aggregatePath, 'utf8')),
							'document',
						);
						if (!Array.isArray(aggregate.fixtures))
							throw new Error('Angular factoriolab aggregate shape differs');
						const state = deriveCorpusTransactionState(
							aggregate.fixtures.map((item) => record(item, 'member')),
						);
						if (
							state.kind !== 'angular-factoriolab-browser-proof' &&
							state.kind !== 'angular-jira-clone-browser-proof' &&
							state.kind !== 'react-memos-browser-proof' &&
							state.kind !== 'next-killedbygoogle-v3-browser-proof' &&
							state.kind !== 'react-linkfree-browser-proof' &&
							state.kind !== 'angular-tiny-translator-browser-proof'
						)
							throw new Error('Angular factoriolab aggregate membership is absent');
						return { kind: state.kind, receipts: state.receipts, appended: false };
					})()
				: (() => {
						throw new Error('Angular factoriolab aggregate append mode differs');
					})();
	process.stdout.write(`${JSON.stringify({ result: 'pass', ...result })}\n`);
}

if (process.argv[1]?.endsWith('angular-factoriolab-aggregate-append.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
