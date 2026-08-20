import { spawn, type ChildProcess } from 'node:child_process';
import type { Stats } from 'node:fs';
import {
	access,
	chmod,
	cp,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	readlink,
	realpath,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import { escape as querystringEscape } from 'node:querystring';
import { charIn, createRegExp, global } from 'magic-regexp';
import * as path from 'pathe';
import { chromium, type Browser, type Page } from 'playwright';
import { parseURL } from 'ufo';
import {
	canonicalize,
	receiptDigest,
	sha256,
	type MigrationReceipt,
} from '../../../core/src/index.ts';
import { transformNext12DerivedStateToMemo } from '../../../frameworks/nextjs/src/index.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const archive = path.join(
	root,
	'.versionless/cache/tier-f/next-killedbygoogle/c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d/source.tar.gz',
);
const closureRoot = path.join(
	root,
	'.versionless/cache/next-killedbygoogle-dependencies/a676ee932cef5e54d469dc6d1e040e50f42f9cc88beb16ae5c72c13e26ebc48a',
);
const closureFile = path.join(closureRoot, 'closure.json');
const dependencyReceipt = path.join(
	root,
	'evidence/dependencies/next-killedbygoogle/dependency-receipt.json',
);
const provenanceFile = path.join(root, 'fixtures/next-killedbygoogle/provenance.json');
const work = path.join(root, '.versionless/work/next-killedbygoogle/derived-state-to-memo');
const stage = path.join(root, '.versionless/stage/next-killedbygoogle/derived-state-to-memo');
const output = path.join(root, 'evidence/runs/next-killedbygoogle-derived-state-to-memo');
const nftMismatchOutput = path.join(
	root,
	'evidence/runs/next-killedbygoogle-next-server-nft-mismatch.json',
);
const nftMismatchWork = path.join(
	root,
	'.versionless/work/next-killedbygoogle/next-server-nft-mismatch-diagnostic',
);
const nftMismatchStage = path.join(
	root,
	'.versionless/stage/next-killedbygoogle/next-server-nft-mismatch-diagnostic',
);
const productionComparisonOutput = path.join(
	root,
	'evidence/runs/next-killedbygoogle-next-server-nft-production-comparison.json',
);
const productionComparisonWork = path.join(
	root,
	'.versionless/work/next-killedbygoogle/next-server-nft-production-comparison',
);
const productionComparisonStage = path.join(
	root,
	'.versionless/stage/next-killedbygoogle/next-server-nft-production-comparison',
);
const operationBisectOutput = path.join(
	root,
	'evidence/runs/next-killedbygoogle-next-server-nft-operation-bisect.json',
);
const operationBisectWork = path.join(
	root,
	'.versionless/work/next-killedbygoogle/next-server-nft-operation-bisect',
);
const operationBisectStage = path.join(
	root,
	'.versionless/stage/next-killedbygoogle/next-server-nft-operation-bisect',
);
const cacheKeyProvenanceOutput = path.join(
	root,
	'evidence/runs/next-killedbygoogle-next-server-cachekey-provenance.json',
);
const cacheKeyProvenanceWork = path.join(
	root,
	'.versionless/stage/next-killedbygoogle/next-server-cachekey-provenance-work',
);
const cacheKeyProvenanceStage = path.join(
	root,
	'.versionless/stage/next-killedbygoogle/next-server-cachekey-provenance',
);
const isolatedCacheKeyProvenanceOutput = path.join(
	root,
	'evidence/runs/next-killedbygoogle-next-server-isolated-cachekey-provenance.json',
);
const isolatedCacheKeyProvenanceStage = path.join(
	root,
	'.versionless/stage/next-killedbygoogle/next-server-isolated-cachekey-provenance',
);
const retainedDiagnosticPath = path.join(output, 'build-variance-diagnostic.json');
const expectedRetainedDiagnostic =
	'8a476406eecc0c81b3eff88c642ba85792f71285e8bf04222b98c5e0e3c4a41e';
const node16 = path.join(root, '.versionless/cache/angular-phonecat/node16/bin/node');
const yarn = path.join(
	process.env.COREPACK_HOME ?? path.join(process.env.HOME ?? '', '.cache/node/corepack'),
	'v1/yarn/1.22.22/bin/yarn.js',
);
const chromiumExecutable = path.join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const expectedArchive = 'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d';
const expectedLock = 'a676ee932cef5e54d469dc6d1e040e50f42f9cc88beb16ae5c72c13e26ebc48a';

type FileRow = { path: string; sha256: string };
export type BuildFileRow = Readonly<FileRow & { byteLength: number }>;
export type BuildSnapshot = Readonly<{
	buildId: string;
	rawDigest: string;
	normalizedDigest: string;
	rows: readonly BuildFileRow[];
	normalizedRows: readonly FileRow[];
}>;

const lowerHex32 = createRegExp(
	charIn('0123456789').from('a', 'f').times(32).at.lineStart().at.lineEnd(),
);
const lowerHex64 = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);
const next12EscapeStringRegexpPattern = createRegExp(charIn('|\\{}()[]^$+*?.-'), [global]);
const expectedInstallTree = 'c49e2976f5d5bd7898512df31472e4b65a5884dee7065f04b9504dda4bab9070';
const expectedDependencyReceipt =
	'e5fc93ad73d6732147b4cef38bb39f24c58b97e461f4eab36436a216c36dce15';
const expectedClosureFile = '38d2a2532f77835ae6ae8e7eaa6512c408760c534b8ab4dd92c57a3fcb873a84';
const expectedClosureCanonical = '61fcd0d02df1212e8a7f461fbfb69917037b4fd85533a095f5d683064991311e';
const expectedNextTarball = 'f8069b42f1ba01bd63c528ff4bd084f0f13119649eee9f34f4c645d5e345bce7';
const expectedNextBuildSource = '8b9f70734856102c56df52752081ee73b0b39dca2adbc51dc2d40d8331d22dac';
const expectedHistoricalAmbientPnpmLock =
	'71fb680c6febb2024b8117efadf3ca0641fafa1cc076a08a126724a1b337e166';
// The ambient pnpm-lock state that immediately preceded vendoring @async/witness into the root
// manifest (T037/T039). Still named by published evidence — keep it accepted, do not retire it:
//   evidence/dependencies/angular-contacts/t631-terminal.json
//   evidence/dependencies/angular-contacts/t633-terminal.json
const expectedVendoringPredecessorAmbientPnpmLock =
	'ae8c76d3483d5dcd72428ba3a0b9eb0b1731724c14f6f0893ac20972cea5e66a';
const expectedCurrentAmbientPnpmLock =
	'a05cd6c698fd531c4dcb6c1117512a0c8ce463cc56edf2e7eccb89585b56066e';
const expectedHistoricalCacheKeyCandidates = [
	{
		updateOrder: ['fixture/yarn.lock', 'ambient/pnpm-lock.yaml'],
		cacheKeySha256: '2a427c8aed107a7358245facf9f07be9e0987d17377ffa1efb630b5f1f849dfc',
	},
	{
		updateOrder: ['ambient/pnpm-lock.yaml', 'fixture/yarn.lock'],
		cacheKeySha256: '02a3831f05baeda599f7f5a78c2baf2bdb4ae2eb0cf2f6e0bb9e0a2bc7e0b50d',
	},
] as const;
const expectedVendoringPredecessorCacheKeyCandidates = [
	{
		updateOrder: ['fixture/yarn.lock', 'ambient/pnpm-lock.yaml'],
		cacheKeySha256: '703d86dff0cb0b8c6aa8413365b62c6bbe780b73a520e9e53856bd25cb511c4a',
	},
	{
		updateOrder: ['ambient/pnpm-lock.yaml', 'fixture/yarn.lock'],
		cacheKeySha256: '1688d4c1f17ce2ad3a8b6065707176112fe6cac438882d3257ba0428e126bd26',
	},
] as const;
const expectedCurrentCacheKeyCandidates = [
	{
		updateOrder: ['fixture/yarn.lock', 'ambient/pnpm-lock.yaml'],
		cacheKeySha256: '023652bbcc92f4de735e3e30446fcdc6dcb41e3bbc0f651bd236e792ed863b1e',
	},
	{
		updateOrder: ['ambient/pnpm-lock.yaml', 'fixture/yarn.lock'],
		cacheKeySha256: '906bba8598f806f62350582d43d03ce906d4f654ab98e78089a588b421c83eb9',
	},
] as const;
const expectedPreviousDiagnostic =
	'fe0c118a821193bacc26fa0afd63fe36d82f70f7b421ec778929ea115b580745';
const expectedVariance = [
	'next-server.js.nft.json',
	'prerender-manifest.json',
	'required-server-files.json',
	'routes-manifest.json',
	'server/pages/_app.js.nft.json',
	'server/pages/_document.js.nft.json',
	'server/pages/_error.js.nft.json',
	'server/pages/index.js.nft.json',
	'trace',
] as const;

function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
}

function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

function compare(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

async function execute(
	command: string,
	args: readonly string[],
	cwd = root,
	env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, [...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (value: Buffer) => stdout.push(value));
		child.stderr.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolve(Buffer.concat(stdout).toString('utf8'))
				: reject(
						new Error(
							`${path.basename(command)} exited ${code}: ${Buffer.concat(stderr).toString('utf8')}${Buffer.concat(stdout).toString('utf8')}`,
						),
					),
		);
	});
}

async function fileTree(
	directory: string,
	ignore: ReadonlySet<string> = new Set(),
): Promise<FileRow[]> {
	const rows: FileRow[] = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) =>
			compare(a.name, b.name),
		)) {
			const absolute = path.join(current, entry.name);
			const relative = path.relative(directory, absolute);
			if (
				ignore.has(relative) ||
				[...ignore].some((prefix) => relative.startsWith(`${prefix}/`))
			)
				continue;
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isSymbolicLink())
				rows.push({ path: relative, sha256: sha256(`link:${await readlink(absolute)}`) });
			else if (entry.isFile())
				rows.push({ path: relative, sha256: sha256(await readFile(absolute)) });
			else throw new Error('T236 encountered a special filesystem entry');
		}
	};
	await visit(directory);
	return rows;
}

async function installTreeDigest(directory: string): Promise<string> {
	const rows: string[] = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of (await readdir(current, { withFileTypes: true })).sort((left, right) =>
			compare(left.name, right.name),
		)) {
			const absolute = path.join(current, entry.name);
			const relative = path.relative(directory, absolute);
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isSymbolicLink()) {
				const target = await readlink(absolute);
				const resolved = path.resolve(path.dirname(absolute), target);
				if (resolved !== directory && !resolved.startsWith(`${directory}/`))
					throw new Error('T240 install produced an escaping symlink');
				rows.push(`L ${relative} ${target}`);
			} else if (entry.isFile())
				rows.push(`F ${relative} ${sha256(await readFile(absolute))}`);
			else throw new Error('T240 install produced a special entry');
		}
	};
	await visit(directory);
	return sha256(`${rows.join('\n')}\n`);
}

async function sourceTree(lane: string): Promise<FileRow[]> {
	return await fileTree(lane, new Set(['node_modules', '.next', '.yarn-cache', '.yarnrc']));
}

async function extractLane(name: string): Promise<string> {
	const extract = path.join(work, `${name}-extract`);
	const lane = path.join(work, name);
	await mkdir(extract, { recursive: true });
	await execute('/usr/bin/tar', ['-xzf', archive, '-C', extract]);
	const entries = await readdir(extract);
	if (entries.length !== 1) throw new Error('T236 archive root differs');
	await rename(path.join(extract, entries[0]!), lane);
	await rm(extract, { recursive: true, force: true });
	return lane;
}

async function installLane(lane: string): Promise<string> {
	const lockBefore = sha256(await readFile(path.join(lane, 'yarn.lock')));
	const sourceBefore = await sourceTree(lane);
	await writeFile(
		path.join(lane, '.yarnrc'),
		`yarn-offline-mirror "${path.join(closureRoot, 'mirror')}"\nyarn-offline-mirror-pruning false\n`,
	);
	await execute(
		node16,
		[
			yarn,
			'install',
			'--frozen-lockfile',
			'--offline',
			'--ignore-scripts',
			'--non-interactive',
			'--cache-folder',
			path.join(lane, '.yarn-cache'),
		],
		lane,
		{
			PATH: `${path.dirname(node16)}:/usr/bin:/bin`,
			VERSIONLESS_NETWORK_MODE: 'offline',
			NPM_CONFIG_OFFLINE: 'true',
			YARN_ENABLE_NETWORK: '0',
			SKIP_YARN_COREPACK_CHECK: '1',
		},
	);
	if (
		lockBefore !== expectedLock ||
		sha256(await readFile(path.join(lane, 'yarn.lock'))) !== lockBefore
	)
		throw new Error('T236 lane install changed yarn.lock');
	const swc = (await readdir(path.join(lane, 'node_modules/@next')))
		.filter((name) => name.startsWith('swc-'))
		.sort(compare);
	if (canonicalize(swc) !== canonicalize(['swc-darwin-arm64']))
		throw new Error('T236 lane SWC platform set differs');
	await rm(path.join(lane, '.yarn-cache'), { recursive: true, force: true });
	if (canonicalize(await sourceTree(lane)) !== canonicalize(sourceBefore))
		throw new Error('T236 offline install changed immutable source');
	return await installTreeDigest(path.join(lane, 'node_modules'));
}

export async function resetProductionBuildRoot(lane: string): Promise<void> {
	await rm(path.join(lane, '.next'), { recursive: true, force: true });
}

async function buildSnapshot(lane: string): Promise<BuildSnapshot> {
	const before = await sourceTree(lane);
	await resetProductionBuildRoot(lane);
	await execute(node16, [path.join(lane, 'node_modules/next/dist/bin/next'), 'build'], lane, {
		PATH: `${path.dirname(node16)}:/usr/bin:/bin`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		NEXT_TELEMETRY_DISABLED: '1',
		CI: '1',
	});
	if (canonicalize(await sourceTree(lane)) !== canonicalize(before))
		throw new Error('T236 Next build changed immutable source or configuration');
	await rm(path.join(lane, '.next/cache'), { recursive: true, force: true });
	const buildRoot = path.join(lane, '.next');
	const buildId = (await readFile(path.join(buildRoot, 'BUILD_ID'), 'utf8')).trim();
	if (!buildId || buildId.includes('/') || buildId.includes('\\'))
		throw new Error('T236 Next BUILD_ID shape differs');
	const rows: BuildFileRow[] = [];
	const normalizedRows: FileRow[] = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) =>
			compare(a.name, b.name),
		)) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isFile()) {
				const relative = path.relative(buildRoot, absolute);
				const bytes = await readFile(absolute);
				rows.push({ path: relative, byteLength: bytes.byteLength, sha256: sha256(bytes) });
				const text = bytes.toString('utf8');
				const normalized = Buffer.from(text, 'utf8').equals(bytes)
					? Buffer.from(text.split(buildId).join('<BUILD_ID>'))
					: bytes;
				normalizedRows.push({
					path: relative.split(buildId).join('<BUILD_ID>'),
					sha256: sha256(normalized),
				});
			} else throw new Error('T236 build contains a non-file entry');
		}
	};
	await visit(buildRoot);
	rows.sort((left, right) => compare(left.path, right.path));
	normalizedRows.sort((left, right) => compare(left.path, right.path));
	return {
		buildId,
		rawDigest: sha256(canonicalize(rows)),
		normalizedDigest: sha256(canonicalize(normalizedRows)),
		rows,
		normalizedRows,
	};
}

function normalizedDifference(first: BuildSnapshot, second: BuildSnapshot): string[] {
	const left = new Map(first.normalizedRows.map((row) => [row.path, row.sha256]));
	const right = new Map(second.normalizedRows.map((row) => [row.path, row.sha256]));
	return [...new Set([...left.keys(), ...right.keys()])]
		.filter((file) => left.get(file) !== right.get(file))
		.sort(compare);
}

function portableTraceValue(value: unknown, lane: string): unknown {
	if (typeof value === 'string')
		return value
			.split(lane)
			.join('<LANE>')
			.split(root)
			.join('<REPOSITORY>')
			.split(process.env.HOME ?? '<NO_HOME>')
			.join('<HOME>');
	if (Array.isArray(value)) return value.map((item) => portableTraceValue(item, lane));
	if (value && typeof value === 'object')
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => compare(left, right))
				.map(([key, item]) => [key, portableTraceValue(item, lane)]),
		);
	return value;
}

type TraceSpan = {
	traceId?: unknown;
	parentId?: unknown;
	name?: unknown;
	id?: unknown;
	timestamp?: unknown;
	duration?: unknown;
	tags?: unknown;
};

async function traceDiagnostic(file: string, lane: string) {
	const raw = await readFile(file);
	const batches = raw
		.toString('utf8')
		.split('\n')
		.filter((line) => line.length > 0)
		.map((line) => JSON.parse(line) as unknown);
	if (batches.some((batch) => !Array.isArray(batch)))
		throw new Error('T240 trace contains a non-array batch');
	const spans = batches.flat() as TraceSpan[];
	const allowed = new Set(['traceId', 'parentId', 'name', 'id', 'timestamp', 'duration', 'tags']);
	for (const span of spans) {
		if (!span || typeof span !== 'object')
			throw new Error('T240 trace contains a non-object span');
		const unexpected = Object.keys(span).filter((key) => !allowed.has(key));
		if (unexpected.length)
			throw new Error(`T240 trace keys differ: ${unexpected.sort(compare).join(', ')}`);
		if (typeof span.name !== 'string' || !span.tags || typeof span.tags !== 'object')
			throw new Error('T240 trace semantic span shape differs');
	}
	const byId = new Map(spans.map((span) => [String(span.id), span]));
	const semanticProjection = spans
		.map((span) => {
			const parent =
				span.parentId === undefined ? undefined : byId.get(String(span.parentId));
			if (span.parentId !== undefined && !parent)
				throw new Error('T240 trace parent cannot be resolved');
			return {
				name: span.name,
				tags: portableTraceValue(span.tags, lane),
				parent:
					parent === undefined
						? null
						: { name: parent.name, tags: portableTraceValue(parent.tags, lane) },
			};
		})
		.sort((left, right) => compare(canonicalize(left), canonicalize(right)));
	const volatileFields = ['traceId', 'id', 'parentId', 'timestamp', 'duration']
		.map((key) => ({
			key,
			present: spans.filter((span) => Object.hasOwn(span, key)).length,
			types: [
				...new Set(
					spans
						.filter((span) => Object.hasOwn(span, key))
						.map((span) => typeof span[key as keyof TraceSpan]),
				),
			].sort(compare),
		}))
		.sort((left, right) => compare(left.key, right.key));
	return {
		rawSha256: sha256(raw),
		byteLength: raw.byteLength,
		batchCount: batches.length,
		spanCount: spans.length,
		keys: [...new Set(spans.flatMap((span) => Object.keys(span)))].sort(compare),
		volatileFields,
		semanticProjection,
		semanticProjectionSha256: sha256(canonicalize(semanticProjection)),
	};
}

async function aggregateTraceDiagnostic(file: string) {
	const raw = await readFile(file);
	const batches = raw
		.toString('utf8')
		.split('\n')
		.filter((line) => line.length > 0)
		.map((line) => JSON.parse(line) as unknown);
	if (batches.some((batch) => !Array.isArray(batch)))
		throw new Error('T255 trace contains a non-array batch');
	const spans = batches.flat() as TraceSpan[];
	const allowedKeys = ['duration', 'id', 'name', 'parentId', 'tags', 'timestamp', 'traceId'];
	const identity = (span: TraceSpan) => canonicalize([span.traceId, span.id]);
	const groupsByIdentity = new Map<string, TraceSpan[]>();
	for (const span of spans) {
		if (!span || typeof span !== 'object')
			throw new Error('T257 trace contains a non-object event');
		if (Object.keys(span).some((key) => !allowedKeys.includes(key)))
			throw new Error('T257 trace contains an unexpected event key');
		if (
			typeof span.name !== 'string' ||
			!span.tags ||
			typeof span.tags !== 'object' ||
			Array.isArray(span.tags) ||
			typeof span.traceId !== 'string' ||
			typeof span.id !== 'number' ||
			(span.parentId !== undefined && typeof span.parentId !== 'number') ||
			typeof span.timestamp !== 'number' ||
			typeof span.duration !== 'number'
		)
			throw new Error('T257 trace event type differs');
		const key = identity(span);
		const group = groupsByIdentity.get(key) ?? [];
		group.push(span);
		groupsByIdentity.set(key, group);
	}
	const traceIdentityCount = new Set(spans.map((span) => span.traceId)).size;
	if (traceIdentityCount !== 1) throw new Error('T257 trace identity count differs');
	const duplicateGroups = [...groupsByIdentity.values()].filter((group) => group.length > 1);
	if (duplicateGroups.length !== 1 || duplicateGroups[0]?.length !== 2)
		throw new Error('T257 duplicate identity groups differ');
	const duplicateGroup = duplicateGroups[0]!;
	const duplicateReference = duplicateGroup[0]!;
	if (
		duplicateReference.name !== 'check-static-error-page' ||
		duplicateGroup.some(
			(span) =>
				span.name !== duplicateReference.name ||
				span.parentId !== duplicateReference.parentId ||
				canonicalize(span.tags) !== canonicalize(duplicateReference.tags),
		)
	)
		throw new Error('T257 duplicate occurrence semantics differ');
	const byIdentity = new Map(
		[...groupsByIdentity.entries()].map(([key, group]) => [key, group[0]!] as const),
	);
	const parentOf = (span: TraceSpan): TraceSpan | undefined => {
		if (span.parentId === undefined) return undefined;
		const parent = byIdentity.get(canonicalize([span.traceId, span.parentId]));
		if (!parent) throw new Error('T257 trace parent cannot be resolved within trace identity');
		return parent;
	};
	const duplicateParent = parentOf(duplicateReference);
	if (duplicateParent?.name !== 'static-check')
		throw new Error('T257 duplicate occurrence parent differs');
	const safeDuplicateGroups = [
		{
			name: 'check-static-error-page',
			parentName: 'static-check',
			occurrences: 2,
			semanticsEqual: true,
		},
	];
	const eventKeyTypeSignatures = allowedKeys.map((key) => ({
		key,
		presence: spans.filter((span) => Object.hasOwn(span, key)).length,
		types: [
			...new Set(
				spans
					.filter((span) => Object.hasOwn(span, key))
					.map((span) => jsonType(span[key as keyof TraceSpan])),
			),
		].sort(compare),
	}));
	const names = [...new Set(spans.map((span) => String(span.name)))].sort(compare);
	const nameCounts = names.map((name) => {
		const named = spans.filter((span) => span.name === name);
		const rootCount = named.filter((span) => parentOf(span) === undefined).length;
		return { name, count: named.length, rootCount, childCount: named.length - rootCount };
	});
	const tagDimensions = new Map<
		string,
		{ name: string; tagKey: string; types: Set<string>; count: number }
	>();
	const valueDimensions = new Map<
		string,
		{ name: string; parentName: string | null; tagKey: string; values: unknown[] }
	>();
	for (const span of spans) {
		const parentName = parentOf(span)?.name ?? null;
		for (const [tagKey, tagValue] of Object.entries(span.tags as Record<string, unknown>)) {
			const key = canonicalize([span.name, tagKey]);
			const dimension = tagDimensions.get(key) ?? {
				name: String(span.name),
				tagKey,
				types: new Set<string>(),
				count: 0,
			};
			dimension.types.add(jsonType(tagValue));
			dimension.count += 1;
			tagDimensions.set(key, dimension);
			const valueKey = canonicalize([span.name, parentName, tagKey]);
			const values = valueDimensions.get(valueKey) ?? {
				name: String(span.name),
				parentName: parentName === null ? null : String(parentName),
				tagKey,
				values: [],
			};
			values.values.push(tagValue);
			valueDimensions.set(valueKey, values);
		}
	}
	const tagKeyTypeSignatures = [...tagDimensions.values()]
		.map((entry) => ({
			name: entry.name,
			tagKeys: [entry.tagKey],
			types: [...entry.types].sort(compare),
			count: entry.count,
		}))
		.sort((left, right) => compare(canonicalize(left), canonicalize(right)));
	const edgeMap = new Map<
		string,
		{ childName: string; parentName: string | null; count: number }
	>();
	for (const span of spans) {
		const parentName = parentOf(span)?.name;
		const edge = {
			childName: String(span.name),
			parentName: parentName === undefined ? null : String(parentName),
		};
		const key = canonicalize(edge);
		const current = edgeMap.get(key) ?? { ...edge, count: 0 };
		current.count += 1;
		edgeMap.set(key, current);
	}
	const parentNameEdgeCounts = [...edgeMap.values()].sort((left, right) =>
		compare(canonicalize(left), canonicalize(right)),
	);
	const rootSpanCount = spans.filter((span) => parentOf(span) === undefined).length;
	return {
		evidence: {
			raw: { byteLength: raw.byteLength, sha256: sha256(raw) },
			batchCount: batches.length,
			spanCount: spans.length,
			traceIdentityCount,
			logicalSpanCount: groupsByIdentity.size,
			duplicateIdentityGroupCount: duplicateGroups.length,
			duplicateOccurrenceCount: duplicateGroups.reduce(
				(count, group) => count + group.length - 1,
				0,
			),
			duplicateGroups: safeDuplicateGroups,
			unresolvedParentCount: 0,
			rootSpanCount,
			childSpanCount: spans.length - rootSpanCount,
			eventKeyTypeSignatures,
			nameCounts,
			tagKeyTypeSignatures,
			parentNameEdgeCounts,
			summaryHashes: {
				eventKeyTypes: sha256(canonicalize(eventKeyTypeSignatures)),
				nameCounts: sha256(canonicalize(nameCounts)),
				tagKeyTypes: sha256(canonicalize(tagKeyTypeSignatures)),
				parentNameEdges: sha256(canonicalize(parentNameEdgeCounts)),
			},
		},
		valueDimensions,
	};
}

function compareAggregateTraces(
	first: Awaited<ReturnType<typeof aggregateTraceDiagnostic>>,
	second: Awaited<ReturnType<typeof aggregateTraceDiagnostic>>,
) {
	const comparison = {
		batchCountEqual: first.evidence.batchCount === second.evidence.batchCount,
		spanCountEqual: first.evidence.spanCount === second.evidence.spanCount,
		eventKeyTypesEqual:
			first.evidence.summaryHashes.eventKeyTypes ===
			second.evidence.summaryHashes.eventKeyTypes,
		nameCountsEqual:
			first.evidence.summaryHashes.nameCounts === second.evidence.summaryHashes.nameCounts,
		tagKeyTypesEqual:
			first.evidence.summaryHashes.tagKeyTypes === second.evidence.summaryHashes.tagKeyTypes,
		parentNameEdgesEqual:
			first.evidence.summaryHashes.parentNameEdges ===
			second.evidence.summaryHashes.parentNameEdges,
	};
	const differingSafeSummaries = Object.entries(comparison)
		.filter(([, equal]) => !equal)
		.map(([name]) => name)
		.sort(compare);
	const tagValueDifferences = [
		...new Set([...first.valueDimensions.keys(), ...second.valueDimensions.keys()]),
	]
		.sort(compare)
		.map((key) => {
			const left = first.valueDimensions.get(key);
			const right = second.valueDimensions.get(key);
			const leftValues = (left?.values ?? []).map(canonicalize).sort(compare);
			const rightValues = (right?.values ?? []).map(canonicalize).sort(compare);
			const dimension = left ?? right!;
			return {
				name: dimension.name,
				parentName: dimension.parentName,
				tagKey: dimension.tagKey,
				equal: canonicalize(leftValues) === canonicalize(rightValues),
				firstOccurrenceCount: leftValues.length,
				secondOccurrenceCount: rightValues.length,
				firstDistinctCount: new Set(leftValues).size,
				secondDistinctCount: new Set(rightValues).size,
			};
		})
		.filter((entry) => !entry.equal);
	return { ...comparison, differingSafeSummaries, tagValueDifferences };
}

type ExpectedTraceValueDimension = {
	name: string;
	parentName: string;
	tagKey: string;
	occurrenceCount: number;
	distinctCount: number;
	sourceCategory: string;
	projectionEligible: boolean;
};

export const expectedTraceValueDimensions: ExpectedTraceValueDimension[] = [
	{
		name: 'add-entry',
		parentName: 'webpack-compilation',
		tagKey: 'request',
		occurrenceCount: 9,
		distinctCount: 9,
		sourceCategory: 'webpack-entry-request',
		projectionEligible: true,
	},
	...[
		['build-module-css', 'build-module-css', 1, 1],
		['build-module-css', 'build-module-tsx', 2, 1],
		['build-module-js', 'build-module-css', 1, 1],
		['build-module-js', 'build-module-js', 404, 394],
		[
			'build-module-js',
			'build-module-js?page=%2F_error&absolutePagePath=next%2Fdist%2Fpages%2F_error!',
			1,
			1,
		],
		['build-module-js', 'build-module-tsx', 11, 10],
		['build-module-js', 'webpack-compilation', 4, 4],
		[
			'build-module-js?page=%2F_error&absolutePagePath=next%2Fdist%2Fpages%2F_error!',
			'webpack-compilation',
			1,
			1,
		],
		['build-module-json', 'build-module-tsx', 1, 1],
		['build-module-ts', 'build-module-tsx', 8, 4],
		['build-module-tsx!', 'webpack-compilation', 2, 2],
		['build-module-tsx', 'build-module-tsx!', 2, 2],
		['build-module-tsx', 'build-module-tsx', 26, 13],
		['build-module-tsx', 'webpack-compilation', 2, 2],
	].map(([name, parentName, occurrenceCount, distinctCount]) => ({
		name: String(name),
		parentName: String(parentName),
		tagKey: 'name',
		occurrenceCount: Number(occurrenceCount),
		distinctCount: Number(distinctCount),
		sourceCategory: 'webpack-module-user-request',
		projectionEligible: true,
	})),
	{
		name: 'minify-js',
		parentName: 'terser-webpack-plugin-optimize',
		tagKey: 'name',
		occurrenceCount: 12,
		distinctCount: 12,
		sourceCategory: 'webpack-compilation-asset-name',
		projectionEligible: false,
	},
];

function isTokenCharacter(value: string): boolean {
	const code = value.codePointAt(0);
	return (
		(code !== undefined && code >= 48 && code <= 57) ||
		(code !== undefined && code >= 65 && code <= 90) ||
		(code !== undefined && code >= 97 && code <= 122) ||
		['_', '-', '.', '~', '%'].includes(value)
	);
}

function hasExactTokenBoundary(
	value: string,
	index: number,
	token: string,
	encoded: boolean,
): boolean {
	const before = index === 0 || !isTokenCharacter(value[index - 1]!);
	const end = index + token.length;
	const after =
		end === value.length ||
		!isTokenCharacter(value[end]!) ||
		(encoded && value.startsWith('%2F', end));
	return before && after;
}

function projectExactLaneToken(value: string, token: string, encoded: boolean) {
	let projected = '';
	let copiedThrough = 0;
	let searchFrom = 0;
	let candidateCount = 0;
	let acceptedOccurrenceCount = 0;
	let rejectedOccurrenceCount = 0;
	while (searchFrom < value.length) {
		const index = value.indexOf(token, searchFrom);
		if (index < 0) break;
		candidateCount += 1;
		if (!hasExactTokenBoundary(value, index, token, encoded)) {
			rejectedOccurrenceCount += 1;
			searchFrom = index + token.length;
			continue;
		}
		projected += `${value.slice(copiedThrough, index)}<LANE>`;
		copiedThrough = index + token.length;
		searchFrom = copiedThrough;
		acceptedOccurrenceCount += 1;
	}
	return {
		value: `${projected}${value.slice(copiedThrough)}`,
		candidateCount,
		acceptedOccurrenceCount,
		rejectedOccurrenceCount,
	};
}

export function categorizeLaneValues(values: unknown[], laneRoot: string) {
	const encodedLaneRoot = querystringEscape(laneRoot);
	if (encodedLaneRoot === laneRoot) throw new Error('T261 encoded lane token differs');
	let literalCandidateCount = 0;
	let acceptedLiteralOccurrenceCount = 0;
	let rejectedLiteralOccurrenceCount = 0;
	let encodedCandidateCount = 0;
	let acceptedEncodedOccurrenceCount = 0;
	let rejectedEncodedOccurrenceCount = 0;
	let literalOnlyValueCount = 0;
	let encodedOnlyValueCount = 0;
	let bothTokenFormsValueCount = 0;
	const tokenlessValues: string[] = [];
	const laneBearingProjectedValues: string[] = [];
	const projectedValues = values.map((value) => {
		if (typeof value !== 'string') throw new Error('T261 eligible trace value is not a string');
		const literal = projectExactLaneToken(value, laneRoot, false);
		const encoded = projectExactLaneToken(literal.value, encodedLaneRoot, true);
		literalCandidateCount += literal.candidateCount;
		acceptedLiteralOccurrenceCount += literal.acceptedOccurrenceCount;
		rejectedLiteralOccurrenceCount += literal.rejectedOccurrenceCount;
		encodedCandidateCount += encoded.candidateCount;
		acceptedEncodedOccurrenceCount += encoded.acceptedOccurrenceCount;
		rejectedEncodedOccurrenceCount += encoded.rejectedOccurrenceCount;
		const hasLiteral = literal.acceptedOccurrenceCount > 0;
		const hasEncoded = encoded.acceptedOccurrenceCount > 0;
		if (hasLiteral && hasEncoded) bothTokenFormsValueCount += 1;
		else if (hasLiteral) literalOnlyValueCount += 1;
		else if (hasEncoded) encodedOnlyValueCount += 1;
		else tokenlessValues.push(value);
		if (hasLiteral || hasEncoded) laneBearingProjectedValues.push(encoded.value);
		return encoded.value;
	});
	return {
		projectedValues: projectedValues.sort(compare),
		tokenlessValues: tokenlessValues.sort(compare),
		laneBearingProjectedValues: laneBearingProjectedValues.sort(compare),
		literalCandidateCount,
		acceptedLiteralOccurrenceCount,
		rejectedLiteralOccurrenceCount,
		encodedCandidateCount,
		acceptedEncodedOccurrenceCount,
		rejectedEncodedOccurrenceCount,
		literalOnlyValueCount,
		encodedOnlyValueCount,
		bothTokenFormsValueCount,
		tokenlessOccurrenceCount: tokenlessValues.length,
		tokenlessDistinctCount: new Set(tokenlessValues).size,
		projectedDistinctCount: new Set(projectedValues).size,
	};
}

