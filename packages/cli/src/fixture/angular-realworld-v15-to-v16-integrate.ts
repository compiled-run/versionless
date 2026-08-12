import { access, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	ANGULAR_REALWORLD_V15_TO_V16_RECEIPT,
	ANGULAR_REALWORLD_V15_TO_V16_SUPPORT_ARTIFACTS,
	canonicalize,
	deriveCorpusTransactionState,
	nextKilledByGoogleAggregateMember,
	witnessAngularRealworldAggregateMember,
	witnessReactBoilerplateAggregateMember,
	witnessNextKilledByGoogleAggregateMember,
	sha256,
	verifyAngularRealworldV15ToV16Evidence,
} from '../../../core/src/index.ts';
import { verifyV16Acquisition } from './angular-realworld-v15-to-v16-ingest.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const aggregatePath = path.join(root, 'evidence/runs/aggregate.json');

export const ANGULAR_REALWORLD_V15_TO_V16_AGGREGATE_MEMBER = {
	id: 'angular-realworld-v15-to-v16',
	framework: 'angular',
	track: 'angular2-plus-adjacent-major',
	bundler: 'angular-cli-architect-aot-15-to-16',
	runtime: 'node-18.20.8',
	result: 'pass',
	receipt: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path,
	digest: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.canonicalDigest,
} as const;

const laterKilledByGoogleMember = nextKilledByGoogleAggregateMember(
	'a018c6490cd559fab74ea402ff93660f053503dbed1a52ba9b68ed7fdc086b7c',
);

