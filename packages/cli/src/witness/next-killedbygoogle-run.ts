import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import {
	canonicalize,
	deriveCorpusTransactionState,
	NEXT_KILLED_BY_GOOGLE_CANONICAL_DIGEST,
	NEXT_KILLED_BY_GOOGLE_CANONICAL_RECEIPT_PATH,
	NEXT_KILLED_BY_GOOGLE_SOURCE,
	parseWitnessNextKilledByGoogleReceipt,
	renderWitnessNextKilledByGoogleReceipt,
	sha256,
	WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION,
	WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER,
	WITNESS_NEXT_KILLED_BY_GOOGLE_SCHEMA,
	witnessNextKilledByGoogleAggregateMember,
	witnessNextKilledByGoogleBehaviorDigest,
	witnessNextKilledByGoogleDigest,
	witnessNextKilledByGoogleRawSemanticDigest,
	type WitnessNextKilledByGoogleReceipt,
	type WitnessNextKilledByGoogleRun,
	type WitnessNextPrerenderPayloadEvidence,
} from '../../../core/src/index.ts';
import { executeNextKilledByGoogleWitnessRun } from './real-app-run.ts';
import { verifyLinkedWitnessProvenance } from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const stageRoot = join(root, '.versionless/stage/witness-next-killedbygoogle');
const sources = {
	baseline: join(root, '.versionless/stage/witness-real-app/killedbygoogle-retained/baseline'),
	migrated: join(root, '.versionless/stage/witness-real-app/killedbygoogle-retained/migrated'),
} as const;
const buildSources = {
	baseline: join(
		root,
		'.versionless/stage/witness-real-app/killedbygoogle-retained/baseline-source/.next',
	),
	migrated: join(
		root,
		'.versionless/stage/witness-real-app/killedbygoogle-retained/migrated-source/.next',
	),
} as const;
type NextPrerenderPayloadInput = Omit<
	Extract<WitnessNextPrerenderPayloadEvidence, { state: 'exact-lane-bound-next-prerender' }>,
	'response'
>;
type StagedInputs = {
	lanes: Record<'baseline' | 'migrated', string>;
	support: Record<'baseline' | 'migrated', NextPrerenderPayloadInput>;
};

async function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

function exactPayloadShape(bytes: Buffer): boolean {
	const value = JSON.parse(bytes.toString('utf8')) as unknown;
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		canonicalize(Object.keys(value).sort()) ===
			canonicalize(WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.keys)
	);
}

