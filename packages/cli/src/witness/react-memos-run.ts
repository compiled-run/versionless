import { access, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	parseWitnessReactMemosReceipt,
	REACT_MEMOS_BUILD_LANES_BINDING,
	REACT_MEMOS_BUILD_LANES_BINDING_REASON,
	REACT_MEMOS_BUILD_LANES_PATH,
	REACT_MEMOS_BUILD_LANES_SHA256,
	REACT_MEMOS_ERA_BUILD_DEVIATION,
	REACT_MEMOS_FIXTURE,
	REACT_MEMOS_LANES_UNIT,
	REACT_MEMOS_MIGRATION_CLASS,
	REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST,
	REACT_MEMOS_PROJECTION_LABEL,
	REACT_MEMOS_PROJECTION_SEED_FIXTURE,
	REACT_MEMOS_SEED_AMENDMENT,
	REACT_MEMOS_SOURCE,
	renderWitnessReactMemosReceipt,
	WITNESS_REACT_MEMOS_CONSOLE_ERRORS,
	WITNESS_REACT_MEMOS_FAILED_REQUESTS,
	WITNESS_REACT_MEMOS_ROUTER_ROUTES,
	WITNESS_REACT_MEMOS_SCHEMA,
	WITNESS_REACT_MEMOS_STYLE_PROBES,
	witnessReactMemosBehaviorDigest,
	witnessReactMemosDigest,
	witnessReactMemosRawDigest,
	type WitnessReactMemosMutation,
	type WitnessReactMemosReceipt,
	type WitnessReactMemosRun,
} from '../../../core/src/receipts/witness-react-memos.ts';
import {
	MEMOS_PINNED_REVISION,
	MEMOS_PROJECTION_BEHAVIOR_DIGEST,
	MEMOS_PROJECTION_LABEL,
	MEMOS_SEED,
	MEMOS_SEED_AMENDMENT,
	memosSeedDigest,
	memosSigninValidates,
	MEMOS_OWNER_PASSWORD,
	replayMemosProjectionBehavior,
} from './memos-projection.ts';
import {
	executeReactMemosWitnessRun,
	MEMOS_MUTATION_SEAM,
	reactMemosProjectionLedger,
} from './real-app-run.ts';
import {
	assertLinkedWitnessProvenanceEquivalent,
	verifyLinkedWitnessProvenance,
} from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const fixtureEvidence = join(root, 'evidence/runs/react-memos-v0-1-3');
const witnessEvidence = join(root, 'evidence/runs/witness-react-memos-v0-1-3');
const stageRoot = join(root, '.versionless/stage/witness-react-memos-v0-1-3');
const workRoot = join(root, '.versionless/work/react-memos-v0-1-3');
const buildOutputs = {
	baseline: join(workRoot, 'baseline/dist-run1'),
	migrated: join(workRoot, 'target/dist-vite-run1'),
} as const;

async function exists(path: string): Promise<boolean> {
	return access(path).then(
		() => true,
		() => false,
	);
}

async function files(directory: string): Promise<string[]> {
	const output: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) output.push(...(await files(path)));
		else if (entry.isFile()) output.push(path);
	}
	return output.sort();
}

/**
 * Bind the frozen projection before a browser is launched.
 *
 * Three separate things are checked, and each one can fail on its own: the
 * committed seed fixture still holds the seed this code compiles against, the
 * transcript replay still produces the frozen behaviour digest, and the amended
 * owner pair still passes the validator the pinned `pages/Signin.tsx` runs
 * before it will send anything at all. The third is what the amendment exists
 * for, so it is checked rather than assumed.
 */
async function bindProjection(): Promise<string> {
	const seedBytes = await readFile(join(root, REACT_MEMOS_PROJECTION_SEED_FIXTURE), 'utf8');
	const committed = JSON.parse(seedBytes) as Record<string, unknown> & { sha256?: unknown };
	const { sha256: committedDigest, ...seed } = committed;
	const digest = memosSeedDigest();
	if (canonicalize(seed) !== canonicalize(MEMOS_SEED) || committedDigest !== digest)
		throw new Error('Memos committed projection seed differs from the compiled seed');
	const replay = await replayMemosProjectionBehavior();
	if (
		replay.digest !== MEMOS_PROJECTION_BEHAVIOR_DIGEST ||
		replay.digest !== REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST
	)
		throw new Error('Memos frozen projection behaviour digest differs');
	const owner = MEMOS_SEED.users[0];
	if (
		owner === undefined ||
		!memosSigninValidates(owner.email) ||
		!memosSigninValidates(MEMOS_OWNER_PASSWORD)
	)
		throw new Error('Memos owner pair is refused by the pinned sign-in validator');
	if (canonicalize(MEMOS_SEED_AMENDMENT) === canonicalize(REACT_MEMOS_SEED_AMENDMENT))
		throw new Error('Memos seed amendment record collapsed into its receipt projection');
	if (
		MEMOS_SEED_AMENDMENT.unit !== REACT_MEMOS_SEED_AMENDMENT.unit ||
		MEMOS_SEED_AMENDMENT.scope !== REACT_MEMOS_SEED_AMENDMENT.scope ||
		MEMOS_SEED_AMENDMENT.supersededSeedSha256 !==
			REACT_MEMOS_SEED_AMENDMENT.supersededSeedSha256 ||
		MEMOS_SEED_AMENDMENT.supersededBehaviorDigest !==
			REACT_MEMOS_SEED_AMENDMENT.supersededBehaviorDigest
	)
		throw new Error('Memos seed amendment record differs from the receipt projection of it');
	return digest;
}