function multisetEqual(first: string[], second: string[]): boolean {
	return canonicalize(first) === canonicalize(second);
}

const laneProjectionFailureCategories = [
	'tokenless-multiset-mismatch',
	'lane-bearing-projected-multiset-mismatch',
	'complete-projected-multiset-mismatch',
	'literal-candidate-count-mismatch',
	'literal-accepted-count-mismatch',
	'literal-rejected-count-mismatch',
	'encoded-candidate-count-mismatch',
	'encoded-accepted-count-mismatch',
	'encoded-rejected-count-mismatch',
	'token-category-count-mismatch',
	'projected-distinct-count-mismatch',
] as const;

type LaneProjectionFailureCategory = (typeof laneProjectionFailureCategories)[number];

export function compareLaneValueCategories(
	firstValues: unknown[],
	secondValues: unknown[],
	firstLane: string,
	secondLane: string,
) {
	const first = categorizeLaneValues(firstValues, firstLane);
	const second = categorizeLaneValues(secondValues, secondLane);
	const tokenlessMultisetEqual = multisetEqual(first.tokenlessValues, second.tokenlessValues);
	const laneBearingProjectedMultisetEqual = multisetEqual(
		first.laneBearingProjectedValues,
		second.laneBearingProjectedValues,
	);
	const fullProjectedMultisetEqual = multisetEqual(first.projectedValues, second.projectedValues);
	const failureCategories: LaneProjectionFailureCategory[] = [];
	if (!tokenlessMultisetEqual) failureCategories.push('tokenless-multiset-mismatch');
	if (!laneBearingProjectedMultisetEqual)
		failureCategories.push('lane-bearing-projected-multiset-mismatch');
	if (!fullProjectedMultisetEqual) failureCategories.push('complete-projected-multiset-mismatch');
	if (first.literalCandidateCount !== second.literalCandidateCount)
		failureCategories.push('literal-candidate-count-mismatch');
	if (first.acceptedLiteralOccurrenceCount !== second.acceptedLiteralOccurrenceCount)
		failureCategories.push('literal-accepted-count-mismatch');
	if (first.rejectedLiteralOccurrenceCount !== second.rejectedLiteralOccurrenceCount)
		failureCategories.push('literal-rejected-count-mismatch');
	if (first.encodedCandidateCount !== second.encodedCandidateCount)
		failureCategories.push('encoded-candidate-count-mismatch');
	if (first.acceptedEncodedOccurrenceCount !== second.acceptedEncodedOccurrenceCount)
		failureCategories.push('encoded-accepted-count-mismatch');
	if (first.rejectedEncodedOccurrenceCount !== second.rejectedEncodedOccurrenceCount)
		failureCategories.push('encoded-rejected-count-mismatch');
	if (
		first.literalOnlyValueCount !== second.literalOnlyValueCount ||
		first.encodedOnlyValueCount !== second.encodedOnlyValueCount ||
		first.bothTokenFormsValueCount !== second.bothTokenFormsValueCount ||
		first.tokenlessOccurrenceCount !== second.tokenlessOccurrenceCount ||
		first.tokenlessDistinctCount !== second.tokenlessDistinctCount
	)
		failureCategories.push('token-category-count-mismatch');
	if (first.projectedDistinctCount !== second.projectedDistinctCount)
		failureCategories.push('projected-distinct-count-mismatch');
	return {
		firstLiteralCandidateCount: first.literalCandidateCount,
		secondLiteralCandidateCount: second.literalCandidateCount,
		firstAcceptedLiteralOccurrenceCount: first.acceptedLiteralOccurrenceCount,
		secondAcceptedLiteralOccurrenceCount: second.acceptedLiteralOccurrenceCount,
		firstRejectedLiteralOccurrenceCount: first.rejectedLiteralOccurrenceCount,
		secondRejectedLiteralOccurrenceCount: second.rejectedLiteralOccurrenceCount,
		firstEncodedCandidateCount: first.encodedCandidateCount,
		secondEncodedCandidateCount: second.encodedCandidateCount,
		firstAcceptedEncodedOccurrenceCount: first.acceptedEncodedOccurrenceCount,
		secondAcceptedEncodedOccurrenceCount: second.acceptedEncodedOccurrenceCount,
		firstRejectedEncodedOccurrenceCount: first.rejectedEncodedOccurrenceCount,
		secondRejectedEncodedOccurrenceCount: second.rejectedEncodedOccurrenceCount,
		firstLiteralOnlyValueCount: first.literalOnlyValueCount,
		secondLiteralOnlyValueCount: second.literalOnlyValueCount,
		firstEncodedOnlyValueCount: first.encodedOnlyValueCount,
		secondEncodedOnlyValueCount: second.encodedOnlyValueCount,
		firstBothTokenFormsValueCount: first.bothTokenFormsValueCount,
		secondBothTokenFormsValueCount: second.bothTokenFormsValueCount,
		firstTokenlessOccurrenceCount: first.tokenlessOccurrenceCount,
		secondTokenlessOccurrenceCount: second.tokenlessOccurrenceCount,
		firstTokenlessDistinctCount: first.tokenlessDistinctCount,
		secondTokenlessDistinctCount: second.tokenlessDistinctCount,
		firstProjectedDistinctCount: first.projectedDistinctCount,
		secondProjectedDistinctCount: second.projectedDistinctCount,
		tokenlessMultisetEqual,
		laneBearingProjectedMultisetEqual,
		fullProjectedMultisetEqual,
		failureCategories: failureCategories.sort(compare),
	};
}

function laneProjectionDiagnostic(
	first: Awaited<ReturnType<typeof aggregateTraceDiagnostic>>,
	second: Awaited<ReturnType<typeof aggregateTraceDiagnostic>>,
	firstLane: string,
	secondLane: string,
	comparison: ReturnType<typeof compareAggregateTraces>,
) {
	if (comparison.tagValueDifferences.length !== expectedTraceValueDimensions.length)
		throw new Error('T259 trace value dimension count differs');
	const actualByKey = new Map(
		comparison.tagValueDifferences.map((dimension) => [
			canonicalize([dimension.name, dimension.parentName, dimension.tagKey]),
			dimension,
		]),
	);
	const dimensions = expectedTraceValueDimensions.map((expected) => {
		const key = canonicalize([expected.name, expected.parentName, expected.tagKey]);
		const actual = actualByKey.get(key);
		if (
			!actual ||
			actual.equal ||
			actual.firstOccurrenceCount !== expected.occurrenceCount ||
			actual.secondOccurrenceCount !== expected.occurrenceCount ||
			actual.firstDistinctCount !== expected.distinctCount ||
			actual.secondDistinctCount !== expected.distinctCount
		)
			throw new Error('T259 trace value dimension identity or counts differ');
		const safeIdentity = {
			name: expected.name,
			parentName: expected.parentName,
			tagKey: expected.tagKey,
			sourceCategory: expected.sourceCategory,
			projectionEligible: expected.projectionEligible,
			originalEqual: false,
		};
		if (!expected.projectionEligible)
			return { ...safeIdentity, projectedEqual: null, residual: true };
		const firstValues = first.valueDimensions.get(key)?.values;
		const secondValues = second.valueDimensions.get(key)?.values;
		if (!firstValues || !secondValues)
			throw new Error('T259 eligible trace value dimension is absent');
		const categoryComparison = compareLaneValueCategories(
			firstValues,
			secondValues,
			firstLane,
			secondLane,
		);
		return {
			...safeIdentity,
			projectedEqual: categoryComparison.fullProjectedMultisetEqual,
			residual: false,
			firstOccurrenceCount: actual.firstOccurrenceCount,
			secondOccurrenceCount: actual.secondOccurrenceCount,
			firstDistinctCount: actual.firstDistinctCount,
			secondDistinctCount: actual.secondDistinctCount,
			...categoryComparison,
		};
	});
	const residualDimensions = dimensions.filter((dimension) => dimension.residual);
	if (actualByKey.size !== dimensions.length || residualDimensions.length !== 1)
		throw new Error('T259 residual trace value dimensions differ');
	return {
		exactDimensionCount: dimensions.length,
		eligibleDimensionCount: dimensions.filter((dimension) => dimension.projectionEligible)
			.length,
		nonProjectableDimensionCount: residualDimensions.length,
		allEligibleProjectedEqual: dimensions
			.filter((dimension) => dimension.projectionEligible)
			.every((dimension) => dimension.projectedEqual === true),
		allDifferencesLaneDerived: false,
		valuesRetained: false,
		valueHashesRetained: false,
		pathsRetained: false,
		dimensions,
		residualDimensions,
	};
}

async function prerenderDiagnostic(
	firstFile: string,
	secondFile: string,
	firstBuildId: string,
	secondBuildId: string,
) {
	const firstRaw = await readFile(firstFile);
	const secondRaw = await readFile(secondFile);
	const first = JSON.parse(firstRaw.toString('utf8')) as Record<string, unknown>;
	const second = JSON.parse(secondRaw.toString('utf8')) as Record<string, unknown>;
	const topLevelKeys = ['dynamicRoutes', 'notFoundRoutes', 'preview', 'routes', 'version'];
	const secretPaths = [
		'previewModeId',
		'previewModeSigningKey',
		'previewModeEncryptionKey',
	] as const;
	for (const manifest of [first, second]) {
		if (canonicalize(Object.keys(manifest).sort(compare)) !== canonicalize(topLevelKeys))
			throw new Error('T246 prerender top-level keys differ');
		if (
			manifest.version !== 3 ||
			!manifest.routes ||
			typeof manifest.routes !== 'object' ||
			Array.isArray(manifest.routes) ||
			canonicalize(Object.keys(manifest.routes).sort(compare)) !== canonicalize(['/']) ||
			!manifest.dynamicRoutes ||
			typeof manifest.dynamicRoutes !== 'object' ||
			Array.isArray(manifest.dynamicRoutes) ||
			Object.keys(manifest.dynamicRoutes).length !== 0 ||
			!Array.isArray(manifest.notFoundRoutes) ||
			manifest.notFoundRoutes.length !== 0
		)
			throw new Error('T246 prerender static SSG shape differs');
		const route = (manifest.routes as Record<string, unknown>)['/'] as
			| Record<string, unknown>
			| undefined;
		if (
			!route ||
			canonicalize(Object.keys(route).sort(compare)) !==
				canonicalize(['dataRoute', 'initialRevalidateSeconds', 'srcRoute']) ||
			route.srcRoute !== null ||
			typeof route.dataRoute !== 'string'
		)
			throw new Error('T246 prerender route shape differs');
	}
	const firstRoute = (first.routes as Record<string, Record<string, unknown>>)['/']!;
	const secondRoute = (second.routes as Record<string, Record<string, unknown>>)['/']!;
	if (
		typeof firstRoute.initialRevalidateSeconds !==
			typeof secondRoute.initialRevalidateSeconds ||
		canonicalize(firstRoute.initialRevalidateSeconds) !==
			canonicalize(secondRoute.initialRevalidateSeconds)
	)
		throw new Error('T246 prerender revalidation semantics differ');
	const firstDataRoute = String(firstRoute.dataRoute);
	const secondDataRoute = String(secondRoute.dataRoute);
	if (
		firstDataRoute !== `/_next/data/${firstBuildId}/index.json` ||
		secondDataRoute !== `/_next/data/${secondBuildId}/index.json` ||
		occurrenceCount(firstDataRoute, firstBuildId) !== 1 ||
		occurrenceCount(secondDataRoute, secondBuildId) !== 1
	)
		throw new Error('T246 prerender BUILD_ID-derived data route differs');
	const previewFirst = first.preview as Record<string, unknown> | undefined;
	const previewSecond = second.preview as Record<string, unknown> | undefined;
	if (
		!previewFirst ||
		!previewSecond ||
		canonicalize(Object.keys(previewFirst).sort(compare)) !==
			canonicalize([...secretPaths].sort(compare)) ||
		canonicalize(Object.keys(previewSecond).sort(compare)) !==
			canonicalize([...secretPaths].sort(compare))
	)
		throw new Error('T246 prerender preview shape differs');
	const expectedLengths = [32, 64, 64] as const;
	const previewComparison = secretPaths.map((key, index) => {
		const left = previewFirst[key];
		const right = previewSecond[key];
		const pattern = expectedLengths[index] === 32 ? lowerHex32 : lowerHex64;
		if (
			typeof left !== 'string' ||
			typeof right !== 'string' ||
			!pattern.test(left) ||
			!pattern.test(right)
		)
			throw new Error(`T240 prerender ${key} format differs`);
		return {
			path: `preview.${key}`,
			classification: 'preview-secret',
			firstLength: left.length,
			secondLength: right.length,
			lowercaseHex: true,
			equal: left === right,
		};
	});
	const redactedFirst = structuredClone(first);
	const redactedSecond = structuredClone(second);
	(
		(redactedFirst.routes as Record<string, Record<string, unknown>>)['/'] as Record<
			string,
			unknown
		>
	).dataRoute = '/_next/data/<BUILD_ID>/index.json';
	(
		(redactedSecond.routes as Record<string, Record<string, unknown>>)['/'] as Record<
			string,
			unknown
		>
	).dataRoute = '/_next/data/<BUILD_ID>/index.json';
	for (const key of secretPaths) {
		(redactedFirst.preview as Record<string, unknown>)[key] = '<PREVIEW_SECRET>';
		(redactedSecond.preview as Record<string, unknown>)[key] = '<PREVIEW_SECRET>';
	}
	const nonPreviewEntries = [
		...decodedEntries(first).filter((entry) => !entry.path.startsWith('preview')),
		...decodedEntries(second).filter((entry) => !entry.path.startsWith('preview')),
	];
	if (
		nonPreviewEntries.some(
			(entry) =>
				entry.path !== 'routes./.dataRoute' &&
				typeof entry.value === 'string' &&
				[String(entry.value)].some(
					(value) => value.includes(firstBuildId) || value.includes(secondBuildId),
				),
		)
	)
		throw new Error('T246 prerender contains BUILD_ID outside the derived field');
	const firstFields = safeDecodedFields(redactedFirst);
	const secondFields = safeDecodedFields(redactedSecond);
	const rightFields = new Map(secondFields.map((field) => [field.path, field]));
	const semanticFieldComparison = firstFields.map((field) => ({
		path: field.path,
		type: field.type,
		firstSha256: sha256(canonicalize(field)),
		secondSha256: sha256(canonicalize(rightFields.get(field.path) ?? null)),
		equal: canonicalize(field) === canonicalize(rightFields.get(field.path)),
	}));
	if (
		firstFields.length !== secondFields.length ||
		semanticFieldComparison.some((field) => !field.equal) ||
		canonicalize(redactedFirst) !== canonicalize(redactedSecond)
	)
		throw new Error('T246 prerender differs outside approved derived fields');
	return {
		first: { rawSha256: sha256(firstRaw), byteLength: firstRaw.byteLength },
		second: { rawSha256: sha256(secondRaw), byteLength: secondRaw.byteLength },
		buildIdOccurrences: [
			{
				path: "routes['/'].dataRoute",
				firstOccurrences: 1,
				secondOccurrences: 1,
				projection: '<BUILD_ID>',
			},
		],
		semanticFieldComparison,
		previewComparison,
		stableProjectionSha256: sha256(canonicalize(redactedFirst)),
		firstStableProjectionSha256: sha256(canonicalize(redactedFirst)),
		secondStableProjectionSha256: sha256(canonicalize(redactedSecond)),
		stableEqual: true,
		generatedBuildIdsRetained: false,
		containsBuildIdOutsideDerivedFields: false,
	};
}

type SafeDecodedField = {
	path: string;
	type: string;
	objectKeyCount?: number;
	objectKeysSha256?: string;
	arrayLength?: number;
	scalarSha256?: string;
};

function safeDecodedFields(value: unknown, current = '<root>'): SafeDecodedField[] {
	if (Array.isArray(value))
		return [
			{ path: current, type: 'array', arrayLength: value.length },
			...value.flatMap((item, index) => safeDecodedFields(item, `${current}[${index}]`)),
		];
	if (value && typeof value === 'object') {
		const keys = Object.keys(value).sort(compare);
		return [
			{
				path: current,
				type: 'object',
				objectKeyCount: keys.length,
				objectKeysSha256: sha256(canonicalize(keys)),
			},
			...keys.flatMap((key) =>
				safeDecodedFields(
					(value as Record<string, unknown>)[key],
					current === '<root>' ? key : `${current}.${key}`,
				),
			),
		];
	}
	return [
		{
			path: current,
			type: value === null ? 'null' : typeof value,
			scalarSha256: sha256(canonicalize(value)),
		},
	];
}

function decodedEntries(
	value: unknown,
	current = '<root>',
): Array<{ path: string; value: unknown }> {
	if (Array.isArray(value))
		return [
			{ path: current, value },
			...value.flatMap((item, index) => decodedEntries(item, `${current}[${index}]`)),
		];
	if (value && typeof value === 'object')
		return [
			{ path: current, value },
			...Object.entries(value).flatMap(([key, item]) =>
				decodedEntries(item, current === '<root>' ? key : `${current}.${key}`),
			),
		];
	return [{ path: current, value }];
}

async function requiredServerFilesDiagnostic(
	firstFile: string,
	secondFile: string,
	firstLane: string,
	secondLane: string,
	firstBuildId: string,
	secondBuildId: string,
	firstPrerenderFile: string,
	secondPrerenderFile: string,
) {
	const firstRaw = await readFile(firstFile);
	const secondRaw = await readFile(secondFile);
	const first = JSON.parse(firstRaw.toString('utf8')) as Record<string, unknown>;
	const second = JSON.parse(secondRaw.toString('utf8')) as Record<string, unknown>;
	const expectedKeys = ['appDir', 'config', 'files', 'ignore', 'version'];
	for (const value of [first, second]) {
		if (canonicalize(Object.keys(value).sort(compare)) !== canonicalize(expectedKeys))
			throw new Error('T242 required-server-files top-level keys differ');
		if (
			value.version !== 1 ||
			!value.config ||
			typeof value.config !== 'object' ||
			Array.isArray(value.config) ||
			!Array.isArray(value.files) ||
			value.files.some((item) => typeof item !== 'string') ||
			!Array.isArray(value.ignore) ||
			value.ignore.some((item) => typeof item !== 'string')
		)
			throw new Error('T242 required-server-files decoded shape differs');
		const fieldNames = decodedEntries(value).map((entry) => entry.path.split('.').at(-1));
		if (fieldNames.includes('configFile') || fieldNames.includes('relativeAppDir'))
			throw new Error('T242 required-server-files contains a prohibited path field');
	}
	if (first.appDir !== firstLane || second.appDir !== secondLane)
		throw new Error('T242 required-server-files appDir does not equal its lane');
	const firstPrerender = JSON.parse(await readFile(firstPrerenderFile, 'utf8')) as {
		preview?: Record<string, unknown>;
	};
	const secondPrerender = JSON.parse(await readFile(secondPrerenderFile, 'utf8')) as {
		preview?: Record<string, unknown>;
	};
	const secretValues = [
		...Object.values(firstPrerender.preview ?? {}),
		...Object.values(secondPrerender.preview ?? {}),
	].filter((value): value is string => typeof value === 'string');
	const allEntries = [...decodedEntries(first), ...decodedEntries(second)];
	const nonAppDirScalars = allEntries.filter(
		(entry) => entry.path !== 'appDir' && typeof entry.value === 'string',
	);
	const containsPreviewSecrets = nonAppDirScalars.some((entry) =>
		secretValues.includes(String(entry.value)),
	);
	const containsGeneratedBuildId = nonAppDirScalars.some((entry) =>
		[firstBuildId, secondBuildId].includes(String(entry.value)),
	);
	const prohibitedVolatileNames = new Set([
		'traceId',
		'timestamp',
		'randomId',
		'randomIdentifier',
	]);
	const containsVolatileIdentifier = allEntries.some((entry) =>
		prohibitedVolatileNames.has(entry.path.split('.').at(-1) ?? ''),
	);
	if (containsPreviewSecrets || containsGeneratedBuildId || containsVolatileIdentifier)
		throw new Error('T242 required-server-files contains prohibited volatile or absolute data');
	const firstStable = structuredClone(first);
	const secondStable = structuredClone(second);
	firstStable.appDir = '<LANE>';
	secondStable.appDir = '<LANE>';
	const firstFields = safeDecodedFields(firstStable);
	const secondFields = safeDecodedFields(secondStable);
	if (canonicalize(firstFields) !== canonicalize(secondFields))
		throw new Error('T242 required-server-files differs outside appDir');
	return {
		first: { rawSha256: sha256(firstRaw), byteLength: firstRaw.byteLength },
		second: { rawSha256: sha256(secondRaw), byteLength: secondRaw.byteLength },
		appDirComparison: {
			classification: 'build-local-app-dir',
			validatedAgainstLane: true,
			projection: '<LANE>',
			first: { byteLength: Buffer.byteLength(firstLane), sha256: sha256(firstLane) },
			second: { byteLength: Buffer.byteLength(secondLane), sha256: sha256(secondLane) },
		},
		decodedFields: firstFields,
		stableProjectionSha256: sha256(canonicalize(firstStable)),
		firstStableProjectionSha256: sha256(canonicalize(firstStable)),
		secondStableProjectionSha256: sha256(canonicalize(secondStable)),
		stableEqual: true,
		containsPreviewSecrets: false,
		containsGeneratedBuildId: false,
		containsRelativeAppDir: false,
		containsVolatileIdentifier: false,
	};
}

function jsonType(value: unknown): string {
	if (value === undefined) return 'absent';
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'array';
	return typeof value;
}

function safeFieldMetadata(fieldPath: string, value: unknown, lane: string) {
	const encoded = canonicalize(value);
	let laneRelation:
		| 'exact-lane-root'
		| 'strictly-under-lane-root'
		| 'not-lane-root-derived'
		| 'not-applicable';
	if (typeof value !== 'string') laneRelation = 'not-applicable';
	else if (fieldPath === 'config.images.path') laneRelation = 'not-lane-root-derived';
	else if (value === lane) laneRelation = 'exact-lane-root';
	else if (value.startsWith(`${lane}/`)) laneRelation = 'strictly-under-lane-root';
	else laneRelation = 'not-lane-root-derived';
	return {
		type: jsonType(value),
		byteLength: Buffer.byteLength(encoded),
		sha256: sha256(encoded),
		laneRelation,
	};
}

async function requiredServerFilesFieldDiagnostic(
	firstFile: string,
	secondFile: string,
	firstLane: string,
	secondLane: string,
) {
	const first = JSON.parse(await readFile(firstFile, 'utf8')) as Record<string, unknown>;
	const second = JSON.parse(await readFile(secondFile, 'utf8')) as Record<string, unknown>;
	const expectedKeys = ['appDir', 'config', 'files', 'ignore', 'version'];
	for (const value of [first, second]) {
		if (canonicalize(Object.keys(value).sort(compare)) !== canonicalize(expectedKeys))
			throw new Error('T251 required-server-files top-level keys differ');
		if (
			value.version !== 1 ||
			!value.config ||
			typeof value.config !== 'object' ||
			Array.isArray(value.config) ||
			!Array.isArray(value.files) ||
			value.files.some((item) => typeof item !== 'string') ||
			!Array.isArray(value.ignore) ||
			value.ignore.some((item) => typeof item !== 'string')
		)
			throw new Error('T251 required-server-files decoded shape differs');
		const fieldNames = decodedEntries(value).map((entry) => entry.path.split('.').at(-1));
		if (fieldNames.includes('configFile') || fieldNames.includes('relativeAppDir'))
			throw new Error('T251 required-server-files contains a prohibited field');
	}
	if (first.appDir !== firstLane || second.appDir !== secondLane)
		throw new Error('T251 required-server-files appDir does not equal its lane');
	const firstEntries = new Map(decodedEntries(first).map((entry) => [entry.path, entry.value]));
	const secondEntries = new Map(decodedEntries(second).map((entry) => [entry.path, entry.value]));
	const comparedPaths = [...new Set([...firstEntries.keys(), ...secondEntries.keys()])].sort(
		compare,
	);
	const fieldDifferences = comparedPaths
		.filter(
			(fieldPath) =>
				canonicalize(firstEntries.get(fieldPath)) !==
				canonicalize(secondEntries.get(fieldPath)),
		)
		.map((fieldPath) => ({
			path: fieldPath,
			first: safeFieldMetadata(fieldPath, firstEntries.get(fieldPath), firstLane),
			second: safeFieldMetadata(fieldPath, secondEntries.get(fieldPath), secondLane),
			equal: false,
		}));
	if (!fieldDifferences.length || !fieldDifferences.some((field) => field.path === 'appDir'))
		throw new Error('T251 required-server field-difference inventory is incomplete');
	return {
		comparedFieldCount: comparedPaths.length,
		comparedPathSetSha256: sha256(canonicalize(comparedPaths)),
		fieldDifferences,
		appDirProjection: '<LANE>',
		semanticDecision: null,
	};
}

function next12EscapeStringRegexp(value: string): string {
	return value.replace(next12EscapeStringRegexpPattern, (character) => `\\${character}`);
}

function occurrenceCount(value: string, needle: string): number {
	if (!needle) throw new Error('T244 cannot count an empty BUILD_ID representation');
	return value.split(needle).length - 1;
}

async function routesManifestDiagnostic(
	firstFile: string,
	secondFile: string,
	firstBuildId: string,
	secondBuildId: string,
) {
	const firstRaw = await readFile(firstFile);
	const secondRaw = await readFile(secondFile);
	const first = JSON.parse(firstRaw.toString('utf8')) as Record<string, unknown>;
	const second = JSON.parse(secondRaw.toString('utf8')) as Record<string, unknown>;
	const expectedKeys = [
		'basePath',
		'dataRoutes',
		'dynamicRoutes',
		'headers',
		'pages404',
		'redirects',
		'rewrites',
		'staticRoutes',
		'version',
	];
	for (const manifest of [first, second]) {
		if (canonicalize(Object.keys(manifest).sort(compare)) !== canonicalize(expectedKeys))
			throw new Error('T244 routes-manifest top-level keys differ');
		if (
			manifest.version !== 3 ||
			manifest.pages404 !== true ||
			typeof manifest.basePath !== 'string' ||
			!Array.isArray(manifest.redirects) ||
			!Array.isArray(manifest.headers) ||
			!Array.isArray(manifest.staticRoutes) ||
			!Array.isArray(manifest.dynamicRoutes) ||
			!Array.isArray(manifest.dataRoutes)
		)
			throw new Error('T244 routes-manifest top-level types differ');
		if (manifest.dataRoutes.length !== 1)
			throw new Error('T244 routes-manifest dataRoutes cardinality differs');
		const dataRoute = manifest.dataRoutes[0] as Record<string, unknown>;
		if (
			!dataRoute ||
			typeof dataRoute !== 'object' ||
			canonicalize(Object.keys(dataRoute).sort(compare)) !==
				canonicalize(['dataRouteRegex', 'page']) ||
			dataRoute.page !== '/' ||
			typeof dataRoute.dataRouteRegex !== 'string'
		)
			throw new Error('T244 routes-manifest static data route shape differs');
	}
	const firstRoute = (first.dataRoutes as Array<Record<string, unknown>>)[0]!;
	const secondRoute = (second.dataRoutes as Array<Record<string, unknown>>)[0]!;
	const firstRegex = String(firstRoute.dataRouteRegex);
	const secondRegex = String(secondRoute.dataRouteRegex);
	const firstEncoded = next12EscapeStringRegexp(firstBuildId);
	const secondEncoded = next12EscapeStringRegexp(secondBuildId);
	const firstOccurrences = occurrenceCount(firstRegex, firstEncoded);
	const secondOccurrences = occurrenceCount(secondRegex, secondEncoded);
	if (
		firstOccurrences !== 1 ||
		secondOccurrences !== 1 ||
		occurrenceCount(firstRegex, secondEncoded) !== 0 ||
		occurrenceCount(secondRegex, firstEncoded) !== 0
	)
		throw new Error('T244 routes-manifest encoded BUILD_ID occurrence differs');
	const targetPath = 'dataRoutes[0].dataRouteRegex';
	const representations = [firstBuildId, secondBuildId, firstEncoded, secondEncoded];
	for (const [manifest, ownRegex] of [
		[first, firstRegex],
		[second, secondRegex],
	] as const) {
		for (const entry of decodedEntries(manifest)) {
			if (entry.path === targetPath) continue;
			if (
				typeof entry.value === 'string' &&
				representations.some((representation) =>
					String(entry.value).includes(representation),
				)
			)
				throw new Error('T244 routes-manifest contains BUILD_ID outside the derived field');
		}
		if (decodedEntries(manifest).filter((entry) => entry.path === targetPath).length !== 1)
			throw new Error('T244 routes-manifest derived field path differs');
		if (!ownRegex) throw new Error('T244 routes-manifest derived regex is empty');
	}
	const firstIndex = firstRegex.indexOf(firstEncoded);
	const secondIndex = secondRegex.indexOf(secondEncoded);
	const firstPrefix = firstRegex.slice(0, firstIndex);
	const firstSuffix = firstRegex.slice(firstIndex + firstEncoded.length);
	const secondPrefix = secondRegex.slice(0, secondIndex);
	const secondSuffix = secondRegex.slice(secondIndex + secondEncoded.length);
	const firstTokenized = structuredClone(first);
	const secondTokenized = structuredClone(second);
	(firstTokenized.dataRoutes as Array<Record<string, unknown>>)[0]!.dataRouteRegex =
		`${firstPrefix}<BUILD_ID>${firstSuffix}`;
	(secondTokenized.dataRoutes as Array<Record<string, unknown>>)[0]!.dataRouteRegex =
		`${secondPrefix}<BUILD_ID>${secondSuffix}`;
	const firstFields = safeDecodedFields(firstTokenized);
	const secondFields = safeDecodedFields(secondTokenized);
	const firstByPath = new Map(firstFields.map((field) => [field.path, field]));
	const secondByPath = new Map(secondFields.map((field) => [field.path, field]));
	const semanticFieldComparison = [...new Set([...firstByPath.keys(), ...secondByPath.keys()])]
		.sort(compare)
		.map((fieldPath) => {
			const left = firstByPath.get(fieldPath);
			const right = secondByPath.get(fieldPath);
			return {
				path: fieldPath,
				type: left?.type ?? right?.type ?? 'absent',
				firstSha256: sha256(canonicalize(left ?? null)),
				secondSha256: sha256(canonicalize(right ?? null)),
				equal: canonicalize(left) === canonicalize(right),
			};
		});
	if (semanticFieldComparison.some((field) => !field.equal))
		throw new Error('T244 routes-manifest semantic projection differs');
	return {
		first: { rawSha256: sha256(firstRaw), byteLength: firstRaw.byteLength },
		second: { rawSha256: sha256(secondRaw), byteLength: secondRaw.byteLength },
		derivedOccurrences: [
			{
				path: targetPath,
				firstOccurrences,
				secondOccurrences,
				projection: '<BUILD_ID>',
				firstSurroundings: {
					prefixByteLength: Buffer.byteLength(firstPrefix),
					prefixSha256: sha256(firstPrefix),
					suffixByteLength: Buffer.byteLength(firstSuffix),
					suffixSha256: sha256(firstSuffix),
				},
				secondSurroundings: {
					prefixByteLength: Buffer.byteLength(secondPrefix),
					prefixSha256: sha256(secondPrefix),
					suffixByteLength: Buffer.byteLength(secondSuffix),
					suffixSha256: sha256(secondSuffix),
				},
			},
		],
		semanticFieldComparison,
		stableProjectionSha256: sha256(canonicalize(firstTokenized)),
		firstStableProjectionSha256: sha256(canonicalize(firstTokenized)),
		secondStableProjectionSha256: sha256(canonicalize(secondTokenized)),
		stableEqual: true,
		generatedBuildIdsRetained: false,
		containsBuildIdOutsideDerivedFields: false,
	};
}

async function nftDiagnostic(file: string, lane: string) {
	const raw = await readFile(file);
	const parsed = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
	const relativeManifest = path.relative(path.join(lane, '.next'), file);
	const allowed = new Set(
		relativeManifest === 'next-server.js.nft.json'
			? ['version', 'files', 'cacheKey']
			: ['version', 'files'],
	);
	const unexpected = Object.keys(parsed).filter((key) => !allowed.has(key));
	if (unexpected.length || typeof parsed.version !== 'number' || !Array.isArray(parsed.files))
		throw new Error(`T240 NFT shape differs: ${relativeManifest}`);
	const members = parsed.files;
	if (members.some((member) => typeof member !== 'string'))
		throw new Error(`T240 NFT member shape differs: ${relativeManifest}`);
	if (new Set(members).size !== members.length)
		throw new Error(`T240 NFT duplicate membership: ${relativeManifest}`);
	const bindings = await Promise.all(
		members.map(async (member) => {
			const originalMember = String(member);
			const target = path.resolve(path.dirname(file), originalMember);
			const portablePath = path.relative(lane, target);
			if (portablePath.startsWith('..') || path.isAbsolute(portablePath))
				throw new Error(`T240 NFT member escapes lane: ${relativeManifest}`);
			const metadata = await lstat(target);
			if (!metadata.isFile() && !metadata.isSymbolicLink())
				throw new Error(`T240 NFT target type differs: ${relativeManifest}`);
			return {
				originalMember,
				portablePath,
				targetType: metadata.isSymbolicLink() ? 'symbolic-link' : 'file',
				targetSha256: sha256(await readFile(target)),
			};
		}),
	);
	bindings.sort((left, right) => compare(canonicalize(left), canonicalize(right)));
	return {
		path: relativeManifest,
		rawSha256: sha256(raw),
		byteLength: raw.byteLength,
		version: parsed.version,
		cacheKeySha256: Object.hasOwn(parsed, 'cacheKey')
			? sha256(canonicalize(parsed.cacheKey))
			: null,
		bindings,
		bindingsSha256: sha256(canonicalize(bindings)),
	};
}

export const productionNftPaths = [
	'next-server.js.nft.json',
	'server/pages/_app.js.nft.json',
	'server/pages/_document.js.nft.json',
	'server/pages/_error.js.nft.json',
	'server/pages/index.js.nft.json',
] as const;

export type ProductionNftPath = (typeof productionNftPaths)[number];