export async function stageNextKilledByGoogleInputs(targetRoot = stageRoot): Promise<StagedInputs> {
	const lanes = join(targetRoot, 'lanes');
	await rm(lanes, { recursive: true, force: true });
	const result = { baseline: join(lanes, 'baseline'), migrated: join(lanes, 'migrated') };
	const support = {} as StagedInputs['support'];
	for (const lane of ['baseline', 'migrated'] as const) {
		if (!(await exists(sources[lane])) || !(await exists(buildSources[lane])))
			throw new Error(`KilledByGoogle retained ${lane} production output is absent`);
		const expected = WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER[lane];
		const buildIdBytes = await readFile(join(buildSources[lane], 'BUILD_ID'));
		const buildId = buildIdBytes.toString('utf8');
		const retainedIndex = await readFile(join(sources[lane], 'index.html'));
		const manifestBytes = await readFile(join(buildSources[lane], 'prerender-manifest.json'));
		const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
			routes?: Record<string, { dataRoute?: unknown }>;
		};
		const sourcePayloadPath = join(buildSources[lane], 'server/pages/index.json');
		const sourcePayload = await readFile(sourcePayloadPath);
		if (
			buildId !== expected.buildId ||
			sha256(buildIdBytes) !== expected.buildIdSha256 ||
			sha256(retainedIndex) !== expected.retainedIndexSha256 ||
			!retainedIndex.toString('utf8').includes(expected.buildId) ||
			sha256(manifestBytes) !== expected.prerenderManifestSha256 ||
			manifest.routes?.['/']?.dataRoute !== expected.dataRoute ||
			sourcePayload.length !== WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.bytes ||
			sha256(sourcePayload) !== WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.sha256 ||
			!exactPayloadShape(sourcePayload)
		)
			throw new Error(`KilledByGoogle retained ${lane} prerender binding differs`);
		await mkdir(result[lane], { recursive: true });
		await cp(sources[lane], result[lane], { recursive: true, force: false });
		const stagedPayloadPath = join(result[lane], expected.stagedPath);
		await mkdir(dirname(stagedPayloadPath), { recursive: true });
		await writeFile(stagedPayloadPath, sourcePayload, { flag: 'wx' });
		const stagedPayload = await readFile(stagedPayloadPath);
		if (
			stagedPayload.length !== WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.bytes ||
			sha256(stagedPayload) !== WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.sha256 ||
			!exactPayloadShape(stagedPayload)
		)
			throw new Error(`KilledByGoogle staged ${lane} prerender payload differs`);
		support[lane] = {
			state: 'exact-lane-bound-next-prerender',
			lane,
			...expected,
			payload: {
				bytes: WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.bytes,
				sha256: WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.sha256,
				keys: [...WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.keys],
			},
		};
	}
	return { lanes: result, support };
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
	support: Record<'baseline' | 'migrated', NextPrerenderPayloadInput>,
): Promise<WitnessNextKilledByGoogleRun[]> {
	const runs: WitnessNextKilledByGoogleRun[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const run = await executeNextKilledByGoogleWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'witness-receipts'),
				nextPrerenderPayload: support[lane],
			});
			if (run.semanticDigest !== witnessNextKilledByGoogleRawSemanticDigest(run))
				throw new Error(`KilledByGoogle ${lane} pass ${pass} raw digest differs`);
			runs.push({ ...run, behaviorDigest: witnessNextKilledByGoogleBehaviorDigest(run) });
		}
	return runs;
}

async function mutationProof(
	laneRoot: string,
	behaviorDigest: string,
	support: NextPrerenderPayloadInput,
): Promise<WitnessNextKilledByGoogleReceipt['mutation']> {
	const target = join(laneRoot, WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.path);
	const before = await readFile(target);
	const source = Buffer.from(WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.sourceSpan, 'utf8');
	const replacement = Buffer.from(WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.mutatedSpan, 'utf8');
	const offsets: number[] = [];
	for (
		let offset = before.indexOf(source);
		offset >= 0;
		offset = before.indexOf(source, offset + 1)
	)
		offsets.push(offset);
	if (
		before.length !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.bytes ||
		sha256(before) !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.beforeSha256 ||
		source.length !== 7 ||
		replacement.length !== 7 ||
		canonicalize(offsets) !== canonicalize(WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.offsets)
	)
		throw new Error(
			'KilledByGoogle mutation file length, hash, spans or Buffer offsets differ',
		);
	const mutated = Buffer.from(before);
	for (const offset of offsets) replacement.copy(mutated, offset);
	if (
		sha256(mutated) !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.mutatedSha256 ||
		mutated.indexOf(source) !== -1
	)
		throw new Error('KilledByGoogle exact four-span mutated bytes differ');
	let intendedFailure = false;
	try {
		await writeFile(target, mutated);
		try {
			await executeNextKilledByGoogleWitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'mutation-red-receipt'),
				nextPrerenderPayload: support,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(
				'expected the page body text to contain "Google+", but it never did',
			);
		}
	} finally {
		await writeFile(target, before);
	}
	const restoredSha256 = sha256(await readFile(target));
	if (!intendedFailure || restoredSha256 !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.beforeSha256)
		throw new Error('KilledByGoogle mutation was not assertion-only red and restored');
	const restored = await executeNextKilledByGoogleWitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'restoration-receipt'),
		nextPrerenderPayload: support,
	});
	if (restored.semanticDigest !== witnessNextKilledByGoogleRawSemanticDigest(restored))
		throw new Error('KilledByGoogle restored raw digest differs');
	const restoredBehaviorDigest = witnessNextKilledByGoogleBehaviorDigest(restored);
	if (restoredBehaviorDigest !== behaviorDigest)
		throw new Error('KilledByGoogle restored full parity differs');
	return {
		seam: 'production-static-four-google-plus-spans',
		failure: 'witness-semantic-assertion',
		path: 'index.html',
		bytes: 291003,
		offsets,
		sourceSpan: 'Google+',
		mutatedSpan: 'Googlx+',
		failureAssertion: 'page.bodyText contains "Google+"',
		intendedFailure: true,
		unrelatedErrors: 0,
		beforeSha256: WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.beforeSha256,
		mutatedSha256: WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.mutatedSha256,
		afterRestoreSha256: restoredSha256,
		restoredByteIdentically: true,
		restoredRun: 'pass',
		restoredBehaviorDigest,
	};
}