/**
 * The retained build-lane receipt, bound by the sha256 of its exact bytes.
 *
 * It also carries the era tsc-gate deviation, and that deviation is not copied
 * into this receipt by hand: every field of it is read back out of the build
 * receipt and required to match, so the sentence the published receipt prints
 * is the one the build lane recorded.
 */
async function bindBuildLanes(): Promise<string> {
	const bytes = await readFile(join(root, REACT_MEMOS_BUILD_LANES_PATH));
	const digest = sha256(bytes);
	const lanes = JSON.parse(bytes.toString('utf8')) as {
		slug?: unknown;
		unit?: unknown;
		revision?: unknown;
		migrationClass?: unknown;
		baselineLane?: Record<string, unknown>;
		targetLane?: Record<string, unknown>;
	};
	if (
		digest !== REACT_MEMOS_BUILD_LANES_SHA256 ||
		lanes.slug !== REACT_MEMOS_FIXTURE ||
		lanes.unit !== REACT_MEMOS_LANES_UNIT ||
		lanes.revision !== REACT_MEMOS_SOURCE.revision ||
		lanes.migrationClass !== REACT_MEMOS_MIGRATION_CLASS.migrationClass ||
		lanes.baselineLane?.bundler !== REACT_MEMOS_MIGRATION_CLASS.baselineBundler ||
		lanes.targetLane?.bundler !== REACT_MEMOS_MIGRATION_CLASS.targetBundler ||
		lanes.baselineLane.declaredBuildCommand !==
			REACT_MEMOS_ERA_BUILD_DEVIATION.declaredBuildCommand ||
		lanes.baselineLane.declaredBuildCommandOutcomeAtThisRevision !==
			REACT_MEMOS_ERA_BUILD_DEVIATION.declaredBuildCommandOutcomeAtThisRevision ||
		lanes.baselineLane.commandRun !== REACT_MEMOS_ERA_BUILD_DEVIATION.commandRun
	)
		throw new Error('Memos build-lane receipt identity or era deviation differs');
	return digest;
}

async function stageInputs(): Promise<Record<'baseline' | 'migrated', string>> {
	const lanes = join(stageRoot, 'lanes');
	await rm(lanes, { recursive: true, force: true });
	const staged = { baseline: join(lanes, 'baseline'), migrated: join(lanes, 'migrated') };
	for (const lane of ['baseline', 'migrated'] as const) {
		if (!(await exists(buildOutputs[lane])))
			throw new Error(`Memos ${lane} production output is absent`);
		await mkdir(dirname(staged[lane]), { recursive: true });
		await cp(buildOutputs[lane], staged[lane], { recursive: true, force: false });
	}
	return staged;
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
): Promise<{ runs: WitnessReactMemosRun[]; ledger: unknown }> {
	const runs: WitnessReactMemosRun[] = [];
	let ledger: unknown = null;
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const raw = await executeReactMemosWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'receipts'),
			});
			const run = raw as WitnessReactMemosRun;
			if (run.semanticDigest !== witnessReactMemosRawDigest(run))
				throw new Error(`Memos ${lane} pass ${String(pass)} raw digest differs`);
			if (ledger === null) ledger = reactMemosProjectionLedger();
			runs.push({ ...run, behaviorDigest: witnessReactMemosBehaviorDigest(run) });
		}
	if (new Set(runs.map((run) => run.behaviorDigest)).size !== 1)
		throw new Error('Memos baseline/migrated behavior parity differs');
	return { runs, ledger };
}

/**
 * Byte mutation on the migrated build: locate the visible list-status text in
 * the served module, overwrite it in place with an equal-length filler, require
 * the journey to go red on that exact assertion, restore the original bytes, and
 * require the restored journey to reproduce the parity behavior digest.
 */