const productionSnapshotIdentities = [
	'baseline-first',
	'baseline-second',
	'migrated-first',
	'migrated-second',
] as const;

export type ProductionSnapshotIdentity = (typeof productionSnapshotIdentities)[number];

export type ProductionSnapshot = Readonly<{
	identity: ProductionSnapshotIdentity;
	canonicalLaneRoot: string;
	storageRoot: string;
	buildId: string;
	inventory: readonly BuildFileRow[];
	nftBindings: readonly ProductionNftBinding[];
}>;

export type ProductionNftBinding = Readonly<{
	relativeManifest: ProductionNftPath;
	version: 1;
	rawSha256: string;
	rawByteLength: number;
	bindings: readonly Readonly<{
		member: string;
		laneRelativeTarget: string;
		realLaneRelativeTarget: string;
		physicalRoot: 'canonical-lane' | 'snapshot-storage';
		targetType: 'symbolic-link' | 'file';
		targetSha256: string;
		targetByteLength: number;
	}>[];
	cacheKeyPresent: boolean;
	cacheKeyType: 'string' | 'absent';
	cacheKeySha256: string | null;
	cacheKeyByteLength: number | null;
	traceMembershipOccurrences: number;
}>;

export const killedByGoogleBrowserOracle = Object.freeze({
	total: 263,
	apps: 50,
	googlePlus: Object.freeze({
		name: 'Google+',
		type: 'service',
		link: 'https://en.wikipedia.org/wiki/Google%2B',
		description: 'Google+ was an Internet-based social network.',
	}),
});

export class KilledByGoogleJourneyOracleError extends Error {
	readonly code: 'google-plus-product-count';
	readonly expected: 1;
	readonly actual: number;

	constructor(actual: number) {
		super(`Killed by Google Google+ product count differs: expected 1, actual ${actual}`);
		this.name = 'KilledByGoogleJourneyOracleError';
		this.code = 'google-plus-product-count';
		this.expected = 1;
		this.actual = actual;
	}
}

export type KilledByGoogleMutationSignal = Readonly<{
	code: 'google-plus-product-count';
	expected: 1;
	actual: 263;
}>;

export class KilledByGoogleMutationPhaseError extends Error {
	readonly phase:
		| 'mutation-red'
		| 'restoration-write'
		| 'restoration-bytes'
		| 'restoration-journey';

	constructor(
		phase: KilledByGoogleMutationPhaseError['phase'],
		message: string,
		options?: ErrorOptions,
	) {
		super(`T296 ${phase}: ${message}`, options);
		this.name = 'KilledByGoogleMutationPhaseError';
		this.phase = phase;
	}
}

export function classifyKilledByGoogleMutationSignal(
	error: unknown,
	provenance: Readonly<{ phase: string; lane: string }>,
): KilledByGoogleMutationSignal | null {
	if (
		provenance.phase !== 'mutation-red' ||
		provenance.lane !== 'migrated' ||
		!error ||
		typeof error !== 'object'
	)
		return null;
	const candidate = error as Record<string, unknown>;
	return candidate.code === 'google-plus-product-count' &&
		candidate.expected === 1 &&
		candidate.actual === killedByGoogleBrowserOracle.total
		? Object.freeze({
				code: 'google-plus-product-count' as const,
				expected: 1 as const,
				actual: killedByGoogleBrowserOracle.total,
			})
		: null;
}

export async function captureKilledByGoogleMutationWithRestoration(operations: {
	runMutated: () => Promise<void>;
	restore: () => Promise<void>;
	readRestored: () => Promise<Buffer>;
	expectedSha256: string;
	provenance: Readonly<{ phase: string; lane: string }>;
}): Promise<KilledByGoogleMutationSignal> {
	let signal: KilledByGoogleMutationSignal | null = null;
	let pendingError: unknown;
	let restorationError: KilledByGoogleMutationPhaseError | null = null;
	try {
		try {
			await operations.runMutated();
		} catch (error) {
			signal = classifyKilledByGoogleMutationSignal(error, operations.provenance);
			if (!signal) pendingError = error;
		}
	} finally {
		try {
			await operations.restore();
		} catch (error) {
			restorationError = new KilledByGoogleMutationPhaseError(
				'restoration-write',
				'App.tsx restoration write failed',
				{ cause: error },
			);
		}
		if (!restorationError)
			try {
				if (sha256(await operations.readRestored()) !== operations.expectedSha256)
					restorationError = new KilledByGoogleMutationPhaseError(
						'restoration-bytes',
						'App.tsx restoration is not byte-exact',
					);
			} catch (error) {
				restorationError = new KilledByGoogleMutationPhaseError(
					'restoration-bytes',
					'App.tsx restoration byte verification failed',
					{ cause: error },
				);
			}
	}
	if (restorationError) throw restorationError;
	if (pendingError) throw pendingError;
	if (!signal)
		throw new KilledByGoogleMutationPhaseError(
			'mutation-red',
			'exact google-plus-product-count expected 1 actual 263 signal was absent',
		);
	return signal;
}

export async function runKilledByGoogleRestorationJourney<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (error) {
		throw new KilledByGoogleMutationPhaseError(
			'restoration-journey',
			'restored browser journey failed',
			{ cause: error },
		);
	}
}

export type KilledByGoogleJourneyPhase =
	| 'baseline-parity'
	| 'migrated-parity'
	| 'mutation-red'
	| 'restoration-green';

export type KilledByGoogleJourneyDescriptor = Readonly<{
	phase: KilledByGoogleJourneyPhase;
	lane: 'baseline' | 'migrated';
	pass: 1 | 2;
	canonicalLaneRoot: string;
	canonicalBuildRoot: string;
	expectedAppSha256: string;
	expectedBuildSha256: string;
	expectedSearchRows: 1 | 263;
}>;

type JourneyDescriptorObserver = Readonly<{
	realpath: (target: string) => Promise<string>;
	readApp: (laneRoot: string) => Promise<Buffer>;
	buildFingerprint: (buildRoot: string) => Promise<string>;
}>;

const journeyDescriptorObserver: JourneyDescriptorObserver = {
	realpath: async (target) => await realpath(target),
	readApp: async (laneRoot) => await readFile(path.join(laneRoot, 'components/App.tsx')),
	buildFingerprint: async (buildRoot) =>
		sha256(canonicalize(await productionStorageInventory(buildRoot))),
};

const journeyPhaseOrder = [
	'baseline-parity',
	'migrated-parity',
	'mutation-red',
	'restoration-green',
] as const;

export function validateKilledByGoogleJourneyPhaseOrder(
	phases: readonly KilledByGoogleJourneyPhase[],
): void {
	if (canonicalize(phases) !== canonicalize(journeyPhaseOrder))
		throw new Error('T298 browser phase order differs');
}

export async function createKilledByGoogleJourneyDescriptors(
	input: Readonly<{
		phase: KilledByGoogleJourneyPhase;
		lane: 'baseline' | 'migrated';
		laneRoot: string;
		expectedAppSha256: string;
		expectedBuildSha256: string;
	}>,
	observe: JourneyDescriptorObserver = journeyDescriptorObserver,
): Promise<readonly [KilledByGoogleJourneyDescriptor, KilledByGoogleJourneyDescriptor]> {
	const laneRoot = path.resolve(input.laneRoot);
	const buildRoot = path.join(laneRoot, '.next');
	const realLaneRoot = await observe.realpath(laneRoot);
	const realBuildRoot = await observe.realpath(buildRoot);
	if (
		realLaneRoot !== laneRoot ||
		realBuildRoot !== buildRoot ||
		!realBuildRoot.startsWith(`${realLaneRoot}/`)
	)
		throw new Error('T298 server lane or build root aliases or escapes');
	if (
		sha256(await observe.readApp(laneRoot)) !== input.expectedAppSha256 ||
		(await observe.buildFingerprint(buildRoot)) !== input.expectedBuildSha256
	)
		throw new Error('T298 server App or build fingerprint is stale');
	const expectedLane = input.phase === 'baseline-parity' ? 'baseline' : 'migrated';
	if (input.lane !== expectedLane)
		throw new Error('T298 browser phase is assigned to the wrong lane');
	const expectedSearchRows = input.phase === 'mutation-red' ? 263 : 1;
	const descriptors = ([1, 2] as const).map((pass) =>
		Object.freeze({
			phase: input.phase,
			lane: input.lane,
			pass,
			canonicalLaneRoot: realLaneRoot,
			canonicalBuildRoot: realBuildRoot,
			expectedAppSha256: input.expectedAppSha256,
			expectedBuildSha256: input.expectedBuildSha256,
			expectedSearchRows,
		}),
	) as unknown as [KilledByGoogleJourneyDescriptor, KilledByGoogleJourneyDescriptor];
	return Object.freeze(descriptors);
}

export async function revalidateKilledByGoogleJourneyLaunch(
	descriptors: readonly [KilledByGoogleJourneyDescriptor, KilledByGoogleJourneyDescriptor],
	observe: JourneyDescriptorObserver = journeyDescriptorObserver,
): Promise<void> {
	const first = descriptors[0];
	if (
		descriptors[1].pass !== 2 ||
		first.pass !== 1 ||
		descriptors.some(
			(descriptor) =>
				descriptor.phase !== first.phase ||
				descriptor.lane !== first.lane ||
				descriptor.canonicalLaneRoot !== first.canonicalLaneRoot ||
				descriptor.canonicalBuildRoot !== first.canonicalBuildRoot ||
				descriptor.expectedAppSha256 !== first.expectedAppSha256 ||
				descriptor.expectedBuildSha256 !== first.expectedBuildSha256,
		)
	)
		throw new Error('T300 launch descriptor pair differs');
	const realLane = await observe.realpath(first.canonicalLaneRoot);
	const realBuild = await observe.realpath(first.canonicalBuildRoot);
	if (
		realLane !== first.canonicalLaneRoot ||
		realBuild !== first.canonicalBuildRoot ||
		realBuild !== path.join(realLane, '.next')
	)
		throw new Error('T300 launch-time lane or build root changed or aliased');
	if (
		sha256(await observe.readApp(realLane)) !== first.expectedAppSha256 ||
		(await observe.buildFingerprint(realBuild)) !== first.expectedBuildSha256
	)
		throw new Error('T300 launch-time App or build fingerprint changed');
}

export type KilledByGoogleJourneyPhaseState = Readonly<{
	consume: (descriptors: readonly KilledByGoogleJourneyDescriptor[]) => void;
	assertComplete: () => void;
}>;

export function createKilledByGoogleJourneyPhaseState(): KilledByGoogleJourneyPhaseState {
	let next = 0;
	return Object.freeze({
		consume: (descriptors) => {
			const expected = journeyPhaseOrder[next];
			if (
				!expected ||
				descriptors.length !== 2 ||
				descriptors[0]?.phase !== expected ||
				descriptors[1]?.phase !== expected
			)
				throw new Error(
					`T300 executed browser phase order differs at ${expected ?? 'complete'}`,
				);
			next += 1;
		},
		assertComplete: () => {
			if (next !== journeyPhaseOrder.length)
				throw new Error('T300 executed browser phases are incomplete');
		},
	});
}

export type KilledByGoogleSearchObservation = Readonly<{
	inputValue: string;
	count: number;
	postInputTurn: number;
}>;

export function settledKilledByGoogleSearchCount(
	descriptor: KilledByGoogleJourneyDescriptor,
	observations: readonly KilledByGoogleSearchObservation[],
): number | null {
	const postInput = observations.filter(
		(observation) => observation.inputValue === 'Google+' && observation.postInputTurn > 0,
	);
	if (
		descriptor.phase === 'mutation-red' &&
		postInput.some((observation) => observation.count === 1)
	)
		throw new Error('T300 mutation-red observed the forbidden settled filtered state');
	const last = postInput.slice(-2);
	return last.length === 2 &&
		last[0]!.postInputTurn < last[1]!.postInputTurn &&
		last.every((observation) => observation.count === descriptor.expectedSearchRows)
		? descriptor.expectedSearchRows
		: null;
}

export class KilledByGoogleJourneyPhaseFailure extends Error {
	readonly phase: KilledByGoogleJourneyPhase;
	readonly lane: 'baseline' | 'migrated';
	readonly pass: 1 | 2;
	readonly canonicalLaneRoot: string;
	readonly canonicalBuildRoot: string;
	readonly expectedAppSha256: string;
	readonly expectedBuildSha256: string;
	readonly expectedSearchRows: 1 | 263;
	readonly code?: 'google-plus-product-count';
	readonly expected?: 1;
	readonly actual?: number;

	constructor(descriptor: KilledByGoogleJourneyDescriptor, cause: unknown) {
		const detail = cause instanceof Error ? cause.message : String(cause);
		super(
			`T300 ${descriptor.phase}/${descriptor.lane}/pass-${descriptor.pass} lane=${descriptor.canonicalLaneRoot} build=${descriptor.canonicalBuildRoot} app=${descriptor.expectedAppSha256} buildFingerprint=${descriptor.expectedBuildSha256}: ${detail}`,
			{ cause },
		);
		this.name = 'KilledByGoogleJourneyPhaseFailure';
		this.phase = descriptor.phase;
		this.lane = descriptor.lane;
		this.pass = descriptor.pass;
		this.canonicalLaneRoot = descriptor.canonicalLaneRoot;
		this.canonicalBuildRoot = descriptor.canonicalBuildRoot;
		this.expectedAppSha256 = descriptor.expectedAppSha256;
		this.expectedBuildSha256 = descriptor.expectedBuildSha256;
		this.expectedSearchRows = descriptor.expectedSearchRows;
		if (cause && typeof cause === 'object') {
			const candidate = cause as Record<string, unknown>;
			if (
				candidate.code === 'google-plus-product-count' &&
				candidate.expected === 1 &&
				typeof candidate.actual === 'number'
			) {
				this.code = 'google-plus-product-count';
				this.expected = 1;
				this.actual = candidate.actual;
			}
		}
	}
}

export function assertKilledByGoogleSettledSearchCount(
	descriptor: KilledByGoogleJourneyDescriptor,
	actual: number,
): void {
	if (actual !== descriptor.expectedSearchRows)
		throw new Error(`T298 ${descriptor.phase} search count is unsettled or wrong-state`);
	if (descriptor.phase === 'mutation-red') {
		if (actual !== killedByGoogleBrowserOracle.total)
			throw new Error('T298 mutation-red did not settle at the exact 263 rows');
		throw new KilledByGoogleJourneyOracleError(actual);
	}
	if (actual !== 1) throw new Error(`T298 ${descriptor.phase} Google+ product count differs`);
}

export type NftMismatchBinding = Readonly<{
	member: string;
	selectedStorageRegion: 'bound-build-output' | 'bound-lane';
	targetType: 'file' | 'symlink';
	portableRealTargetIdentity: string;
	targetSha256: string;
	byteLength: number;
}>;

export type NftMismatchRun = Readonly<{
	id: 'first' | 'second';
	manifest: Readonly<{ sha256: string; byteLength: number }>;
	cacheKey: Readonly<{
		present: true;
		type: 'string';
		valueSha256: string;
		byteLength: number;
		valueRetained: false;
	}>;
	members: readonly NftMismatchBinding[];
}>;

export type CanonicalNftProjection = Readonly<{
	relativeManifest: ProductionNftPath;
	version: 1;
	rawObservation: Readonly<{ sha256: string; byteLength: number }>;
	semantic: Readonly<{
		cacheKey: Readonly<{
			present: boolean;
			type: 'string' | 'absent';
			valueSha256: string | null;
			byteLength: number | null;
		}>;
		members: readonly NftMismatchBinding[];
	}>;
	traceMembershipOccurrences: number;
	pathResolutionSemantics:
		| 'lexical-storage-native-realpath'
		| 'post-resolution-storage-manual-leaf-symlink';
}>;

export const next12NftConsumerAssertions = Object.freeze({
	nextStartReadsManifest: false,
	nextServerReadsManifest: false,
	requiredServerGenerationReadsManifest: false,
	standaloneCopyReadsFilesOnly: true,
	standaloneCopyJoinsMembersRelativeToManifest: true,
	standaloneCopyPreservesSymlinksOrCopiesBytes: true,
	standaloneCopyIgnoresRawManifestIdentityVersionAndCacheKey: true,
	pathResolutionParity:
		'unresolved-production-native-realpath-versus-diagnostic-manual-leaf-traversal',
});

export type BaselineIntervalFingerprint = Readonly<{
	source: string;
	install: string;
	externalTargets: string;
	canonicalBuildOutput: string;
	firstLiveProjection: string | null;
	copiedProjection: string | null;
	secondLiveProjection: string | null;
	copyDestination: string | null;
}>;

const baselineIntervalOperationSpecs = [
	{
		operation: 'first-cache-removal',
		reads: ['canonical-build-output'],
		writes: ['canonical-build-cache'],
		mutableFingerprints: ['canonicalBuildOutput'],
	},
	{
		operation: 'first-live-projection',
		reads: ['canonical-build-output', 'canonical-external-targets'],
		writes: [],
		mutableFingerprints: ['firstLiveProjection'],
	},
	{
		operation: 'copy-first-build-output',
		reads: ['canonical-build-output'],
		writes: ['copy-destination'],
		mutableFingerprints: ['copyDestination'],
	},
	{
		operation: 'copied-bind-inventory-hash-realpath',
		reads: ['copy-destination', 'canonical-external-targets'],
		writes: [],
		mutableFingerprints: ['copiedProjection'],
	},
	{
		operation: 'copy-fidelity-assertion',
		reads: ['canonical-build-output', 'copy-destination', 'canonical-external-targets'],
		writes: [],
		mutableFingerprints: [],
	},
	{
		operation: 'source-install-external-rehash',
		reads: ['canonical-source', 'canonical-install', 'canonical-external-targets'],
		writes: [],
		mutableFingerprints: [],
	},
	{
		operation: 'second-build-boundary',
		reads: ['canonical-source', 'canonical-install'],
		writes: ['canonical-build-output'],
		mutableFingerprints: ['canonicalBuildOutput'],
	},
	{
		operation: 'second-cache-removal',
		reads: ['canonical-build-output'],
		writes: ['canonical-build-cache'],
		mutableFingerprints: ['canonicalBuildOutput'],
	},
	{
		operation: 'second-live-projection',
		reads: ['canonical-build-output', 'canonical-external-targets'],
		writes: [],
		mutableFingerprints: ['secondLiveProjection'],
	},
	{
		operation: 'compare-frozen-projections',
		reads: ['first-live-projection', 'copied-projection', 'second-live-projection'],
		writes: [],
		mutableFingerprints: [],
	},
	{
		operation: 'baseline-conformance-complete',
		reads: ['comparison-result'],
		writes: [],
		mutableFingerprints: [],
	},
	{
		operation: 'browser-start',
		reads: ['baseline-conformance'],
		writes: [],
		mutableFingerprints: [],
	},
	{
		operation: 'server-start',
		reads: ['browser-session', 'baseline-conformance'],
		writes: [],
		mutableFingerprints: [],
	},
] as const;

for (const specification of baselineIntervalOperationSpecs) {
	Object.freeze(specification.reads);
	Object.freeze(specification.writes);
	Object.freeze(specification.mutableFingerprints);
	Object.freeze(specification);
}
Object.freeze(baselineIntervalOperationSpecs);

export type BaselineIntervalOperation =
	(typeof baselineIntervalOperationSpecs)[number]['operation'];

export type BaselineIntervalObservation = Readonly<{
	operation: BaselineIntervalOperation;
	reads: readonly string[];
	writes: readonly string[];
	before: BaselineIntervalFingerprint;
	after: BaselineIntervalFingerprint;
}>;

export type BaselineIntervalMeasurement = Readonly<{
	operation: BaselineIntervalOperation;
	before: BaselineIntervalFingerprint;
	after: BaselineIntervalFingerprint;
}>;

export type BaselineIntervalInstrumentation = Readonly<{
	canonicalLane: string;
	copyDestination: string;
	observe: (
		specification: (typeof baselineIntervalOperationSpecs)[number],
	) => Promise<BaselineIntervalMeasurement>;
}>;

function validateBaselineFingerprint(fingerprint: BaselineIntervalFingerprint): void {
	if (
		canonicalize(Object.keys(fingerprint).sort(compare)) !==
		canonicalize(
			[
				'source',
				'install',
				'externalTargets',
				'canonicalBuildOutput',
				'firstLiveProjection',
				'copiedProjection',
				'secondLiveProjection',
				'copyDestination',
			].sort(compare),
		)
	)
		throw new Error('T290 baseline fingerprint keys differ');
	for (const [name, value] of Object.entries(fingerprint))
		if (value !== null) diagnosticDigest(value, `baseline ${name} fingerprint`);
}

async function resolvedThroughExistingAncestor(target: string): Promise<string> {
	let ancestor = path.resolve(target);
	const suffix: string[] = [];
	while (!(await exists(ancestor))) {
		const parent = path.dirname(ancestor);
		if (parent === ancestor) throw new Error('T292 path has no existing ancestor');
		suffix.unshift(path.basename(ancestor));
		ancestor = parent;
	}
	return path.resolve(await realpath(ancestor), ...suffix);
}

export async function productionCopyPathsAreDisjoint(
	left: string,
	right: string,
): Promise<boolean> {
	const resolvedLeft = await resolvedThroughExistingAncestor(left);
	const resolvedRight = await resolvedThroughExistingAncestor(right);
	return (
		resolvedLeft !== resolvedRight &&
		!resolvedLeft.startsWith(`${resolvedRight}/`) &&
		!resolvedRight.startsWith(`${resolvedLeft}/`)
	);
}

export async function instrumentT283BaselineInterval(
	instrumentation: BaselineIntervalInstrumentation,
) {
	const ledger: BaselineIntervalObservation[] = [];
	let harnessDefect: string | null = (await productionCopyPathsAreDisjoint(
		instrumentation.canonicalLane,
		instrumentation.copyDestination,
	))
		? null
		: 'copy-destination-overlaps-or-aliases-canonical-lane';
	for (const specification of baselineIntervalOperationSpecs) {
		const observation = await instrumentation.observe(specification);
		validateBaselineFingerprint(observation.before);
		validateBaselineFingerprint(observation.after);
		if (observation.operation !== specification.operation)
			harnessDefect ??= `operation-order-differs:${specification.operation}`;
		if (
			ledger.length > 0 &&
			canonicalize(ledger.at(-1)!.after) !== canonicalize(observation.before)
		)
			harnessDefect ??= `noncontiguous-fingerprint:${specification.operation}`;
		for (const field of Object.keys(observation.before) as Array<
			keyof BaselineIntervalFingerprint
		>)
			if (
				observation.before[field] !== observation.after[field] &&
				!(specification.mutableFingerprints as readonly string[]).includes(field)
			)
				harnessDefect ??= `unexpected-fingerprint-write:${specification.operation}:${field}`;
		for (const field of ['source', 'install', 'externalTargets'] as const)
			if (observation.before[field] !== observation.after[field])
				harnessDefect ??= `canonical-input-changed:${specification.operation}:${field}`;
		ledger.push(
			Object.freeze({
				...observation,
				reads: Object.freeze([...specification.reads]),
				writes: Object.freeze([...specification.writes]),
				before: Object.freeze({ ...observation.before }),
				after: Object.freeze({ ...observation.after }),
			}),
		);
	}
	const initial = ledger[0]!.before;
	const final = ledger.at(-1)!.after;
	if (
		initial.source !== final.source ||
		initial.install !== final.install ||
		initial.externalTargets !== final.externalTargets
	)
		harnessDefect ??= 'canonical-input-fingerprint-changed-across-interval';
	if (
		final.firstLiveProjection === null ||
		final.copiedProjection === null ||
		final.firstLiveProjection !== final.copiedProjection
	)
		harnessDefect ??= 'copied-live-fidelity-differs';
	const classification = harnessDefect
		? ('harness-defect' as const)
		: final.secondLiveProjection !== final.firstLiveProjection
			? ('unsupported-nondeterminism' as const)
			: ('expected' as const);
	return Object.freeze({
		classification,
		reason:
			harnessDefect ??
			(classification === 'unsupported-nondeterminism'
				? 'unchanged-input-production-projection-variance'
				: 'disjoint-destination-only-copy-and-stable-projections'),
		ledger: Object.freeze(ledger),
	});
}

const operationBisectSpecs = baselineIntervalOperationSpecs.slice(0, 10);
const operationBisectMismatchClassNames = [
	'bindingSetMismatch',
	'memberFieldMismatch',
	'targetByteMismatch',
	'cacheKeyMismatch',
] as const;

export type NextServerNftOperationBisectArtifact = Readonly<{
	schemaVersion: 'versionless.next12-next-server-nft-operation-bisect.v1';
	fixture: 'next-killedbygoogle';
	manifestPath: '.next/next-server.js.nft.json';
	immutableInputs: Record<string, unknown>;
	preconditions: Readonly<{
		copyDisjoint: true;
		dualLaneSourcesEqual: true;
		dualLaneInstallTreesEqual: true;
	}>;
	ledger: readonly BaselineIntervalObservation[];
	projections: Readonly<{
		firstLive: CanonicalNftProjection;
		copied: CanonicalNftProjection;
		secondLive: CanonicalNftProjection;
	}>;
	fidelity: Readonly<{ liveCopiedEqual: boolean }>;
	comparison: Record<string, unknown>;
	classification: Readonly<{
		result: 'expected' | 'harness-defect' | 'unsupported-nondeterminism';
		reason: string;
	}>;
	privacy: Record<string, unknown>;
	integrity: Readonly<{ algorithm: 'sha256'; canonicalDigest: string }>;
}>;

const operationBisectImmutableInputs = Object.freeze({
	sourceRevision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
	sourceArchiveSha256: expectedArchive,
	lockSha256: expectedLock,
	closureFileSha256: expectedClosureFile,
	closureCanonicalDigest: expectedClosureCanonical,
	closureArtifacts: 710,
	installTreeSha256: expectedInstallTree,
	nextTarballSha256: expectedNextTarball,
	node: '16.20.2',
	yarn: '1.22.22',
	next: '12.0.10',
	offlineControls: { VERSIONLESS_NETWORK_MODE: 'offline', NPM_CONFIG_OFFLINE: true, CI: true },
});

const operationBisectPrivacy = Object.freeze({
	rawPayloadRetained: false,
	absolutePathsRetained: false,
	environmentValuesRetained: false,
	secretsRetained: false,
	cacheKeyValueRetained: false,
	traceContentAccessed: false,
	traceContentRetained: false,
	buildIdRetained: false,
	buildInventoryRetained: false,
	browserEvidenceRetained: false,
	receiptRetained: false,
	aggregateCorpusTrustRetained: false,
	productionCountability: 'operation-bisect-only-not-countable',
	cleanup: 'opaque-whole-dedicated-root-removal',
});

export function nextServerNftOperationBisectDigest(value: Record<string, unknown>): string {
	const copy = structuredClone(value);
	delete copy.integrity;
	return sha256(canonicalize(copy));
}

function validateOperationBisectLedger(
	ledger: readonly BaselineIntervalObservation[],
): string | null {
	if (!Array.isArray(ledger) || ledger.length !== operationBisectSpecs.length)
		throw new Error('T292 operation ledger length differs');
	let harnessDefect: string | null = null;
	for (const [index, specification] of operationBisectSpecs.entries()) {
		const observation = ledger[index]!;
		exactKeys(
			observation as unknown as Record<string, unknown>,
			['operation', 'reads', 'writes', 'before', 'after'],
			'operation observation',
		);
		if (
			observation.operation !== specification.operation ||
			canonicalize(observation.reads) !== canonicalize(specification.reads) ||
			canonicalize(observation.writes) !== canonicalize(specification.writes)
		)
			throw new Error('T292 operation order or specification-owned scope differs');
		validateBaselineFingerprint(observation.before);
		validateBaselineFingerprint(observation.after);
		if (
			index > 0 &&
			canonicalize(ledger[index - 1]!.after) !== canonicalize(observation.before)
		)
			throw new Error('T292 operation ledger is not contiguous');
		for (const field of Object.keys(observation.before) as Array<
			keyof BaselineIntervalFingerprint
		>)
			if (
				observation.before[field] !== observation.after[field] &&
				!(specification.mutableFingerprints as readonly string[]).includes(field)
			)
				harnessDefect ??= `unexpected-fingerprint-write:${specification.operation}:${field}`;
		for (const field of ['source', 'install', 'externalTargets'] as const)
			if (observation.before[field] !== observation.after[field])
				harnessDefect ??= `canonical-input-changed:${specification.operation}:${field}`;
	}
	const initial = ledger[0]!.before;
	const final = ledger.at(-1)!.after;
	if (
		initial.source !== final.source ||
		initial.install !== final.install ||
		initial.externalTargets !== final.externalTargets
	)
		harnessDefect ??= 'canonical-input-fingerprint-changed-across-interval';
	return harnessDefect;
}

export function createNextServerNftOperationBisectArtifact(
	ledger: readonly BaselineIntervalObservation[],
	firstLive: CanonicalNftProjection,
	copied: CanonicalNftProjection,
	secondLive: CanonicalNftProjection,
	preconditions = {
		copyDisjoint: true as const,
		dualLaneSourcesEqual: true as const,
		dualLaneInstallTreesEqual: true as const,
	},
): NextServerNftOperationBisectArtifact {
	const fidelity = canonicalize(firstLive) === canonicalize(copied);
	const predicates = canonicalNftMismatchPredicates(firstLive, secondLive);
	const mismatchClasses = operationBisectMismatchClassNames
		.filter((name) => predicates[name].value)
		.sort(compare);
	const harnessDefect = validateOperationBisectLedger(ledger);
	const classification =
		harnessDefect || !fidelity
			? {
					result: 'harness-defect' as const,
					reason: harnessDefect ?? 'copied-live-fidelity-differs',
				}
			: mismatchClasses.length > 0
				? {
						result: 'unsupported-nondeterminism' as const,
						reason: 'unchanged-input-production-projection-variance',
					}
				: {
						result: 'expected' as const,
						reason: 'disjoint-destination-only-copy-and-stable-projections',
					};
	const artifact = {
		schemaVersion: 'versionless.next12-next-server-nft-operation-bisect.v1' as const,
		fixture: 'next-killedbygoogle' as const,
		manifestPath: '.next/next-server.js.nft.json' as const,
		immutableInputs: operationBisectImmutableInputs,
		preconditions,
		ledger,
		projections: { firstLive, copied, secondLive },
		fidelity: { liveCopiedEqual: fidelity },
		comparison: { ...predicates, mismatchClasses },
		classification,
		privacy: operationBisectPrivacy,
		integrity: { algorithm: 'sha256' as const, canonicalDigest: '' },
	};
	artifact.integrity.canonicalDigest = nextServerNftOperationBisectDigest(
		artifact as unknown as Record<string, unknown>,
	);
	return artifact;
}

export function validateNextServerNftOperationBisectArtifact(value: unknown) {
	const artifact = value as Record<string, unknown>;
	if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact))
		throw new Error('T292 artifact must be an object');
	exactKeys(
		artifact,
		[
			'schemaVersion',
			'fixture',
			'manifestPath',
			'immutableInputs',
			'preconditions',
			'ledger',
			'projections',
			'fidelity',
			'comparison',
			'classification',
			'privacy',
			'integrity',
		],
		'operation bisect artifact',
	);
	if (
		artifact.schemaVersion !== 'versionless.next12-next-server-nft-operation-bisect.v1' ||
		artifact.fixture !== 'next-killedbygoogle' ||
		artifact.manifestPath !== '.next/next-server.js.nft.json' ||
		canonicalize(artifact.immutableInputs) !== canonicalize(operationBisectImmutableInputs) ||
		canonicalize(artifact.preconditions) !==
			canonicalize({
				copyDisjoint: true,
				dualLaneSourcesEqual: true,
				dualLaneInstallTreesEqual: true,
			}) ||
		canonicalize(artifact.privacy) !== canonicalize(operationBisectPrivacy)
	)
		throw new Error('T292 artifact identity, inputs, preconditions, or privacy differ');
	const ledger = artifact.ledger as BaselineIntervalObservation[];
	const harnessDefect = validateOperationBisectLedger(ledger);
	const projections = artifact.projections as Record<string, CanonicalNftProjection>;
	exactKeys(projections, ['firstLive', 'copied', 'secondLive'], 'operation projections');
	for (const projection of Object.values(projections)) {
		validateCanonicalNftProjection(projection);
		if (
			projection.relativeManifest !== 'next-server.js.nft.json' ||
			projection.pathResolutionSemantics !== 'lexical-storage-native-realpath' ||
			projection.traceMembershipOccurrences !== 0
		)
			throw new Error('T292 projection identity, resolution, or trace exclusion differs');
	}
	const final = ledger.at(-1)!.after;
	if (
		final.firstLiveProjection !== sha256(canonicalize(projections.firstLive)) ||
		final.copiedProjection !== sha256(canonicalize(projections.copied)) ||
		final.secondLiveProjection !== sha256(canonicalize(projections.secondLive))
	)
		throw new Error('T292 ledger projection binding differs');
	const fidelity = canonicalize(projections.firstLive) === canonicalize(projections.copied);
	if (canonicalize(artifact.fidelity) !== canonicalize({ liveCopiedEqual: fidelity }))
		throw new Error('T292 copied/live fidelity differs');
	const predicates = canonicalNftMismatchPredicates(
		projections.firstLive!,
		projections.secondLive!,
	);
	const mismatchClasses = operationBisectMismatchClassNames
		.filter((name) => predicates[name].value)
		.sort(compare);
	if (canonicalize(artifact.comparison) !== canonicalize({ ...predicates, mismatchClasses }))
		throw new Error('T292 comparison predicates or classes differ');
	const expectedClassification =
		harnessDefect || !fidelity
			? { result: 'harness-defect', reason: harnessDefect ?? 'copied-live-fidelity-differs' }
			: mismatchClasses.length > 0
				? {
						result: 'unsupported-nondeterminism',
						reason: 'unchanged-input-production-projection-variance',
					}
				: {
						result: 'expected',
						reason: 'disjoint-destination-only-copy-and-stable-projections',
					};
	if (canonicalize(artifact.classification) !== canonicalize(expectedClassification))
		throw new Error('T292 classification differs from retained evidence');
	const serialized = canonicalize(artifact);
	for (const prohibited of [root, process.env.HOME])
		if (prohibited && serialized.includes(prohibited))
			throw new Error('T292 artifact contains prohibited retained material');
	const integrity = artifact.integrity as Record<string, unknown>;
	if (
		integrity?.algorithm !== 'sha256' ||
		diagnosticDigest(integrity.canonicalDigest, 'operation bisect digest') !==
			nextServerNftOperationBisectDigest(artifact)
	)
		throw new Error('T292 artifact integrity differs');
	return {
		artifact,
		digest: integrity.canonicalDigest as string,
		mismatchClasses,
		classification: expectedClassification,
	};
}