const historicalMembers = [
	[
		'react-boilerplate-v4',
		'evidence/runs/react-boilerplate-v4/t008-run.json',
		'4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758',
	],
	[
		'angular-phonecat',
		'evidence/runs/angular-phonecat/t014-run.json',
		'a6798081c0b005c76534b5acd4dc647d77d497b0b649748c685b779451035f51',
	],
	[
		'react-boilerplate-v4-node24',
		'evidence/runs/react-boilerplate-v4-node24/t022-run.json',
		'815a5416b90c0a0c0a2f0adb779308c0ba0447d67c965003f15d343940d9b593',
	],
	[
		'angular-phonecat-route-resolve',
		'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
		'aa8b2923a38aa5f1adc870b48cdd938b739e107c927aac71b8c2890705f6beef',
	],
	[
		'angular-phonecat-composed',
		'evidence/runs/angular-phonecat-composed/t048-run.json',
		'a7e8a9dc864085d77338f1615e3434a8a842fa5f4156a13bd2f5560bd2f8dc12',
	],
	[
		'react-boilerplate-v4-vite8',
		'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
		'1caf9dfa24b14b83ac63ceab9ca90829346045aac690c7b95a952ae4d9e72849',
	],
	[
		'react-boilerplate-v4-composed',
		'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
		'52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21',
	],
	[
		'react-boilerplate-v4-data-flow',
		'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
		'2bd6e145d611fb0bb5fb89c9d6ed164a3b30e9c0b1b2a290032f56908e5035da',
	],
	[
		'angular-phonecat-vite8',
		'evidence/runs/angular-phonecat-vite8/t069-run.json',
		'033fc40237975e28df36117cc309625632610a399b5c0f88735079ed21fcad0d',
	],
] as const;

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Angular RealWorld integration ${label} must be an object`);
	return value as Record<string, unknown>;
}

async function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

async function filesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(item)));
		else if (entry.isFile()) files.push(item);
		else throw new Error('Angular RealWorld integration found a special filesystem entry');
	}
	return files.sort();
}

async function treeDigest(directory: string): Promise<string> {
	const rows = await Promise.all(
		(await filesBelow(directory)).map(
			async (file) => `${path.relative(directory, file)}\0${sha256(await readFile(file))}`,
		),
	);
	return sha256(rows.join('\n'));
}

function assertAggregate(value: unknown, requireIntegrated: boolean): Record<string, unknown> {
	const aggregate = record(value, 'aggregate');
	if (
		aggregate.schemaVersion !== 'versionless.aggregate.v1' ||
		!Array.isArray(aggregate.fixtures) ||
		!Array.isArray(aggregate.unsupported) ||
		aggregate.unsupported.length !== 0
	)
		throw new Error('Angular RealWorld integration aggregate shape differs');
	const fixtures = aggregate.fixtures.map((item) => record(item, 'aggregate member'));
	try {
		const kind = deriveCorpusTransactionState(fixtures).kind;
		if (
			kind === 'react-zero-sw-reconciliation' ||
			kind === 'react-papercups-browser-proof' ||
			kind === 'react-hospitalrun-browser-proof' ||
			kind === 'angular-factoriolab-browser-proof' ||
			kind === 'angular-jira-clone-browser-proof' ||
			kind === 'react-memos-browser-proof' ||
			kind === 'next-killedbygoogle-v3-browser-proof' ||
			kind === 'react-linkfree-browser-proof' ||
			kind === 'angular-tiny-translator-browser-proof' ||
			kind === 'angular-super-productivity-browser-proof'
		)
			return aggregate;
	} catch {
		// Fall through to the legacy member-specific conflict diagnostics below.
	}
	for (const [id, receipt, digest] of historicalMembers) {
		const matches = fixtures.filter((item) => item.id === id);
		if (
			matches.length !== 1 ||
			matches[0]?.receipt !== receipt ||
			matches[0]?.digest !== digest
		)
			throw new Error(`Angular RealWorld integration historical member differs: ${id}`);
	}
	const integrated = fixtures.filter(
		(item) => item.id === ANGULAR_REALWORLD_V15_TO_V16_AGGREGATE_MEMBER.id,
	);
	const later = fixtures.filter((item) => item.id === laterKilledByGoogleMember.id);
	const witness = fixtures.filter((item) => item.id === 'witness-angular-realworld');
	const reactWitness = fixtures.filter((item) => item.id === 'witness-react-boilerplate');
	const nextWitness = fixtures.filter((item) => item.id === 'witness-next-killedbygoogle');
	let exactWitness: Record<string, unknown> | null = null;
	if (witness.length === 1) {
		const digest = witness[0]?.digest;
		exactWitness = witnessAngularRealworldAggregateMember(
			typeof digest === 'string' ? digest : '',
		);
	}
	let exactReactWitness: Record<string, unknown> | null = null;
	if (reactWitness.length === 1) {
		const digest = reactWitness[0]?.digest;
		exactReactWitness = witnessReactBoilerplateAggregateMember(
			typeof digest === 'string' ? digest : '',
		);
	}
	let exactNextWitness: Record<string, unknown> | null = null;
	if (nextWitness.length === 1) {
		const digest = nextWitness[0]?.digest;
		exactNextWitness = witnessNextKilledByGoogleAggregateMember(
			typeof digest === 'string' ? digest : '',
		);
	}
	if (
		fixtures.length !==
			historicalMembers.length +
				integrated.length +
				later.length +
				witness.length +
				reactWitness.length +
				nextWitness.length ||
		integrated.length > 1 ||
		later.length > 1 ||
		witness.length > 1 ||
		reactWitness.length > 1 ||
		nextWitness.length > 1 ||
		(later.length === 1 && integrated.length !== 1) ||
		(witness.length === 1 && (integrated.length !== 1 || later.length !== 1)) ||
		(witness.length === 1 && canonicalize(witness[0]) !== canonicalize(exactWitness)) ||
		(reactWitness.length === 1 &&
			(witness.length !== 1 ||
				later.length !== 1 ||
				canonicalize(reactWitness[0]) !== canonicalize(exactReactWitness) ||
				(nextWitness.length === 0 &&
					deriveCorpusTransactionState(fixtures).kind !== 'react-candidate'))) ||
		(nextWitness.length === 1 &&
			(reactWitness.length !== 1 ||
				canonicalize(nextWitness[0]) !== canonicalize(exactNextWitness) ||
				deriveCorpusTransactionState(fixtures).kind !== 'next-candidate')) ||
		(later.length === 1 &&
			canonicalize(later[0]) !== canonicalize(laterKilledByGoogleMember)) ||
		(requireIntegrated &&
			(integrated.length !== 1 ||
				canonicalize(integrated[0]) !==
					canonicalize(ANGULAR_REALWORLD_V15_TO_V16_AGGREGATE_MEMBER)))
	)
		throw new Error('Angular RealWorld integration aggregate membership differs');
	if (
		!requireIntegrated &&
		integrated.length === 1 &&
		canonicalize(integrated[0]) !== canonicalize(ANGULAR_REALWORLD_V15_TO_V16_AGGREGATE_MEMBER)
	)
		throw new Error('Angular RealWorld integration conflicts with an existing member');
	return aggregate;
}

export function integrateAngularRealworldAggregate(value: unknown): Record<string, unknown> {
	const aggregate = assertAggregate(value, false);
	const fixtures = aggregate.fixtures as Array<Record<string, unknown>>;
	if (fixtures.some((item) => item.id === ANGULAR_REALWORLD_V15_TO_V16_AGGREGATE_MEMBER.id)) {
		assertAggregate(aggregate, true);
		return aggregate;
	}
	const integrated = {
		...aggregate,
		fixtures: [...fixtures, ANGULAR_REALWORLD_V15_TO_V16_AGGREGATE_MEMBER],
	};
	assertAggregate(integrated, true);
	return integrated;
}

export async function verifyAngularRealworldV15ToV16Inputs(
	rootDir = root,
	environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
	if (
		environment.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		environment.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular RealWorld integration requires dual offline controls');
	const resolvedRoot = path.resolve(rootDir);
	await verifyAngularRealworldV15ToV16Evidence(resolvedRoot);
	const portableRoots = [
		'fixtures/angular-realworld-v15-to-v16',
		'evidence/ingests/angular-realworld-v16',
		'evidence/runs/angular-realworld-v15-to-v16',
	];
	const portable = (
		await Promise.all(
			portableRoots.map(async (directory) =>
				(await filesBelow(path.join(resolvedRoot, directory))).map((file) =>
					path.relative(resolvedRoot, file),
				),
			),
		)
	).flat();
	const expectedPortable = [
		ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path,
		...ANGULAR_REALWORLD_V15_TO_V16_SUPPORT_ARTIFACTS.map(([file]) => file),
		'fixtures/angular-realworld-v15-to-v16/production-journeys.json',
	].sort();
	if (canonicalize(portable.sort()) !== canonicalize(expectedPortable))
		throw new Error('Angular RealWorld integration portable artifact inventory differs');
	if (
		sha256(
			await readFile(
				path.join(
					resolvedRoot,
					'fixtures/angular-realworld-v15-to-v16/production-journeys.json',
				),
			),
		) !== '5fd6ccc4893bdcb4bc98809e229411a6c227cb7a5b02e58b61286e8932c22703'
	)
		throw new Error('Angular RealWorld production journey inventory binding differs');
	const acquisition = verifyV16Acquisition(
		JSON.parse(
			await readFile(
				path.join(resolvedRoot, 'evidence/ingests/angular-realworld-v16/receipt.json'),
				'utf8',
			),
		),
	);
	if (
		acquisition.integrity.canonicalDigest !==
			'0361276affa5c44353401a306226ed19c73628a8aa51260fe6926194119d612c' ||
		acquisition.manifestSha256 !==
			'44111d42de90dd020caaea2f3cc06082b53525f061ba70308cdeb5166e4a3c21'
	)
		throw new Error('Angular RealWorld integration acquisition identity differs');
	const publication = path.join(resolvedRoot, acquisition.publication);
	const manifest = record(
		JSON.parse(await readFile(path.join(publication, 'manifest.json'), 'utf8')),
		'closure manifest',
	);
	const source = record(manifest.source, 'closure source');
	if (
		manifest.parentCommit !== 'e28c8969aab9a27ece9873118b1ab7251f9ccb0c' ||
		manifest.targetCommit !== '0d28f5c63b9cd678a3f1f724f68d6e41363bdd5a' ||
		manifest.targetTree !== '8ed918dfdf28dcf7ee4b76a206b3967a2cc65cf5' ||
		source.files !== 79 ||
		canonicalize(source.changedFiles) !== canonicalize(['package-lock.json', 'package.json']) ||
		source.applicationFilesChanged !== 0 ||
		source.archiveSha256 !==
			'b834410ded0baae07950ba680d2ee82a5d7b797ee01bd86d9a901d3e696544a2' ||
		source.treeSha256 !== '1af58917cef53a2664c82c3fe8b38a1678a2e33590be8674284586bf6dfc503e' ||
		source.packageSha256 !==
			'48e23882a01326609a8c9b5fdf4b039a42ac013705a6d15b9104ddd3b28809ec' ||
		source.lockSha256 !== '030d8e0661fc5a0cfa54cffa3a7a33a488cdc6007e8671f7f52d87306f356016' ||
		source.licenseSha256 !== 'dd241fc76d00987f9a025558ec977a2df69875320ab0379bd8f5865ad1033c7b'
	)
		throw new Error('Angular RealWorld integration closure source identity differs');
	const parentSource = path.join(
		resolvedRoot,
		'.versionless/cache/angular-realworld-v15/closures/d3576ef3443079903aa0fa2c2337fbf8fcab88fdfeea3ff5b8de03e99587b8f9/source',
	);
	const targetSource = path.join(publication, 'source');
	const parentFiles = await filesBelow(parentSource);
	const targetFiles = await filesBelow(targetSource);
	if (parentFiles.length !== 79 || targetFiles.length !== 79)
		throw new Error('Angular RealWorld integration source file count differs');
	const changed: string[] = [];
	for (const targetFile of targetFiles) {
		const relative = path.relative(targetSource, targetFile);
		const parentFile = path.join(parentSource, relative);
		if (
			!(await exists(parentFile)) ||
			sha256(await readFile(parentFile)) !== sha256(await readFile(targetFile))
		)
			changed.push(relative);
	}
	if (canonicalize(changed.sort()) !== canonicalize(['package-lock.json', 'package.json']))
		throw new Error('Angular RealWorld integration source delta differs');
	const distributions = [
		['legacy', '34bbecf0f342a65b6c813e6d93f07dd93397716915f0673ac9251a175ca77274'],
		['target-initial', 'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185'],
		['target', 'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185'],
	] as const;
	for (const [name, digest] of distributions) {
		const directory = path.join(
			resolvedRoot,
			'.versionless/work/angular-realworld-v15-to-v16/dist',
			name,
		);
		if ((await filesBelow(directory)).length !== 15 || (await treeDigest(directory)) !== digest)
			throw new Error(`Angular RealWorld integration distribution differs: ${name}`);
	}
	const target = path.join(
		resolvedRoot,
		'.versionless/work/angular-realworld-v15-to-v16/lanes/target',
	);
	const restored = [
		['package.json', '48e23882a01326609a8c9b5fdf4b039a42ac013705a6d15b9104ddd3b28809ec'],
		['package-lock.json', '030d8e0661fc5a0cfa54cffa3a7a33a488cdc6007e8671f7f52d87306f356016'],
		[
			'src/app/core/interceptors/api.interceptor.ts',
			'5afdac9c0ed22ea38ebba4e957455563ba92d9704a3027b952b239793bbbf1f4',
		],
	] as const;
	for (const [file, digest] of restored)
		if (sha256(await readFile(path.join(target, file))) !== digest)
			throw new Error(`Angular RealWorld integration restored source differs: ${file}`);
}

export async function publishAngularRealworldV15ToV16(rootDir = root): Promise<void> {
	await verifyAngularRealworldV15ToV16Inputs(rootDir);
	const resolvedRoot = path.resolve(rootDir);
	const target = path.join(resolvedRoot, 'evidence/runs/aggregate.json');
	const aggregate = assertAggregate(JSON.parse(await readFile(target, 'utf8')), false);
	const integrated = integrateAngularRealworldAggregate(aggregate);
	if (canonicalize(aggregate) === canonicalize(integrated)) {
		return;
	}
	const staged = `${target}.t222.tmp`;
	if (await exists(staged))
		throw new Error('Angular RealWorld integration staging residue exists');
	try {
		await writeFile(staged, `${JSON.stringify(integrated, null, 2)}\n`, { flag: 'wx' });
		assertAggregate(JSON.parse(await readFile(staged, 'utf8')), true);
		await rename(staged, target);
	} catch (error) {
		await unlink(staged).catch(() => undefined);
		throw error;
	}
	assertAggregate(JSON.parse(await readFile(target, 'utf8')), true);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1) throw new Error('Angular RealWorld integration requires one mode');
	if (args[0] === '--verify-inputs') await verifyAngularRealworldV15ToV16Inputs();
	else if (args[0] === '--publish') await publishAngularRealworldV15ToV16();
	else if (args[0] === '--verify-only') {
		await verifyAngularRealworldV15ToV16Inputs();
		assertAggregate(JSON.parse(await readFile(aggregatePath, 'utf8')), true);
	} else throw new Error('Angular RealWorld integration mode differs');
	process.stdout.write(`${JSON.stringify({ result: 'pass', mode: args[0] })}\n`);
}

if (process.argv[1]?.endsWith('angular-realworld-v15-to-v16-integrate.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