export async function publishWitnessNextKilledByGoogleTransaction(options: {
	output: string;
	aggregatePath: string;
	receipt: WitnessNextKilledByGoogleReceipt;
	transactionStageRoot?: string;
	verifyPublished?: () => Promise<void>;
}): Promise<void> {
	const transactionRoot = options.transactionStageRoot ?? join(stageRoot, 'publication');
	const stagedOutput = join(transactionRoot, 'receipt');
	const stagedAggregate = join(transactionRoot, 'aggregate.json');
	const priorOutput = join(transactionRoot, 'receipt.previous');
	const priorAggregate = join(transactionRoot, 'aggregate.previous.json');
	await rm(transactionRoot, { recursive: true, force: true });
	await mkdir(stagedOutput, { recursive: true });
	const json = `${canonicalize(options.receipt)}\n`;
	const markdown = renderWitnessNextKilledByGoogleReceipt(options.receipt);
	await writeFile(join(stagedOutput, 'receipt.json'), json, { flag: 'wx' });
	await writeFile(join(stagedOutput, 'receipt.md'), markdown, { flag: 'wx' });
	parseWitnessNextKilledByGoogleReceipt(JSON.parse(json));
	const aggregate = JSON.parse(await readFile(options.aggregatePath, 'utf8')) as {
		fixtures?: unknown;
		[key: string]: unknown;
	};
	const current = deriveCorpusTransactionState(aggregate.fixtures);
	if (current.kind !== 'react-candidate' && current.kind !== 'next-candidate')
		throw new Error('KilledByGoogle Witness publication requires exact 13 predecessors');
	if (!Array.isArray(aggregate.fixtures)) throw new Error('KilledByGoogle fixtures are absent');
	const expected = witnessNextKilledByGoogleAggregateMember(
		options.receipt.integrity.canonicalDigest,
	);
	const fixtures = aggregate.fixtures as Array<Record<string, unknown>>;
	const existing = fixtures.findIndex(
		(item) => item.id === expected.id || item.receipt === expected.receipt,
	);
	const next = [...fixtures];
	if (existing >= 0) {
		if (existing !== next.length - 1) throw new Error('KilledByGoogle Witness order differs');
		next[existing] = expected;
	} else next.push(expected);
	const integrated = { ...aggregate, fixtures: next };
	if (deriveCorpusTransactionState(integrated.fixtures).kind !== 'next-candidate')
		throw new Error('KilledByGoogle Witness staged aggregate differs');
	await writeFile(stagedAggregate, `${JSON.stringify(integrated, null, 2)}\n`, { flag: 'wx' });
	await mkdir(dirname(options.output), { recursive: true });
	const hadOutput = await exists(options.output);
	let aggregateBackedUp = false;
	try {
		if (hadOutput) await rename(options.output, priorOutput);
		await rename(options.aggregatePath, priorAggregate);
		aggregateBackedUp = true;
		await rename(stagedOutput, options.output);
		await rename(stagedAggregate, options.aggregatePath);
		if (
			parseWitnessNextKilledByGoogleReceipt(
				JSON.parse(await readFile(join(options.output, 'receipt.json'), 'utf8')),
			).integrity.canonicalDigest !== options.receipt.integrity.canonicalDigest ||
			(await readFile(join(options.output, 'receipt.md'), 'utf8')) !== markdown ||
			deriveCorpusTransactionState(
				(
					JSON.parse(await readFile(options.aggregatePath, 'utf8')) as {
						fixtures?: unknown;
					}
				).fixtures,
			).kind !== 'next-candidate'
		)
			throw new Error('KilledByGoogle Witness published transaction differs');
		await options.verifyPublished?.();
		await rm(transactionRoot, { recursive: true, force: true });
	} catch (error) {
		await rm(options.output, { recursive: true, force: true });
		if (hadOutput && (await exists(priorOutput))) await rename(priorOutput, options.output);
		if (aggregateBackedUp) {
			await rm(options.aggregatePath, { force: true });
			await rename(priorAggregate, options.aggregatePath);
		}
		await rm(transactionRoot, { recursive: true, force: true });
		throw error;
	}
}

