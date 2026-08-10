import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import {
	canonicalize,
	deriveCorpusTransactionState,
	parseWitnessReactBoilerplateReceipt,
	REACT_BOILERPLATE_CANONICAL_DIGEST,
	REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH,
	REACT_BOILERPLATE_CANONICAL_SHA256,
	REACT_BOILERPLATE_SOURCE,
	renderWitnessReactBoilerplateReceipt,
	sha256,
	WITNESS_REACT_BOILERPLATE_MUTATION,
	WITNESS_REACT_BOILERPLATE_SCHEMA,
	witnessReactBoilerplateAggregateMember,
	witnessReactBoilerplateBehaviorDigest,
	witnessReactBoilerplateDigest,
	witnessReactBoilerplateRawSemanticDigest,
	type WitnessReactBoilerplateReceipt,
	type WitnessReactBoilerplateRun,
} from '../../../core/src/index.ts';
import { executeReactBoilerplateWitnessRun } from './real-app-run.ts';
import { verifyLinkedWitnessProvenance } from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const stageRoot = join(root, '.versionless/stage/witness-react-boilerplate');
const sources = {
	baseline: join(root, '.versionless/work/react-boilerplate-v4-composed/legacy/build'),
	migrated: join(root, '.versionless/work/react-boilerplate-v4-composed/target/build-vite'),
} as const;

async function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

async function stageInputs(): Promise<Record<'baseline' | 'migrated', string>> {
	const lanes = join(stageRoot, 'lanes');
	await rm(lanes, { recursive: true, force: true });
	const result = { baseline: join(lanes, 'baseline'), migrated: join(lanes, 'migrated') };
	for (const lane of ['baseline', 'migrated'] as const) {
		if (!(await exists(sources[lane])))
			throw new Error(`React Boilerplate retained ${lane} production output is absent`);
		await mkdir(result[lane], { recursive: true });
		await cp(sources[lane], result[lane], { recursive: true, force: false });
	}
	return result;
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
): Promise<WitnessReactBoilerplateRun[]> {
	const runs: WitnessReactBoilerplateRun[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const run = await executeReactBoilerplateWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'witness-receipts'),
			});
			if (run.semanticDigest !== witnessReactBoilerplateRawSemanticDigest(run))
				throw new Error(`React Boilerplate ${lane} pass ${pass} raw digest differs`);
			runs.push({ ...run, behaviorDigest: witnessReactBoilerplateBehaviorDigest(run) });
		}
	return runs;
}

async function mutationProof(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessReactBoilerplateReceipt['mutation']> {
	const target = join(laneRoot, WITNESS_REACT_BOILERPLATE_MUTATION.path);
	const before = await readFile(target);
	const source = Buffer.from(WITNESS_REACT_BOILERPLATE_MUTATION.sourceSpan);
	const replacement = Buffer.from(WITNESS_REACT_BOILERPLATE_MUTATION.mutatedSpan);
	if (
		before.length !== 420_324 ||
		sha256(before) !== WITNESS_REACT_BOILERPLATE_MUTATION.beforeSha256 ||
		source.length !== WITNESS_REACT_BOILERPLATE_MUTATION.bytes ||
		replacement.length !== WITNESS_REACT_BOILERPLATE_MUTATION.bytes ||
		before.indexOf(source) !== WITNESS_REACT_BOILERPLATE_MUTATION.offset ||
		before.lastIndexOf(source) !== WITNESS_REACT_BOILERPLATE_MUTATION.offset
	)
		throw new Error(
			'React Boilerplate mutation target path, size, span, offset or hash differs',
		);
	const mutated = Buffer.from(before);
	replacement.copy(mutated, WITNESS_REACT_BOILERPLATE_MUTATION.offset);
	if (
		sha256(mutated) !== WITNESS_REACT_BOILERPLATE_MUTATION.mutatedSha256 ||
		mutated.indexOf(source) !== -1 ||
		mutated.indexOf(replacement) !== WITNESS_REACT_BOILERPLATE_MUTATION.offset ||
		mutated.lastIndexOf(replacement) !== WITNESS_REACT_BOILERPLATE_MUTATION.offset
	)
		throw new Error('React Boilerplate exact mutated German heading bytes differ');
	let intendedFailure = false;
	try {
		await writeFile(target, mutated);
		try {
			await executeReactBoilerplateWitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'mutation-red-receipt'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(
				'expected the page body text to contain "Beginnen Sie Ihr nächstes React Projekt in Sekunden", but it never did',
			);
		}
	} finally {
		await writeFile(target, before);
	}
	const restoredSha256 = sha256(await readFile(target));
	if (!intendedFailure || restoredSha256 !== WITNESS_REACT_BOILERPLATE_MUTATION.beforeSha256)
		throw new Error('React Boilerplate mutation was not exact semantic red and restored');
	const restored = await executeReactBoilerplateWitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'restoration-receipt'),
	});
	if (restored.semanticDigest !== witnessReactBoilerplateRawSemanticDigest(restored))
		throw new Error('React Boilerplate restored raw digest differs');
	const restoredBehaviorDigest = witnessReactBoilerplateBehaviorDigest(restored);
	if (restoredBehaviorDigest !== behaviorDigest)
		throw new Error('React Boilerplate restored full parity differs');
	return {
		seam: 'production-static-german-heading',
		failure: 'witness-semantic-assertion',
		path: WITNESS_REACT_BOILERPLATE_MUTATION.path,
		offset: WITNESS_REACT_BOILERPLATE_MUTATION.offset,
		bytes: WITNESS_REACT_BOILERPLATE_MUTATION.bytes,
		sourceSpan: WITNESS_REACT_BOILERPLATE_MUTATION.sourceSpan,
		mutatedSpan: WITNESS_REACT_BOILERPLATE_MUTATION.mutatedSpan,
		failureAssertion: WITNESS_REACT_BOILERPLATE_MUTATION.failureAssertion,
		intendedFailure: true,
		beforeSha256: WITNESS_REACT_BOILERPLATE_MUTATION.beforeSha256,
		mutatedSha256: WITNESS_REACT_BOILERPLATE_MUTATION.mutatedSha256,
		afterRestoreSha256: restoredSha256,
		restoredByteIdentically: true,
		restoredRun: 'pass',
		restoredBehaviorDigest,
	};
}