const mismatchClassNames = [
	'bindingSetMismatch',
	'cacheKeyMismatch',
	'memberFieldMismatch',
	'targetByteMismatch',
] as const;

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string) {
	if (
		canonicalize(Object.keys(value).sort(compare)) !== canonicalize([...expected].sort(compare))
	)
		throw new Error(`T273 ${label} keys differ`);
}

function portableDiagnosticPath(value: unknown, label: string): string {
	if (
		typeof value !== 'string' ||
		!value ||
		value.includes('\\') ||
		path.isAbsolute(value) ||
		path.normalize(value) !== value ||
		value === '..' ||
		value.startsWith('../')
	)
		throw new Error(`T273 ${label} is not portable and contained`);
	return value;
}

function diagnosticDigest(value: unknown, label: string): string {
	if (typeof value !== 'string' || !lowerHex64.test(value))
		throw new Error(`T273 ${label} is not a lowercase SHA-256`);
	return value;
}

function canonicalLaneRelativeTarget(relativeManifest: ProductionNftPath, member: string): string {
	if (
		!new Set<string>(productionNftPaths).has(relativeManifest) ||
		typeof member !== 'string' ||
		!member ||
		member.includes('\\') ||
		path.isAbsolute(member)
	)
		throw new Error('T285 canonical NFT manifest or member identity differs');
	const manifest = path.join('.next', relativeManifest);
	const derived = path.normalize(path.join(path.dirname(manifest), member));
	return portableDiagnosticPath(derived, 'derived lane-relative target');
}

function validateCanonicalNftProjection(
	projection: CanonicalNftProjection,
): CanonicalNftProjection {
	if (
		canonicalize(Object.keys(projection).sort(compare)) !==
			canonicalize(
				[
					'relativeManifest',
					'version',
					'rawObservation',
					'semantic',
					'traceMembershipOccurrences',
					'pathResolutionSemantics',
				].sort(compare),
			) ||
		!new Set<string>(productionNftPaths).has(projection.relativeManifest) ||
		projection.version !== 1 ||
		!projection.rawObservation ||
		!projection.semantic ||
		!Array.isArray(projection.semantic.members)
	)
		throw new Error('T285 canonical NFT projection schema differs');
	if (
		canonicalize(Object.keys(projection.rawObservation).sort(compare)) !==
			canonicalize(['byteLength', 'sha256']) ||
		canonicalize(Object.keys(projection.semantic).sort(compare)) !==
			canonicalize(['cacheKey', 'members']) ||
		canonicalize(Object.keys(projection.semantic.cacheKey).sort(compare)) !==
			canonicalize(['byteLength', 'present', 'type', 'valueSha256'])
	)
		throw new Error('T285 canonical NFT nested schema differs');
	diagnosticDigest(projection.rawObservation.sha256, 'raw manifest digest');
	if (
		!Number.isInteger(projection.rawObservation.byteLength) ||
		projection.rawObservation.byteLength < 1
	)
		throw new Error('T285 raw manifest observation length differs');
	const cacheKey = projection.semantic.cacheKey;
	if (
		!cacheKey ||
		typeof cacheKey.present !== 'boolean' ||
		(cacheKey.present
			? cacheKey.type !== 'string' ||
				diagnosticDigest(cacheKey.valueSha256, 'canonical cacheKey digest') !==
					cacheKey.valueSha256 ||
				!Number.isInteger(cacheKey.byteLength) ||
				(cacheKey.byteLength as number) < 1
			: cacheKey.type !== 'absent' ||
				cacheKey.valueSha256 !== null ||
				cacheKey.byteLength !== null)
	)
		throw new Error('T285 canonical cacheKey projection differs');
	const members = projection.semantic.members;
	if (
		canonicalize(members.map((row) => row.member)) !==
			canonicalize(members.map((row) => row.member).sort(compare)) ||
		new Set(members.map((row) => row.member)).size !== members.length
	)
		throw new Error('T285 canonical NFT members are duplicate or unsorted');
	for (const row of members) {
		if (
			canonicalize(Object.keys(row).sort(compare)) !==
				canonicalize(
					[
						'member',
						'selectedStorageRegion',
						'targetType',
						'portableRealTargetIdentity',
						'targetSha256',
						'byteLength',
					].sort(compare),
				) ||
			typeof row.member !== 'string' ||
			!row.member ||
			row.member.includes('\\') ||
			path.isAbsolute(row.member) ||
			!['bound-build-output', 'bound-lane'].includes(row.selectedStorageRegion) ||
			!['file', 'symlink'].includes(row.targetType) ||
			!Number.isInteger(row.byteLength) ||
			row.byteLength < 0
		)
			throw new Error('T285 canonical NFT member projection differs');
		portableDiagnosticPath(row.portableRealTargetIdentity, 'canonical real target identity');
		diagnosticDigest(row.targetSha256, 'canonical target digest');
	}
	const traceMembershipOccurrences = members.filter(
		(row) =>
			canonicalLaneRelativeTarget(projection.relativeManifest, row.member) === '.next/trace',
	).length;
	if (projection.traceMembershipOccurrences !== traceMembershipOccurrences)
		throw new Error('T285 trace membership count is not recomputed from bindings');
	if (
		!new Set<string>([
			'lexical-storage-native-realpath',
			'post-resolution-storage-manual-leaf-symlink',
		]).has(projection.pathResolutionSemantics)
	)
		throw new Error('T285 path-resolution semantics differ');
	return projection;
}

export function diagnosticRunToCanonicalNftProjection(run: NftMismatchRun): CanonicalNftProjection {
	return validateCanonicalNftProjection({
		relativeManifest: 'next-server.js.nft.json',
		version: 1,
		rawObservation: run.manifest,
		semantic: {
			cacheKey: {
				present: run.cacheKey.present,
				type: run.cacheKey.type,
				valueSha256: run.cacheKey.valueSha256,
				byteLength: run.cacheKey.byteLength,
			},
			members: run.members,
		},
		traceMembershipOccurrences: run.members.filter(
			(row) =>
				canonicalLaneRelativeTarget('next-server.js.nft.json', row.member) ===
				'.next/trace',
		).length,
		pathResolutionSemantics: 'post-resolution-storage-manual-leaf-symlink',
	});
}

export function productionBindingToCanonicalNftProjection(
	binding: ProductionNftBinding,
): CanonicalNftProjection {
	if (
		canonicalize(Object.keys(binding).sort(compare)) !==
			canonicalize(
				[
					'relativeManifest',
					'version',
					'rawSha256',
					'rawByteLength',
					'bindings',
					'cacheKeyPresent',
					'cacheKeyType',
					'cacheKeySha256',
					'cacheKeyByteLength',
					'traceMembershipOccurrences',
				].sort(compare),
			) ||
		binding.version !== 1 ||
		!new Set<string>(productionNftPaths).has(binding.relativeManifest) ||
		!Array.isArray(binding.bindings)
	)
		throw new Error('T285 production NFT binding schema differs');
	const members = binding.bindings
		.map((row) => {
			if (
				canonicalize(Object.keys(row).sort(compare)) !==
				canonicalize(
					[
						'member',
						'laneRelativeTarget',
						'realLaneRelativeTarget',
						'physicalRoot',
						'targetType',
						'targetSha256',
						'targetByteLength',
					].sort(compare),
				)
			)
				throw new Error('T285 production NFT member keys differ');
			const derived = canonicalLaneRelativeTarget(binding.relativeManifest, row.member);
			if (row.laneRelativeTarget !== derived)
				throw new Error('T285 production laneRelativeTarget lexical invariant differs');
			if (
				!['canonical-lane', 'snapshot-storage'].includes(row.physicalRoot) ||
				!['file', 'symbolic-link'].includes(row.targetType)
			)
				throw new Error('T285 production NFT binding enum differs');
			return {
				member: row.member,
				selectedStorageRegion:
					row.physicalRoot === 'snapshot-storage'
						? ('bound-build-output' as const)
						: ('bound-lane' as const),
				targetType:
					row.targetType === 'symbolic-link' ? ('symlink' as const) : ('file' as const),
				portableRealTargetIdentity: row.realLaneRelativeTarget,
				targetSha256: row.targetSha256,
				byteLength: row.targetByteLength,
			};
		})
		.sort((left, right) => compare(left.member, right.member));
	return validateCanonicalNftProjection({
		relativeManifest: binding.relativeManifest,
		version: binding.version,
		rawObservation: { sha256: binding.rawSha256, byteLength: binding.rawByteLength },
		semantic: {
			cacheKey: {
				present: binding.cacheKeyPresent,
				type: binding.cacheKeyType,
				valueSha256: binding.cacheKeySha256,
				byteLength: binding.cacheKeyByteLength,
			},
			members,
		},
		traceMembershipOccurrences: members.filter(
			(row) =>
				canonicalLaneRelativeTarget(binding.relativeManifest, row.member) === '.next/trace',
		).length,
		pathResolutionSemantics: 'lexical-storage-native-realpath',
	});
}

export function canonicalNftMismatchPredicates(
	first: CanonicalNftProjection,
	second: CanonicalNftProjection,
) {
	validateCanonicalNftProjection(first);
	validateCanonicalNftProjection(second);
	if (first.relativeManifest !== second.relativeManifest || first.version !== second.version)
		throw new Error('T285 canonical NFT identity or version differs');
	return nftSemanticMismatchPredicates(first.semantic, second.semantic);
}

export function compareCanonicalNftProjections(
	first: CanonicalNftProjection,
	second: CanonicalNftProjection,
) {
	const predicates = canonicalNftMismatchPredicates(first, second);
	return {
		predicates,
		rawEqual:
			first.rawObservation.sha256 === second.rawObservation.sha256 &&
			first.rawObservation.byteLength === second.rawObservation.byteLength,
		pathResolutionSemanticsEqual:
			first.pathResolutionSemantics === second.pathResolutionSemantics,
	};
}

export function nextServerNftMismatchPredicates(first: NftMismatchRun, second: NftMismatchRun) {
	return canonicalNftMismatchPredicates(
		diagnosticRunToCanonicalNftProjection(first),
		diagnosticRunToCanonicalNftProjection(second),
	);
}

function nftSemanticMismatchPredicates(
	first: CanonicalNftProjection['semantic'],
	second: CanonicalNftProjection['semantic'],
) {
	const firstByMember = new Map(first.members.map((binding) => [binding.member, binding]));
	const secondByMember = new Map(second.members.map((binding) => [binding.member, binding]));
	const added = second.members
		.map((binding) => binding.member)
		.filter((member) => !firstByMember.has(member))
		.sort(compare);
	const removed = first.members
		.map((binding) => binding.member)
		.filter((member) => !secondByMember.has(member))
		.sort(compare);
	const shared = first.members
		.map((binding) => binding.member)
		.filter((member) => secondByMember.has(member))
		.sort(compare);
	const memberFields = shared.filter((member) => {
		const left = firstByMember.get(member)!;
		const right = secondByMember.get(member)!;
		return (
			left.targetType !== right.targetType ||
			left.selectedStorageRegion !== right.selectedStorageRegion ||
			left.portableRealTargetIdentity !== right.portableRealTargetIdentity
		);
	});
	const targetBytes = shared.filter((member) => {
		const left = firstByMember.get(member)!;
		const right = secondByMember.get(member)!;
		const fieldsEqual =
			left.targetType === right.targetType &&
			left.selectedStorageRegion === right.selectedStorageRegion &&
			left.portableRealTargetIdentity === right.portableRealTargetIdentity;
		return (
			fieldsEqual &&
			(left.targetSha256 !== right.targetSha256 || left.byteLength !== right.byteLength)
		);
	});
	const cacheKeyMismatch =
		first.cacheKey.present !== second.cacheKey.present ||
		first.cacheKey.type !== second.cacheKey.type ||
		first.cacheKey.valueSha256 !== second.cacheKey.valueSha256 ||
		first.cacheKey.byteLength !== second.cacheKey.byteLength;
	return {
		bindingSetMismatch: { value: added.length > 0 || removed.length > 0, added, removed },
		memberFieldMismatch: { value: memberFields.length > 0, members: memberFields },
		targetByteMismatch: { value: targetBytes.length > 0, members: targetBytes },
		cacheKeyMismatch: { value: cacheKeyMismatch },
	};
}

export function nextServerNftMismatchDigest(value: Record<string, unknown>): string {
	const copy = structuredClone(value);
	delete copy.integrity;
	return sha256(canonicalize(copy));
}

export function validateNextServerNftMismatchArtifact(value: unknown) {
	const artifact = value as Record<string, unknown>;
	if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact))
		throw new Error('T273 artifact must be an object');
	exactKeys(
		artifact,
		[
			'schemaVersion',
			'fixture',
			'manifestPath',
			'immutableInputs',
			'runs',
			'comparison',
			'consumerContext',
			'privacy',
			'integrity',
		],
		'artifact',
	);
	if (
		artifact.schemaVersion !== 'versionless.next12-next-server-nft-mismatch.v1' ||
		artifact.fixture !== 'next-killedbygoogle' ||
		artifact.manifestPath !== '.next/next-server.js.nft.json'
	)
		throw new Error('T273 artifact identity differs');
	const inputs = artifact.immutableInputs as Record<string, unknown>;
	exactKeys(
		inputs,
		[
			'sourceRevision',
			'sourceArchiveSha256',
			'lockSha256',
			'closureFileSha256',
			'closureCanonicalDigest',
			'closureArtifacts',
			'installTreeSha256',
			'nextTarballSha256',
			'node',
			'yarn',
			'next',
			'offlineControls',
		],
		'immutable inputs',
	);
	if (
		canonicalize(inputs) !==
		canonicalize({
			sourceRevision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
			sourceArchiveSha256: expectedArchive,
			lockSha256: expectedLock,
			closureFileSha256: expectedClosureFile,
			closureCanonicalDigest: expectedClosureCanonical,
			closureArtifacts: 710,
			installTreeSha256: expectedInstallTree,
			nextTarballSha256: expectedNextTarball,
			node: '16.20.2',
			yarn: '1.22.22',
			next: '12.0.10',
			offlineControls: { VERSIONLESS_NETWORK_MODE: 'offline', NPM_CONFIG_OFFLINE: true },
		})
	)
		throw new Error('T273 immutable inputs differ');
	if (!Array.isArray(artifact.runs) || artifact.runs.length !== 2)
		throw new Error('T273 runs differ');
	const runs = artifact.runs as NftMismatchRun[];
	if (runs[0]?.id !== 'first' || runs[1]?.id !== 'second')
		throw new Error('T273 run order differs');
	for (const run of runs) {
		exactKeys(
			run as unknown as Record<string, unknown>,
			['id', 'manifest', 'cacheKey', 'members'],
			'run',
		);
		exactKeys(
			run.manifest as unknown as Record<string, unknown>,
			['sha256', 'byteLength'],
			'manifest',
		);
		exactKeys(
			run.cacheKey as unknown as Record<string, unknown>,
			['present', 'type', 'valueSha256', 'byteLength', 'valueRetained'],
			'cacheKey',
		);
		diagnosticDigest(run.manifest.sha256, 'manifest digest');
		diagnosticDigest(run.cacheKey.valueSha256, 'cacheKey digest');
		if (
			!Number.isInteger(run.manifest.byteLength) ||
			run.manifest.byteLength < 1 ||
			run.cacheKey.present !== true ||
			run.cacheKey.type !== 'string' ||
			run.cacheKey.valueRetained !== false ||
			!Number.isInteger(run.cacheKey.byteLength) ||
			run.cacheKey.byteLength < 1 ||
			!Array.isArray(run.members) ||
			run.members.length < 1 ||
			canonicalize(run.members.map((row) => row.member)) !==
				canonicalize(run.members.map((row) => row.member).sort(compare)) ||
			new Set(run.members.map((row) => row.member)).size !== run.members.length
		)
			throw new Error(`T273 ${run.id} run shape differs`);
		for (const row of run.members) {
			exactKeys(
				row as unknown as Record<string, unknown>,
				[
					'member',
					'selectedStorageRegion',
					'targetType',
					'portableRealTargetIdentity',
					'targetSha256',
					'byteLength',
				],
				'member binding',
			);
			if (
				typeof row.member !== 'string' ||
				!row.member ||
				row.member.includes('\\') ||
				path.isAbsolute(row.member) ||
				!['bound-build-output', 'bound-lane'].includes(row.selectedStorageRegion) ||
				!['file', 'symlink'].includes(row.targetType) ||
				!Number.isInteger(row.byteLength) ||
				row.byteLength < 0
			)
				throw new Error('T273 member binding shape differs');
			portableDiagnosticPath(row.portableRealTargetIdentity, 'real target identity');
			diagnosticDigest(row.targetSha256, 'target digest');
		}
	}
	const expectedComparison = nextServerNftMismatchPredicates(runs[0]!, runs[1]!);
	const comparison = artifact.comparison as Record<string, unknown>;
	exactKeys(comparison, [...mismatchClassNames, 'mismatchClasses'], 'comparison');
	const expectedClasses = mismatchClassNames
		.filter((name) => (expectedComparison[name] as { value: boolean }).value)
		.sort(compare);
	if (
		canonicalize(
			Object.fromEntries(mismatchClassNames.map((name) => [name, comparison[name]])),
		) !== canonicalize(expectedComparison)
	)
		throw new Error('T281 serialized mismatch predicates differ from runs');
	if (canonicalize(comparison.mismatchClasses) !== canonicalize(expectedClasses))
		throw new Error('T281 mismatch classes differ from true predicates');
	if (expectedClasses.length === 0)
		throw new Error('T281 no classified next-server NFT mismatch reproduced');
	const consumerContext = artifact.consumerContext as Record<string, unknown>;
	exactKeys(
		consumerContext,
		[
			'nextStartReadsManifest',
			'requiredServerGenerationReadsManifest',
			'standaloneCopyConsumesEveryMember',
			'fixtureStandaloneOutput',
			'independentMemberRuntimeRelevance',
			'sources',
		],
		'consumer context',
	);
	if (
		consumerContext.nextStartReadsManifest !== false ||
		consumerContext.requiredServerGenerationReadsManifest !== false ||
		consumerContext.standaloneCopyConsumesEveryMember !== true ||
		consumerContext.fixtureStandaloneOutput !== false ||
		consumerContext.independentMemberRuntimeRelevance !== 'pending-read-only-judge' ||
		!Array.isArray(consumerContext.sources) ||
		consumerContext.sources.length !== 3
	)
		throw new Error('T273 consumer context differs');
	const expectedSourceIdentities = [
		'next.config.js',
		'node_modules/next/dist/build/index.js',
		'node_modules/next/dist/server/next-server.js',
	];
	for (const [index, source] of (
		consumerContext.sources as Array<Record<string, unknown>>
	).entries()) {
		exactKeys(source, ['identity', 'sha256', 'byteLength'], 'consumer source');
		if (
			source.identity !== expectedSourceIdentities[index] ||
			!Number.isInteger(source.byteLength) ||
			(source.byteLength as number) < 1
		)
			throw new Error('T273 consumer source differs');
		portableDiagnosticPath(source.identity, 'consumer source identity');
		diagnosticDigest(source.sha256, 'consumer source digest');
	}
	const privacy = artifact.privacy as Record<string, unknown>;
	if (
		canonicalize(privacy) !==
		canonicalize({
			rawPayloadRetained: false,
			absolutePathsRetained: false,
			environmentValuesRetained: false,
			secretsRetained: false,
			cacheKeyValueRetained: false,
			traceContentAccessed: false,
			traceContentRetained: false,
			buildInventoryRetained: false,
			browserEvidenceRetained: false,
			receiptRetained: false,
			aggregateCorpusTrustRetained: false,
			productionCountability: 'diagnostic-only-not-countable',
			cleanup: 'opaque-whole-dedicated-root-removal',
		})
	)
		throw new Error('T273 privacy or noncountability differs');
	const serialized = canonicalize(artifact);
	for (const prohibited of [root, process.env.HOME])
		if (prohibited && serialized.includes(prohibited))
			throw new Error('T273 artifact contains prohibited retained material');
	const integrity = artifact.integrity as Record<string, unknown>;
	if (
		integrity?.algorithm !== 'sha256' ||
		diagnosticDigest(integrity.canonicalDigest, 'artifact canonical digest') !==
			nextServerNftMismatchDigest(artifact)
	)
		throw new Error('T273 artifact integrity differs');
	return { artifact, digest: integrity.canonicalDigest as string };
}

type DiagnosticFileSystem = Readonly<{
	readFile: (file: string) => Promise<Buffer>;
	lstat: (file: string) => Promise<Stats>;
	readlink: (file: string) => Promise<string>;
}>;

const diagnosticFileSystem: DiagnosticFileSystem = {
	readFile: async (file) => await readFile(file),
	lstat: async (file) => await lstat(file),
	readlink: async (file) => await readlink(file),
};

function pathSegments(value: string): string[] {
	return value.split('/').filter((segment) => segment.length > 0 && segment !== '.');
}

function namesTrace(value: string): boolean {
	const segments = pathSegments(value);
	return segments.some(
		(segment, index) => segment === '.next' && segments[index + 1] === 'trace',
	);
}

function assertDiagnosticPathSafe(lane: string, candidate: string, rawIdentity: string): void {
	if (rawIdentity.includes('\\') || namesTrace(rawIdentity))
		throw new Error('T273 NFT member names or traverses the forbidden build trace');
	const traceBoundary = path.join(lane, '.next', 'trace');
	if (
		(candidate !== lane && !candidate.startsWith(`${lane}/`)) ||
		candidate === traceBoundary ||
		candidate.startsWith(`${traceBoundary}/`)
	)
		throw new Error(
			'T273 NFT member resolves outside the lane or aliases the forbidden build trace',
		);
}

export async function captureNextServerNftRun(
	lane: string,
	id: NftMismatchRun['id'],
	fileSystem: DiagnosticFileSystem = diagnosticFileSystem,
): Promise<NftMismatchRun> {
	const manifestPath = path.join(lane, '.next', 'next-server.js.nft.json');
	const manifestBytes = await fileSystem.readFile(manifestPath);
	const parsed = JSON.parse(manifestBytes.toString('utf8')) as Record<string, unknown>;
	exactKeys(parsed, ['cacheKey', 'files', 'version'], 'next-server NFT manifest');
	if (
		parsed.version !== 1 ||
		typeof parsed.cacheKey !== 'string' ||
		!parsed.cacheKey ||
		!Array.isArray(parsed.files) ||
		parsed.files.some((member) => typeof member !== 'string' || !member) ||
		new Set(parsed.files).size !== parsed.files.length
	)
		throw new Error('T273 next-server NFT manifest shape differs');
	const members: NftMismatchBinding[] = [];
	for (const member of [...(parsed.files as string[])].sort(compare)) {
		if (path.isAbsolute(member)) throw new Error('T273 NFT member is absolute');
		let candidate = path.resolve(path.dirname(manifestPath), member);
		assertDiagnosticPathSafe(lane, candidate, member);
		const initial = await fileSystem.lstat(candidate);
		const targetType = initial.isSymbolicLink() ? 'symlink' : initial.isFile() ? 'file' : null;
		if (!targetType) throw new Error('T273 NFT member target is not a file or symlink');
		const visited = new Set<string>();
		for (let hop = 0; ; hop += 1) {
			if (hop > 40 || visited.has(candidate))
				throw new Error('T273 NFT member symlink chain is cyclic or too deep');
			visited.add(candidate);
			assertDiagnosticPathSafe(lane, candidate, candidate);
			const status = hop === 0 ? initial : await fileSystem.lstat(candidate);
			if (!status.isSymbolicLink()) {
				if (!status.isFile()) throw new Error('T273 NFT member real target is not a file');
				break;
			}
			const target = await fileSystem.readlink(candidate);
			const nextCandidate = path.resolve(path.dirname(candidate), target);
			assertDiagnosticPathSafe(lane, nextCandidate, target);
			candidate = nextCandidate;
		}
		const bytes = await fileSystem.readFile(candidate);
		members.push({
			member,
			selectedStorageRegion:
				candidate === path.join(lane, '.next') ||
				candidate.startsWith(`${path.join(lane, '.next')}/`)
					? 'bound-build-output'
					: 'bound-lane',
			targetType,
			portableRealTargetIdentity: portableDiagnosticPath(
				path.relative(lane, candidate),
				'real target identity',
			),
			targetSha256: sha256(bytes),
			byteLength: bytes.byteLength,
		});
	}
	const cacheKeyBytes = Buffer.from(parsed.cacheKey, 'utf8');
	return {
		id,
		manifest: { sha256: sha256(manifestBytes), byteLength: manifestBytes.byteLength },
		cacheKey: {
			present: true,
			type: 'string',
			valueSha256: sha256(cacheKeyBytes),
			byteLength: cacheKeyBytes.byteLength,
			valueRetained: false,
		},
		members,
	};
}

async function extractDiagnosticLane(): Promise<string> {
	const extractRoot = path.join(nftMismatchWork, 'canonical-extract');
	const lane = path.join(nftMismatchWork, 'canonical-lane');
	await mkdir(extractRoot, { recursive: true });
	await execute('/usr/bin/tar', ['-xzf', archive, '-C', extractRoot]);
	const entries = await readdir(extractRoot);
	if (entries.length !== 1) throw new Error('T273 source archive root differs');
	await rename(path.join(extractRoot, entries[0]!), lane);
	await rm(extractRoot, { recursive: true, force: true });
	return lane;
}

async function diagnosticConsumerSources(lane: string) {
	const identities = [
		'next.config.js',
		'node_modules/next/dist/build/index.js',
		'node_modules/next/dist/server/next-server.js',
	] as const;
	return await Promise.all(
		identities.map(async (identity) => {
			const bytes = await readFile(path.join(lane, identity));
			return { identity, sha256: sha256(bytes), byteLength: bytes.byteLength };
		}),
	);
}

async function runDiagnosticBuild(lane: string): Promise<void> {
	const sourceBefore = await sourceTree(lane);
	await execute(node16, [path.join(lane, 'node_modules/next/dist/bin/next'), 'build'], lane, {
		PATH: `${path.dirname(node16)}:/usr/bin:/bin`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		NEXT_TELEMETRY_DISABLED: '1',
		CI: '1',
	});
	if (canonicalize(await sourceTree(lane)) !== canonicalize(sourceBefore))
		throw new Error('T273 Next build changed immutable source or configuration');
}

export type DiagnosticAcquisitionOperations = Readonly<{
	extract: () => Promise<string>;
	install: (lane: string) => Promise<void>;
	resetBuildRoot: (lane: string) => Promise<void>;
	build: (lane: string) => Promise<void>;
	capture: (lane: string, id: NftMismatchRun['id']) => Promise<NftMismatchRun>;
	assertImmutable: (lane: string) => Promise<void>;
}>;

export async function acquireNextServerNftRuns(
	operations: DiagnosticAcquisitionOperations,
): Promise<Readonly<{ lane: string; first: NftMismatchRun; second: NftMismatchRun }>> {
	const lane = await operations.extract();
	await operations.install(lane);
	await operations.assertImmutable(lane);
	await operations.resetBuildRoot(lane);
	await operations.build(lane);
	const first = await operations.capture(lane, 'first');
	await operations.assertImmutable(lane);
	await operations.resetBuildRoot(lane);
	await operations.build(lane);
	const second = await operations.capture(lane, 'second');
	await operations.assertImmutable(lane);
	return { lane, first, second };
}

async function assertDiagnosticImmutableInputs(): Promise<void> {
	const closureBytes = await readFile(closureFile);
	const closure = JSON.parse(closureBytes.toString('utf8')) as {
		artifacts?: unknown[];
		integrity?: { canonicalDigest?: string };
		source?: { commit?: string };
	};
	const nextTarball = path.join(closureRoot, 'mirror', 'next-12.0.10.tgz');
	if (
		sha256(await readFile(archive)) !== expectedArchive ||
		sha256(closureBytes) !== expectedClosureFile ||
		sha256(await readFile(dependencyReceipt)) !== expectedDependencyReceipt ||
		closure.integrity?.canonicalDigest !== expectedClosureCanonical ||
		closure.artifacts?.length !== 710 ||
		closure.source?.commit !== '56809c31592e6ca1edce8af9bfe842fbcdf71f4d' ||
		sha256(await readFile(nextTarball)) !== expectedNextTarball
	)
		throw new Error('T273 immutable source or closure binding differs');
}

type CacheKeyLockIdentity = 'fixture/yarn.lock' | 'ambient/pnpm-lock.yaml';

export type Next12CacheKeyModelInput = Readonly<{
	nextVersion: '12.0.10';
	hasSsrAmpPages: false;
	hasNextSupport: false;
	buildSourceSha256: string;
	lockFiles: readonly Readonly<{ identity: CacheKeyLockIdentity; bytes: Buffer }>[];
}>;

export type Next12CacheKeyModel = Readonly<{
	fixedInputs: Readonly<{
		nextVersion: '12.0.10';
		hasSsrAmpPages: false;
		hasNextSupport: false;
		buildSourceSha256: string;
	}>;
	findUp: readonly Readonly<{
		name: 'package-lock.json' | 'yarn.lock' | 'pnpm-lock.yaml';
		result: 'absent' | CacheKeyLockIdentity;
	}>[];
	locks: readonly Readonly<{
		identity: CacheKeyLockIdentity;
		sha256: string;
		byteLength: number;
	}>[];
	candidates: readonly Readonly<{
		updateOrder: readonly CacheKeyLockIdentity[];
		cacheKeySha256: string;
	}>[];
}>;

export function modelNext12CacheKeyCandidates(
	input: Next12CacheKeyModelInput,
): Next12CacheKeyModel {
	if (
		input.nextVersion !== '12.0.10' ||
		input.hasSsrAmpPages !== false ||
		input.hasNextSupport !== false ||
		input.buildSourceSha256 !== expectedNextBuildSource
	)
		throw new Error('T314 fixed Next cacheKey inputs differ');
	if (!Array.isArray(input.lockFiles) || input.lockFiles.length !== 2)
		throw new Error('T314 exact found lockfile count differs');
	const byIdentity = new Map(input.lockFiles.map((entry) => [entry.identity, entry]));
	if (
		byIdentity.size !== 2 ||
		!byIdentity.has('fixture/yarn.lock') ||
		!byIdentity.has('ambient/pnpm-lock.yaml') ||
		input.lockFiles.some(
			(entry) =>
				!Buffer.isBuffer(entry.bytes) ||
				entry.bytes.byteLength < 1 ||
				!new Set<CacheKeyLockIdentity>(['fixture/yarn.lock', 'ambient/pnpm-lock.yaml']).has(
					entry.identity,
				),
		)
	)
		throw new Error('T314 found lockfile identities differ');
	const orders: readonly (readonly CacheKeyLockIdentity[])[] = [
		['fixture/yarn.lock', 'ambient/pnpm-lock.yaml'],
		['ambient/pnpm-lock.yaml', 'fixture/yarn.lock'],
	];
	const fixed = [
		Buffer.from(input.nextVersion, 'utf8'),
		Buffer.from(String(input.hasSsrAmpPages), 'utf8'),
		Buffer.from(String(input.hasNextSupport), 'utf8'),
	];
	return Object.freeze({
		fixedInputs: Object.freeze({
			nextVersion: input.nextVersion,
			hasSsrAmpPages: input.hasSsrAmpPages,
			hasNextSupport: input.hasNextSupport,
			buildSourceSha256: input.buildSourceSha256,
		}),
		findUp: Object.freeze([
			Object.freeze({ name: 'package-lock.json' as const, result: 'absent' as const }),
			Object.freeze({ name: 'yarn.lock' as const, result: 'fixture/yarn.lock' as const }),
			Object.freeze({
				name: 'pnpm-lock.yaml' as const,
				result: 'ambient/pnpm-lock.yaml' as const,
			}),
		]),
		locks: Object.freeze(
			(['fixture/yarn.lock', 'ambient/pnpm-lock.yaml'] as const).map((identity) => {
				const bytes = byIdentity.get(identity)!.bytes;
				return Object.freeze({
					identity,
					sha256: sha256(bytes),
					byteLength: bytes.byteLength,
				});
			}),
		),
		candidates: Object.freeze(
			orders.map((updateOrder) =>
				Object.freeze({
					updateOrder: Object.freeze([...updateOrder]),
					cacheKeySha256: sha256(
						Buffer.concat([
							...fixed,
							...updateOrder.map((identity) => byIdentity.get(identity)!.bytes),
						]),
					),
				}),
			),
		),
	});
}

export type NextServerCacheKeyProvenanceArtifact = Readonly<{
	schemaVersion: 'versionless.next12-cachekey-provenance.v1';
	fixture: 'next-killedbygoogle';
	manifestPath: '.next/next-server.js.nft.json';
	model: Next12CacheKeyModel;
	runs: readonly Readonly<{ id: 'first' | 'second'; actualCacheKeySha256: string }>[];
	nonCacheKeyPredicates: Readonly<{
		bindingSetMismatch: false;
		memberFieldMismatch: false;
		targetByteMismatch: false;
	}>;
	classification: 'observed-order-variance' | 'mechanism-present-unreproduced';
	privacy: Record<string, unknown>;
	integrity: Readonly<{ algorithm: 'sha256'; canonicalDigest: string }>;
}>;

const cacheKeyProvenancePrivacy = Object.freeze({
	rawLockfileBytesRetained: false,
	rawManifestRetained: false,
	absolutePathsRetained: false,
	environmentValuesRetained: false,
	secretsRetained: false,
	cacheKeyHashValuesRetained: true,
	traceContentAccessed: false,
	traceContentRetained: false,
	buildInventoryRetained: false,
	browserEvidenceRetained: false,
	receiptRetained: false,
	aggregateCorpusTrustRetained: false,
	productionComparatorChanged: false,
	productionCountability: 'provenance-only-not-countable',
	cleanup: 'opaque-whole-dedicated-root-removal',
});

export function nextServerCacheKeyProvenanceDigest(value: Record<string, unknown>): string {
	const copy = structuredClone(value);
	delete copy.integrity;
	return sha256(canonicalize(copy));
}

function exactCacheKeyKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
	label: string,
	code: 'T314' | 'T318' = 'T314',
) {
	if (
		canonicalize(Object.keys(value).sort(compare)) !== canonicalize([...expected].sort(compare))
	)
		throw new Error(`${code} ${label} keys differ`);
}

export function createNextServerCacheKeyProvenanceArtifact(
	model: Next12CacheKeyModel,
	actualCacheKeys: readonly [string, string],
	nonCacheKeyPredicates: {
		bindingSetMismatch: boolean;
		memberFieldMismatch: boolean;
		targetByteMismatch: boolean;
	},
): NextServerCacheKeyProvenanceArtifact {
	for (const key of actualCacheKeys)
		if (!lowerHex64.test(key)) throw new Error('T314 actual cacheKey is not lowercase SHA-256');
	if (
		nonCacheKeyPredicates.bindingSetMismatch ||
		nonCacheKeyPredicates.memberFieldMismatch ||
		nonCacheKeyPredicates.targetByteMismatch
	)
		throw new Error('T314 non-cacheKey NFT predicate differs');
	const candidates = new Set(model.candidates.map((candidate) => candidate.cacheKeySha256));
	if (actualCacheKeys.some((key) => !candidates.has(key)))
		throw new Error('T314 actual cacheKey is outside the source-derived candidate set');
	const artifact = {
		schemaVersion: 'versionless.next12-cachekey-provenance.v1' as const,
		fixture: 'next-killedbygoogle' as const,
		manifestPath: '.next/next-server.js.nft.json' as const,
		model,
		runs: Object.freeze([
			Object.freeze({ id: 'first' as const, actualCacheKeySha256: actualCacheKeys[0] }),
			Object.freeze({ id: 'second' as const, actualCacheKeySha256: actualCacheKeys[1] }),
		]),
		nonCacheKeyPredicates: Object.freeze({
			bindingSetMismatch: false as const,
			memberFieldMismatch: false as const,
			targetByteMismatch: false as const,
		}),
		classification:
			actualCacheKeys[0] === actualCacheKeys[1]
				? ('mechanism-present-unreproduced' as const)
				: ('observed-order-variance' as const),
		privacy: cacheKeyProvenancePrivacy,
		integrity: { algorithm: 'sha256' as const, canonicalDigest: '' },
	};
	artifact.integrity.canonicalDigest = nextServerCacheKeyProvenanceDigest(artifact);
	return artifact;
}

export function validateNextServerCacheKeyProvenanceArtifact(
	value: unknown,
): NextServerCacheKeyProvenanceArtifact {
	const artifact = journeyRecord(value, 'cacheKey provenance artifact');
	exactCacheKeyKeys(
		artifact,
		[
			'schemaVersion',
			'fixture',
			'manifestPath',
			'model',
			'runs',
			'nonCacheKeyPredicates',
			'classification',
			'privacy',
			'integrity',
		],
		'cacheKey provenance artifact',
	);
	if (
		artifact.schemaVersion !== 'versionless.next12-cachekey-provenance.v1' ||
		artifact.fixture !== 'next-killedbygoogle' ||
		artifact.manifestPath !== '.next/next-server.js.nft.json'
	)
		throw new Error('T314 artifact identity differs');
	const model = journeyRecord(artifact.model, 'cacheKey model') as unknown as Next12CacheKeyModel;
	exactCacheKeyKeys(
		model as unknown as Record<string, unknown>,
		['fixedInputs', 'findUp', 'locks', 'candidates'],
		'cacheKey model',
	);
	const fixed = journeyRecord(model.fixedInputs, 'cacheKey fixed inputs');
	exactCacheKeyKeys(
		fixed,
		['nextVersion', 'hasSsrAmpPages', 'hasNextSupport', 'buildSourceSha256'],
		'cacheKey fixed inputs',
	);
	const ambientBinding = model.locks[1];
	const historicalAmbientBinding =
		ambientBinding?.sha256 === expectedHistoricalAmbientPnpmLock &&
		ambientBinding.byteLength === 67_243 &&
		canonicalize(model.candidates) === canonicalize(expectedHistoricalCacheKeyCandidates);
	const vendoringPredecessorAmbientBinding =
		ambientBinding?.sha256 === expectedVendoringPredecessorAmbientPnpmLock &&
		ambientBinding.byteLength === 67_396 &&
		canonicalize(model.candidates) ===
			canonicalize(expectedVendoringPredecessorCacheKeyCandidates);
	const currentAmbientBinding =
		ambientBinding?.sha256 === expectedCurrentAmbientPnpmLock &&
		ambientBinding.byteLength === 68_172 &&
		canonicalize(model.candidates) === canonicalize(expectedCurrentCacheKeyCandidates);
	if (
		fixed.nextVersion !== '12.0.10' ||
		fixed.hasSsrAmpPages !== false ||
		fixed.hasNextSupport !== false ||
		fixed.buildSourceSha256 !== expectedNextBuildSource ||
		canonicalize(model.findUp) !==
			canonicalize([
				{ name: 'package-lock.json', result: 'absent' },
				{ name: 'yarn.lock', result: 'fixture/yarn.lock' },
				{ name: 'pnpm-lock.yaml', result: 'ambient/pnpm-lock.yaml' },
			]) ||
		!Array.isArray(model.locks) ||
		model.locks.length !== 2 ||
		model.locks[0]?.identity !== 'fixture/yarn.lock' ||
		model.locks[0]?.sha256 !== expectedLock ||
		model.locks[0]?.byteLength !== 256_958 ||
		model.locks[1]?.identity !== 'ambient/pnpm-lock.yaml' ||
		(!historicalAmbientBinding &&
			!vendoringPredecessorAmbientBinding &&
			!currentAmbientBinding) ||
		model.locks.some(
			(lock) =>
				canonicalize(Object.keys(lock).sort(compare)) !==
					canonicalize(['identity', 'sha256', 'byteLength'].sort(compare)) ||
				!Number.isInteger(lock.byteLength) ||
				lock.byteLength < 1,
		)
	)
		throw new Error('T314 source-bound cacheKey model differs');
	for (const [index, candidate] of model.candidates.entries()) {
		exactCacheKeyKeys(
			candidate as unknown as Record<string, unknown>,
			['updateOrder', 'cacheKeySha256'],
			`cacheKey candidate ${index}`,
		);
		diagnosticDigest(candidate.cacheKeySha256, `cacheKey candidate ${index}`);
	}
	const runs = artifact.runs;
	if (!Array.isArray(runs) || runs.length !== 2) throw new Error('T314 capture runs differ');
	const actualKeys = runs.map((run, index) => {
		const row = journeyRecord(run, `cacheKey run ${index}`);
		exactCacheKeyKeys(row, ['id', 'actualCacheKeySha256'], `cacheKey run ${index}`);
		if (row.id !== (index === 0 ? 'first' : 'second'))
			throw new Error('T314 capture run order differs');
		return diagnosticDigest(row.actualCacheKeySha256, `actual cacheKey ${index}`);
	});
	const candidates = new Set(model.candidates.map((candidate) => candidate.cacheKeySha256));
	if (actualKeys.some((key) => !candidates.has(key)))
		throw new Error('T314 retained actual cacheKey is outside candidates');
	const predicates = journeyRecord(artifact.nonCacheKeyPredicates, 'non-cacheKey predicates');
	exactCacheKeyKeys(
		predicates,
		['bindingSetMismatch', 'memberFieldMismatch', 'targetByteMismatch'],
		'non-cacheKey predicates',
	);
	if (
		predicates.bindingSetMismatch !== false ||
		predicates.memberFieldMismatch !== false ||
		predicates.targetByteMismatch !== false
	)
		throw new Error('T314 retained non-cacheKey predicate differs');
	const classification =
		actualKeys[0] === actualKeys[1]
			? 'mechanism-present-unreproduced'
			: 'observed-order-variance';
	if (artifact.classification !== classification)
		throw new Error('T314 classification differs from runs');
	if (canonicalize(artifact.privacy) !== canonicalize(cacheKeyProvenancePrivacy))
		throw new Error('T314 privacy contract differs');
	const serialized = canonicalize(artifact);
	for (const prohibited of [root, process.env.HOME])
		if (prohibited && serialized.includes(prohibited))
			throw new Error('T314 artifact contains prohibited retained material');
	const integrity = journeyRecord(artifact.integrity, 'cacheKey provenance integrity');
	exactCacheKeyKeys(integrity, ['algorithm', 'canonicalDigest'], 'cacheKey provenance integrity');
	if (
		integrity.algorithm !== 'sha256' ||
		diagnosticDigest(integrity.canonicalDigest, 'cacheKey provenance digest') !==
			nextServerCacheKeyProvenanceDigest(artifact)
	)
		throw new Error('T314 artifact integrity differs');
	return artifact as unknown as NextServerCacheKeyProvenanceArtifact;
}

async function exactFindUp(name: string, start: string): Promise<string | null> {
	let current = path.resolve(start);
	for (;;) {
		const candidate = path.join(current, name);
		if (await exists(candidate)) return candidate;
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

export type IsolatedNextBuildLaneOperations = Readonly<{
	createOwnedRoot: (
		prefix: string,
	) => Promise<Readonly<{ path: string; existedBefore: boolean }>>;
	populateFixtureLane: (lane: string) => Promise<void>;
	removeOwnedRoot: (ownedRoot: string) => Promise<void>;
}>;

export type IsolatedNextBuildLaneProof = Readonly<{
	freshOwnedRoot: true;
	realpathDisjoint: true;
	permissions: '0700';
	findUp: Readonly<{
		packageLock: 'absent';
		yarnLock: 'fixture/yarn.lock';
		pnpmLock: 'absent';
	}>;
	fixtureLock: Readonly<{ sha256: string; byteLength: 256_958 }>;
	cleanup: 'verified-absent';
}>;

const isolatedNextBuildLaneOperations: IsolatedNextBuildLaneOperations = {
	createOwnedRoot: async (prefix) => ({ path: await mkdtemp(prefix), existedBefore: false }),
	populateFixtureLane: async () => {
		throw new Error('T316 isolated lane population must be explicitly injected');
	},
	removeOwnedRoot: async (ownedRoot) => await rm(ownedRoot, { recursive: true, force: true }),
};

function pathsOverlap(first: string, second: string): boolean {
	const firstToSecond = path.relative(first, second);
	const secondToFirst = path.relative(second, first);
	return (
		firstToSecond === '' ||
		(!firstToSecond.startsWith('..') && !path.isAbsolute(firstToSecond)) ||
		(!secondToFirst.startsWith('..') && !path.isAbsolute(secondToFirst))
	);
}

export async function withIsolatedNextBuildLane<Result>(
	operations: IsolatedNextBuildLaneOperations,
	useVerifiedLane: (lane: string, proof: IsolatedNextBuildLaneProof) => Promise<Result>,
): Promise<Readonly<{ proof: IsolatedNextBuildLaneProof; result: Result }>> {
	const temporaryRoot = await realpath(os.tmpdir());
	const created = await operations.createOwnedRoot(
		path.join(temporaryRoot, 'versionless-next12-isolated-'),
	);
	const ownedRoot = path.resolve(created.path);
	let failure: unknown;
	let completed: Readonly<{ proof: IsolatedNextBuildLaneProof; result: Result }> | undefined;
	try {
		if (created.existedBefore || !(await exists(ownedRoot)))
			throw new Error('T316 isolated root is not freshly owned');
		const realOwnedRoot = await realpath(ownedRoot);
		if (
			realOwnedRoot !== ownedRoot ||
			realOwnedRoot === temporaryRoot ||
			path.dirname(realOwnedRoot) !== temporaryRoot
		)
			throw new Error('T316 isolated root is aliased or outside the OS temporary root');
		for (const protectedRoot of [
			root,
			path.join(root, '.versionless/cache'),
			path.join(root, 'evidence'),
		])
			if (pathsOverlap(realOwnedRoot, await realpath(protectedRoot)))
				throw new Error('T316 isolated root overlaps a protected repository root');
		await chmod(realOwnedRoot, 0o700);
		const lane = path.join(realOwnedRoot, 'fixture-lane');
		if (await exists(lane)) throw new Error('T316 isolated fixture lane preexists');
		await mkdir(lane, { mode: 0o700 });
		await operations.populateFixtureLane(lane);
		await chmod(lane, 0o700);
		const realLane = await realpath(lane);
		if (realLane !== lane || path.dirname(realLane) !== realOwnedRoot)
			throw new Error('T316 isolated fixture lane is aliased or not directly contained');
		const currentUid = process.getuid?.();
		const rootStatus = await lstat(realOwnedRoot);
		const laneStatus = await lstat(realLane);
		if (
			currentUid === undefined ||
			!rootStatus.isDirectory() ||
			!laneStatus.isDirectory() ||
			rootStatus.uid !== currentUid ||
			laneStatus.uid !== currentUid ||
			(rootStatus.mode & 0o777) !== 0o700 ||
			(laneStatus.mode & 0o777) !== 0o700
		)
			throw new Error('T316 isolated root ownership or permissions differ');
		const packageLock = await exactFindUp('package-lock.json', realLane);
		const yarnLock = await exactFindUp('yarn.lock', realLane);
		const pnpmLock = await exactFindUp('pnpm-lock.yaml', realLane);
		const expectedYarnLock = path.join(realLane, 'yarn.lock');
		if (packageLock !== null || yarnLock !== expectedYarnLock || pnpmLock !== null)
			throw new Error('T316 isolated findUp does not expose exactly the fixture yarn.lock');
		const yarnStatus = await lstat(expectedYarnLock);
		if (
			!yarnStatus.isFile() ||
			yarnStatus.isSymbolicLink() ||
			(await realpath(expectedYarnLock)) !== expectedYarnLock ||
			yarnStatus.uid !== currentUid
		)
			throw new Error('T316 fixture yarn.lock ownership or realpath differs');
		const yarnBytes = await readFile(expectedYarnLock);
		if (sha256(yarnBytes) !== expectedLock || yarnBytes.byteLength !== 256_958)
			throw new Error('T316 fixture yarn.lock byte binding differs');
		const proof: IsolatedNextBuildLaneProof = Object.freeze({
			freshOwnedRoot: true as const,
			realpathDisjoint: true as const,
			permissions: '0700' as const,
			findUp: Object.freeze({
				packageLock: 'absent' as const,
				yarnLock: 'fixture/yarn.lock' as const,
				pnpmLock: 'absent' as const,
			}),
			fixtureLock: Object.freeze({ sha256: expectedLock, byteLength: 256_958 }),
			cleanup: 'verified-absent' as const,
		});
		completed = Object.freeze({ proof, result: await useVerifiedLane(realLane, proof) });
	} catch (error) {
		failure = error;
	}
	await operations.removeOwnedRoot(ownedRoot);
	if (await exists(ownedRoot)) throw new Error('T316 isolated root cleanup failed');
	if (failure) throw failure;
	if (!completed) throw new Error('T316 isolated prerequisite produced no result');
	return completed;
}

export async function verifyIsolatedNextBuildLanePrerequisite(
	operations: IsolatedNextBuildLaneOperations = isolatedNextBuildLaneOperations,
) {
	return (
		await withIsolatedNextBuildLane(operations, async () => Object.freeze({ verified: true }))
	).proof;
}

const isolatedCacheKeyCandidate =
	'a6375d1500463115ea1b64cb8acbf5de78fb93a2ac3607df9d9b83b36e06dd6d';
const isolatedCacheKeyProjectionSha256 =
	'7687588279f783d4d9e5f43a4fdb316c06c2b540f5c6b99ca3959a4bbafbfadb';
const isolatedCacheKeyProvenanceFileSha256 =
	'42cdd32f10fd1e94a45e0f83656015cb40a741cf460d13745444e3faad5c4bc8';
const isolatedCacheKeyProvenanceCanonicalDigest =
	'411d2d6e725389981f32d8051a7a1fa286d191aebc9d5ddfba1e283793b2daba';

export type IsolatedNextWorkflowLanes = Readonly<{
	baseline: string;
	migrated: string;
	proofs: Readonly<{
		baseline: IsolatedNextBuildLaneProof;
		migrated: IsolatedNextBuildLaneProof;
	}>;
}>;

export async function withIsolatedNextWorkflowLanes<Result>(
	operations: IsolatedNextBuildLaneOperations,
	closeResources: () => Promise<void>,
	useVerifiedLanes: (lanes: IsolatedNextWorkflowLanes) => Promise<Result>,
): Promise<Result> {
	const baseline = await withIsolatedNextBuildLane(
		operations,
		async (baselineLane, baselineProof) =>
			(
				await withIsolatedNextBuildLane(operations, async (migratedLane, migratedProof) => {
					if (pathsOverlap(baselineLane, migratedLane))
						throw new Error('T320 isolated workflow lanes overlap');
					try {
						return await useVerifiedLanes({
							baseline: baselineLane,
							migrated: migratedLane,
							proofs: { baseline: baselineProof, migrated: migratedProof },
						});
					} finally {
						await closeResources();
					}
				})
			).result,
	);
	return baseline.result;
}

export type IsolatedNextWorkflowPromotionOperations<Result> = Readonly<{
	runInsideLanes: () => Promise<Result>;
	removeWork: () => Promise<void>;
	assertWorkAbsent: () => Promise<void>;
	promote: (result: Result) => Promise<void>;
}>;

export async function promoteAfterIsolatedNextWorkflow<Result>(
	operations: IsolatedNextWorkflowPromotionOperations<Result>,
): Promise<Result> {
	let result: Result | undefined;
	let failure: unknown;
	try {
		result = await operations.runInsideLanes();
	} catch (error) {
		failure = error;
	}
	await operations.removeWork();
	await operations.assertWorkAbsent();
	if (failure) throw failure;
	if (result === undefined) throw new Error('T320 isolated workflow produced no result');
	await operations.promote(result);
	return result;
}

export type IsolatedCacheKeyAcquisitionOperations = Readonly<{
	install: (lane: string) => Promise<void>;
	resetBuild: (lane: string) => Promise<void>;
	build: (lane: string) => Promise<void>;
	capture: (
		lane: string,
		id: 'first' | 'second',
	) => Promise<Readonly<{ actualCacheKeySha256: string; nft: NftMismatchRun }>>;
}>;

export async function acquireIsolatedNextCacheKeyRuns(
	lane: string,
	operations: IsolatedCacheKeyAcquisitionOperations,
) {
	await operations.install(lane);
	const runs: Array<Readonly<{ actualCacheKeySha256: string; nft: NftMismatchRun }>> = [];
	for (const id of ['first', 'second'] as const) {
		await operations.resetBuild(lane);
		await operations.build(lane);
		runs.push(await operations.capture(lane, id));
	}
	if (runs.length !== 2 || !runs[0] || !runs[1])
		throw new Error('T318 isolated acquisition did not produce exactly two runs');
	return Object.freeze([runs[0], runs[1]] as const);
}

const isolatedCacheKeyPrivacy = Object.freeze({
	rawLockfileBytesRetained: false,
	rawManifestRetained: false,
	absolutePathsRetained: false,
	environmentValuesRetained: false,
	secretsRetained: false,
	cacheKeyHashValuesRetained: true,
	nftProjectionPayloadRetained: false,
	traceContentAccessed: false,
	traceContentRetained: false,
	buildInventoryRetained: false,
	browserEvidenceRetained: false,
	receiptRetained: false,
	aggregateCorpusTrustRetained: false,
	productionComparatorChanged: false,
	productionCountability: 'isolated-provenance-only-not-countable',
	cleanup: 'verified-before-atomic-publication',
});

export function nextServerIsolatedCacheKeyDigest(value: Record<string, unknown>): string {
	const copy = structuredClone(value);
	delete copy.integrity;
	return sha256(canonicalize(copy));
}

function nonCacheKeyProjectionDigest(run: NftMismatchRun): string {
	const projection = diagnosticRunToCanonicalNftProjection(run);
	return sha256(
		canonicalize({
			relativeManifest: projection.relativeManifest,
			version: projection.version,
			members: projection.semantic.members,
			traceMembershipOccurrences: projection.traceMembershipOccurrences,
			pathResolutionSemantics: projection.pathResolutionSemantics,
		}),
	);
}

export function createNextServerIsolatedCacheKeyArtifact(
	proof: IsolatedNextBuildLaneProof,
	runs: readonly [
		Readonly<{ actualCacheKeySha256: string; nft: NftMismatchRun }>,
		Readonly<{ actualCacheKeySha256: string; nft: NftMismatchRun }>,
	],
) {
	const predicates = nextServerNftMismatchPredicates(runs[0].nft, runs[1].nft);
	if (
		predicates.bindingSetMismatch.value ||
		predicates.memberFieldMismatch.value ||
		predicates.targetByteMismatch.value
	)
		throw new Error('T318 isolated non-cacheKey NFT predicate differs');
	if (runs.some((run) => run.actualCacheKeySha256 !== isolatedCacheKeyCandidate))
		throw new Error('T318 isolated actual cacheKey differs from exact candidate');
	const projectionDigests = runs.map((run) => nonCacheKeyProjectionDigest(run.nft));
	if (projectionDigests[0] !== projectionDigests[1])
		throw new Error('T318 isolated non-cacheKey projection digest differs');
	const artifact = {
		schemaVersion: 'versionless.next12-isolated-cachekey-provenance.v1' as const,
		fixture: 'next-killedbygoogle' as const,
		manifestPath: '.next/next-server.js.nft.json' as const,
		immutableInputs: {
			sourceRevision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
			sourceArchiveSha256: expectedArchive,
			lockSha256: expectedLock,
			closureFileSha256: expectedClosureFile,
			closureCanonicalDigest: expectedClosureCanonical,
			closureArtifacts: 710,
			installTreeSha256: expectedInstallTree,
			nextTarballSha256: expectedNextTarball,
			nextBuildSourceSha256: expectedNextBuildSource,
			node: '16.20.2',
			next: '12.0.10',
			offlineControls: {
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: true,
				CI: true,
			},
		},
		isolation: proof,
		candidate: isolatedCacheKeyCandidate,
		runs: [
			{
				id: 'first',
				actualCacheKeySha256: runs[0].actualCacheKeySha256,
				nonCacheKeyProjectionSha256: projectionDigests[0],
			},
			{
				id: 'second',
				actualCacheKeySha256: runs[1].actualCacheKeySha256,
				nonCacheKeyProjectionSha256: projectionDigests[1],
			},
		],
		nonCacheKeyPredicates: {
			bindingSetMismatch: false,
			memberFieldMismatch: false,
			targetByteMismatch: false,
		},
		lifecycle: {
			extractions: 1,
			installations: 1,
			cleanBuildRootResets: 2,
			builds: 2,
			captures: 2,
			cleanupBeforePublication: true,
		},
		privacy: isolatedCacheKeyPrivacy,
		integrity: { algorithm: 'sha256' as const, canonicalDigest: '' },
	};
	artifact.integrity.canonicalDigest = nextServerIsolatedCacheKeyDigest(artifact);
	return artifact;
}

export function validateNextServerIsolatedCacheKeyArtifact(value: unknown) {
	const artifact = journeyRecord(value, 'isolated cacheKey artifact');
	exactCacheKeyKeys(
		artifact,
		[
			'schemaVersion',
			'fixture',
			'manifestPath',
			'immutableInputs',
			'isolation',
			'candidate',
			'runs',
			'nonCacheKeyPredicates',
			'lifecycle',
			'privacy',
			'integrity',
		],
		'isolated cacheKey artifact',
		'T318',
	);
	if (
		artifact.schemaVersion !== 'versionless.next12-isolated-cachekey-provenance.v1' ||
		artifact.fixture !== 'next-killedbygoogle' ||
		artifact.manifestPath !== '.next/next-server.js.nft.json' ||
		artifact.candidate !== isolatedCacheKeyCandidate
	)
		throw new Error('T318 isolated artifact identity or candidate differs');
	if (
		canonicalize(artifact.immutableInputs) !==
			canonicalize({
				sourceRevision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
				sourceArchiveSha256: expectedArchive,
				lockSha256: expectedLock,
				closureFileSha256: expectedClosureFile,
				closureCanonicalDigest: expectedClosureCanonical,
				closureArtifacts: 710,
				installTreeSha256: expectedInstallTree,
				nextTarballSha256: expectedNextTarball,
				nextBuildSourceSha256: expectedNextBuildSource,
				node: '16.20.2',
				next: '12.0.10',
				offlineControls: {
					VERSIONLESS_NETWORK_MODE: 'offline',
					NPM_CONFIG_OFFLINE: true,
					CI: true,
				},
			}) ||
		canonicalize(artifact.isolation) !==
			canonicalize({
				freshOwnedRoot: true,
				realpathDisjoint: true,
				permissions: '0700',
				findUp: {
					packageLock: 'absent',
					yarnLock: 'fixture/yarn.lock',
					pnpmLock: 'absent',
				},
				fixtureLock: { sha256: expectedLock, byteLength: 256_958 },
				cleanup: 'verified-absent',
			})
	)
		throw new Error('T318 immutable inputs or isolation proof differs');
	const runs = artifact.runs;
	if (!Array.isArray(runs) || runs.length !== 2) throw new Error('T318 isolated runs differ');
	let projectionDigest: string | undefined;
	for (const [index, value] of runs.entries()) {
		const run = journeyRecord(value, `isolated run ${index}`);
		exactCacheKeyKeys(
			run,
			['id', 'actualCacheKeySha256', 'nonCacheKeyProjectionSha256'],
			`isolated run ${index}`,
			'T318',
		);
		if (
			run.id !== (index === 0 ? 'first' : 'second') ||
			run.actualCacheKeySha256 !== isolatedCacheKeyCandidate
		)
			throw new Error('T318 isolated run identity or actual key differs');
		const digest = diagnosticDigest(run.nonCacheKeyProjectionSha256, 'non-cacheKey projection');
		projectionDigest ??= digest;
		if (projectionDigest !== digest)
			throw new Error('T318 retained non-cacheKey projections differ');
	}
	if (
		canonicalize(artifact.nonCacheKeyPredicates) !==
			canonicalize({
				bindingSetMismatch: false,
				memberFieldMismatch: false,
				targetByteMismatch: false,
			}) ||
		canonicalize(artifact.lifecycle) !==
			canonicalize({
				extractions: 1,
				installations: 1,
				cleanBuildRootResets: 2,
				builds: 2,
				captures: 2,
				cleanupBeforePublication: true,
			}) ||
		canonicalize(artifact.privacy) !== canonicalize(isolatedCacheKeyPrivacy)
	)
		throw new Error('T318 predicates, lifecycle, or privacy differs');
	const serialized = canonicalize(artifact);
	for (const prohibited of [root, process.env.HOME])
		if (prohibited && serialized.includes(prohibited))
			throw new Error('T318 artifact contains prohibited retained material');
	const integrity = journeyRecord(artifact.integrity, 'isolated artifact integrity');
	exactCacheKeyKeys(
		integrity,
		['algorithm', 'canonicalDigest'],
		'isolated artifact integrity',
		'T318',
	);
	if (
		integrity.algorithm !== 'sha256' ||
		diagnosticDigest(integrity.canonicalDigest, 'isolated artifact digest') !==
			nextServerIsolatedCacheKeyDigest(artifact)
	)
		throw new Error('T318 isolated artifact integrity differs');
	return artifact;
}

export async function captureNextServerIsolatedCacheKeyProvenance() {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1'
	)
		throw new Error('T318 capture requires exact dual-offline CI controls');
	if (
		(await exists(isolatedCacheKeyProvenanceOutput)) ||
		(await exists(isolatedCacheKeyProvenanceStage))
	)
		throw new Error('T318 isolated artifact or stage already exists');
	await assertDiagnosticImmutableInputs();
	const isolated = await withIsolatedNextBuildLane(
		{
			...isolatedNextBuildLaneOperations,
			populateFixtureLane: async (lane) => {
				await execute('/usr/bin/tar', [
					'-xzf',
					archive,
					'-C',
					lane,
					'--strip-components',
					'1',
				]);
			},
		},
		async (lane) => {
			const sourceBaseline = await sourceTree(lane);
			const runs = await acquireIsolatedNextCacheKeyRuns(lane, {
				install: async (installedLane) => {
					if ((await installLane(installedLane)) !== expectedInstallTree)
						throw new Error('T318 isolated installed tree differs');
					if (
						sha256(
							await readFile(
								path.join(installedLane, 'node_modules/next/dist/build/index.js'),
							),
						) !== expectedNextBuildSource
					)
						throw new Error('T318 isolated Next build source differs');
				},
				resetBuild: async (buildLane) =>
					await rm(path.join(buildLane, '.next'), { recursive: true, force: true }),
				build: runDiagnosticBuild,
				capture: async (captureLane, id) => {
					const captured = await captureCacheKeyProvenanceRun(captureLane, id);
					if (
						canonicalize(await sourceTree(captureLane)) !==
							canonicalize(sourceBaseline) ||
						(await installTreeDigest(path.join(captureLane, 'node_modules'))) !==
							expectedInstallTree
					)
						throw new Error('T318 isolated source or installed tree changed');
					return captured;
				},
			});
			return runs;
		},
	);
	const artifact = createNextServerIsolatedCacheKeyArtifact(isolated.proof, isolated.result);
	validateNextServerIsolatedCacheKeyArtifact(artifact);
	try {
		await mkdir(isolatedCacheKeyProvenanceStage, { recursive: true });
		const staged = path.join(isolatedCacheKeyProvenanceStage, 'artifact.json');
		await writeFile(staged, canonical(artifact));
		validateNextServerIsolatedCacheKeyArtifact(JSON.parse(await readFile(staged, 'utf8')));
		await rename(staged, isolatedCacheKeyProvenanceOutput);
		return validateNextServerIsolatedCacheKeyArtifact(
			JSON.parse(await readFile(isolatedCacheKeyProvenanceOutput, 'utf8')),
		);
	} finally {
		await rm(isolatedCacheKeyProvenanceStage, { recursive: true, force: true });
	}
}

export async function validatePublishedNextServerIsolatedCacheKeyProvenance() {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1'
	)
		throw new Error('T318 validation requires exact dual-offline CI controls');
	await assertDiagnosticImmutableInputs();
	return validateNextServerIsolatedCacheKeyArtifact(
		JSON.parse(await readFile(isolatedCacheKeyProvenanceOutput, 'utf8')),
	);
}

async function extractCacheKeyProvenanceLane(): Promise<string> {
	const extractRoot = path.join(cacheKeyProvenanceWork, 'baseline-extract');
	const lane = path.join(cacheKeyProvenanceWork, 'baseline-lane');
	await mkdir(extractRoot, { recursive: true });
	await execute('/usr/bin/tar', ['-xzf', archive, '-C', extractRoot]);
	const entries = await readdir(extractRoot);
	if (entries.length !== 1) throw new Error('T314 source archive root differs');
	await rename(path.join(extractRoot, entries[0]!), lane);
	await rm(extractRoot, { recursive: true, force: true });
	return lane;
}

async function captureCacheKeyProvenanceRun(lane: string, id: 'first' | 'second') {
	const manifest = path.join(lane, '.next', 'next-server.js.nft.json');
	const parsed = JSON.parse((await readFile(manifest)).toString('utf8')) as Record<
		string,
		unknown
	>;
	if (typeof parsed.cacheKey !== 'string' || !lowerHex64.test(parsed.cacheKey))
		throw new Error('T314 actual cacheKey is malformed');
	const nft = await captureNextServerNftRun(lane, id);
	if (
		nft.cacheKey.valueSha256 !== sha256(Buffer.from(parsed.cacheKey, 'utf8')) ||
		nft.cacheKey.byteLength !== 64
	)
		throw new Error('T314 cacheKey capture binding differs');
	return Object.freeze({ actualCacheKeySha256: parsed.cacheKey, nft });
}

export async function captureNextServerCacheKeyProvenance() {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1'
	)
		throw new Error('T314 capture requires exact dual-offline CI controls');
	if (
		(await exists(cacheKeyProvenanceOutput)) ||
		(await exists(cacheKeyProvenanceWork)) ||
		(await exists(cacheKeyProvenanceStage))
	)
		throw new Error('T314 artifact or dedicated root already exists');
	await assertDiagnosticImmutableInputs();
	try {
		await mkdir(cacheKeyProvenanceWork, { recursive: true });
		const lane = await extractCacheKeyProvenanceLane();
		const sourceBaseline = await sourceTree(lane);
		if ((await installLane(lane)) !== expectedInstallTree)
			throw new Error('T314 installed tree differs');
		const packageLock = await exactFindUp('package-lock.json', lane);
		const yarnLock = await exactFindUp('yarn.lock', lane);
		const pnpmLock = await exactFindUp('pnpm-lock.yaml', lane);
		if (
			packageLock !== null ||
			yarnLock !== path.join(lane, 'yarn.lock') ||
			pnpmLock !== path.join(root, 'pnpm-lock.yaml')
		)
			throw new Error('T314 exact findUp results differ');
		const buildSource = await readFile(
			path.join(lane, 'node_modules/next/dist/build/index.js'),
		);
		if (sha256(buildSource) !== expectedNextBuildSource)
			throw new Error('T314 pinned Next build source binding differs');
		const model = modelNext12CacheKeyCandidates({
			nextVersion: '12.0.10',
			hasSsrAmpPages: false,
			hasNextSupport: false,
			buildSourceSha256: sha256(buildSource),
			lockFiles: [
				{ identity: 'fixture/yarn.lock', bytes: await readFile(yarnLock) },
				{ identity: 'ambient/pnpm-lock.yaml', bytes: await readFile(pnpmLock) },
			],
		});
		if (
			model.locks[0]?.sha256 !== expectedLock ||
			model.locks[1]?.sha256 !== expectedCurrentAmbientPnpmLock
		)
			throw new Error('T314 exact lockfile byte binding differs');
		const capture = async (id: 'first' | 'second') => {
			await rm(path.join(lane, '.next'), { recursive: true, force: true });
			await runDiagnosticBuild(lane);
			const run = await captureCacheKeyProvenanceRun(lane, id);
			if (
				canonicalize(await sourceTree(lane)) !== canonicalize(sourceBaseline) ||
				(await installTreeDigest(path.join(lane, 'node_modules'))) !== expectedInstallTree
			)
				throw new Error('T314 source or installed tree changed across builds');
			return run;
		};
		const first = await capture('first');
		const second = await capture('second');
		const predicates = nextServerNftMismatchPredicates(first.nft, second.nft);
		const artifact = createNextServerCacheKeyProvenanceArtifact(
			model,
			[first.actualCacheKeySha256, second.actualCacheKeySha256],
			{
				bindingSetMismatch: predicates.bindingSetMismatch.value,
				memberFieldMismatch: predicates.memberFieldMismatch.value,
				targetByteMismatch: predicates.targetByteMismatch.value,
			},
		);
		validateNextServerCacheKeyProvenanceArtifact(artifact);
		await mkdir(cacheKeyProvenanceStage, { recursive: true });
		const staged = path.join(cacheKeyProvenanceStage, 'artifact.json');
		await writeFile(staged, canonical(artifact));
		validateNextServerCacheKeyProvenanceArtifact(JSON.parse(await readFile(staged, 'utf8')));
		await rename(staged, cacheKeyProvenanceOutput);
		return validateNextServerCacheKeyProvenanceArtifact(
			JSON.parse(await readFile(cacheKeyProvenanceOutput, 'utf8')),
		);
	} finally {
		await rm(cacheKeyProvenanceStage, { recursive: true, force: true });
		await rm(cacheKeyProvenanceWork, { recursive: true, force: true });
	}
}

