import { access, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	deriveCorpusTransactionState,
	reactHospitalrunAggregateMember,
	REACT_HOSPITALRUN_RECEIPT_PATH,
	verifyWitnessReactHospitalrunEvidence,
	witnessReactHospitalrunAggregateMember,
	WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
} from '../../../core/src/index.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const aggregatePath = path.join(root, 'evidence/runs/aggregate.json');

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`React HospitalRun aggregate ${label} must be an object`);
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
 * The two HospitalRun members are derived from the published evidence, never
 * authored by hand: the retained build-and-boot receipt contributes the
 * canonical digest sealed inside the browser-proof Witness receipt, and the
 * Witness member contributes that receipt's own canonical digest.
 */
export async function reactHospitalrunAggregateMembers(rootDir = root): Promise<{
	migration: ReturnType<typeof reactHospitalrunAggregateMember>;
	witness: ReturnType<typeof witnessReactHospitalrunAggregateMember>;
}> {
	const verified = await verifyWitnessReactHospitalrunEvidence(rootDir);
	return {
		migration: reactHospitalrunAggregateMember(
			verified.receipt.canonicalReceipt.canonicalDigest,
		),
		witness: witnessReactHospitalrunAggregateMember(verified.digest),
	};
}

function hospitalrunPaths(fixtures: Array<Record<string, unknown>>): string[] {
	return fixtures
		.map((fixture) => fixture.receipt)
		.filter(
			(value): value is string =>
				value === REACT_HOSPITALRUN_RECEIPT_PATH ||
				value === WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
		);
}

/**
 * Appends the HospitalRun pair to the canonical aggregate and refuses anything
 * other than the exact Papercups browser-proof predecessor state or the exact
 * already-appended HospitalRun state. The append is atomic: the composed
 * aggregate is staged, re-derived, and only then renamed into place.
 */
export async function appendReactHospitalrunAggregateMembers(rootDir = root): Promise<{
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
		throw new Error('React HospitalRun aggregate shape differs');
	const fixtures = aggregate.fixtures.map((item) => record(item, 'member'));
	const members = await reactHospitalrunAggregateMembers(rootDir);
	const present = hospitalrunPaths(fixtures);
	if (present.length === 2) {
		const state = deriveCorpusTransactionState(fixtures);
		if (
			state.kind !== 'react-hospitalrun-browser-proof' &&
			state.kind !== 'angular-factoriolab-browser-proof' &&
			state.kind !== 'angular-jira-clone-browser-proof' &&
			state.kind !== 'react-memos-browser-proof' &&
			state.kind !== 'next-killedbygoogle-v3-browser-proof' &&
			state.kind !== 'react-linkfree-browser-proof' &&
			state.kind !== 'angular-tiny-translator-browser-proof' &&
			state.kind !== 'angular-super-productivity-browser-proof'
		)
			throw new Error('React HospitalRun aggregate membership is already inconsistent');
		return { kind: state.kind, receipts: state.receipts, appended: false };
	}
	if (present.length !== 0) throw new Error('React HospitalRun aggregate is partially appended');
	if (deriveCorpusTransactionState(fixtures).kind !== 'react-papercups-browser-proof')
		throw new Error(
			'React HospitalRun append requires the Papercups browser-proof predecessor',
		);
	const composed = {
		...aggregate,
		fixtures: [...fixtures, members.migration, members.witness],
	};
	const state = deriveCorpusTransactionState(composed.fixtures);
	if (
		state.kind !== 'react-hospitalrun-browser-proof' ||
		state.receipts !== composed.fixtures.length
	)
		throw new Error('React HospitalRun append does not derive the browser-proof state');
	const staged = `${target}.t004.tmp`;
	if (await exists(staged)) throw new Error('React HospitalRun aggregate staging residue exists');
	try {
		await writeFile(staged, `${JSON.stringify(composed, null, 2)}\n`, { flag: 'wx' });
		const restaged = record(JSON.parse(await readFile(staged, 'utf8')), 'staged document');
		if (!Array.isArray(restaged.fixtures)) throw new Error('React HospitalRun staging differs');
		const restagedState = deriveCorpusTransactionState(
			restaged.fixtures.map((item) => record(item, 'staged member')),
		);
		if (restagedState.kind !== 'react-hospitalrun-browser-proof')
			throw new Error('React HospitalRun staged aggregate does not re-derive');
		await rename(staged, target);
	} catch (error) {
		await unlink(staged).catch(() => undefined);
		throw error;
	}
	return { kind: state.kind, receipts: state.receipts, appended: true };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1) throw new Error('React HospitalRun aggregate append requires one mode');
	const result =
		args[0] === '--append'
			? await appendReactHospitalrunAggregateMembers()
			: args[0] === '--verify-only'
				? await (async () => {
						const aggregate = record(
							JSON.parse(await readFile(aggregatePath, 'utf8')),
							'document',
						);
						if (!Array.isArray(aggregate.fixtures))
							throw new Error('React HospitalRun aggregate shape differs');
						const state = deriveCorpusTransactionState(
							aggregate.fixtures.map((item) => record(item, 'member')),
						);
						if (
							state.kind !== 'react-hospitalrun-browser-proof' &&
							state.kind !== 'angular-factoriolab-browser-proof' &&
							state.kind !== 'angular-jira-clone-browser-proof' &&
							state.kind !== 'react-memos-browser-proof' &&
							state.kind !== 'next-killedbygoogle-v3-browser-proof' &&
							state.kind !== 'react-linkfree-browser-proof' &&
							state.kind !== 'angular-tiny-translator-browser-proof' &&
							state.kind !== 'angular-super-productivity-browser-proof'
						)
							throw new Error('React HospitalRun aggregate membership is absent');
						return { kind: state.kind, receipts: state.receipts, appended: false };
					})()
				: (() => {
						throw new Error('React HospitalRun aggregate append mode differs');
					})();
	process.stdout.write(`${JSON.stringify({ result: 'pass', ...result })}\n`);
}

if (process.argv[1]?.endsWith('react-hospitalrun-aggregate-append.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
