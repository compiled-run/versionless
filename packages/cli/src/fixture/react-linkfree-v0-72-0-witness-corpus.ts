import { spawn } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'pathe';
import { joinURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

/**
 * The SYNTHETIC profile corpus this application's browser proof runs against,
 * and the staging that puts it in front of both lanes.
 *
 * The pinned archive ships 561 profile documents, each one a real contributor's
 * personal data. The ingest fixed the handling rule — counted and digested,
 * never quoted — and the standing ruling for the witness phase goes further:
 * none of it renders into evidence at all. What the MIT grant settles is the
 * code; whether a contributor intended their profile to be redistributed inside
 * a migration-evidence corpus is recorded upstream as unresolved, and an
 * unresolved question is not a licence.
 *
 * The application's own `generate.js` is corpus-agnostic — it indexes whatever
 * profile documents it finds — so the substitution needs no application change
 * and no fork of the pipeline. Both lanes are served the SAME synthetic corpus,
 * built by the application's own codegen, so the parity comparison stays
 * apples-to-apples and the journeys prove the application's BEHAVIOUR rather
 * than its shipped dataset.
 */

const compareUtf16CodeUnits = (left: string, right: string): number =>
	left === right ? 0 : left < right ? -1 : 1;

/** Where the committed synthetic corpus lives, relative to the repository root. */
export const LINKFREE_SYNTHETIC_CORPUS_DIRECTORY =
	'fixtures/react-linkfree-v0-72-0/witness-corpus' as const;

/**
 * The application's own codegen prebuild, bound by the sha256 of its bytes at
 * the pinned revision. The staging runs this script unmodified; pinning it is
 * what stops the synthetic corpus from being indexed by anything other than the
 * application's own pipeline.
 */
export const LINKFREE_GENERATE_JS_SHA256 =
	'c9aa61ed427c00ab826aa4e980236a868fdf3ef01bba5741c854602b932424bb' as const;

/**
 * The two hosts the application reaches for at runtime, both answered in
 * context and neither contacted.
 *
 * `avatar` is where every profile document points its avatar. `fallback` is
 * where `src/utils.js` sends the `<img>` when the first load fails — the
 * cascade the ingest warned about, and the reason blocking one host alone would
 * look quiet while redirecting egress to a second live host.
 */
export const LINKFREE_AVATAR_HOST = 'https://avatars.githubusercontent.com' as const;
export const LINKFREE_AVATAR_FALLBACK_HOST = 'https://avatars.dicebear.com' as const;

/** The avatar endpoint a synthetic profile declares, pinned query-free. */
export const linkfreeSyntheticAvatarUrl = (username: string): string =>
	joinURL(LINKFREE_AVATAR_HOST, 'synthetic', `${username}.png`);

/** The endpoint the application's own onerror handler cascades to. */
export const linkfreeAvatarFallbackUrl = (name: string): string =>
	joinURL(LINKFREE_AVATAR_FALLBACK_HOST, 'api/initials', `${name}.svg`);

/** Outbound link targets are invented and unresolvable; nothing ever fetches one. */
const linkfreeSyntheticLinkUrl = (username: string, icon: string): string =>
	joinURL('https://example.invalid', 'synthetic', username, icon);

export type LinkfreeSyntheticProfile = {
	username: string;
	name: string;
	type: 'personal' | 'community';
	bio: string;
	avatar: string;
	links: Array<{ name: string; url: string; icon: string }>;
};

/**
 * The invented display names. They are single tokens on purpose: the
 * application interpolates the display name straight into its avatar-fallback
 * URL without encoding it, so a name with a space would put a percent escape in
 * the seam inventory for no gain.
 */
const SYNTHETIC_NAMES = [
	'Aurora',
	'Basalt',
	'Cinder',
	'Delta',
	'Ember',
	'Fjord',
	'Glacier',
	'Harbor',
	'Indigo',
	'Juniper',
	'Kestrel',
	'Nimbus',
] as const;

/**
 * The profile the journey opens. It is the last name in sorted order, carries
 * the long link list the scroll surface needs, and is the one profile typed
 * `community`, so the journey can assert the badge the application renders for
 * that type.
 */
export const LINKFREE_JOURNEY_PROFILE_NAME = 'Nimbus' as const;

const LINK_ICONS = [
	'github',
	'twitter',
	'linkedin',
	'youtube',
	'twitch',
	'spotify',
	'discord',
	'telegram',
	'medium',
	'gitlab',
	'hashnode',
	'polywork',
	'instagram',
	'globe',
] as const;

/** The link list every other profile carries, so the corpus is not uniform. */
const SHORT_LINK_ICONS = ['github', 'globe'] as const;

const syntheticUsername = (name: string): string => `synthetic-${name.toLowerCase()}`;

/** The visible label of one declared link, invented and obviously so. */
export const linkfreeSyntheticLinkName = (icon: string): string => `Synthetic ${icon} link`;

function syntheticProfile(name: string, index: number): LinkfreeSyntheticProfile {
	const username = syntheticUsername(name);
	const journeyProfile = name === LINKFREE_JOURNEY_PROFILE_NAME;
	const icons = journeyProfile ? LINK_ICONS : SHORT_LINK_ICONS;
	return {
		username,
		name,
		type: journeyProfile ? 'community' : 'personal',
		bio: `Synthetic profile ${String(index + 1)} of ${String(
			SYNTHETIC_NAMES.length,
		)}, invented for Versionless browser evidence. Not a person, not an account, not a real profile.`,
		avatar: linkfreeSyntheticAvatarUrl(username),
		links: icons.map((icon) => ({
			name: linkfreeSyntheticLinkName(icon),
			url: linkfreeSyntheticLinkUrl(username, icon),
			icon,
		})),
	};
}

/**
 * The whole synthetic corpus, in the order the names are declared. Every value
 * is derived from the name, so the corpus is reproducible from this module
 * alone and the committed documents can be checked against it byte for byte.
 */
export const LINKFREE_SYNTHETIC_PROFILES: readonly LinkfreeSyntheticProfile[] = Object.freeze(
	SYNTHETIC_NAMES.map((name, index) => syntheticProfile(name, index)),
);

/** Sorted by display name, which is the order the search route renders them in. */
export const LINKFREE_SYNTHETIC_NAMES_SORTED: readonly string[] = Object.freeze(
	[...LINKFREE_SYNTHETIC_PROFILES]
		.map((profile) => profile.name)
		.sort((left, right) => compareUtf16CodeUnits(left, right)),
);

export const LINKFREE_JOURNEY_PROFILE: LinkfreeSyntheticProfile = LINKFREE_SYNTHETIC_PROFILES.find(
	(profile) => profile.name === LINKFREE_JOURNEY_PROFILE_NAME,
)!;

/** Every profile document, as the exact bytes the corpus commits. */
export function linkfreeSyntheticCorpusDocuments(): Array<{ path: string; bytes: string }> {
	return LINKFREE_SYNTHETIC_PROFILES.map((profile) => {
		const { username: _username, ...document } = profile;
		return {
			path: `${profile.username}.json`,
			bytes: `${JSON.stringify(document, null, 2)}\n`,
		};
	}).sort((left, right) => compareUtf16CodeUnits(left.path, right.path));
}

export type LinkfreeCorpusInventory = {
	directory: string;
	files: Array<{ path: string; sha256: string }>;
	aggregateSha256: string;
};

function corpusInventory(
	directory: string,
	files: Array<{ path: string; sha256: string }>,
): LinkfreeCorpusInventory {
	const sorted = [...files].sort((left, right) => compareUtf16CodeUnits(left.path, right.path));
	return { directory, files: sorted, aggregateSha256: sha256(canonicalize(sorted)) };
}

/** Writes the corpus into a directory, replacing whatever was there. */
export async function writeLinkfreeSyntheticCorpus(
	directory: string,
): Promise<LinkfreeCorpusInventory> {
	await rm(directory, { recursive: true, force: true });
	await mkdir(directory, { recursive: true });
	const files: Array<{ path: string; sha256: string }> = [];
	for (const document of linkfreeSyntheticCorpusDocuments()) {
		await writeFile(join(directory, document.path), document.bytes);
		files.push({ path: document.path, sha256: sha256(document.bytes) });
	}
	return corpusInventory('data/', files);
}

/**
 * Reads the committed corpus and requires it to be exactly what this module
 * generates. A drifted document — one edited by hand, one added, one removed —
 * fails here rather than reaching a browser.
 */
export async function verifyLinkfreeSyntheticCorpus(
	root: string,
): Promise<LinkfreeCorpusInventory> {
	const directory = join(root, LINKFREE_SYNTHETIC_CORPUS_DIRECTORY);
	const expected = linkfreeSyntheticCorpusDocuments();
	const present = (await readdir(directory)).sort(compareUtf16CodeUnits);
	if (canonicalize(present) !== canonicalize(expected.map((document) => document.path)))
		throw new Error('LinkFree synthetic corpus file set differs from its generator');
	const files: Array<{ path: string; sha256: string }> = [];
	for (const document of expected) {
		const bytes = await readFile(join(directory, document.path), 'utf8');
		if (bytes !== document.bytes)
			throw new Error(`LinkFree synthetic corpus document differs: ${document.path}`);
		files.push({ path: document.path, sha256: sha256(bytes) });
	}
	return corpusInventory('data/', files);
}

async function filesBelow(directory: string): Promise<string[]> {
	const found: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = join(directory, entry.name);
		if (entry.isDirectory()) found.push(...(await filesBelow(item)));
		else if (entry.isFile()) found.push(item);
	}
	return found;
}