export async function validatePublishedNextServerCacheKeyProvenance() {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		(process.env.CI !== '1' && process.env.CI !== 'true')
	)
		throw new Error('T314 validation requires exact dual-offline CI controls');
	await assertDiagnosticImmutableInputs();
	return validateNextServerCacheKeyProvenanceArtifact(
		JSON.parse(await readFile(cacheKeyProvenanceOutput, 'utf8')),
	);
}

export type ProductionComparisonAcquisitionOperations = Readonly<{
	extract: () => Promise<string>;
	install: (lane: string) => Promise<void>;
	resetBuildRoot: (lane: string) => Promise<void>;
	build: (lane: string) => Promise<void>;
	removeBuildCache: (lane: string) => Promise<void>;
	capture: (lane: string) => Promise<CanonicalNftProjection>;
	assertImmutable: (lane: string) => Promise<void>;
}>;

export async function acquireNextServerNftProductionComparison(
	operations: ProductionComparisonAcquisitionOperations,
) {
	const lane = await operations.extract();
	await operations.install(lane);
	await operations.assertImmutable(lane);
	await operations.resetBuildRoot(lane);
	await operations.build(lane);
	await operations.removeBuildCache(lane);
	const first = await operations.capture(lane);
	await operations.assertImmutable(lane);
	await operations.resetBuildRoot(lane);
	await operations.build(lane);
	await operations.removeBuildCache(lane);
	const second = await operations.capture(lane);
	await operations.assertImmutable(lane);
	return { lane, first, second };
}

async function extractProductionComparisonLane(): Promise<string> {
	const extractRoot = path.join(productionComparisonWork, 'canonical-extract');
	const lane = path.join(productionComparisonWork, 'canonical-lane');
	await mkdir(extractRoot, { recursive: true });
	await execute('/usr/bin/tar', ['-xzf', archive, '-C', extractRoot]);
	const entries = await readdir(extractRoot);
	if (entries.length !== 1) throw new Error('T288 source archive root differs');
	await rename(path.join(extractRoot, entries[0]!), lane);
	await rm(extractRoot, { recursive: true, force: true });
	return lane;
}

async function runProductionComparisonBuild(lane: string): Promise<void> {
	await execute(node16, [path.join(lane, 'node_modules/next/dist/bin/next'), 'build'], lane, {
		PATH: `${path.dirname(node16)}:/usr/bin:/bin`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		NEXT_TELEMETRY_DISABLED: '1',
		CI: '1',
	});
}

export async function captureProductionComparisonProjection(
	lane: string,
): Promise<CanonicalNftProjection> {
	return productionBindingToCanonicalNftProjection(
		await captureProductionNftBinding(
			lane,
			path.join(lane, '.next'),
			'next-server.js.nft.json',
		),
	);
}

export async function captureNextServerNftProductionComparison() {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1'
	)
		throw new Error('T288 production comparison requires exact offline CI controls');
	if (
		(await exists(productionComparisonOutput)) ||
		(await exists(productionComparisonWork)) ||
		(await exists(productionComparisonStage))
	)
		throw new Error('T288 production comparison artifact or dedicated root already exists');
	await assertDiagnosticImmutableInputs();
	try {
		await mkdir(productionComparisonWork, { recursive: true });
		let sourceBaseline: FileRow[] | undefined;
		const { first, second } = await acquireNextServerNftProductionComparison({
			extract: async () => {
				const lane = await extractProductionComparisonLane();
				sourceBaseline = await sourceTree(lane);
				return lane;
			},
			install: async (lane) => {
				if ((await installLane(lane)) !== expectedInstallTree)
					throw new Error('T288 production comparison install tree differs');
			},
			resetBuildRoot: async (lane) => {
				await rm(path.join(lane, '.next'), { recursive: true, force: true });
			},
			build: runProductionComparisonBuild,
			removeBuildCache: async (lane) => {
				await rm(path.join(lane, '.next', 'cache'), { recursive: true, force: true });
			},
			capture: captureProductionComparisonProjection,
			assertImmutable: async (lane) => {
				if (
					!sourceBaseline ||
					canonicalize(await sourceTree(lane)) !== canonicalize(sourceBaseline) ||
					sha256(await readFile(path.join(lane, 'yarn.lock'))) !== expectedLock ||
					(await installTreeDigest(path.join(lane, 'node_modules'))) !==
						expectedInstallTree
				)
					throw new Error('T288 source or install tree changed across builds');
			},
		});
		const artifact = createNextServerNftProductionComparisonArtifact(first, second);
		validateNextServerNftProductionComparisonArtifact(artifact);
		await mkdir(productionComparisonStage, { recursive: true });
		const staged = path.join(
			productionComparisonStage,
			'next-server-nft-production-comparison.json',
		);
		await writeFile(staged, canonical(artifact));
		validateNextServerNftProductionComparisonArtifact(
			JSON.parse(await readFile(staged, 'utf8')),
		);
		await rename(staged, productionComparisonOutput);
		return validateNextServerNftProductionComparisonArtifact(
			JSON.parse(await readFile(productionComparisonOutput, 'utf8')),
		);
	} finally {
		await rm(productionComparisonStage, { recursive: true, force: true });
		await rm(productionComparisonWork, { recursive: true, force: true });
	}
}

export async function validatePublishedNextServerNftProductionComparison() {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1'
	)
		throw new Error('T288 production comparison validation requires offline CI controls');
	await assertDiagnosticImmutableInputs();
	return validateNextServerNftProductionComparisonArtifact(
		JSON.parse(await readFile(productionComparisonOutput, 'utf8')),
	);
}

export async function diagnoseNextServerNftMismatch() {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1'
	)
		throw new Error('T273 diagnostic requires exact dual-offline controls and CI=1');
	if (
		(await exists(nftMismatchOutput)) ||
		(await exists(nftMismatchWork)) ||
		(await exists(nftMismatchStage))
	)
		throw new Error('T273 diagnostic output or dedicated root already exists');
	await assertDiagnosticImmutableInputs();
	try {
		await mkdir(nftMismatchWork, { recursive: true });
		let sourceBaseline: FileRow[] | undefined;
		const { lane, first, second } = await acquireNextServerNftRuns({
			extract: async () => {
				const extracted = await extractDiagnosticLane();
				sourceBaseline = await sourceTree(extracted);
				return extracted;
			},
			install: async (installedLane) => {
				if ((await installLane(installedLane)) !== expectedInstallTree)
					throw new Error('T281 installed diagnostic tree differs');
			},
			resetBuildRoot: async (buildLane) => {
				await rm(path.join(buildLane, '.next'), { recursive: true, force: true });
			},
			build: runDiagnosticBuild,
			capture: captureNextServerNftRun,
			assertImmutable: async (immutableLane) => {
				if (
					!sourceBaseline ||
					canonicalize(await sourceTree(immutableLane)) !==
						canonicalize(sourceBaseline) ||
					sha256(await readFile(path.join(immutableLane, 'yarn.lock'))) !==
						expectedLock ||
					(await installTreeDigest(path.join(immutableLane, 'node_modules'))) !==
						expectedInstallTree
				)
					throw new Error(
						'T281 source or installed tree changed across diagnostic builds',
					);
			},
		});
		const sources = await diagnosticConsumerSources(lane);
		const comparisonRows = nextServerNftMismatchPredicates(first, second);
		const mismatchClasses = mismatchClassNames
			.filter((name) => comparisonRows[name].value)
			.sort(compare);
		const artifact: Record<string, unknown> = {
			schemaVersion: 'versionless.next12-next-server-nft-mismatch.v1',
			fixture: 'next-killedbygoogle',
			manifestPath: '.next/next-server.js.nft.json',
			immutableInputs: {
				sourceRevision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
				sourceArchiveSha256: expectedArchive,
				lockSha256: expectedLock,
				closureFileSha256: expectedClosureFile,
				closureCanonicalDigest: expectedClosureCanonical,
				closureArtifacts: 710,
				installTreeSha256: expectedInstallTree,
				nextTarballSha256: expectedNextTarball,
				node: '16.20.2',
				yarn: '1.22.22',
				next: '12.0.10',
				offlineControls: { VERSIONLESS_NETWORK_MODE: 'offline', NPM_CONFIG_OFFLINE: true },
			},
			runs: [first, second],
			comparison: { ...comparisonRows, mismatchClasses },
			consumerContext: {
				nextStartReadsManifest: false,
				requiredServerGenerationReadsManifest: false,
				standaloneCopyConsumesEveryMember: true,
				fixtureStandaloneOutput: false,
				independentMemberRuntimeRelevance: 'pending-read-only-judge',
				sources,
			},
			privacy: {
				rawPayloadRetained: false,
				absolutePathsRetained: false,
				environmentValuesRetained: false,
				secretsRetained: false,
				cacheKeyValueRetained: false,
				traceContentAccessed: false,
				traceContentRetained: false,
				buildInventoryRetained: false,
				browserEvidenceRetained: false,
				receiptRetained: false,
				aggregateCorpusTrustRetained: false,
				productionCountability: 'diagnostic-only-not-countable',
				cleanup: 'opaque-whole-dedicated-root-removal',
			},
			integrity: { algorithm: 'sha256', canonicalDigest: '' },
		};
		(artifact.integrity as Record<string, unknown>).canonicalDigest =
			nextServerNftMismatchDigest(artifact);
		validateNextServerNftMismatchArtifact(artifact);
		await mkdir(nftMismatchStage, { recursive: true });
		const staged = path.join(nftMismatchStage, 'next-server-nft-mismatch.json');
		await writeFile(staged, canonical(artifact));
		validateNextServerNftMismatchArtifact(JSON.parse(await readFile(staged, 'utf8')));
		await rename(staged, nftMismatchOutput);
		return validateNextServerNftMismatchArtifact(
			JSON.parse(await readFile(nftMismatchOutput, 'utf8')),
		);
	} finally {
		await rm(nftMismatchStage, { recursive: true, force: true });
		await rm(nftMismatchWork, { recursive: true, force: true });
	}
}

export async function validatePublishedNextServerNftMismatch() {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1'
	)
		throw new Error('T273 validation requires exact dual-offline controls and CI=1');
	await assertDiagnosticImmutableInputs();
	return validateNextServerNftMismatchArtifact(
		JSON.parse(await readFile(nftMismatchOutput, 'utf8')),
	);
}

async function productionStorageInventory(storageRoot: string): Promise<BuildFileRow[]> {
	const rows: BuildFileRow[] = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of (await readdir(current, { withFileTypes: true })).sort((left, right) =>
			compare(left.name, right.name),
		)) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isFile()) {
				const bytes = await readFile(absolute);
				rows.push({
					path: path.relative(storageRoot, absolute),
					byteLength: bytes.byteLength,
					sha256: sha256(bytes),
				});
			} else throw new Error('T267 production snapshot contains a non-file entry');
		}
	};
	await visit(storageRoot);
	return rows.sort((left, right) => compare(left.path, right.path));
}

export async function bindProductionSnapshot(
	identity: ProductionSnapshotIdentity,
	captured: BuildSnapshot,
	canonicalLaneRoot: string,
	storageRoot: string,
): Promise<ProductionSnapshot> {
	if (!new Set<string>(productionSnapshotIdentities).has(identity))
		throw new Error('T267 production snapshot identity differs');
	const lane = path.resolve(canonicalLaneRoot);
	const storage = path.resolve(storageRoot);
	const buildId = (await readFile(path.join(storage, 'BUILD_ID'), 'utf8')).trim();
	const inventory = await productionStorageInventory(storage);
	if (
		buildId !== captured.buildId ||
		canonicalize(inventory) !== canonicalize(captured.rows) ||
		sha256(canonicalize(inventory)) !== captured.rawDigest
	)
		throw new Error('T267 production snapshot inventory or BUILD_ID differs');
	const nftBindings = await Promise.all(
		productionNftPaths.map(
			async (nftPath) => await captureProductionNftBinding(lane, storage, nftPath),
		),
	);
	return Object.freeze({
		identity,
		canonicalLaneRoot: lane,
		storageRoot: storage,
		buildId,
		inventory: Object.freeze(inventory),
		nftBindings: Object.freeze(nftBindings),
	});
}

function containedRelative(base: string, target: string): string | null {
	const relative = path.relative(base, target);
	return relative.startsWith('..') || path.isAbsolute(relative) ? null : relative;
}

async function captureProductionNftBinding(
	canonicalLaneRoot: string,
	storageRoot: string,
	nftPath: ProductionNftPath,
): Promise<ProductionNftBinding> {
	const file = path.join(storageRoot, nftPath);
	const raw = await readFile(file);
	const parsed = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
	const relativeManifest = nftPath;
	const expectedKeys =
		relativeManifest === 'next-server.js.nft.json'
			? ['cacheKey', 'files', 'version']
			: ['files', 'version'];
	if (canonicalize(Object.keys(parsed).sort(compare)) !== canonicalize(expectedKeys))
		throw new Error(`T263 NFT keys differ: ${relativeManifest}`);
	if (parsed.version !== 1 || !Array.isArray(parsed.files))
		throw new Error(`T263 NFT schema differs: ${relativeManifest}`);
	if (
		(relativeManifest === 'next-server.js.nft.json' && typeof parsed.cacheKey !== 'string') ||
		(relativeManifest !== 'next-server.js.nft.json' && Object.hasOwn(parsed, 'cacheKey'))
	)
		throw new Error(`T263 NFT cacheKey shape differs: ${relativeManifest}`);
	if (parsed.files.some((member) => typeof member !== 'string' || path.isAbsolute(member)))
		throw new Error(`T263 NFT member shape differs: ${relativeManifest}`);
	const members = parsed.files as string[];
	if (new Set(members).size !== members.length)
		throw new Error(`T263 NFT duplicate membership: ${relativeManifest}`);
	const realLane = await realpath(canonicalLaneRoot);
	const canonicalManifest = path.join(canonicalLaneRoot, '.next', nftPath);
	const canonicalBuildRoot = path.join(canonicalLaneRoot, '.next');
	const realStorageRoot = await realpath(storageRoot);
	const bindings = await Promise.all(
		members.map(async (member) => {
			const canonicalTarget = path.resolve(path.dirname(canonicalManifest), member);
			const laneRelativeTarget = containedRelative(canonicalLaneRoot, canonicalTarget);
			if (laneRelativeTarget === null)
				throw new Error(`T263 NFT lexical escape: ${relativeManifest}`);
			if (laneRelativeTarget === '.next/trace')
				throw new Error('T288 production NFT member names the forbidden build trace');
			const buildRelativeTarget = containedRelative(canonicalBuildRoot, canonicalTarget);
			const target =
				buildRelativeTarget === null
					? canonicalTarget
					: path.resolve(storageRoot, buildRelativeTarget);
			if (buildRelativeTarget !== null && containedRelative(storageRoot, target) === null)
				throw new Error(`T267 NFT physical lexical escape: ${relativeManifest}`);
			const metadata = await lstat(target);
			if (!metadata.isFile() && !metadata.isSymbolicLink())
				throw new Error(`T263 NFT target type differs: ${relativeManifest}`);
			const realTarget = await realpath(target);
			const physicalRealRelative = containedRelative(
				buildRelativeTarget === null ? realLane : realStorageRoot,
				realTarget,
			);
			const realLaneRelativeTarget =
				physicalRealRelative === null
					? null
					: buildRelativeTarget === null
						? physicalRealRelative
						: path.join('.next', physicalRealRelative);
			if (realLaneRelativeTarget === null)
				throw new Error(`T263 NFT realpath escape: ${relativeManifest}`);
			const bytes = await readFile(target);
			return Object.freeze({
				member,
				laneRelativeTarget,
				realLaneRelativeTarget,
				physicalRoot: buildRelativeTarget === null ? 'canonical-lane' : 'snapshot-storage',
				targetType: metadata.isSymbolicLink() ? 'symbolic-link' : 'file',
				targetSha256: sha256(bytes),
				targetByteLength: bytes.byteLength,
			});
		}),
	);
	bindings.sort((left, right) => compare(canonicalize(left), canonicalize(right)));
	const cacheKeyBytes =
		typeof parsed.cacheKey === 'string' ? Buffer.from(parsed.cacheKey, 'utf8') : null;
	return Object.freeze({
		relativeManifest,
		version: 1 as const,
		rawSha256: sha256(raw),
		rawByteLength: raw.byteLength,
		bindings: Object.freeze(bindings),
		cacheKeyPresent: Object.hasOwn(parsed, 'cacheKey'),
		cacheKeyType: Object.hasOwn(parsed, 'cacheKey') ? ('string' as const) : ('absent' as const),
		cacheKeySha256: cacheKeyBytes ? sha256(cacheKeyBytes) : null,
		cacheKeyByteLength: cacheKeyBytes?.byteLength ?? null,
		traceMembershipOccurrences: bindings.filter(
			(binding) => binding.laneRelativeTarget === '.next/trace',
		).length,
	});
}

export function productionNftBinding(
	snapshot: ProductionSnapshot,
	nftPath: ProductionNftPath,
): ProductionNftBinding {
	if (!new Set<string>(productionNftPaths).has(nftPath))
		throw new Error('T267 production NFT path differs');
	const binding = snapshot.nftBindings.find(
		(candidate) => candidate.relativeManifest === nftPath,
	);
	if (!binding) throw new Error('T283 eager production NFT binding is absent');
	return binding;
}

export function assertIsolatedProductionCacheKeyBinding(snapshot: ProductionSnapshot): void {
	const binding = productionNftBinding(snapshot, 'next-server.js.nft.json');
	if (
		!binding.cacheKeyPresent ||
		binding.cacheKeyType !== 'string' ||
		binding.cacheKeyByteLength !== 64 ||
		binding.cacheKeySha256 === null ||
		binding.cacheKeySha256 !== isolatedCacheKeyProjectionSha256
	)
		throw new Error('T322 isolated production cacheKey projection differs');
}

export function assertIsolatedProductionCacheKeyBindings(
	snapshots: readonly ProductionSnapshot[],
): void {
	if (snapshots.length !== 6) throw new Error('T322 isolated production snapshot count differs');
	for (const snapshot of snapshots) assertIsolatedProductionCacheKeyBinding(snapshot);
}

export function assertProductionSnapshotFidelity(
	live: ProductionSnapshot,
	copied: ProductionSnapshot,
): void {
	if (
		live.identity !== copied.identity ||
		live.buildId !== copied.buildId ||
		canonicalize(live.inventory) !== canonicalize(copied.inventory) ||
		canonicalize(live.nftBindings) !== canonicalize(copied.nftBindings)
	)
		throw new Error('T283 copied/live production snapshot fidelity differs');
}

export async function compareProductionNfts(
	firstSnapshot: ProductionSnapshot,
	secondSnapshot: ProductionSnapshot,
) {
	const manifests = [];
	for (const nftPath of productionNftPaths) {
		const first = await productionNftBinding(firstSnapshot, nftPath);
		const second = await productionNftBinding(secondSnapshot, nftPath);
		const firstCanonical = productionBindingToCanonicalNftProjection(first);
		const secondCanonical = productionBindingToCanonicalNftProjection(second);
		const canonicalComparison = compareCanonicalNftProjections(firstCanonical, secondCanonical);
		const { predicates } = canonicalComparison;
		if (predicates.bindingSetMismatch.value)
			throw new Error(`T285 NFT binding-set mismatch: ${nftPath}`);
		if (predicates.memberFieldMismatch.value)
			throw new Error(`T285 NFT member-field mismatch: ${nftPath}`);
		if (predicates.targetByteMismatch.value)
			throw new Error(`T285 NFT target-byte mismatch: ${nftPath}`);
		if (predicates.cacheKeyMismatch.value)
			throw new Error(`T285 NFT cacheKey mismatch: ${nftPath}`);
		const bindingsEqual = true;
		const cacheKeyEqual = true;
		manifests.push({
			path: nftPath,
			rawEqual: canonicalComparison.rawEqual,
			version: 1,
			memberCount: first.bindings.length,
			membersUnique: true,
			targetsContained: true,
			realTargetsContained: true,
			bindingsEqual,
			cacheKeyPresent: first.cacheKeyPresent,
			cacheKeyEqual,
			bindings: first.bindings,
			firstProjectionSha256: sha256(canonicalize(firstCanonical.semantic)),
			secondProjectionSha256: sha256(canonicalize(secondCanonical.semantic)),
			traceMembershipOccurrences:
				firstCanonical.traceMembershipOccurrences +
				secondCanonical.traceMembershipOccurrences,
		});
	}
	return manifests;
}

export function nextServerNftProductionComparisonDigest(value: Record<string, unknown>): string {
	const copy = structuredClone(value);
	delete copy.integrity;
	return sha256(canonicalize(copy));
}

export function createNextServerNftProductionComparisonArtifact(
	first: CanonicalNftProjection,
	second: CanonicalNftProjection,
): Record<string, unknown> {
	const predicates = canonicalNftMismatchPredicates(first, second);
	const mismatchClasses = mismatchClassNames
		.filter((name) => predicates[name].value)
		.sort(compare);
	const artifact: Record<string, unknown> = {
		schemaVersion: 'versionless.next12-next-server-nft-production-comparison.v1',
		fixture: 'next-killedbygoogle',
		manifestPath: '.next/next-server.js.nft.json',
		immutableInputs: {
			sourceRevision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
			sourceArchiveSha256: expectedArchive,
			lockSha256: expectedLock,
			closureFileSha256: expectedClosureFile,
			closureCanonicalDigest: expectedClosureCanonical,
			closureArtifacts: 710,
			installTreeSha256: expectedInstallTree,
			nextTarballSha256: expectedNextTarball,
			node: '16.20.2',
			yarn: '1.22.22',
			next: '12.0.10',
			offlineControls: { VERSIONLESS_NETWORK_MODE: 'offline', NPM_CONFIG_OFFLINE: true },
		},
		runs: [
			{ id: 'first', projection: first },
			{ id: 'second', projection: second },
		],
		comparison: { ...predicates, mismatchClasses },
		rawObservation: {
			manifestEqual:
				first.rawObservation.sha256 === second.rawObservation.sha256 &&
				first.rawObservation.byteLength === second.rawObservation.byteLength,
			semanticClass: false,
		},
		consumerContext: next12NftConsumerAssertions,
		privacy: {
			rawPayloadRetained: false,
			absolutePathsRetained: false,
			environmentValuesRetained: false,
			secretsRetained: false,
			cacheKeyValueRetained: false,
			buildIdRetained: false,
			inventoryRetained: false,
			traceContentAccessed: false,
			traceContentRetained: false,
			browserEvidenceRetained: false,
			receiptRetained: false,
			aggregateCorpusTrustRetained: false,
			productionCountability: 'comparison-only-not-countable',
			cleanup: 'opaque-whole-dedicated-root-removal',
		},
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	(artifact.integrity as Record<string, unknown>).canonicalDigest =
		nextServerNftProductionComparisonDigest(artifact);
	return artifact;
}

export function validateNextServerNftProductionComparisonArtifact(value: unknown) {
	const artifact = value as Record<string, unknown>;
	if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact))
		throw new Error('T288 production comparison artifact must be an object');
	exactKeys(
		artifact,
		[
			'schemaVersion',
			'fixture',
			'manifestPath',
			'immutableInputs',
			'runs',
			'comparison',
			'rawObservation',
			'consumerContext',
			'privacy',
			'integrity',
		],
		'production comparison artifact',
	);
	if (
		artifact.schemaVersion !== 'versionless.next12-next-server-nft-production-comparison.v1' ||
		artifact.fixture !== 'next-killedbygoogle' ||
		artifact.manifestPath !== '.next/next-server.js.nft.json'
	)
		throw new Error('T288 production comparison identity differs');
	const inputs = artifact.immutableInputs as Record<string, unknown>;
	if (
		canonicalize(inputs) !==
		canonicalize({
			sourceRevision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
			sourceArchiveSha256: expectedArchive,
			lockSha256: expectedLock,
			closureFileSha256: expectedClosureFile,
			closureCanonicalDigest: expectedClosureCanonical,
			closureArtifacts: 710,
			installTreeSha256: expectedInstallTree,
			nextTarballSha256: expectedNextTarball,
			node: '16.20.2',
			yarn: '1.22.22',
			next: '12.0.10',
			offlineControls: { VERSIONLESS_NETWORK_MODE: 'offline', NPM_CONFIG_OFFLINE: true },
		})
	)
		throw new Error('T288 production comparison immutable inputs differ');
	if (!Array.isArray(artifact.runs) || artifact.runs.length !== 2)
		throw new Error('T288 production comparison runs differ');
	const runs = artifact.runs as Array<Record<string, unknown>>;
	if (runs[0]?.id !== 'first' || runs[1]?.id !== 'second')
		throw new Error('T288 production comparison run order differs');
	for (const run of runs) {
		exactKeys(run, ['id', 'projection'], 'production comparison run');
		validateCanonicalNftProjection(run.projection as CanonicalNftProjection);
		if (
			(run.projection as CanonicalNftProjection).relativeManifest !==
				'next-server.js.nft.json' ||
			(run.projection as CanonicalNftProjection).pathResolutionSemantics !==
				'lexical-storage-native-realpath' ||
			(run.projection as CanonicalNftProjection).traceMembershipOccurrences !== 0
		)
			throw new Error('T288 production comparison projection boundary differs');
	}
	const first = runs[0]!.projection as CanonicalNftProjection;
	const second = runs[1]!.projection as CanonicalNftProjection;
	const predicates = canonicalNftMismatchPredicates(first, second);
	const expectedClasses = mismatchClassNames
		.filter((name) => predicates[name].value)
		.sort(compare);
	const comparison = artifact.comparison as Record<string, unknown>;
	exactKeys(comparison, [...mismatchClassNames, 'mismatchClasses'], 'production comparison');
	if (
		canonicalize(
			Object.fromEntries(mismatchClassNames.map((name) => [name, comparison[name]])),
		) !== canonicalize(predicates)
	)
		throw new Error('T288 production comparison predicates differ from runs');
	if (canonicalize(comparison.mismatchClasses) !== canonicalize(expectedClasses))
		throw new Error('T288 production comparison classes differ from predicates');
	if (expectedClasses.length === 0) throw new Error('T288 no production NFT mismatch reproduced');
	const expectedRaw = {
		manifestEqual:
			first.rawObservation.sha256 === second.rawObservation.sha256 &&
			first.rawObservation.byteLength === second.rawObservation.byteLength,
		semanticClass: false,
	};
	if (canonicalize(artifact.rawObservation) !== canonicalize(expectedRaw))
		throw new Error('T288 raw observation disposition differs');
	if (canonicalize(artifact.consumerContext) !== canonicalize(next12NftConsumerAssertions))
		throw new Error('T288 consumer context differs');
	const expectedPrivacy = {
		rawPayloadRetained: false,
		absolutePathsRetained: false,
		environmentValuesRetained: false,
		secretsRetained: false,
		cacheKeyValueRetained: false,
		buildIdRetained: false,
		inventoryRetained: false,
		traceContentAccessed: false,
		traceContentRetained: false,
		browserEvidenceRetained: false,
		receiptRetained: false,
		aggregateCorpusTrustRetained: false,
		productionCountability: 'comparison-only-not-countable',
		cleanup: 'opaque-whole-dedicated-root-removal',
	};
	if (canonicalize(artifact.privacy) !== canonicalize(expectedPrivacy))
		throw new Error('T288 production comparison privacy differs');
	const serialized = canonicalize(artifact);
	for (const prohibited of [root, process.env.HOME])
		if (prohibited && serialized.includes(prohibited))
			throw new Error('T288 production comparison retains a prohibited host path');
	const integrity = artifact.integrity as Record<string, unknown>;
	if (
		integrity?.algorithm !== 'sha256' ||
		diagnosticDigest(integrity.canonicalDigest, 'production comparison digest') !==
			nextServerNftProductionComparisonDigest(artifact)
	)
		throw new Error('T288 production comparison integrity differs');
	return {
		artifact,
		digest: integrity.canonicalDigest as string,
		mismatchClasses: expectedClasses,
	};
}

async function requiredServerTraceReferences(file: string): Promise<number> {
	const parsed = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
	if (!Array.isArray(parsed.files)) throw new Error('T263 required-server files shape differs');
	return parsed.files.filter((item) => {
		const value = String(item).split('\\').join('/');
		return value === 'trace' || value.endsWith('/trace');
	}).length;
}

async function productionOutputConformance(
	first: BuildSnapshot,
	second: BuildSnapshot,
	firstSnapshot: ProductionSnapshot,
	secondSnapshot: ProductionSnapshot,
) {
	const firstBuildRoot = firstSnapshot.storageRoot;
	const secondBuildRoot = secondSnapshot.storageRoot;
	const firstLane = firstSnapshot.canonicalLaneRoot;
	const secondLane = secondSnapshot.canonicalLaneRoot;
	if (first.rows.length !== 43 || second.rows.length !== 43)
		throw new Error('T263 production inventory count differs');
	const firstRaw = new Map(first.rows.map((row) => [row.path, row]));
	const secondRaw = new Map(second.rows.map((row) => [row.path, row]));
	const rawDifferingPaths = [...new Set([...firstRaw.keys(), ...secondRaw.keys()])]
		.filter((file) => firstRaw.get(file)?.sha256 !== secondRaw.get(file)?.sha256)
		.sort(compare);
	const special = new Set([
		'prerender-manifest.json',
		'required-server-files.json',
		'routes-manifest.json',
		...productionNftPaths,
		'trace',
	]);
	const normalizedDifferences = normalizedDifference(first, second);
	if (normalizedDifferences.some((file) => !special.has(file)))
		throw new Error('T263 unclassified production output differs');
	const prerender = await prerenderDiagnostic(
		path.join(firstBuildRoot, 'prerender-manifest.json'),
		path.join(secondBuildRoot, 'prerender-manifest.json'),
		first.buildId,
		second.buildId,
	);
	const requiredServer = await requiredServerFilesDiagnostic(
		path.join(firstBuildRoot, 'required-server-files.json'),
		path.join(secondBuildRoot, 'required-server-files.json'),
		firstLane,
		secondLane,
		first.buildId,
		second.buildId,
		path.join(firstBuildRoot, 'prerender-manifest.json'),
		path.join(secondBuildRoot, 'prerender-manifest.json'),
	);
	const routes = await routesManifestDiagnostic(
		path.join(firstBuildRoot, 'routes-manifest.json'),
		path.join(secondBuildRoot, 'routes-manifest.json'),
		first.buildId,
		second.buildId,
	);
	const nfts = await compareProductionNfts(firstSnapshot, secondSnapshot);
	const requiredServerReferences =
		(await requiredServerTraceReferences(
			path.join(firstBuildRoot, 'required-server-files.json'),
		)) +
		(await requiredServerTraceReferences(
			path.join(secondBuildRoot, 'required-server-files.json'),
		));
	const nftMembershipReferences = nfts.reduce(
		(count, nft) => count + nft.traceMembershipOccurrences,
		0,
	);
	if (requiredServerReferences || nftMembershipReferences)
		throw new Error('T263 trace is referenced by a production input');
	const stableRows = (snapshot: BuildSnapshot) =>
		snapshot.normalizedRows.filter((row) => !special.has(row.path));
	const firstDeterministicCore = sha256(
		canonicalize({
			inventory: stableRows(first),
			manifests: {
				prerender: prerender.firstStableProjectionSha256,
				requiredServer: requiredServer.firstStableProjectionSha256,
				routes: routes.firstStableProjectionSha256,
			},
			nfts: nfts.map((nft) => ({ path: nft.path, digest: nft.firstProjectionSha256 })),
		}),
	);
	const secondDeterministicCore = sha256(
		canonicalize({
			inventory: stableRows(second),
			manifests: {
				prerender: prerender.secondStableProjectionSha256,
				requiredServer: requiredServer.secondStableProjectionSha256,
				routes: routes.secondStableProjectionSha256,
			},
			nfts: nfts.map((nft) => ({ path: nft.path, digest: nft.secondProjectionSha256 })),
		}),
	);
	if (firstDeterministicCore !== secondDeterministicCore)
		throw new Error('T267 independently derived deterministic cores differ');
	return {
		inventoryFiles: 43,
		inventories: { first: first.rows, second: second.rows },
		rawDifferingPaths,
		allRuntimeInputsEquivalent: true,
		trace: {
			present: firstRaw.has('trace') && secondRaw.has('trace'),
			rawEqual: firstRaw.get('trace')?.sha256 === secondRaw.get('trace')?.sha256,
			parsed: false,
			normalized: false,
			deleted: false,
			productionInput: false,
			comparisonDisposition: 'excluded-build-diagnostic-not-runtime-input',
			requiredServerReferences,
			nftMembershipReferences,
		},
		manifests: { prerender, requiredServer, routes },
		nfts,
		deterministicCore: {
			first: firstDeterministicCore,
			second: secondDeterministicCore,
			equal: true,
		},
	};
}

async function availablePort(): Promise<number> {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('T236 loopback port differs');
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
	return address.port;
}