async function semanticMutation(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessReactMemosMutation> {
	const expected = Buffer.from(MEMOS_MUTATION_SEAM);
	const candidates: Array<{ path: string; offset: number }> = [];
	for (const path of await files(laneRoot)) {
		const bytes = await readFile(path);
		const offset = bytes.indexOf(expected);
		if (offset < 0) continue;
		if (bytes.lastIndexOf(expected) !== offset)
			throw new Error('Memos semantic seam is not unique within its file');
		candidates.push({ path, offset });
	}
	const modules = candidates.filter((candidate) => candidate.path.endsWith('.js'));
	const target = modules[0];
	// This build emits no sourcemap, so the seam must live in exactly one served
	// module and nowhere else. Both shapes are named rather than assumed.
	if (
		modules.length !== 1 ||
		target === undefined ||
		(canonicalize(candidates.map((candidate) => candidate.path).sort()) !==
			canonicalize([target.path]) &&
			canonicalize(candidates.map((candidate) => candidate.path).sort()) !==
				canonicalize([target.path, `${target.path}.map`].sort()))
	)
		throw new Error('Memos semantic seam is not a single served module');
	const before = await readFile(target.path);
	const mutated = Buffer.from(before);
	Buffer.alloc(expected.length, 'X').copy(mutated, target.offset);
	const beforeSha256 = sha256(before);
	const mutatedSha256 = sha256(mutated);
	let intendedFailure = false;
	try {
		await writeFile(target.path, mutated);
		try {
			await executeReactMemosWitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'mutation-receipt'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(MEMOS_MUTATION_SEAM);
		}
	} finally {
		await writeFile(target.path, before);
	}
	const afterRestoreSha256 = sha256(await readFile(target.path));
	if (!intendedFailure || afterRestoreSha256 !== beforeSha256)
		throw new Error('Memos semantic mutation was not exact red and byte-restored');
	const restored = (await executeReactMemosWitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'restoration-receipt'),
	})) as WitnessReactMemosRun;
	const restoredBehaviorDigest = witnessReactMemosBehaviorDigest(restored);
	if (restoredBehaviorDigest !== behaviorDigest)
		throw new Error('Memos restored browser behavior differs');
	return {
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		lane: 'migrated',
		seam: MEMOS_MUTATION_SEAM,
		path: relative(laneRoot, target.path),
		offset: target.offset,
		beforeSha256,
		mutatedSha256,
		afterRestoreSha256,
		restoredByteIdentically: true,
		restoredRun: 'pass',
		restoredBehaviorDigest,
	};
}