export async function runWitnessNextKilledByGoogle(
	output: string,
): Promise<WitnessNextKilledByGoogleReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('KilledByGoogle Witness run requires dual offline controls');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const staged = await stageNextKilledByGoogleInputs();
	const runs = await executeRuns(staged.lanes, staged.support);
	const mutation = await mutationProof(
		staged.lanes.migrated,
		runs[0]!.behaviorDigest,
		staged.support.migrated,
	);
	const canonicalBytes = await readFile(join(root, NEXT_KILLED_BY_GOOGLE_CANONICAL_RECEIPT_PATH));
	const canonical = JSON.parse(canonicalBytes.toString('utf8')) as {
		integrity?: { canonicalDigest?: string };
	};
	if (canonical.integrity?.canonicalDigest !== NEXT_KILLED_BY_GOOGLE_CANONICAL_DIGEST)
		throw new Error('KilledByGoogle canonical receipt silently rebound');
	const receipt: WitnessNextKilledByGoogleReceipt = {
		schemaVersion: WITNESS_NEXT_KILLED_BY_GOOGLE_SCHEMA,
		result: 'pass',
		fixture: 'next-killedbygoogle-derived-state-to-memo',
		source: NEXT_KILLED_BY_GOOGLE_SOURCE,
		provenance,
		canonicalReceipt: {
			path: NEXT_KILLED_BY_GOOGLE_CANONICAL_RECEIPT_PATH,
			canonicalDigest: NEXT_KILLED_BY_GOOGLE_CANONICAL_DIGEST,
			sha256: sha256(canonicalBytes),
		},
		runs,
		mutation,
		readiness: {
			reactLineage: { ready: 1, total: 4 },
			angularLineage: { ready: 1, total: 4 },
			olderNext: { ready: 0, total: 4, counted: false },
			harness: { ready: 0, total: 4 },
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: [
			'One immutable Next 12 Pages fixture is a candidate only and does not establish generic Next support or advance older Next readiness before Judge audit.',
			'Empty navigation events reflect the raw Witness record; an initial route was not synthesized.',
			'Drag is not-tested because the selected journey has no genuine drag surface.',
			'Locality is process-scoped and does not establish OS-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessNextKilledByGoogleDigest(receipt);
	parseWitnessNextKilledByGoogleReceipt(receipt);
	await publishWitnessNextKilledByGoogleTransaction({
		output,
		aggregatePath: join(root, 'evidence/runs/aggregate.json'),
		receipt,
	});
	return receipt;
}

export async function verifyWitnessNextKilledByGoogle(
	output: string,
): Promise<WitnessNextKilledByGoogleReceipt> {
	const provenance = await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessNextKilledByGoogleReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	if (canonicalize(receipt.provenance) !== canonicalize(provenance))
		throw new Error('KilledByGoogle Witness local provenance differs');
	if (
		sha256(await readFile(join(root, receipt.canonicalReceipt.path))) !==
		receipt.canonicalReceipt.sha256
	)
		throw new Error('KilledByGoogle Witness canonical receipt bytes drifted');
	if (
		(await readFile(join(output, 'receipt.md'), 'utf8')) !==
		renderWitnessNextKilledByGoogleReceipt(receipt)
	)
		throw new Error('KilledByGoogle Witness human receipt differs');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const receipt = await runWitnessNextKilledByGoogle(resolve(root, args[publishIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessNextKilledByGoogle(
			resolve(root, args[verifyIndex + 1]!),
		);
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error(
		'KilledByGoogle Witness runner requires --run-twice --publish <dir> or --verify <dir>',
	);
}

if (process.argv[1]?.endsWith('next-killedbygoogle-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