async function startProduction(
	descriptors: readonly [KilledByGoogleJourneyDescriptor, KilledByGoogleJourneyDescriptor],
): Promise<{ child: ChildProcess; url: string }> {
	const port = await availablePort();
	await revalidateKilledByGoogleJourneyLaunch(descriptors);
	const lane = descriptors[0].canonicalLaneRoot;
	const child = spawn(
		node16,
		[
			path.join(lane, 'node_modules/next/dist/bin/next'),
			'start',
			'-p',
			String(port),
			'-H',
			'127.0.0.1',
		],
		{
			cwd: lane,
			env: {
				PATH: `${path.dirname(node16)}:/usr/bin:/bin`,
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
				NEXT_TELEMETRY_DISABLED: '1',
				NODE_ENV: 'production',
			},
			stdio: ['ignore', 'pipe', 'pipe'],
		},
	);
	const errors: Buffer[] = [];
	child.stderr?.on('data', (value: Buffer) => errors.push(value));
	const url = `http://127.0.0.1:${port}`;
	for (let attempt = 0; attempt < 100; attempt += 1) {
		if (child.exitCode !== null)
			throw new Error(`T236 next start exited: ${Buffer.concat(errors).toString('utf8')}`);
		try {
			const response = await fetch(url);
			if (response.ok) return { child, url };
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	await stopProduction(child);
	throw new Error('T236 next start did not become ready');
}

type StoppableChild = Pick<ChildProcess, 'exitCode' | 'signalCode' | 'kill' | 'once'>;

async function waitForChildExit(child: StoppableChild, milliseconds: number): Promise<boolean> {
	if (child.exitCode !== null || child.signalCode !== null) return true;
	return await new Promise<boolean>((resolve) => {
		const timeout = setTimeout(() => resolve(false), milliseconds);
		child.once('exit', () => {
			clearTimeout(timeout);
			resolve(true);
		});
	});
}

export async function terminateKilledByGoogleServerChild(
	child: StoppableChild,
	waitForExit: (
		child: StoppableChild,
		milliseconds: number,
	) => Promise<boolean> = waitForChildExit,
): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) return;
	child.kill('SIGTERM');
	if (!(await waitForExit(child, 2000))) {
		if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
		if (!(await waitForExit(child, 2000)))
			throw new Error('T300 Next production child survived bounded TERM and KILL');
	}
	if (child.exitCode === null && child.signalCode === null)
		throw new Error('T300 Next production child exit is unconfirmed after TERM or KILL');
}

async function stopProduction(child: ChildProcess): Promise<void> {
	await terminateKilledByGoogleServerChild(child);
}

async function settleKilledByGoogleSearch(
	page: Page,
	descriptor: KilledByGoogleJourneyDescriptor,
	initialCount: number,
): Promise<number> {
	const search = page.locator('#searchBox');
	const observations: KilledByGoogleSearchObservation[] = [
		{ inputValue: await search.inputValue(), count: initialCount, postInputTurn: 0 },
	];
	await search.fill('Google+');
	for (let turn = 1; turn <= 300; turn += 1) {
		await page.evaluate(
			async () =>
				await new Promise<void>((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
				),
		);
		observations.push({
			inputValue: await search.inputValue(),
			count: await page.locator('ul > li h2').count(),
			postInputTurn: turn,
		});
		const settled = settledKilledByGoogleSearchCount(descriptor, observations);
		if (settled !== null) return settled;
	}
	throw new Error('T300 Google+ search did not reach two stable post-input turns');
}

function journeyRecord(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`T308 ${label} is not an object`);
	return value as Record<string, unknown>;
}

function journeyInteger(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
		throw new Error(`T308 ${label} is not a nonnegative integer`);
	return value;
}

function journeyString(value: unknown, label: string): string {
	if (typeof value !== 'string') throw new Error(`T308 ${label} is not a string`);
	return value;
}

function exactJourneyKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
	label: string,
) {
	if (
		canonicalize(Object.keys(value).sort(compare)) !== canonicalize([...expected].sort(compare))
	)
		throw new Error(`T308 ${label} keys differ`);
}

function projectKilledByGoogleScript(value: unknown, index: number) {
	const script = journeyRecord(value, `script ${index}`);
	exactJourneyKeys(script, ['src', 'async', 'defer'], `script ${index}`);
	if (typeof script.async !== 'boolean' || typeof script.defer !== 'boolean')
		throw new Error(`T308 script ${index} flags differ`);
	const src = journeyString(script.src, `script ${index} source`);
	if (!src)
		return Object.freeze({
			sourceDisposition: 'inline',
			sourceIdentity: '',
			async: script.async,
			defer: script.defer,
		});
	const parsed = parseURL(src);
	const loopback = parsed.host?.startsWith('127.0.0.1:') ?? false;
	const generated = loopback && parsed.pathname.startsWith('/_next/static/');
	return Object.freeze({
		sourceDisposition: generated
			? 'generated-loopback'
			: loopback
				? 'loopback-exact'
				: 'nonloopback-exact',
		sourceIdentity: generated ? '<GENERATED-LOOPBACK-SCRIPT>' : src,
		async: script.async,
		defer: script.defer,
	});
}

export function projectKilledByGoogleJourneySemantics(value: unknown) {
	const row = journeyRecord(value, 'journey');
	exactJourneyKeys(
		row,
		[
			'pass',
			'phase',
			'lane',
			'appSha256',
			'buildSha256',
			'initialRows',
			'initialProducts',
			'searchTerm',
			'searchRows',
			'googlePlus',
			'filterLabel',
			'appRows',
			'blocked',
			'scripts',
			'successfulNonLoopback',
			'pageErrors',
		],
		'journey',
	);
	if (row.pass !== 1 && row.pass !== 2) throw new Error('T308 journey pass differs');
	if (!journeyPhaseOrder.includes(row.phase as (typeof journeyPhaseOrder)[number]))
		throw new Error('T308 journey phase differs');
	if (row.lane !== 'baseline' && row.lane !== 'migrated')
		throw new Error('T308 journey lane differs');
	for (const [field, digest] of [
		['appSha256', row.appSha256],
		['buildSha256', row.buildSha256],
	] as const)
		if (typeof digest !== 'string' || !lowerHex64.test(digest))
			throw new Error(`T308 journey ${field} differs`);

	const googlePlus = journeyRecord(row.googlePlus, 'Google+ identity');
	exactJourneyKeys(googlePlus, ['name', 'type', 'link', 'description'], 'Google+ identity');
	const blocked = row.blocked;
	if (!Array.isArray(blocked)) throw new Error('T308 blocked requests differ');
	const projectedBlocked = blocked.map((value, index) => {
		const entry = journeyRecord(value, `blocked request ${index}`);
		exactJourneyKeys(entry, ['kind', 'value'], `blocked request ${index}`);
		if (entry.kind !== 'nonloopback' && entry.kind !== 'excluded-local-asset')
			throw new Error(`T308 blocked request ${index} kind differs`);
		return Object.freeze({
			kind: entry.kind,
			value: journeyString(entry.value, `blocked request ${index} value`),
		});
	});
	const scripts = row.scripts;
	if (!Array.isArray(scripts)) throw new Error('T308 scripts differ');
	const pageErrors = row.pageErrors;
	if (!Array.isArray(pageErrors)) throw new Error('T308 page errors differ');

	return Object.freeze({
		initialRows: journeyInteger(row.initialRows, 'initialRows'),
		initialProducts: journeyInteger(row.initialProducts, 'initialProducts'),
		searchTerm: journeyString(row.searchTerm, 'searchTerm'),
		searchRows: journeyInteger(row.searchRows, 'searchRows'),
		googlePlus: Object.freeze({
			name: journeyString(googlePlus.name, 'Google+ name'),
			type: journeyString(googlePlus.type, 'Google+ type'),
			link: journeyString(googlePlus.link, 'Google+ link'),
			description: journeyString(googlePlus.description, 'Google+ description'),
		}),
		filterLabel: journeyString(row.filterLabel, 'filterLabel'),
		appRows: journeyInteger(row.appRows, 'appRows'),
		blocked: Object.freeze(
			projectedBlocked.sort((left, right) =>
				compare(canonicalize(left), canonicalize(right)),
			),
		),
		scripts: Object.freeze(scripts.map(projectKilledByGoogleScript)),
		successfulNonLoopback: journeyInteger(row.successfulNonLoopback, 'successfulNonLoopback'),
		pageErrors: Object.freeze(
			pageErrors.map((error, index) => journeyString(error, `page error ${index}`)),
		),
	});
}

async function journeyAttempt(
	page: Page,
	url: string,
	excludedAssets: readonly string[],
	descriptor: KilledByGoogleJourneyDescriptor,
) {
	const blocked: Array<{ kind: 'nonloopback' | 'excluded-local-asset'; value: string }> = [];
	const pageErrors: string[] = [];
	let successfulNonLoopback = 0;
	page.on('pageerror', (error) => pageErrors.push(error.message));
	await page.route('**/*', async (route) => {
		const requestUrl = route.request().url();
		const parsed = parseURL(requestUrl);
		const local = parsed.host?.startsWith('127.0.0.1:') ?? false;
		const archivePath = `public${parsed.pathname}`;
		if (!local) {
			blocked.push({ kind: 'nonloopback', value: requestUrl });
			await route.abort('blockedbyclient');
		} else if (excludedAssets.includes(archivePath)) {
			blocked.push({ kind: 'excluded-local-asset', value: archivePath });
			await route.abort('blockedbyclient');
		} else await route.continue();
	});
	page.on('response', (response) => {
		if (!parseURL(response.url()).host?.startsWith('127.0.0.1:') && response.ok())
			successfulNonLoopback += 1;
	});
	const waitForCount = async (selector: string, expected: number, label: string) => {
		try {
			await page.waitForFunction(
				({ selector: query, expected: count }) =>
					document.querySelectorAll(query).length === count,
				{ selector, expected },
				{ timeout: 60_000 },
			);
		} catch {
			throw new Error(
				`T267 ${label} row count differs: expected ${expected}, found ${await page.locator(selector).count()}; page errors: ${pageErrors.join(' | ') || 'none'}`,
			);
		}
	};
	await page.goto(url, { waitUntil: 'domcontentloaded' });
	await waitForCount('ul > li h2', killedByGoogleBrowserOracle.total, 'initial product');
	const initialRows = await page.locator('ul > li h2').count();
	const initialProducts = await page.locator('ul > li h2').count();
	if (
		initialRows !== killedByGoogleBrowserOracle.total ||
		initialProducts !== killedByGoogleBrowserOracle.total
	)
		throw new Error('T236 initial list row count differs');
	const search = page.locator('#searchBox');
	if ((await search.getAttribute('placeholder')) !== 'Search')
		throw new Error('T236 search label differs');
	const searchRows = await settleKilledByGoogleSearch(page, descriptor, initialRows);
	assertKilledByGoogleSettledSearchCount(descriptor, searchRows);
	const googlePlusLink = page.getByRole('link', {
		name: killedByGoogleBrowserOracle.googlePlus.name,
		exact: true,
	});
	const googlePlusItem = googlePlusLink.locator('xpath=ancestor::li');
	if (
		(await googlePlusLink.count()) !== 1 ||
		(await googlePlusLink.getAttribute('href')) !==
			killedByGoogleBrowserOracle.googlePlus.link ||
		!(await googlePlusItem.textContent())?.includes(
			killedByGoogleBrowserOracle.googlePlus.description,
		)
	)
		throw new Error('T269 exact Google+ browser identity differs');
	await search.fill('');
	await waitForCount('ul > li h2', killedByGoogleBrowserOracle.total, 'cleared search');
	const filter = page.locator('#listFilter input');
	await filter.click();
	await page.getByText(`Apps (${killedByGoogleBrowserOracle.apps})`, { exact: true }).click();
	await waitForCount('ul > li h2', killedByGoogleBrowserOracle.apps, 'Apps filter');
	const appRows = await page.locator('ul > li h2').count();
	if (appRows !== killedByGoogleBrowserOracle.apps)
		throw new Error('T236 Apps row-count assertion failed');
	await page.waitForTimeout(100);
	const scripts = await page.locator('script').evaluateAll((nodes) =>
		nodes.map((node) => ({
			src: (node as HTMLScriptElement).src,
			async: (node as HTMLScriptElement).async,
			defer: (node as HTMLScriptElement).defer,
		})),
	);
	if (successfulNonLoopback || pageErrors.length)
		throw new Error('T236 browser locality or page-error invariant differs');
	return {
		phase: descriptor.phase,
		lane: descriptor.lane,
		appSha256: descriptor.expectedAppSha256,
		buildSha256: descriptor.expectedBuildSha256,
		initialRows,
		initialProducts,
		searchTerm: 'Google+',
		searchRows,
		googlePlus: killedByGoogleBrowserOracle.googlePlus,
		filterLabel: `Apps (${killedByGoogleBrowserOracle.apps})`,
		appRows,
		blocked: blocked.sort((left, right) => compare(canonicalize(left), canonicalize(right))),
		scripts,
		successfulNonLoopback,
		pageErrors,
	};
}

async function journey(
	page: Page,
	url: string,
	excludedAssets: readonly string[],
	descriptor: KilledByGoogleJourneyDescriptor,
) {
	try {
		return await journeyAttempt(page, url, excludedAssets, descriptor);
	} catch (error) {
		throw new KilledByGoogleJourneyPhaseFailure(descriptor, error);
	}
}

async function runJourneys(
	browser: Browser,
	phaseState: KilledByGoogleJourneyPhaseState,
	descriptors: readonly [KilledByGoogleJourneyDescriptor, KilledByGoogleJourneyDescriptor],
	excludedAssets: readonly string[],
): Promise<
	ReturnType<typeof journey> extends Promise<infer T> ? Array<T & { pass: number }> : never
> {
	try {
		if (
			descriptors[0].pass !== 1 ||
			descriptors[1].pass !== 2 ||
			descriptors.some(
				(descriptor) =>
					descriptor.phase !== descriptors[0].phase ||
					descriptor.lane !== descriptors[0].lane ||
					descriptor.canonicalLaneRoot !== descriptors[0].canonicalLaneRoot ||
					descriptor.canonicalBuildRoot !== descriptors[0].canonicalBuildRoot ||
					descriptor.expectedAppSha256 !== descriptors[0].expectedAppSha256 ||
					descriptor.expectedBuildSha256 !== descriptors[0].expectedBuildSha256,
			)
		)
			throw new Error('T298 journey descriptor pair differs');
		phaseState.consume(descriptors);
		const server = await startProduction(descriptors);
		try {
			const results = [];
			for (const descriptor of descriptors) {
				const context = await browser.newContext({ serviceWorkers: 'block' });
				try {
					const page = await context.newPage();
					results.push({
						pass: descriptor.pass,
						...(await journey(page, server.url, excludedAssets, descriptor)),
					});
				} finally {
					await context.close();
				}
			}
			return results as never;
		} finally {
			await stopProduction(server.child);
		}
	} catch (error) {
		if (error instanceof KilledByGoogleJourneyPhaseFailure) throw error;
		throw new KilledByGoogleJourneyPhaseFailure(descriptors[0], error);
	}
}

async function artifact(name: string, value: unknown): Promise<{ path: string; sha256: string }> {
	const file = path.join(stage, 'artifacts', name);
	await writeFile(file, canonical(value));
	return {
		path: `evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/${name}`,
		sha256: sha256(await readFile(file)),
	};
}

class DiagnosticClassificationFailure extends Error {
	readonly stage: string;
	readonly code: string;

	constructor(stage: string, code: string) {
		super(`T246 diagnostic classifier failed at ${stage}/${code}`);
		this.stage = stage;
		this.code = code;
	}
}

async function classify<T>(stageName: string, failureCode: string, operation: () => Promise<T>) {
	try {
		return await operation();
	} catch {
		throw new DiagnosticClassificationFailure(stageName, failureCode);
	}
}

async function publishBuildVarianceDiagnostic(value: unknown): Promise<void> {
	const previous = path.join(
		root,
		'.versionless/stage/next-killedbygoogle/derived-state-to-memo-previous',
	);
	await writeFile(path.join(stage, 'build-variance-diagnostic.json'), canonical(value));
	await rename(output, previous);
	try {
		await rename(stage, output);
		await rm(previous, { recursive: true, force: true });
	} catch (error) {
		if (await exists(previous)) await rename(previous, output);
		throw error;
	}
}

export async function diagnoseNextKilledByGoogleBuildVariance(): Promise<Record<string, unknown>> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1' ||
		process.env.VERSIONLESS_CONSENT_ID
	)
		throw new Error('T240 requires consent-free offline CI mode');
	for (const target of [work, stage])
		if (await exists(target))
			throw new Error(`T240 residue exists: ${path.relative(root, target)}`);
	const previousDiagnostic = path.join(output, 'build-variance-diagnostic.json');
	const previousDiagnosticSha256 = (await exists(previousDiagnostic))
		? sha256(await readFile(previousDiagnostic))
		: '';
	if (
		previousDiagnosticSha256 !== expectedPreviousDiagnostic ||
		(await exists(path.join(output, 'receipt.json')))
	)
		throw new Error('T249 retained v4 diagnostic identity differs');
	if (sha256(await readFile(archive)) !== expectedArchive)
		throw new Error('T240 immutable source archive differs');
	if (sha256(await readFile(dependencyReceipt)) !== expectedDependencyReceipt)
		throw new Error('T240 dependency receipt differs');
	if (
		sha256(await readFile(path.join(root, 'evidence/runs/aggregate.json'))) !==
		'66a742c3aab263eac7383b6bc96bb6a390a3336d5ff8223cafca810f3d3c1730'
	)
		throw new Error('T240 aggregate differs');
	const closure = JSON.parse(await readFile(closureFile, 'utf8')) as {
		integrity?: { canonicalDigest?: unknown };
		artifacts?: unknown[];
	};
	if (
		closure.integrity?.canonicalDigest !==
			'61fcd0d02df1212e8a7f461fbfb69917037b4fd85533a095f5d683064991311e' ||
		closure.artifacts?.length !== 710
	)
		throw new Error('T240 audited closure identity differs');
	await mkdir(work, { recursive: true });
	await mkdir(stage, { recursive: true });
	try {
		const firstLane = await extractLane('diagnostic-first');
		const secondLane = await extractLane('diagnostic-second');
		const firstSource = await sourceTree(firstLane);
		const secondSource = await sourceTree(secondLane);
		if (canonicalize(firstSource) !== canonicalize(secondSource))
			throw new Error('T240 initial immutable lane sources differ');
		const firstInstall = await installLane(firstLane);
		const secondInstall = await installLane(secondLane);
		if (firstInstall !== expectedInstallTree || secondInstall !== expectedInstallTree)
			throw new Error('T240 retained offline install tree differs');
		const firstBuild = await buildSnapshot(firstLane);
		const secondBuild = await buildSnapshot(secondLane);
		if (
			canonicalize(await sourceTree(firstLane)) !== canonicalize(firstSource) ||
			canonicalize(await sourceTree(secondLane)) !== canonicalize(secondSource)
		)
			throw new Error('T240 source, configuration, or lock changed');
		const differingPaths = normalizedDifference(firstBuild, secondBuild);
		const firstBuildRoot = path.join(firstLane, '.next');
		const secondBuildRoot = path.join(secondLane, '.next');
		const portableInventory = (snapshot: BuildSnapshot) =>
			snapshot.rows.map((row) => ({
				path: row.path.split(snapshot.buildId).join('<BUILD_ID>'),
				byteLength: row.byteLength,
				rawSha256: row.sha256,
			}));
		const firstNormalized = new Map(
			firstBuild.normalizedRows.map((row) => [row.path, row.sha256]),
		);
		const secondNormalized = new Map(
			secondBuild.normalizedRows.map((row) => [row.path, row.sha256]),
		);
		const firstRaw = new Map(firstBuild.rows.map((row) => [row.path, row]));
		const secondRaw = new Map(secondBuild.rows.map((row) => [row.path, row]));
		const classifiedRaw = expectedVariance.map((filePath) => {
			const left = firstRaw.get(filePath);
			const right = secondRaw.get(filePath);
			if (!left || !right)
				throw new Error(`T249 classified build path is absent: ${filePath}`);
			return {
				path: filePath,
				first: { byteLength: left.byteLength, sha256: left.sha256 },
				second: { byteLength: right.byteLength, sha256: right.sha256 },
				rawEqual: left.byteLength === right.byteLength && left.sha256 === right.sha256,
			};
		});
		const rawDifferingPaths = classifiedRaw
			.filter((row) => !row.rawEqual)
			.map((row) => row.path)
			.sort(compare);
		const buildFileComparison = [
			...new Set([...firstNormalized.keys(), ...secondNormalized.keys()]),
		]
			.sort(compare)
			.map((filePath) => ({
				path: filePath,
				type: 'file',
				firstSha256: firstNormalized.get(filePath) ?? null,
				secondSha256: secondNormalized.get(filePath) ?? null,
				equal: firstNormalized.get(filePath) === secondNormalized.get(filePath),
			}));
		const baseDiagnostic = {
			schemaVersion: 'versionless.next-killedbygoogle-build-variance-diagnostic.v11',
			result: 'diagnostic-only',
			diagnosticAttemptCount: 1,
			safeMismatchPersistence: true,
			builds: 2,
			productionPath: 'next build',
			sourceChanged: false,
			payloadsRetained: false,
			networkMode: 'offline',
			dependency: {
				closureCanonicalDigest: closure.integrity.canonicalDigest,
				installTreeSha256: expectedInstallTree,
				installTreesEqual: true,
			},
			rawInventories: [
				{
					build: 1,
					files: portableInventory(firstBuild),
				},
				{
					build: 2,
					files: portableInventory(secondBuild),
				},
			],
			rawDifferingPaths,
			buildIdNormalizedDifferingPaths: differingPaths,
			buildFileComparison,
		};
		if (
			baseDiagnostic.schemaVersion ===
			'versionless.next-killedbygoogle-build-variance-diagnostic.v11'
		) {
			const classified: Record<string, unknown> = {};
			try {
				await classify('variance', 'unexpected-raw-path-set', async () => {
					const allowed = new Set<string>(expectedVariance);
					if (
						!rawDifferingPaths.length ||
						rawDifferingPaths.some((filePath) => !allowed.has(filePath))
					)
						throw new Error('raw-path-set');
					if (differingPaths.some((filePath) => !allowed.has(filePath)))
						throw new Error('unclassified-output');
				});
				classified.prerenderManifest = await classify(
					'prerender-manifest',
					'prerender-semantic-mismatch',
					async () =>
						await prerenderDiagnostic(
							path.join(firstBuildRoot, 'prerender-manifest.json'),
							path.join(secondBuildRoot, 'prerender-manifest.json'),
							firstBuild.buildId,
							secondBuild.buildId,
						),
				);
				classified.requiredServerFiles = await classify(
					'required-server-files',
					'required-server-semantic-mismatch',
					async () =>
						await requiredServerFilesDiagnostic(
							path.join(firstBuildRoot, 'required-server-files.json'),
							path.join(secondBuildRoot, 'required-server-files.json'),
							firstLane,
							secondLane,
							firstBuild.buildId,
							secondBuild.buildId,
							path.join(firstBuildRoot, 'prerender-manifest.json'),
							path.join(secondBuildRoot, 'prerender-manifest.json'),
						),
				);
				classified.routesManifest = await classify(
					'routes-manifest',
					'routes-semantic-mismatch',
					async () =>
						await routesManifestDiagnostic(
							path.join(firstBuildRoot, 'routes-manifest.json'),
							path.join(secondBuildRoot, 'routes-manifest.json'),
							firstBuild.buildId,
							secondBuild.buildId,
						),
				);
				const firstTrace = await classify(
					'trace',
					'trace-schema-mismatch',
					async () => await aggregateTraceDiagnostic(path.join(firstBuildRoot, 'trace')),
				);
				const secondTrace = await classify(
					'trace',
					'trace-schema-mismatch',
					async () => await aggregateTraceDiagnostic(path.join(secondBuildRoot, 'trace')),
				);
				const comparison = compareAggregateTraces(firstTrace, secondTrace);
				const laneProjection = await classify(
					'trace-lane-projection',
					'lane-projection-mismatch',
					async () =>
						laneProjectionDiagnostic(
							firstTrace,
							secondTrace,
							firstLane,
							secondLane,
							comparison,
						),
				);
				classified.traceDiagnostic = {
					traceDecision: null,
					valuesRetained: false,
					valueHashesRetained: false,
					idsRetained: false,
					timingRetained: false,
					eventsRetained: false,
					pathsRetained: false,
					builds: [firstTrace.evidence, secondTrace.evidence],
					comparison,
					laneProjection,
				};
			} catch (error) {
				const failure =
					error instanceof DiagnosticClassificationFailure
						? error
						: new DiagnosticClassificationFailure(
								'trace-diagnostic',
								'unclassified-mismatch',
							);
				await publishBuildVarianceDiagnostic({
					...baseDiagnostic,
					...classified,
					classificationStatus: 'mismatch',
					normalizationEligible: false,
					failure: { stage: failure.stage, code: failure.code },
					classification: 'next12-lane-trace-projection-category-diagnostic-only',
				});
				throw failure;
			}
			const traceDiagnostic = {
				...baseDiagnostic,
				...classified,
				classificationStatus: 'lane-projection-category-diagnostic-complete',
				normalizationEligible: false,
				classification: 'next12-lane-trace-projection-category-diagnostic-only',
			};
			await publishBuildVarianceDiagnostic(traceDiagnostic);
			return traceDiagnostic;
		}
		if (
			baseDiagnostic.schemaVersion ===
			'versionless.next-killedbygoogle-build-variance-diagnostic.v6'
		) {
			const classified: Record<string, unknown> = {};
			try {
				await classify('variance', 'unexpected-raw-path-set', async () => {
					const allowed = new Set<string>(expectedVariance);
					if (
						!rawDifferingPaths.length ||
						rawDifferingPaths.some((filePath) => !allowed.has(filePath))
					)
						throw new Error('raw-path-set');
					if (differingPaths.some((filePath) => !allowed.has(filePath)))
						throw new Error('unclassified-output');
				});
				classified.prerenderManifest = await classify(
					'prerender-manifest',
					'prerender-semantic-mismatch',
					async () =>
						await prerenderDiagnostic(
							path.join(firstBuildRoot, 'prerender-manifest.json'),
							path.join(secondBuildRoot, 'prerender-manifest.json'),
							firstBuild.buildId,
							secondBuild.buildId,
						),
				);
				classified.requiredServerFiles = await classify(
					'required-server-files',
					'required-server-field-diagnostic-failure',
					async () =>
						await requiredServerFilesFieldDiagnostic(
							path.join(firstBuildRoot, 'required-server-files.json'),
							path.join(secondBuildRoot, 'required-server-files.json'),
							firstLane,
							secondLane,
						),
				);
			} catch (error) {
				const failure =
					error instanceof DiagnosticClassificationFailure
						? error
						: new DiagnosticClassificationFailure(
								'field-diagnostic',
								'unclassified-mismatch',
							);
				await publishBuildVarianceDiagnostic({
					...baseDiagnostic,
					...classified,
					classificationStatus: 'mismatch',
					normalizationEligible: false,
					failure: { stage: failure.stage, code: failure.code },
					classification: 'required-server-field-diagnostic-only',
				});
				throw failure;
			}
			const fieldDiagnostic = {
				...baseDiagnostic,
				...classified,
				classificationStatus: 'field-diagnostic-complete',
				normalizationEligible: false,
				classification: 'required-server-field-diagnostic-only',
				limitations: [
					'Required-server field diagnostic only; no normalization, migration, browser, support, aggregate, corpus, receipt, or trust claim.',
					'No raw scalar, host path, manifest, trace, build payload, node_modules, or application bundle is retained.',
				],
			};
			await publishBuildVarianceDiagnostic(fieldDiagnostic);
			return fieldDiagnostic;
		}
		const classified: Record<string, unknown> = {};
		try {
			await classify('variance', 'unclassified-output-path', async () => {
				const allowed = new Set<string>(expectedVariance);
				if (differingPaths.some((filePath) => !allowed.has(filePath)))
					throw new Error('unclassified-output');
			});
			const dispositions = new Map<
				string,
				{
					rawEqual: boolean;
					comparatorRan: boolean;
					semanticEqual: boolean;
					classification: string;
				}
			>();
			const isRawEqual = (filePath: string) =>
				classifiedRaw.find((row) => row.path === filePath)?.rawEqual ?? false;
			const classifyPath = async (
				filePath: string,
				stageName: string,
				failureCode: string,
				operation: () => Promise<unknown>,
				trivial: unknown,
			): Promise<unknown> => {
				if (isRawEqual(filePath)) {
					dispositions.set(filePath, {
						rawEqual: true,
						comparatorRan: false,
						semanticEqual: true,
						classification: 'raw-byte-equal',
					});
					return trivial;
				}
				const result = await classify(stageName, failureCode, operation);
				dispositions.set(filePath, {
					rawEqual: false,
					comparatorRan: true,
					semanticEqual: true,
					classification: 'source-backed-semantic-equal',
				});
				return result;
			};
			classified.prerenderManifest = await classifyPath(
				'prerender-manifest.json',
				'prerender-manifest',
				'prerender-semantic-mismatch',
				async () =>
					await prerenderDiagnostic(
						path.join(firstBuildRoot, 'prerender-manifest.json'),
						path.join(secondBuildRoot, 'prerender-manifest.json'),
						firstBuild.buildId,
						secondBuild.buildId,
					),
				{ stableEqual: true, classification: 'raw-byte-equal' },
			);
			classified.requiredServerFiles = await classifyPath(
				'required-server-files.json',
				'required-server-files',
				'required-server-semantic-mismatch',
				async () =>
					await requiredServerFilesDiagnostic(
						path.join(firstBuildRoot, 'required-server-files.json'),
						path.join(secondBuildRoot, 'required-server-files.json'),
						firstLane,
						secondLane,
						firstBuild.buildId,
						secondBuild.buildId,
						path.join(firstBuildRoot, 'prerender-manifest.json'),
						path.join(secondBuildRoot, 'prerender-manifest.json'),
					),
				{ stableEqual: true, classification: 'raw-byte-equal' },
			);
			classified.routesManifest = await classifyPath(
				'routes-manifest.json',
				'routes-manifest',
				'routes-semantic-mismatch',
				async () =>
					await routesManifestDiagnostic(
						path.join(firstBuildRoot, 'routes-manifest.json'),
						path.join(secondBuildRoot, 'routes-manifest.json'),
						firstBuild.buildId,
						secondBuild.buildId,
					),
				{ stableEqual: true, classification: 'raw-byte-equal' },
			);
			classified.trace = await classifyPath(
				'trace',
				'trace',
				'trace-semantic-mismatch',
				async () => {
					const firstTrace = await traceDiagnostic(
						path.join(firstBuildRoot, 'trace'),
						firstLane,
					);
					const secondTrace = await traceDiagnostic(
						path.join(secondBuildRoot, 'trace'),
						secondLane,
					);
					if (
						canonicalize(firstTrace.semanticProjection) !==
							canonicalize(secondTrace.semanticProjection) ||
						firstTrace.spanCount !== secondTrace.spanCount
					)
						throw new Error('trace');
					const { semanticProjection: _firstProjection, ...firstTraceEvidence } =
						firstTrace;
					const { semanticProjection: _secondProjection, ...secondTraceEvidence } =
						secondTrace;
					return {
						first: firstTraceEvidence,
						second: secondTraceEvidence,
						semanticProjectionEqual: true,
						volatileOnly: true,
					};
				},
				{ semanticProjectionEqual: true, classification: 'raw-byte-equal' },
			);
			const nftPaths = expectedVariance.filter((file) => file.endsWith('.nft.json'));
			const nftPairs = [];
			for (const nftPath of nftPaths) {
				const pair = await classifyPath(
					nftPath,
					'nft',
					'nft-semantic-mismatch',
					async () => {
						const firstNft = await nftDiagnostic(
							path.join(firstBuildRoot, nftPath),
							firstLane,
						);
						const secondNft = await nftDiagnostic(
							path.join(secondBuildRoot, nftPath),
							secondLane,
						);
						if (
							firstNft.version !== secondNft.version ||
							firstNft.cacheKeySha256 !== secondNft.cacheKeySha256 ||
							canonicalize(firstNft.bindings) !== canonicalize(secondNft.bindings)
						)
							throw new Error('nft');
						return {
							path: nftPath,
							first: firstNft,
							second: secondNft,
							bindingsEqual: true,
							semanticEqual: true,
						};
					},
					{
						path: nftPath,
						rawEqual: true,
						comparatorRan: false,
						semanticEqual: true,
						classification: 'raw-byte-equal',
					},
				);
				nftPairs.push(pair);
			}
			classified.nftPairs = nftPairs;
			const classifiedPaths = classifiedRaw.map((row) => ({
				...row,
				...dispositions.get(row.path),
			}));
			if (
				classifiedPaths.length !== expectedVariance.length ||
				classifiedPaths.some(
					(row) =>
						typeof row.semanticEqual !== 'boolean' ||
						(row.rawEqual ? row.comparatorRan !== false : row.comparatorRan !== true),
				)
			)
				throw new DiagnosticClassificationFailure(
					'disposition',
					'incomplete-classified-paths',
				);
			classified.classifiedPaths = classifiedPaths;
			classified.semanticDifferingPaths = classifiedPaths
				.filter((row) => !row.semanticEqual)
				.map((row) => row.path);
			if ((classified.semanticDifferingPaths as string[]).length !== 0)
				throw new DiagnosticClassificationFailure('disposition', 'semantic-difference');
		} catch (error) {
			const failure =
				error instanceof DiagnosticClassificationFailure
					? error
					: new DiagnosticClassificationFailure('classifier', 'unclassified-mismatch');
			const mismatchDiagnostic = {
				...baseDiagnostic,
				...classified,
				classificationStatus: 'mismatch',
				normalizationEligible: false,
				failure: { stage: failure.stage, code: failure.code },
				classification: 'no-normalization-or-support-decision',
			};
			await publishBuildVarianceDiagnostic(mismatchDiagnostic);
			throw failure;
		}
		const diagnostic = {
			...baseDiagnostic,
			...classified,
			classificationStatus: 'complete',
			normalizationEligible: true,
			classification: 'explicit-next12-semantic-reproducibility-diagnostic-only',
			limitations: [
				'Diagnostic evidence only; no migration, browser parity, support, aggregate, corpus, receipt, or trust claim.',
				'Build payloads, raw trace bodies, preview secret values, node_modules, and application bundles are not retained.',
			],
		};
		await publishBuildVarianceDiagnostic(diagnostic);
		return diagnostic;
	} catch (error) {
		await rm(stage, { recursive: true, force: true });
		throw error;
	} finally {
		await rm(work, { recursive: true, force: true });
	}
}

