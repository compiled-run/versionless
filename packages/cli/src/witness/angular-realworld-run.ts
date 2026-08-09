import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { box, runBoxes } from '@async/witness';
import { dirname, join, resolve } from 'pathe';
import { joinURL } from 'ufo';
import {
	ANGULAR_REALWORLD_CANONICAL_DIGEST,
	ANGULAR_REALWORLD_CANONICAL_RECEIPT_PATH,
	canonicalize,
	deriveCorpusTransactionState,
	parseWitnessAngularRealworldReceipt,
	renderWitnessAngularRealworldReceipt,
	sha256,
	WITNESS_ANGULAR_REALWORLD_SCHEMA,
	WITNESS_ANGULAR_REALWORLD_MUTATION,
	witnessAngularRealworldBehaviorDigest,
	witnessAngularRealworldRawSemanticDigest,
	witnessAngularRealworldAggregateMember,
	witnessAngularRealworldDigest,
	type WitnessAngularRealworldReceipt,
	type WitnessAngularRealworldRun,
} from '../../../core/src/index.ts';
import { witnessNodeFileSystem } from './node-filesystem.ts';
import { createPlaywrightWitnessHost } from './playwright-host.ts';
import { executeAngularRealworldWitnessRun, startStaticServer } from './real-app-run.ts';
import { verifyLinkedWitnessProvenance } from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const stageRoot = join(root, '.versionless/stage/witness-angular-realworld');
const chromiumExecutable = join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const sources = {
	baseline: join(root, '.versionless/work/angular-realworld-v15-to-v16/dist/legacy'),
	migrated: join(root, '.versionless/work/angular-realworld-v15-to-v16/dist/target'),
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
			throw new Error(`Angular RealWorld retained ${lane} production output is absent`);
		await mkdir(result[lane], { recursive: true });
		await cp(sources[lane], result[lane], { recursive: true, force: false });
	}
	return result;
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
): Promise<WitnessAngularRealworldRun[]> {
	const runs: WitnessAngularRealworldRun[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const run = await executeAngularRealworldWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'witness-receipts'),
			});
			if (run.semanticDigest !== witnessAngularRealworldRawSemanticDigest(run))
				throw new Error(`Angular RealWorld ${lane} pass ${pass} raw digest differs`);
			runs.push({ ...run, behaviorDigest: witnessAngularRealworldBehaviorDigest(run) });
		}
	return runs;
}

