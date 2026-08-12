import { access, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	deriveCorpusTransactionState,
	verifyWitnessAngularTinyTranslatorEvidence,
	witnessAngularTinyTranslatorAggregateMember,
	WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
} from '../../../core/src/index.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const aggregatePath = path.join(root, 'evidence/runs/aggregate.json');

/** Every state in which the TinyTranslator member is already published. */
const APPENDED_KINDS = new Set(['angular-tiny-translator-browser-proof']);

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Angular TinyTranslator aggregate ${label} must be an object`);
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
 * The single TinyTranslator member is derived from the published evidence, never
 * authored by hand: verifying the browser proof re-hashes the two build-lane
 * receipts it seals, checks each receipt's own byte-identity claim against the
 * binding, and returns the Witness receipt's canonical digest, which is the only
 * digest the member carries.
 *
 * The lane appends one member rather than a pair: its two build-lane receipts
 * are sealed inside the Witness receipt by both canonical digest and exact
 * bytes, so a second aggregate row would restate a binding that already exists.
 */
export async function angularTinyTranslatorAggregateMembers(rootDir = root): Promise<{
	witness: ReturnType<typeof witnessAngularTinyTranslatorAggregateMember>;
}> {
	const verified = await verifyWitnessAngularTinyTranslatorEvidence(rootDir);
	return { witness: witnessAngularTinyTranslatorAggregateMember(verified.digest) };
}

function tinyTranslatorPaths(fixtures: Array<Record<string, unknown>>): string[] {
	return fixtures
		.map((fixture) => fixture.receipt)
		.filter(
			(value): value is string => value === WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
		);
}

/**
 * Appends the TinyTranslator member to the canonical aggregate and refuses
 * anything other than the exact LinkFree browser-proof predecessor state or the
 * exact already-appended TinyTranslator state. The append is atomic: the
 * composed aggregate is staged, re-derived, and only then renamed into place.
 */
export async function appendAngularTinyTranslatorAggregateMembers(rootDir = root): Promise<{
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
		throw new Error('Angular TinyTranslator aggregate shape differs');
	const fixtures = aggregate.fixtures.map((item) => record(item, 'member'));
	const members = await angularTinyTranslatorAggregateMembers(rootDir);
	if (tinyTranslatorPaths(fixtures).length === 1) {
		const state = deriveCorpusTransactionState(fixtures);
		if (!APPENDED_KINDS.has(state.kind))
			throw new Error('Angular TinyTranslator aggregate membership is already inconsistent');
		return { kind: state.kind, receipts: state.receipts, appended: false };
	}
	if (deriveCorpusTransactionState(fixtures).kind !== 'react-linkfree-browser-proof')
		throw new Error(
			'Angular TinyTranslator append requires the LinkFree browser-proof predecessor',
		);
	const composed = { ...aggregate, fixtures: [...fixtures, members.witness] };
	const state = deriveCorpusTransactionState(composed.fixtures);
	if (
		state.kind !== 'angular-tiny-translator-browser-proof' ||
		state.receipts !== composed.fixtures.length
	)
		throw new Error('Angular TinyTranslator append does not derive the browser-proof state');
	const staged = `${target}.t006a.tmp`;
	if (await exists(staged))
		throw new Error('Angular TinyTranslator aggregate staging residue exists');
	try {
		await writeFile(staged, `${JSON.stringify(composed, null, 2)}\n`, { flag: 'wx' });
		const restaged = record(JSON.parse(await readFile(staged, 'utf8')), 'staged document');
		if (!Array.isArray(restaged.fixtures))
			throw new Error('Angular TinyTranslator staging differs');
		const restagedState = deriveCorpusTransactionState(
			restaged.fixtures.map((item) => record(item, 'staged member')),
		);
		if (restagedState.kind !== 'angular-tiny-translator-browser-proof')
			throw new Error('Angular TinyTranslator staged aggregate does not re-derive');
		await rename(staged, target);
	} catch (error) {
		await unlink(staged).catch(() => undefined);
		throw error;
	}
	return { kind: state.kind, receipts: state.receipts, appended: true };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1) throw new Error('Angular TinyTranslator aggregate append requires one mode');
	const result =
		args[0] === '--append'
			? await appendAngularTinyTranslatorAggregateMembers()
			: args[0] === '--verify-only'
				? await (async () => {
						const aggregate = record(
							JSON.parse(await readFile(aggregatePath, 'utf8')),
							'document',
						);
						if (!Array.isArray(aggregate.fixtures))
							throw new Error('Angular TinyTranslator aggregate shape differs');
						const state = deriveCorpusTransactionState(
							aggregate.fixtures.map((item) => record(item, 'member')),
						);
						if (!APPENDED_KINDS.has(state.kind))
							throw new Error('Angular TinyTranslator aggregate membership is absent');
						return { kind: state.kind, receipts: state.receipts, appended: false };
					})()
				: (() => {
						throw new Error('Angular TinyTranslator aggregate append mode differs');
					})();
	process.stdout.write(`${JSON.stringify({ result: 'pass', ...result })}\n`);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-aggregate-append.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