async function inventory(directory: string): Promise<Array<{ path: string; sha256: string }>> {
	const files: Array<{ path: string; sha256: string }> = [];
	for (const file of await filesBelow(directory))
		files.push({
			path: relative(directory, file).split(sep).join('/'),
			sha256: sha256(await readFile(file)),
		});
	return files.sort((left, right) => compareUtf16CodeUnits(left.path, right.path));
}

async function runNode(script: string, cwd: string): Promise<void> {
	await new Promise<void>((resolveRun, rejectRun) => {
		const child = spawn(process.execPath, [script], {
			cwd,
			stdio: ['ignore', 'ignore', 'pipe'],
			env: {
				...process.env,
				npm_config_offline: 'true',
				VERSIONLESS_NETWORK_MODE: 'offline',
			},
		});
		const errors: string[] = [];
		child.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString('utf8')));
		child.on('error', rejectRun);
		child.on('close', (code) =>
			code === 0
				? resolveRun()
				: rejectRun(new Error(`node ${script} exited ${String(code)}: ${errors.join('')}`)),
		);
	});
}

/**
 * The corpus directory inside an emitted lane, and the index the codegen writes
 * beside it. These are the only two paths the staging replaces.
 */
const CORPUS_DIRECTORY = 'data' as const;
const GENERATED_INDEX = 'list.json' as const;