export async function runWitnessReactMemos(): Promise<WitnessReactMemosReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Memos Witness requires dual offline controls');
	if (await exists(witnessEvidence)) throw new Error('Memos Witness output collision');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const seedSha256 = await bindProjection();
	const buildLanesSha256 = await bindBuildLanes();
	const lanes = await stageInputs();
	const { runs, ledger } = await executeRuns(lanes);
	const mutation = await semanticMutation(lanes.migrated, runs[0]!.behaviorDigest);
	const artifacts = join(fixtureEvidence, 'artifacts');
	await mkdir(artifacts, { recursive: true });
	await writeFile(join(artifacts, 'witness-journeys.json'), `${canonicalize(runs)}\n`, {
		flag: 'wx',
	});
	await writeFile(join(artifacts, 'witness-mutation.json'), `${canonicalize(mutation)}\n`, {
		flag: 'wx',
	});
	await writeFile(
		join(artifacts, 'witness-projection-ledger.json'),
		`${canonicalize({
			label: MEMOS_PROJECTION_LABEL,
			pinnedRevision: MEMOS_PINNED_REVISION,
			behaviorDigest: MEMOS_PROJECTION_BEHAVIOR_DIGEST,
			seedSha256,
			seedFixture: REACT_MEMOS_PROJECTION_SEED_FIXTURE,
			amendment: MEMOS_SEED_AMENDMENT,
			lane: 'baseline',
			pass: 1,
			note: 'the ordered ledger the first run wrote; the receipt digests the same records tallied by identity, because the application fires several of its mount requests concurrently and the ORDER is a property of the event loop rather than of the application',
			records: ledger,
		})}\n`,
		{ flag: 'wx' },
	);
	const receipt: WitnessReactMemosReceipt = {
		schemaVersion: WITNESS_REACT_MEMOS_SCHEMA,
		result: 'pass',
		fixture: REACT_MEMOS_FIXTURE,
		source: REACT_MEMOS_SOURCE,
		provenance,
		canonicalReceipt: {
			path: REACT_MEMOS_BUILD_LANES_PATH,
			binding: REACT_MEMOS_BUILD_LANES_BINDING,
			bindingReason: REACT_MEMOS_BUILD_LANES_BINDING_REASON,
			sha256: buildLanesSha256,
			unit: REACT_MEMOS_LANES_UNIT,
		},
		migrationClass: REACT_MEMOS_MIGRATION_CLASS,
		eraBuildDeviation: REACT_MEMOS_ERA_BUILD_DEVIATION,
		projection: {
			label: REACT_MEMOS_PROJECTION_LABEL,
			pinnedRevision: MEMOS_PINNED_REVISION,
			behaviorDigest: REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST,
			seedSha256,
			seedFixture: REACT_MEMOS_PROJECTION_SEED_FIXTURE,
			amendment: REACT_MEMOS_SEED_AMENDMENT,
		},
		runs,
		mutation,
		consoleErrors: WITNESS_REACT_MEMOS_CONSOLE_ERRORS,
		failedRequests: WITNESS_REACT_MEMOS_FAILED_REQUESTS,
		renderedStyleParity: {
			state: 'measured-identical-resolved-styles',
			probes: WITNESS_REACT_MEMOS_STYLE_PROBES.length,
			lanesAgree: true,
			note: 'the baseline ships the stylesheet Vite 2.9.5 emitted and the migrated lane ships the one Vite 8.0.16 emitted, 2454 bytes smaller and differently named, and the two still resolve to identical appearance at every probe',
		},
		scrollAbsence: runs[0]!.scrollAbsence,
		router: {
			library: 'application-authored-pathname-switch',
			routes: [...WITNESS_REACT_MEMOS_ROUTER_ROUTES],
			fallback: '*',
			navigations: runs[0]!.routes.length,
		},
		readiness: {
			reactLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: [
			'This is one React lineage under direct Witness and does not establish generic React, generic Vite, or generic old-Vite-to-Vite-8 support.',
			'The React lineage readiness score is unchanged at 1/4; this vertical is not counted before Judge audit.',
			"The API this journey talks to is a frozen synthetic loopback projection authored for this fixture, not the repository's Go backend. No captured production payload, no real account and no real user data are involved, and nothing here is evidence about that backend.",
			"The seeded owner credentials were amended after the projection was frozen, because the pinned application's own client-side validator refused the original pair. The superseded seed digest and behaviour digest are recorded in this receipt; nothing but the owner pair moved.",
			"The baseline lane was NOT built with the repository's declared build command: `tsc && vite build` fails in its tsc gate at this revision, so the era lane ran `vite build` alone. Every baseline claim here stands on that deviated command.",
			'Scroll is not tested. Every stage the journey occupies was measured at 1280x720 and none of them overflows the document, because the application pins its page wrapper to the viewport and scrolls its own panels; no scroll coverage is claimed.',
			'Drag is not tested because the visited routes have no genuine drag surface.',
			'`POST /api/resource` is enumerated in the pinned client and deliberately not projected, so no claim is made about file upload or about the `/h/r/:id/:filename` byte stream behind it.',
			'The application’s own cypress or unit suites were not run; this is a browser proof of the journeys named above, not a substitute for the upstream suite.',
			'Locality is process-scoped and does not establish operating-system-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessReactMemosDigest(receipt);
	parseWitnessReactMemosReceipt(receipt);
	await mkdir(witnessEvidence, { recursive: true });
	await writeFile(join(witnessEvidence, 'receipt.json'), `${canonicalize(receipt)}\n`, {
		flag: 'wx',
	});
	await writeFile(join(witnessEvidence, 'receipt.md'), renderWitnessReactMemosReceipt(receipt), {
		flag: 'wx',
	});
	return receipt;
}

export async function verifyWitnessReactMemos(
	output = witnessEvidence,
): Promise<WitnessReactMemosReceipt> {
	const expectedProvenance = await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessReactMemosReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	assertLinkedWitnessProvenanceEquivalent(receipt.provenance, expectedProvenance, "Memos");
	const canonicalBytes = await readFile(join(root, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('Memos build-lane receipt bytes drifted');
	if (
		(await readFile(join(output, 'receipt.md'), 'utf8')) !==
		renderWitnessReactMemosReceipt(receipt)
	)
		throw new Error('Memos human Witness receipt differs');
	const serialized = canonicalize(receipt);
	if (serialized.includes(root) || serialized.includes(process.env.USER ?? ''))
		throw new Error('Memos receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const output = resolve(root, args[publishIndex + 1]!);
		if (output !== witnessEvidence) throw new Error('Memos publish path differs');
		const receipt = await runWitnessReactMemos();
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessReactMemos(resolve(root, args[verifyIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error('Memos Witness runner requires --run-twice --publish <dir> or --verify <dir>');
}

if (basename(process.argv[1] ?? '') === 'react-memos-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