export async function runNextKilledByGoogle(): Promise<Record<string, unknown>> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1' ||
		process.env.VERSIONLESS_CONSENT_ID
	)
		throw new Error('T236 requires consent-free offline CI mode');
	for (const target of [work, stage])
		if (await exists(target))
			throw new Error(`T236 residue exists: ${path.relative(root, target)}`);
	const retainedDiagnostic = await readFile(retainedDiagnosticPath);
	if (
		sha256(retainedDiagnostic) !== expectedRetainedDiagnostic ||
		(await exists(path.join(output, 'receipt.json')))
	)
		throw new Error('T263 retained v11 diagnostic identity differs');
	if (sha256(await readFile(archive)) !== expectedArchive)
		throw new Error('T236 immutable source archive differs');
	if (
		sha256(await readFile(provenanceFile)) !==
		'2d7b33af46e951f2e128b5dd4c440d611e0c27f593d3004b470190abc703164b'
	)
		throw new Error('T236 source provenance differs');
	const closure = JSON.parse(await readFile(closureFile, 'utf8')) as {
		integrity?: { canonicalDigest?: unknown };
		artifacts?: unknown[];
	};
	if (
		closure.integrity?.canonicalDigest !==
			'61fcd0d02df1212e8a7f461fbfb69917037b4fd85533a095f5d683064991311e' ||
		closure.artifacts?.length !== 710
	)
		throw new Error('T236 audited closure identity differs');
	const closureCanonicalDigest = closure.integrity.canonicalDigest;
	const dependencyReceiptSha256 = sha256(await readFile(dependencyReceipt));
	const provenance = JSON.parse(await readFile(provenanceFile, 'utf8')) as {
		assets?: Array<{ path?: unknown; classification?: unknown; sha256?: unknown }>;
	};
	const excludedAssets = (provenance.assets ?? [])
		.filter(
			(entry) => entry.classification === 'unknown' || entry.classification === 'excluded',
		)
		.map((entry) => String(entry.path))
		.sort(compare);
	if (excludedAssets.length !== 22) throw new Error('T236 excluded asset inventory differs');
	if (
		sha256(await readFile(chromiumExecutable)) !==
		'a46b3b1e63163fa2d2437fb6ae967cb5a73b50050bca32f1964e6129b6228244'
	)
		throw new Error('T236 Chromium identity differs');
	if (
		sha256(await readFile(isolatedCacheKeyProvenanceOutput)) !==
		isolatedCacheKeyProvenanceFileSha256
	)
		throw new Error('T320 isolated cacheKey provenance file differs');
	const isolatedCacheKeyProvenance =
		await validatePublishedNextServerIsolatedCacheKeyProvenance();
	if (
		(isolatedCacheKeyProvenance.integrity as Record<string, unknown>).canonicalDigest !==
		isolatedCacheKeyProvenanceCanonicalDigest
	)
		throw new Error('T320 isolated cacheKey provenance digest differs');
	await mkdir(work, { recursive: true });
	await mkdir(path.join(stage, 'artifacts'), { recursive: true });
	let browser: Browser | undefined;
	try {
		return await promoteAfterIsolatedNextWorkflow({
			runInsideLanes: async () =>
				await withIsolatedNextWorkflowLanes(
					{
						...isolatedNextBuildLaneOperations,
						populateFixtureLane: async (lane) => {
							await execute('/usr/bin/tar', [
								'-xzf',
								archive,
								'-C',
								lane,
								'--strip-components',
								'1',
							]);
						},
					},
					async () => {
						await browser?.close();
						browser = undefined;
					},
					async ({ baseline, migrated }) => {
						const baselineSource = await sourceTree(baseline);
						if (
							canonicalize(baselineSource) !==
							canonicalize(await sourceTree(migrated))
						)
							throw new Error('T236 initial lane sources differ');
						const baselineInstall = await installLane(baseline);
						const migratedInstall = await installLane(migrated);
						if (baselineInstall !== migratedInstall)
							throw new Error('T236 clean offline lane install trees differ');
						const baselineFirst = await buildSnapshot(baseline);
						const baselineFirstLiveProduction = await bindProductionSnapshot(
							'baseline-first',
							baselineFirst,
							baseline,
							path.join(baseline, '.next'),
						);
						assertIsolatedProductionCacheKeyBinding(baselineFirstLiveProduction);
						const baselineFirstRoot = path.join(
							work,
							'production-snapshots/baseline-first',
						);
						await cp(path.join(baseline, '.next'), baselineFirstRoot, {
							recursive: true,
						});
						const baselineFirstProduction = await bindProductionSnapshot(
							'baseline-first',
							baselineFirst,
							baseline,
							baselineFirstRoot,
						);
						assertIsolatedProductionCacheKeyBinding(baselineFirstProduction);
						assertProductionSnapshotFidelity(
							baselineFirstLiveProduction,
							baselineFirstProduction,
						);
						const baselineSecond = await buildSnapshot(baseline);
						const baselineSecondProduction = await bindProductionSnapshot(
							'baseline-second',
							baselineSecond,
							baseline,
							path.join(baseline, '.next'),
						);
						assertIsolatedProductionCacheKeyBinding(baselineSecondProduction);
						const baselineProduction = await productionOutputConformance(
							baselineFirst,
							baselineSecond,
							baselineFirstProduction,
							baselineSecondProduction,
						);
						const baselineBuild = {
							rawEqual: baselineFirst.rawDigest === baselineSecond.rawDigest,
							normalizedEqual: true,
							firstBuildId: baselineFirst.buildId,
							secondBuildId: baselineSecond.buildId,
							variance: baselineProduction.rawDifferingPaths,
							normalizedDigest: 'not-retained-production-semantic-comparison',
						};
						const appFile = path.join(migrated, 'components/App.tsx');
						const originalApp = await readFile(appFile);
						const transform = transformNext12DerivedStateToMemo(
							originalApp.toString('utf8'),
						);
						if (
							!transform.changed ||
							transform.edits.length !== 3 ||
							transformNext12DerivedStateToMemo(transform.code).changed
						)
							throw new Error('T236 transform or idempotence differs');
						await writeFile(appFile, transform.code);
						const withoutApp = (rows: FileRow[]) =>
							rows.filter((row) => row.path !== 'components/App.tsx');
						if (
							canonicalize(withoutApp(baselineSource)) !==
							canonicalize(withoutApp(await sourceTree(migrated)))
						)
							throw new Error(
								'T236 transform changed another source or configuration file',
							);
						const migratedInitial = await buildSnapshot(migrated);
						const migratedInitialLiveProduction = await bindProductionSnapshot(
							'migrated-first',
							migratedInitial,
							migrated,
							path.join(migrated, '.next'),
						);
						assertIsolatedProductionCacheKeyBinding(migratedInitialLiveProduction);
						const migratedInitialRoot = path.join(
							work,
							'production-snapshots/migrated-initial',
						);
						await cp(path.join(migrated, '.next'), migratedInitialRoot, {
							recursive: true,
						});
						const migratedFirstProduction = await bindProductionSnapshot(
							'migrated-first',
							migratedInitial,
							migrated,
							migratedInitialRoot,
						);
						assertIsolatedProductionCacheKeyBinding(migratedFirstProduction);
						assertProductionSnapshotFidelity(
							migratedInitialLiveProduction,
							migratedFirstProduction,
						);
						validateKilledByGoogleJourneyPhaseOrder([
							'baseline-parity',
							'migrated-parity',
							'mutation-red',
							'restoration-green',
						]);
						const phaseState = createKilledByGoogleJourneyPhaseState();
						const baselineDescriptors = await createKilledByGoogleJourneyDescriptors({
							phase: 'baseline-parity',
							lane: 'baseline',
							laneRoot: baseline,
							expectedAppSha256: sha256(
								await readFile(path.join(baseline, 'components/App.tsx')),
							),
							expectedBuildSha256: baselineSecond.rawDigest,
						});
						const migratedDescriptors = await createKilledByGoogleJourneyDescriptors({
							phase: 'migrated-parity',
							lane: 'migrated',
							laneRoot: migrated,
							expectedAppSha256: sha256(await readFile(appFile)),
							expectedBuildSha256: migratedInitial.rawDigest,
						});
						browser = await chromium.launch({
							executablePath: chromiumExecutable,
							headless: true,
						});
						const baselineJourneys = await runJourneys(
							browser,
							phaseState,
							baselineDescriptors,
							excludedAssets,
						);
						const migratedJourneys = await runJourneys(
							browser,
							phaseState,
							migratedDescriptors,
							excludedAssets,
						);
						if (
							canonicalize(
								baselineJourneys.map(projectKilledByGoogleJourneySemantics),
							) !==
							canonicalize(
								migratedJourneys.map(projectKilledByGoogleJourneySemantics),
							)
						)
							throw new Error('T236 normalized browser journeys differ');
						const transformedApp = await readFile(appFile);
						const mutationBefore = `        return list.filter(el =>
            regexp.test(el.name.toLowerCase()) ||
            regexp.test(el.description.toLowerCase())
        );`;
						const mutationAfter = '        return list;';
						const mutated = transformedApp
							.toString('utf8')
							.replace(mutationBefore, mutationAfter);
						if (mutated === transformedApp.toString('utf8'))
							throw new Error('T236 mutation span is absent');
						await writeFile(appFile, mutated);
						const mutatedBuild = await buildSnapshot(migrated);
						const mutationDescriptors = await createKilledByGoogleJourneyDescriptors({
							phase: 'mutation-red',
							lane: 'migrated',
							laneRoot: migrated,
							expectedAppSha256: sha256(await readFile(appFile)),
							expectedBuildSha256: mutatedBuild.rawDigest,
						});
						const mutationFailure = await captureKilledByGoogleMutationWithRestoration({
							runMutated: async () => {
								await runJourneys(
									browser!,
									phaseState,
									mutationDescriptors,
									excludedAssets,
								);
							},
							restore: async () => {
								await writeFile(appFile, transformedApp);
							},
							readRestored: async () => await readFile(appFile),
							expectedSha256: sha256(transformedApp),
							provenance: mutationDescriptors[0],
						});
						const migratedRestored = await buildSnapshot(migrated);
						const migratedSecondProduction = await bindProductionSnapshot(
							'migrated-second',
							migratedRestored,
							migrated,
							path.join(migrated, '.next'),
						);
						assertIsolatedProductionCacheKeyBinding(migratedSecondProduction);
						const migratedProduction = await productionOutputConformance(
							migratedInitial,
							migratedRestored,
							migratedFirstProduction,
							migratedSecondProduction,
						);
						assertIsolatedProductionCacheKeyBindings([
							baselineFirstLiveProduction,
							baselineFirstProduction,
							baselineSecondProduction,
							migratedInitialLiveProduction,
							migratedFirstProduction,
							migratedSecondProduction,
						]);
						const migratedBuild = {
							rawEqual: migratedInitial.rawDigest === migratedRestored.rawDigest,
							normalizedEqual: true,
							firstBuildId: migratedInitial.buildId,
							secondBuildId: migratedRestored.buildId,
							variance: migratedProduction.rawDifferingPaths,
							normalizedDigest: 'not-retained-production-semantic-comparison',
						};
						const restorationDescriptors = await createKilledByGoogleJourneyDescriptors(
							{
								phase: 'restoration-green',
								lane: 'migrated',
								laneRoot: migrated,
								expectedAppSha256: sha256(await readFile(appFile)),
								expectedBuildSha256: migratedRestored.rawDigest,
							},
						);
						const restoredJourney = await runKilledByGoogleRestorationJourney(
							async () =>
								(
									await runJourneys(
										browser!,
										phaseState,
										restorationDescriptors,
										excludedAssets,
									)
								)[0]!,
						);
						phaseState.assertComplete();
						const allJourneys = [...baselineJourneys, ...migratedJourneys];
						const allBlocked = allJourneys.flatMap((row) => row.blocked);
						const externalScripts = allJourneys.flatMap((row) =>
							row.scripts.filter(
								(script) =>
									script.src &&
									!parseURL(script.src).host?.startsWith('127.0.0.1:'),
							),
						);
						const nftRows = baselineProduction.nfts;
						const nextServerNft = nftRows.find(
							(nft) => nft.path === 'next-server.js.nft.json',
						);
						if (!nextServerNft)
							throw new Error('T263 next-server NFT disposition is absent');
						for (const rows of [nftRows, migratedProduction.nfts])
							if (
								rows.length !== 5 ||
								rows.some(
									(nft) =>
										!nft.membersUnique ||
										!nft.targetsContained ||
										!nft.realTargetsContained ||
										!nft.bindingsEqual ||
										nft.traceMembershipOccurrences !== 0,
								)
							)
								throw new Error(
									'T263 baseline or migrated NFT disposition differs',
								);
						const deterministicFirst = sha256(
							canonicalize({
								baseline: baselineProduction.deterministicCore.first,
								migrated: migratedProduction.deterministicCore.first,
							}),
						);
						const deterministicSecond = sha256(
							canonicalize({
								baseline: baselineProduction.deterministicCore.second,
								migrated: migratedProduction.deterministicCore.second,
							}),
						);
						if (deterministicFirst !== deterministicSecond)
							throw new Error('T267 cross-lane deterministic cores differ');
						const productionOutputArtifact = await artifact('production-output.json', {
							schemaVersion: 'versionless.next12-production-output-conformance.v1',
							result: 'pass',
							inventoryFiles: 43,
							inventories: {
								baseline: baselineProduction.inventories,
								migrated: migratedProduction.inventories,
							},
							pairs: { baseline: 'pass', migrated: 'pass' },
							trace: baselineProduction.trace,
							manifests: baselineProduction.manifests,
							nftManifestCount: nftRows.length,
							allRuntimeInputsEquivalent: true,
							deterministicCore: {
								baseline: baselineProduction.deterministicCore,
								migrated: migratedProduction.deterministicCore,
								combined: {
									first: deterministicFirst,
									second: deterministicSecond,
									equal: true,
								},
							},
							sourceBindings: {
								traceWriterOnly: true,
								nextStartReadsTrace: false,
								nextServerReadsTrace: false,
								copyTracedFilesReadsTraceDirectly: false,
							},
						});
						const nftEquivalenceArtifact = await artifact('nft-equivalence.json', {
							schemaVersion: 'versionless.next12-nft-equivalence.v1',
							result: 'pass',
							manifestCount: nftRows.length,
							varyingManifestCount: nftRows.filter((nft) => !nft.rawEqual).length,
							rawEqualManifestCount: nftRows.filter((nft) => nft.rawEqual).length,
							allVersions: nftRows.every((nft) => nft.version === 1) ? 1 : 0,
							allMembersUnique: nftRows.every((nft) => nft.membersUnique),
							allTargetsContained: nftRows.every((nft) => nft.targetsContained),
							allRealTargetsContained: nftRows.every(
								(nft) => nft.realTargetsContained,
							),
							allBindingsEqual: nftRows.every((nft) => nft.bindingsEqual),
							memberOrderDisposition: 'order-insensitive-by-copyTracedFiles-consumer',
							nextServerCacheKey: {
								present: nextServerNft.cacheKeyPresent,
								type: nextServerNft.cacheKeyPresent ? 'string' : 'absent',
								equal: nextServerNft.cacheKeyEqual,
								runtimeInput: false,
								valueRetained: false,
								valueHashRetained: false,
							},
							traceMembershipOccurrences: nftRows.reduce(
								(count, nft) => count + nft.traceMembershipOccurrences,
								0,
							),
							manifests: nftRows,
						});
						const supports = [
							{
								path: 'evidence/dependencies/next-killedbygoogle/dependency-receipt.json',
								sha256: dependencyReceiptSha256,
							},
							{
								path: 'evidence/runs/next-killedbygoogle-derived-state-to-memo/build-variance-diagnostic.json',
								sha256: expectedRetainedDiagnostic,
							},
							productionOutputArtifact,
							nftEquivalenceArtifact,
							await artifact('preparation.json', {
								sourceArchiveSha256: expectedArchive,
								closureCanonicalDigest,
								dependencyReceiptSha256,
								installTreeSha256: baselineInstall,
								node: '16.20.2',
								yarn: '1.22.22',
								next: '12.0.10',
								typescript: '4.5.5',
								buildCommand: 'next build',
								configSynthesis: false,
								excludedAssets,
							}),
							await artifact('transform.json', {
								...transform,
								file: 'components/App.tsx',
								preservedOtherSourceAndConfig: true,
								analyticsEffectPreserved: true,
							}),
							await artifact('baseline-build.json', {
								...baselineBuild,
								builds: 2,
								productionPath: 'next build',
								webpackSvgr: true,
								nextTypeCheck: {
									project: 'tsconfig.json',
									testSpecDiagnostics: 'suppressed-by-next-12-production-checker',
								},
								standaloneTypeScriptCheck: 'not-run',
							}),
							await artifact('migrated-build.json', {
								...migratedBuild,
								initialRawDigest: migratedInitial.rawDigest,
								restoredRawDigest: migratedRestored.rawDigest,
								productionPath: 'next build',
								webpackSvgr: true,
								nextTypeCheck: {
									project: 'tsconfig.json',
									testSpecDiagnostics: 'suppressed-by-next-12-production-checker',
								},
								standaloneTypeScriptCheck: 'not-run',
							}),
							await artifact('journey.json', {
								baseline: baselineJourneys,
								migrated: migratedJourneys,
								normalizedEquivalent: true,
								restored: restoredJourney,
							}),
							await artifact('locality.json', {
								mode: 'offline',
								scope: 'spawned Next production processes and Playwright browser requests',
								successfulNonLoopback: 0,
								blocked: allBlocked,
								blockedHosts: [
									'analytics.bale.media',
									'card.codyogden.com',
									'cdn.carbonads.com',
								],
								excludedAssets,
								serviceWorkers: 'blocked',
								osWideIsolation: false,
							}),
							await artifact('mutation-restoration.json', {
								mutation: 'memoized search result returns the unfiltered list',
								result: 'intended-google-plus-row-count-failure',
								reason: {
									code: mutationFailure.code,
									expected: mutationFailure.expected,
									actual: mutationFailure.actual,
								},
								restoredAppSha256: sha256(transformedApp),
								restoredNormalizedBuildSha256: migratedRestored.normalizedDigest,
								restoration: 'byte-exact-green',
							}),
							await artifact('controls.json', {
								staticScriptSurface: { lanes: 2, externalScriptsIntroduced: 0 },
								runtimeScriptObservation: {
									lanes: 2,
									runs: 4,
									externalScripts,
									successfulNonLoopback: 0,
								},
								journeyLocalityAgreement: true,
							}),
						];
						const receiptMd = path.join(stage, 'artifacts/receipt.md');
						await writeFile(
							receiptMd,
							'# Killed by Google Next 12 derived-state-to-useMemo receipt\n\nOne immutable Pages Router/webpack/SVGR production vertical under historical Node 16.20.2. This is not generic Next.js support, a Next upgrade, pilot evidence, production readiness, certification, authenticity, signer identity, SLSA, or OS-wide isolation.\n',
						);
						supports.push({
							path: 'evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/receipt.md',
							sha256: sha256(await readFile(receiptMd)),
						});
						if (supports.length !== 13)
							throw new Error('T263 support artifact count differs');
						const receiptBody = {
							schemaVersion: 'versionless.receipt.v1',
							runId: 'T236-next-killedbygoogle-derived-state-to-memo',
							fixture: 'next-killedbygoogle-derived-state-to-memo',
							result: 'pass',
							source: {
								repository: 'https://github.com/codyogden/killedbygoogle',
								revision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
								tree: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763',
								archiveSha256: expectedArchive,
								license: 'MIT',
								licenseSha256:
									'10547fb81e311e470cdcda5a273bac2a76f50ded6b33ce4362bcb05e1176d5e0',
							},
							migration: {
								file: 'components/App.tsx',
								transform: 'next12-derived-state-to-useMemo',
								edits: transform.edits.length,
								changedFiles: ['components/App.tsx'],
								sourceSha256: transform.sourceSha256,
								targetSha256: transform.targetSha256,
							},
							verification: {
								result: 'pass',
								builds: 'pass',
								journeys: 'pass',
								mutation: 'pass',
								locality: {
									mode: 'offline',
									scope: 'spawned Next production processes and Playwright browser requests',
									osWideIsolation: false,
									successfulNonLoopback: 0,
									browserBlockedRequests: allBlocked.length,
								},
								deterministicCore: {
									first: deterministicFirst,
									second: deterministicSecond,
									equal: true,
								},
								productionOutputConformance: 'pass',
								nftManifestCount: 5,
								productionTraceExcluded: true,
								traceNormalized: false,
								traceDeleted: false,
								browserParity: true,
								baselineBuilds: 2,
								migratedBuilds: 2,
								baselineJourneys: 2,
								migratedJourneys: 2,
								normalizedEquivalent: true,
								mutationRestoration: 'pass',
								successfulNonLoopback: 0,
							},
							tooling: {
								node: '16.20.2',
								yarn: '1.22.22',
								next: '12.0.10',
								react: '17.0.2',
								typescript: '4.5.5',
								playwright: '1.58.2-host-harness',
							},
							consent: [
								{
									id: 'T236-next-killedbygoogle-yarn-v1-closure',
									purpose:
										'Acquire and audit the immutable 710-artifact Yarn v1 dependency closure.',
									mode: 'consented',
								},
							],
							artifacts: supports,
							limitations: [
								'One immutable Next 12 Pages Router/webpack/SVGR production experiment; no generic React or Next.js support, Next-version upgrade, maintained Node 16 support, pilot, or production readiness.',
								'All 22 provenance-classified unknown or excluded local assets were blocked; visual parity for those assets is not claimed.',
								'No Vite replacement, compliance, certification, authenticity, signer identity, SLSA level, or OS-wide isolation claim.',
								'The retained v11 trace diagnostic remains a typed mismatch; trace is excluded only from production-input equivalence because exact Next 12 source and actual membership prove it is not a runtime input. Diagnostic reproducibility is not claimed.',
							],
						};
						const receipt = {
							...receiptBody,
							integrity: {
								algorithm: 'sha256',
								canonicalDigest: '',
								authenticity: 'not-established',
							},
						};
						receipt.integrity.canonicalDigest = receiptDigest(
							receipt as unknown as MigrationReceipt,
						);
						await writeFile(
							path.join(stage, 'build-variance-diagnostic.json'),
							retainedDiagnostic,
						);
						await writeFile(path.join(stage, 'receipt.json'), canonical(receipt));
						await writeFile(
							path.join(stage, 'receipt.md'),
							`# Killed by Google Next 12 derived-state-to-useMemo receipt\n\nCanonical receipt digest: \`${receipt.integrity.canonicalDigest}\`.\n\nThis receipt covers one immutable Pages Router/webpack/SVGR production vertical under historical Node 16.20.2. Its limitations remain authoritative.\n`,
						);
						return receipt;
					},
				),
			removeWork: async () => await rm(work, { recursive: true, force: true }),
			assertWorkAbsent: async () => {
				if (await exists(work)) throw new Error('T320 workflow work cleanup failed');
			},
			promote: async () => {
				const previousOutput = path.join(
					root,
					'.versionless/stage/next-killedbygoogle/derived-state-to-memo-previous',
				);
				await rename(output, previousOutput);
				try {
					await rename(stage, output);
					await rm(previousOutput, { recursive: true, force: true });
				} catch (error) {
					if (await exists(previousOutput)) await rename(previousOutput, output);
					throw error;
				}
			},
		});
	} catch (error) {
		await rm(stage, { recursive: true, force: true });
		await rm(work, { recursive: true, force: true });
		throw error;
	} finally {
		await browser?.close();
	}
}

async function extractOperationBisectLane(name: 'baseline' | 'migrated'): Promise<string> {
	const extractRoot = path.join(operationBisectWork, `${name}-extract`);
	const lane = path.join(operationBisectWork, `${name}-lane`);
	await mkdir(extractRoot, { recursive: true });
	await execute('/usr/bin/tar', ['-xzf', archive, '-C', extractRoot]);
	const entries = await readdir(extractRoot);
	if (entries.length !== 1) throw new Error('T292 source archive root differs');
	await rename(path.join(extractRoot, entries[0]!), lane);
	await rm(extractRoot, { recursive: true, force: true });
	return lane;
}

function operationFingerprint(
	base: BaselineIntervalFingerprint,
	change: Partial<BaselineIntervalFingerprint> = {},
): BaselineIntervalFingerprint {
	return Object.freeze({ ...base, ...change });
}

function operationObservation(
	index: number,
	before: BaselineIntervalFingerprint,
	after: BaselineIntervalFingerprint,
): BaselineIntervalObservation {
	const specification = operationBisectSpecs[index]!;
	return Object.freeze({
		operation: specification.operation,
		reads: Object.freeze([...specification.reads]),
		writes: Object.freeze([...specification.writes]),
		before,
		after,
	});
}

function externalTargetFingerprint(projection: CanonicalNftProjection): string {
	return sha256(
		canonicalize(
			projection.semantic.members.filter(
				(member) => member.selectedStorageRegion === 'bound-lane',
			),
		),
	);
}

export async function captureNextServerNftOperationBisect() {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1'
	)
		throw new Error('T292 operation bisect requires exact offline CI controls');
	if (
		(await exists(operationBisectOutput)) ||
		(await exists(operationBisectWork)) ||
		(await exists(operationBisectStage))
	)
		throw new Error('T292 operation bisect artifact or dedicated root already exists');
	await assertDiagnosticImmutableInputs();
	try {
		await mkdir(operationBisectWork, { recursive: true });
		const baselineLane = await extractOperationBisectLane('baseline');
		const migratedLane = await extractOperationBisectLane('migrated');
		const baselineSource = await sourceTree(baselineLane);
		const migratedSource = await sourceTree(migratedLane);
		if (canonicalize(baselineSource) !== canonicalize(migratedSource))
			throw new Error('T292 dual-lane source trees differ');
		const baselineInstall = await installLane(baselineLane);
		const migratedInstall = await installLane(migratedLane);
		if (
			baselineInstall !== expectedInstallTree ||
			migratedInstall !== expectedInstallTree ||
			baselineInstall !== migratedInstall
		)
			throw new Error('T292 dual-lane install trees differ');

		const firstBuild = await buildSnapshot(baselineLane);
		const firstLiveSnapshot = await bindProductionSnapshot(
			'baseline-first',
			firstBuild,
			baselineLane,
			path.join(baselineLane, '.next'),
		);
		const firstLive = productionBindingToCanonicalNftProjection(
			productionNftBinding(firstLiveSnapshot, 'next-server.js.nft.json'),
		);
		const copyRoot = path.join(operationBisectWork, 'production-snapshots/baseline-first');
		if (!(await productionCopyPathsAreDisjoint(baselineLane, copyRoot)))
			throw new Error('T292 production copy overlaps or aliases canonical lane');
		await mkdir(path.dirname(copyRoot), { recursive: true });
		await cp(path.join(baselineLane, '.next'), copyRoot, { recursive: true });
		const copiedSnapshot = await bindProductionSnapshot(
			'baseline-first',
			firstBuild,
			baselineLane,
			copyRoot,
		);
		assertProductionSnapshotFidelity(firstLiveSnapshot, copiedSnapshot);
		const copied = productionBindingToCanonicalNftProjection(
			productionNftBinding(copiedSnapshot, 'next-server.js.nft.json'),
		);

		const sourceRehash = sha256(canonicalize(await sourceTree(baselineLane)));
		const installRehash = await installTreeDigest(path.join(baselineLane, 'node_modules'));
		const externalRehash = externalTargetFingerprint(firstLive);
		const secondBuild = await buildSnapshot(baselineLane);
		const secondLiveSnapshot = await bindProductionSnapshot(
			'baseline-second',
			secondBuild,
			baselineLane,
			path.join(baselineLane, '.next'),
		);
		const secondLive = productionBindingToCanonicalNftProjection(
			productionNftBinding(secondLiveSnapshot, 'next-server.js.nft.json'),
		);
		const sourceAfter = sha256(canonicalize(await sourceTree(baselineLane)));
		const installAfter = await installTreeDigest(path.join(baselineLane, 'node_modules'));
		const externalAfter = externalTargetFingerprint(secondLive);

		let current: BaselineIntervalFingerprint = operationFingerprint({
			source: sha256(canonicalize(baselineSource)),
			install: baselineInstall,
			externalTargets: externalTargetFingerprint(firstLive),
			canonicalBuildOutput: firstBuild.rawDigest,
			firstLiveProjection: null,
			copiedProjection: null,
			secondLiveProjection: null,
			copyDestination: null,
		});
		const ledger: BaselineIntervalObservation[] = [];
		const append = (index: number, change: Partial<BaselineIntervalFingerprint> = {}) => {
			const after = operationFingerprint(current, change);
			ledger.push(operationObservation(index, current, after));
			current = after;
		};
		append(0);
		append(1, { firstLiveProjection: sha256(canonicalize(firstLive)) });
		append(2, { copyDestination: firstBuild.rawDigest });
		append(3, { copiedProjection: sha256(canonicalize(copied)) });
		append(4);
		append(5, {
			source: sourceRehash,
			install: installRehash,
			externalTargets: externalRehash,
		});
		append(6, { canonicalBuildOutput: secondBuild.rawDigest });
		append(7);
		append(8, {
			source: sourceAfter,
			install: installAfter,
			externalTargets: externalAfter,
			secondLiveProjection: sha256(canonicalize(secondLive)),
		});
		append(9);

		const artifact = createNextServerNftOperationBisectArtifact(
			ledger,
			firstLive,
			copied,
			secondLive,
		);
		validateNextServerNftOperationBisectArtifact(artifact);
		await mkdir(operationBisectStage, { recursive: true });
		const staged = path.join(operationBisectStage, 'artifact.json');
		await writeFile(staged, canonical(artifact));
		validateNextServerNftOperationBisectArtifact(JSON.parse(await readFile(staged, 'utf8')));
		await rename(staged, operationBisectOutput);
		return validateNextServerNftOperationBisectArtifact(
			JSON.parse(await readFile(operationBisectOutput, 'utf8')),
		);
	} finally {
		await rm(operationBisectStage, { recursive: true, force: true });
		await rm(operationBisectWork, { recursive: true, force: true });
	}
}

export async function validatePublishedNextServerNftOperationBisect() {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1'
	)
		throw new Error('T292 operation bisect validation requires exact offline CI controls');
	await assertDiagnosticImmutableInputs();
	return validateNextServerNftOperationBisectArtifact(
		JSON.parse(await readFile(operationBisectOutput, 'utf8')),
	);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (
		canonicalize(args) === canonicalize(['--capture-next-server-isolated-cachekey-provenance'])
	) {
		const result = await captureNextServerIsolatedCacheKeyProvenance();
		process.stdout.write(
			canonical({
				result: 'isolated-provenance-only',
				integrity: (result.integrity as Record<string, unknown>).canonicalDigest,
			}),
		);
		return;
	}
	if (
		canonicalize(args) === canonicalize(['--validate-next-server-isolated-cachekey-provenance'])
	) {
		const result = await validatePublishedNextServerIsolatedCacheKeyProvenance();
		process.stdout.write(
			canonical({
				result: 'valid',
				integrity: (result.integrity as Record<string, unknown>).canonicalDigest,
			}),
		);
		return;
	}
	if (canonicalize(args) === canonicalize(['--capture-next-server-cachekey-provenance'])) {
		const result = await captureNextServerCacheKeyProvenance();
		process.stdout.write(
			canonical({
				classification: result.classification,
				integrity: result.integrity.canonicalDigest,
			}),
		);
		return;
	}
	if (canonicalize(args) === canonicalize(['--validate-next-server-cachekey-provenance'])) {
		const result = await validatePublishedNextServerCacheKeyProvenance();
		process.stdout.write(
			canonical({
				result: 'valid',
				classification: result.classification,
				integrity: result.integrity.canonicalDigest,
			}),
		);
		return;
	}
	if (canonicalize(args) === canonicalize(['--capture-next-server-nft-operation-bisect'])) {
		const result = await captureNextServerNftOperationBisect();
		process.stdout.write(
			canonical({
				result: result.classification.result,
				integrity: result.digest,
				mismatchClasses: result.mismatchClasses,
			}),
		);
		return;
	}
	if (canonicalize(args) === canonicalize(['--validate-next-server-nft-operation-bisect'])) {
		const result = await validatePublishedNextServerNftOperationBisect();
		process.stdout.write(
			canonical({
				result: 'valid',
				classification: result.classification.result,
				integrity: result.digest,
				mismatchClasses: result.mismatchClasses,
			}),
		);
		return;
	}
	if (canonicalize(args) === canonicalize(['--capture-next-server-nft-production-comparison'])) {
		const comparison = await captureNextServerNftProductionComparison();
		process.stdout.write(
			canonical({
				result: 'comparison-only',
				integrity: comparison.digest,
				mismatchClasses: comparison.mismatchClasses,
			}),
		);
		return;
	}
	if (canonicalize(args) === canonicalize(['--validate-next-server-nft-production-comparison'])) {
		const comparison = await validatePublishedNextServerNftProductionComparison();
		process.stdout.write(
			canonical({
				result: 'valid',
				integrity: comparison.digest,
				mismatchClasses: comparison.mismatchClasses,
			}),
		);
		return;
	}
	if (canonicalize(args) === canonicalize(['--diagnose-next-server-nft-mismatch'])) {
		const diagnostic = await diagnoseNextServerNftMismatch();
		process.stdout.write(
			canonical({ result: 'diagnostic-only', integrity: diagnostic.digest }),
		);
		return;
	}
	if (canonicalize(args) === canonicalize(['--validate-next-server-nft-mismatch'])) {
		const diagnostic = await validatePublishedNextServerNftMismatch();
		process.stdout.write(canonical({ result: 'valid', integrity: diagnostic.digest }));
		return;
	}
	if (args.includes('--diagnose-build-variance')) {
		const diagnostic = await diagnoseNextKilledByGoogleBuildVariance();
		process.stdout.write(
			canonical({
				result: diagnostic.result,
				rawDifferingPaths: diagnostic.rawDifferingPaths,
			}),
		);
		return;
	}
	if (!args.includes('--run-derived-state-to-memo'))
		throw new Error('T236/T273 requires an exact supported runner flag');
	const receipt = await runNextKilledByGoogle();
	process.stdout.write(canonical({ result: receipt.result, integrity: receipt.integrity }));
}

if (process.argv[1]?.endsWith('next-killedbygoogle-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