async function mutationProof(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessAngularRealworldReceipt['mutation']> {
	const file = join(laneRoot, 'index.html');
	const before = await readFile(file);
	if (sha256(before) !== WITNESS_ANGULAR_REALWORLD_MUTATION.beforeSha256)
		throw new Error('Angular RealWorld mutation target index hash differs');
	const source = Buffer.from(WITNESS_ANGULAR_REALWORLD_MUTATION.sourceSpan);
	const replacement = Buffer.from(WITNESS_ANGULAR_REALWORLD_MUTATION.mutatedSpan);
	const offset = before.indexOf(source);
	if (offset < 0 || before.lastIndexOf(source) !== offset)
		throw new Error('Angular RealWorld bootstrap-root mutation span is not unique');
	const mutated = Buffer.concat([
		before.subarray(0, offset),
		replacement,
		before.subarray(offset + source.length),
	]);
	const mutatedOffset = mutated.indexOf(replacement);
	if (
		sha256(mutated) !== WITNESS_ANGULAR_REALWORLD_MUTATION.mutatedSha256 ||
		mutated.indexOf(source) !== -1 ||
		mutatedOffset < 0 ||
		mutated.lastIndexOf(replacement) !== mutatedOffset
	)
		throw new Error('Angular RealWorld exact mutated bootstrap bytes differ');
	let intendedFailure = false;
	try {
		await writeFile(file, mutated);
		const staticServer = await startStaticServer(laneRoot);
		const host = createPlaywrightWitnessHost({
			chromiumExecutable,
			transport: async () => ({
				action: 'fulfill',
				status: 204,
				contentType: 'text/plain',
				body: Buffer.alloc(0),
			}),
		});
		const definition = box('angular-realworld-mutation-red', async (context) => {
			const page = await context.browser.visit(joinURL(staticServer.origin, '/'));
			await context.expect.page.bodyText(page, { contains: 'Global Feed' });
		});
		let result: Awaited<ReturnType<typeof runBoxes>>;
		try {
			result = await runBoxes({
				root: laneRoot,
				boxes: [
					{
						file: join(laneRoot, 'versionless-mutation.box.ts'),
						relativeFile: 'versionless-mutation.box.ts',
						exportName: 'default',
						box: definition,
					},
				],
				receiptDir: join(stageRoot, 'witness-receipts', 'mutation-red'),
				assertionTimeoutMs: 1_000,
				fileSystem: witnessNodeFileSystem,
				browser: host.browser,
				headless: true,
			});
		} finally {
			await staticServer.close();
		}
		staticServer.assertClean();
		const failureMessage = result.boxes[0]?.error?.message ?? '';
		intendedFailure =
			result.status === 'failed' &&
			failureMessage.startsWith(
				'expected the page body text to contain "Global Feed", but it never did',
			);
	} finally {
		await writeFile(file, before);
	}
	const restoredSha256 = sha256(await readFile(file));
	if (!intendedFailure || restoredSha256 !== WITNESS_ANGULAR_REALWORLD_MUTATION.beforeSha256)
		throw new Error('Angular RealWorld mutation was not red and restored byte-identically');
	const restored = await executeAngularRealworldWitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'restoration-receipt'),
	});
	const restoredBehaviorDigest = witnessAngularRealworldBehaviorDigest(restored);
	if (restoredBehaviorDigest !== behaviorDigest)
		throw new Error('Angular RealWorld restored run behavior differs');
	return {
		seam: 'production-static-angular-bootstrap-root',
		failure: 'witness-semantic-assertion',
		sourceSpan: WITNESS_ANGULAR_REALWORLD_MUTATION.sourceSpan,
		mutatedSpan: WITNESS_ANGULAR_REALWORLD_MUTATION.mutatedSpan,
		failureAssertion: WITNESS_ANGULAR_REALWORLD_MUTATION.failureAssertion,
		intendedFailure: true,
		beforeSha256: WITNESS_ANGULAR_REALWORLD_MUTATION.beforeSha256,
		mutatedSha256: WITNESS_ANGULAR_REALWORLD_MUTATION.mutatedSha256,
		afterRestoreSha256: restoredSha256,
		restoredByteIdentically: true,
		restoredRun: 'pass',
		restoredBehaviorDigest,
	};
}