export type LinkfreeStagedCorpus = {
	policy: 'synthetic-profile-corpus-through-the-applications-own-codegen';
	corpus: LinkfreeCorpusInventory;
	generatedIndex: { path: string; sha256: string; profiles: number };
	codegen: {
		script: 'generate.js';
		sha256: string;
		modified: false;
		declaredBy: 'the first half of the application own build script';
	};
	replacedPaths: string[];
	/**
	 * Every emitted path that is not the corpus or its index, proved byte
	 * identical to the committed build output. The bundlers ran against the real
	 * archive and their bytes are untouched here; only the served dataset moved.
	 */
	bundlerAuthoredPaths: number;
	bundlerAuthoredBytesUnchanged: true;
};

/**
 * Stages one built lane for the browser proof: copy the emitted output, replace
 * its profile corpus with the synthetic one, and regenerate its index by
 * running the application's own `generate.js` over that corpus.
 *
 * The codegen runs in a scratch application root shaped the way the script
 * expects (`generate.js` beside `public/data`), so the committed work tree and
 * the real corpus inside it are never written to.
 */
export async function stageLinkfreeWitnessLane(options: {
	repositoryRoot: string;
	buildRoot: string;
	laneRoot: string;
	codegenScript: string;
	scratchRoot: string;
}): Promise<LinkfreeStagedCorpus> {
	const corpus = await verifyLinkfreeSyntheticCorpus(options.repositoryRoot);
	const corpusRoot = join(options.repositoryRoot, LINKFREE_SYNTHETIC_CORPUS_DIRECTORY);
	const codegenBytes = await readFile(options.codegenScript);
	const codegenSha256 = sha256(codegenBytes);
	if (codegenSha256 !== LINKFREE_GENERATE_JS_SHA256)
		throw new Error('LinkFree codegen prebuild bytes differ from the pinned revision');
	const scratch = resolve(options.scratchRoot);
	await rm(scratch, { recursive: true, force: true });
	await mkdir(join(scratch, 'public'), { recursive: true });
	await writeFile(join(scratch, 'generate.js'), codegenBytes);
	// The application's own root declares no module type, which is how its
	// `generate.js` is a CommonJS script. This scratch root sits under a
	// workspace whose package.json declares ESM, so the same declaration is
	// restated here rather than the script being adapted to survive it.
	await writeFile(
		join(scratch, 'package.json'),
		`${JSON.stringify({ name: 'react-linkfree-witness-codegen', private: true, type: 'commonjs' }, null, '\t')}\n`,
	);
	await cp(corpusRoot, join(scratch, 'public', CORPUS_DIRECTORY), { recursive: true });
	await runNode('generate.js', scratch);
	const generatedBytes = await readFile(join(scratch, 'public', GENERATED_INDEX));
	const generated = JSON.parse(generatedBytes.toString('utf8')) as unknown[];
	if (generated.length !== LINKFREE_SYNTHETIC_PROFILES.length)
		throw new Error('LinkFree codegen indexed a different number of synthetic profiles');

	const laneRoot = resolve(options.laneRoot);
	await rm(laneRoot, { recursive: true, force: true });
	await mkdir(resolve(laneRoot, '..'), { recursive: true });
	await cp(options.buildRoot, laneRoot, { recursive: true });
	const emitted = await inventory(options.buildRoot);
	await rm(join(laneRoot, CORPUS_DIRECTORY), { recursive: true, force: true });
	await cp(join(scratch, 'public', CORPUS_DIRECTORY), join(laneRoot, CORPUS_DIRECTORY), {
		recursive: true,
	});
	await writeFile(join(laneRoot, GENERATED_INDEX), generatedBytes);

	const staged = await inventory(laneRoot);
	const replaced = (path: string): boolean =>
		path === GENERATED_INDEX || path.startsWith(`${CORPUS_DIRECTORY}/`);
	const bundlerAuthored = emitted.filter((file) => !replaced(file.path));
	if (canonicalize(bundlerAuthored) !== canonicalize(staged.filter((file) => !replaced(file.path))))
		throw new Error('LinkFree staging changed a bundler-authored byte');
	return {
		policy: 'synthetic-profile-corpus-through-the-applications-own-codegen',
		corpus,
		generatedIndex: {
			path: `/${GENERATED_INDEX}`,
			sha256: sha256(generatedBytes),
			profiles: generated.length,
		},
		codegen: {
			script: 'generate.js',
			sha256: codegenSha256,
			modified: false,
			declaredBy: 'the first half of the application own build script',
		},
		replacedPaths: [`${CORPUS_DIRECTORY}/`, GENERATED_INDEX],
		bundlerAuthoredPaths: bundlerAuthored.length,
		bundlerAuthoredBytesUnchanged: true,
	};
}