export async function publishWitnessReactBoilerplateTransaction(options: {
	output: string;
	aggregatePath: string;
	receipt: WitnessReactBoilerplateReceipt;
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
	const receiptJson = `${canonicalize(options.receipt)}\n`;
	const receiptMarkdown = renderWitnessReactBoilerplateReceipt(options.receipt);
	await writeFile(join(stagedOutput, 'receipt.json'), receiptJson, { flag: 'wx' });
	await writeFile(join(stagedOutput, 'receipt.md'), receiptMarkdown, { flag: 'wx' });
	parseWitnessReactBoilerplateReceipt(JSON.parse(receiptJson));

	const aggregate = JSON.parse(await readFile(options.aggregatePath, 'utf8')) as {
		schemaVersion?: unknown;
		fixtures?: unknown;
		unsupported?: unknown;
	};
	const current = deriveCorpusTransactionState(aggregate.fixtures);
	if (
		current.kind !== 'production-readiness' &&
		current.kind !== 'react-candidate' &&
		current.kind !== 'next-candidate' &&
		current.kind !== 'react-zero-sw-reconciliation'
	)
		throw new Error('React Boilerplate Witness publication requires all predecessors');
	if (!Array.isArray(aggregate.fixtures))
		throw new Error('React Boilerplate Witness aggregate fixtures are absent');
	const expected = witnessReactBoilerplateAggregateMember(
		options.receipt.integrity.canonicalDigest,
	);
	const fixtures = aggregate.fixtures as Array<Record<string, unknown>>;
	const existingIndex = fixtures.findIndex(
		(item) => item.receipt === expected.receipt || item.id === expected.id,
	);
	const nextFixtures = [...fixtures];
	if (existingIndex >= 0) {
		const expectedIndex =
			current.kind === 'react-zero-sw-reconciliation'
				? nextFixtures.length - 4
				: current.kind === 'next-candidate'
					? nextFixtures.length - 2
					: nextFixtures.length - 1;
		if (existingIndex !== expectedIndex)
			throw new Error('React Boilerplate Witness aggregate order differs');
		nextFixtures[existingIndex] = expected;
	} else nextFixtures.push(expected);
	const integrated = { ...aggregate, fixtures: nextFixtures };
	const expectedKind =
		current.kind === 'react-zero-sw-reconciliation'
			? 'react-zero-sw-reconciliation'
			: current.kind === 'next-candidate'
				? 'next-candidate'
				: 'react-candidate';
	if (deriveCorpusTransactionState(integrated.fixtures).kind !== expectedKind)
		throw new Error('React Boilerplate Witness staged aggregate state differs');
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
		const published = parseWitnessReactBoilerplateReceipt(
			JSON.parse(await readFile(join(options.output, 'receipt.json'), 'utf8')),
		);
		if (
			published.integrity.canonicalDigest !== options.receipt.integrity.canonicalDigest ||
			(await readFile(join(options.output, 'receipt.md'), 'utf8')) !== receiptMarkdown ||
			deriveCorpusTransactionState(
				(
					JSON.parse(await readFile(options.aggregatePath, 'utf8')) as {
						fixtures?: unknown;
					}
				).fixtures,
			).kind !== expectedKind
		)
			throw new Error('React Boilerplate Witness published transaction differs');
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

export async function runWitnessReactBoilerplate(
	output: string,
): Promise<WitnessReactBoilerplateReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('React Boilerplate Witness run requires dual offline controls');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const lanes = await stageInputs();
	await rm(join(stageRoot, 'witness-receipts'), { recursive: true, force: true });
	const runs = await executeRuns(lanes);
	const behaviorDigest = runs[0]!.behaviorDigest;
	const mutation = await mutationProof(lanes.migrated, behaviorDigest);
	const canonicalBytes = await readFile(join(root, REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH));
	if (sha256(canonicalBytes) !== REACT_BOILERPLATE_CANONICAL_SHA256)
		throw new Error('React Boilerplate canonical receipt bytes silently rebound');
	const canonicalReceipt = JSON.parse(canonicalBytes.toString('utf8')) as {
		integrity?: { canonicalDigest?: string };
	};
	if (canonicalReceipt.integrity?.canonicalDigest !== REACT_BOILERPLATE_CANONICAL_DIGEST)
		throw new Error('React Boilerplate canonical receipt digest silently rebound');
	const receipt: WitnessReactBoilerplateReceipt = {
		schemaVersion: WITNESS_REACT_BOILERPLATE_SCHEMA,
		result: 'pass',
		fixture: 'react-boilerplate-v4-composed',
		source: REACT_BOILERPLATE_SOURCE,
		provenance,
		canonicalReceipt: {
			path: REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH,
			canonicalDigest: REACT_BOILERPLATE_CANONICAL_DIGEST,
			sha256: REACT_BOILERPLATE_CANONICAL_SHA256,
		},
		runs,
		mutation,
		readiness: {
			reactLineage: { ready: 0, total: 4, counted: false },
			angularLineage: { ready: 1, total: 4 },
			harness: { ready: 0, total: 4 },
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: [
			'One immutable React Boilerplate lineage is a candidate only and does not establish generic React support or advance readiness before Judge audit.',
			'API fulfillment is synthetic and online-only; API caching, Redux persistence and prior-result persistence are not claimed.',
			'Drag is not-tested because the selected journey has no genuine drag surface.',
			'Locality is process-scoped and does not establish OS-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessReactBoilerplateDigest(receipt);
	parseWitnessReactBoilerplateReceipt(receipt);
	await publishWitnessReactBoilerplateTransaction({
		output,
		aggregatePath: join(root, 'evidence/runs/aggregate.json'),
		receipt,
	});
	return receipt;
}

export async function verifyWitnessReactBoilerplate(
	output: string,
): Promise<WitnessReactBoilerplateReceipt> {
	const expectedProvenance = await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessReactBoilerplateReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	if (canonicalize(receipt.provenance) !== canonicalize(expectedProvenance))
		throw new Error('React Boilerplate Witness local provenance differs');
	const canonicalBytes = await readFile(join(root, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('React Boilerplate Witness canonical receipt bytes drifted');
	if (
		(await readFile(join(output, 'receipt.md'), 'utf8')) !==
		renderWitnessReactBoilerplateReceipt(receipt)
	)
		throw new Error('React Boilerplate Witness human receipt differs');
	const serialized = JSON.stringify(receipt);
	if (serialized.includes(root) || serialized.includes(process.env.USER ?? ''))
		throw new Error('React Boilerplate Witness receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const receipt = await runWitnessReactBoilerplate(resolve(root, args[publishIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessReactBoilerplate(resolve(root, args[verifyIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error(
		'React Boilerplate Witness runner requires --run-twice --publish <dir> or --verify <dir>',
	);
}

if (process.argv[1]?.endsWith('react-boilerplate-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