export async function publishWitnessAngularRealworldTransaction(options: {
	output: string;
	aggregatePath: string;
	receipt: WitnessAngularRealworldReceipt;
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
	const receiptMarkdown = renderWitnessAngularRealworldReceipt(options.receipt);
	await writeFile(join(stagedOutput, 'receipt.json'), receiptJson, { flag: 'wx' });
	await writeFile(join(stagedOutput, 'receipt.md'), receiptMarkdown, { flag: 'wx' });
	parseWitnessAngularRealworldReceipt(JSON.parse(receiptJson));

	const aggregate = JSON.parse(await readFile(options.aggregatePath, 'utf8')) as {
		schemaVersion?: unknown;
		fixtures?: unknown;
		unsupported?: unknown;
	};
	const current = deriveCorpusTransactionState(aggregate.fixtures);
	if (
		current.kind !== 'postintegration' &&
		current.kind !== 'production-readiness' &&
		current.kind !== 'react-candidate' &&
		current.kind !== 'next-candidate'
	)
		throw new Error(
			'Angular RealWorld Witness publication requires Angular and Next predecessors',
		);
	if (!Array.isArray(aggregate.fixtures))
		throw new Error('Angular RealWorld Witness aggregate fixtures are absent');
	const expected = witnessAngularRealworldAggregateMember(
		options.receipt.integrity.canonicalDigest,
	);
	const fixtures = aggregate.fixtures as Array<Record<string, unknown>>;
	const existingIndex = fixtures.findIndex(
		(item) => item.receipt === expected.receipt || item.id === expected.id,
	);
	const nextFixtures = [...fixtures];
	if (existingIndex >= 0) nextFixtures[existingIndex] = expected;
	else {
		const angularIndex = nextFixtures.findIndex(
			(item) => item.id === 'angular-realworld-v15-to-v16',
		);
		if (angularIndex < 0)
			throw new Error('Angular RealWorld Witness Angular predecessor is absent');
		nextFixtures.splice(angularIndex + 1, 0, expected);
	}
	const integrated = { ...aggregate, fixtures: nextFixtures };
	const expectedKind =
		current.kind === 'next-candidate'
			? 'next-candidate'
			: current.kind === 'react-candidate'
				? 'react-candidate'
				: 'production-readiness';
	if (deriveCorpusTransactionState(integrated.fixtures).kind !== expectedKind)
		throw new Error('Angular RealWorld Witness staged aggregate state differs');
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
		const publishedReceipt = parseWitnessAngularRealworldReceipt(
			JSON.parse(await readFile(join(options.output, 'receipt.json'), 'utf8')),
		);
		if (
			publishedReceipt.integrity.canonicalDigest !==
				options.receipt.integrity.canonicalDigest ||
			(await readFile(join(options.output, 'receipt.md'), 'utf8')) !== receiptMarkdown ||
			deriveCorpusTransactionState(
				(
					JSON.parse(await readFile(options.aggregatePath, 'utf8')) as {
						fixtures?: unknown;
					}
				).fixtures,
			).kind !== expectedKind
		)
			throw new Error('Angular RealWorld Witness published transaction verification differs');
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

export async function runWitnessAngularRealworld(
	output: string,
): Promise<WitnessAngularRealworldReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular RealWorld Witness run requires dual offline controls');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const lanes = await stageInputs();
	await rm(join(stageRoot, 'witness-receipts'), { recursive: true, force: true });
	const runs = await executeRuns(lanes);
	const behaviorDigest = runs[0]!.behaviorDigest;
	const mutation = await mutationProof(lanes.migrated, behaviorDigest);
	const canonicalBytes = await readFile(join(root, ANGULAR_REALWORLD_CANONICAL_RECEIPT_PATH));
	const canonicalReceipt = JSON.parse(canonicalBytes.toString('utf8')) as {
		integrity?: { canonicalDigest?: string };
	};
	if (canonicalReceipt.integrity?.canonicalDigest !== ANGULAR_REALWORLD_CANONICAL_DIGEST)
		throw new Error('Angular RealWorld canonical receipt silently rebound');
	const receipt: WitnessAngularRealworldReceipt = {
		schemaVersion: WITNESS_ANGULAR_REALWORLD_SCHEMA,
		result: 'pass',
		fixture: 'angular-realworld-v15-to-v16',
		provenance,
		canonicalReceipt: {
			path: ANGULAR_REALWORLD_CANONICAL_RECEIPT_PATH,
			canonicalDigest: ANGULAR_REALWORLD_CANONICAL_DIGEST,
			sha256: sha256(canonicalBytes),
		},
		runs,
		mutation,
		readiness: {
			angularLineage: { ready: 1, total: 4 },
			harness: { ready: 0, total: 4 },
			phonecat: 'unsupported-visible-transition-not-counted',
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: [
			'One immutable Angular 15-to-16 fixture does not establish generic Angular support, a designated pilot, or readiness beyond the exact lineage cell.',
			'Drag is not-tested because the selected Conduit journey has no genuine drag surface.',
			'Locality is process-scoped and does not establish OS-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessAngularRealworldDigest(receipt);
	parseWitnessAngularRealworldReceipt(receipt);
	await publishWitnessAngularRealworldTransaction({
		output,
		aggregatePath: join(root, 'evidence/runs/aggregate.json'),
		receipt,
	});
	return receipt;
}

export async function verifyWitnessAngularRealworld(
	output: string,
): Promise<WitnessAngularRealworldReceipt> {
	await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessAngularRealworldReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	const canonicalBytes = await readFile(join(root, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('Angular RealWorld Witness canonical receipt bytes drifted');
	const markdown = await readFile(join(output, 'receipt.md'), 'utf8');
	if (markdown !== renderWitnessAngularRealworldReceipt(receipt))
		throw new Error('Angular RealWorld Witness human receipt differs');
	const serialized = JSON.stringify(receipt);
	if (serialized.includes(root) || serialized.includes(process.env.USER ?? ''))
		throw new Error('Angular RealWorld Witness receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const receipt = await runWitnessAngularRealworld(resolve(root, args[publishIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessAngularRealworld(resolve(root, args[verifyIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error(
		'Angular RealWorld Witness runner requires --run-twice --publish <dir> or --verify <dir>',
	);
}

if (process.argv[1]?.endsWith('angular-realworld-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
