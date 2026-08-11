import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { charIn, charNotIn, createRegExp, exactly, global, oneOrMore } from 'magic-regexp';
import * as path from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	MEMOS_PINNED_REVISION,
	MEMOS_PROJECTED_ENDPOINTS,
	MEMOS_PROJECTION_BEHAVIOR_DIGEST,
	MEMOS_SEED,
	MEMOS_SEED_AMENDMENT,
	MEMOS_SIGNIN_VALIDATOR,
	MEMOS_UNPROJECTED_ENDPOINTS,
	memosSeedDigest,
	memosSigninValidates,
} from '../witness/memos-projection.ts';

/**
 * The Memos API surface enumeration: what the pinned `web/src` actually reaches,
 * read out of the pinned tree rather than remembered.
 *
 * The declaration below is reviewable prose — request shape, the response shape
 * the UI consumes, session semantics, and whether the frozen projection answers
 * the route. What it is NOT allowed to be is a guess: `verifyMemosApiSurface`
 * re-extracts every axios call from the pinned `web/src/helpers/api.ts` and
 * refuses to agree unless the extracted method-and-path set matches the
 * declared one exactly, and unless every declared consumer file in the pinned
 * tree really names the symbol claimed for it.
 *
 * `web/src/helpers/api.ts` is the whole client transport: nothing else in the
 * pinned tree constructs a request. Every other module reaches the network
 * through a `services/*` wrapper around this file, which is why the consumers
 * recorded here are service functions rather than raw call sites.
 */

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../../../..');

/** The reconciled pinned tree this enumeration reads. */
export const MEMOS_SOURCE_ROOT = path.join(
	REPOSITORY_ROOT,
	'.versionless/cache/react-memos-v0-1-3-source/verify/extracted',
	`memos-${MEMOS_PINNED_REVISION}/web`,
);

export const MEMOS_API_HELPER = 'src/helpers/api.ts' as const;

export const MEMOS_API_SURFACE_EVIDENCE = path.join(
	REPOSITORY_ROOT,
	'evidence/runs/react-memos-v0-1-3/t006-api-surface.json',
);

export type MemosApiEndpoint = {
	/** The exported helper in `web/src/helpers/api.ts`. */
	helper: string;
	method: string;
	/** The path as the helper writes it, with interpolated identifiers as `:id`. */
	path: string;
	/** The query string the helper hard-codes, if any. */
	query: string | null;
	request: string;
	/** The part of the response the pinned UI actually reads. */
	response: string;
	session: 'none' | 'establishes' | 'clears' | 'required';
	consumers: readonly { file: string; symbol: string }[];
	/** The projection's ledger id for this route, or null when it is withheld. */
	endpoint: string | null;
	note: string;
};

const ENVELOPE = 'ResponseObject<T> — the UI reads `response.data.data`';

/**
 * The declared surface. Twenty-one exported helpers over twenty distinct
 * method-and-path pairs: `pinMemo` and `unpinMemo` share one organizer route
 * and differ only in the body they send.
 */
export const MEMOS_API_SURFACE: readonly MemosApiEndpoint[] = Object.freeze([
	{
		helper: 'getSystemStatus',
		method: 'GET',
		path: '/api/status',
		query: null,
		request: 'none',
		response: `${ENVELOPE} as SystemStatus: \`owner\` decides the sign-in button, \`profile.mode\` prefills the form when it is "dev"`,
		session: 'none',
		consumers: [
			{ file: 'src/pages/Signin.tsx', symbol: 'api.getSystemStatus' },
			{ file: 'src/components/AboutSiteDialog.tsx', symbol: 'api.getSystemStatus' },
		],
		endpoint: 'status',
		note: 'The only route the pinned client calls before a session exists. An absent owner turns the sign-in button into "Sign up as Owner".',
	},
	{
		helper: 'login',
		method: 'POST',
		path: '/api/auth/login',
		query: null,
		request: '{ email, password }',
		response: `${ENVELOPE} as User; Signin discards the body and re-reads the session through userService.doSignIn`,
		session: 'establishes',
		consumers: [{ file: 'src/pages/Signin.tsx', symbol: 'api.login' }],
		endpoint: 'auth.login',
		note: 'A non-2xx makes axios throw, which the page turns into a toast; the projection answers 401 for values it does not hold.',
	},
	{
		helper: 'signup',
		method: 'POST',
		path: '/api/auth/signup',
		query: null,
		request: '{ email, password, role, name } — the page always sends role "OWNER"',
		response: `${ENVELOPE} as User`,
		session: 'establishes',
		consumers: [{ file: 'src/pages/Signin.tsx', symbol: 'api.signup' }],
		endpoint: 'auth.signup',
		note: 'Reachable only while /api/status reports no owner. The projection grants OWNER only when no owner exists and otherwise records a USER.',
	},
	{
		helper: 'signout',
		method: 'POST',
		path: '/api/auth/logout',
		query: null,
		request: 'none',
		response: 'ignored — userService clears the store before it calls',
		session: 'clears',
		consumers: [{ file: 'src/services/userService.ts', symbol: 'api.signout' }],
		endpoint: 'auth.logout',
		note: 'Sign-out is what puts the session gate back in force for the next navigation.',
	},
	{
		helper: 'createUser',
		method: 'POST',
		path: '/api/user',
		query: null,
		request: 'UserCreate { email, password, name, role }',
		response: `${ENVELOPE} as User; MemberSection refetches the list afterwards`,
		session: 'required',
		consumers: [
			{ file: 'src/components/Settings/MemberSection.tsx', symbol: 'api.createUser' },
		],
		endpoint: 'user.create',
		note: 'Owner-only in the settings dialog; the projection answers 403 for a non-owner session.',
	},
	{
		helper: 'getUser',
		method: 'GET',
		path: '/api/user/me',
		query: null,
		request: 'none',
		response: `${ENVELOPE} as User; userService converts createdTs/updatedTs from seconds to milliseconds`,
		session: 'required',
		consumers: [{ file: 'src/services/userService.ts', symbol: 'api.getUser' }],
		endpoint: 'user.me.get',
		note: 'THE session gate. Home.tsx replaces history with /signin whenever this does not yield a user, so every behind-the-gate journey depends on it.',
	},
	{
		helper: 'getUserList',
		method: 'GET',
		path: '/api/user',
		query: null,
		request: 'none',
		response: `${ENVELOPE} as User[] rendered by the member table`,
		session: 'required',
		consumers: [
			{ file: 'src/components/Settings/MemberSection.tsx', symbol: 'api.getUserList' },
		],
		endpoint: 'user.list',
		note: 'Same path as createUser, disambiguated by method alone.',
	},
	{
		helper: 'patchUser',
		method: 'PATCH',
		path: '/api/user/me',
		query: null,
		request: 'UserPatch { name?, password?, resetOpenId? }',
		response: `${ENVELOPE} as User, merged into the store`,
		session: 'required',
		consumers: [{ file: 'src/services/userService.ts', symbol: 'api.patchUser' }],
		endpoint: 'user.me.patch',
		note: 'The account-settings surface: display name, password change and open-id reset all arrive here. Preference toggles never do — they are localStorage only.',
	},
	{
		helper: 'getMemoList',
		method: 'GET',
		path: '/api/memo',
		query: null,
		request: 'none',
		response: `${ENVELOPE} as Memo[]; memoService drops ARCHIVED rows client-side and rescales timestamps`,
		session: 'required',
		consumers: [{ file: 'src/services/memoService.ts', symbol: 'api.getMemoList' }],
		endpoint: 'memo.list',
		note: 'The list the home page renders. Search, tag filter and type filter are computed client-side in helpers/filter.ts over exactly this payload.',
	},
	{
		helper: 'getArchivedMemoList',
		method: 'GET',
		path: '/api/memo',
		query: '?rowStatus=ARCHIVED',
		request: 'none',
		response: `${ENVELOPE} as Memo[] rendered by the recycle-bin dialog`,
		session: 'required',
		consumers: [{ file: 'src/services/memoService.ts', symbol: 'api.getArchivedMemoList' }],
		endpoint: 'memo.list',
		note: 'Same route as getMemoList with a hard-coded query, so the projection has to honour rowStatus rather than always returning everything.',
	},
	{
		helper: 'createMemo',
		method: 'POST',
		path: '/api/memo',
		query: null,
		request: 'MemoCreate { content, createdTs? }',
		response: `${ENVELOPE} as Memo, prepended to the store`,
		session: 'required',
		consumers: [{ file: 'src/services/memoService.ts', symbol: 'api.createMemo' }],
		endpoint: 'memo.create',
		note: 'The editor save path, and also the JSON import in PreferencesSection which supplies its own createdTs.',
	},
	{
		helper: 'patchMemo',
		method: 'PATCH',
		path: '/api/memo/:id',
		query: null,
		request: 'MemoPatch { id, content?, rowStatus? }',
		response: `${ENVELOPE} as Memo`,
		session: 'required',
		consumers: [{ file: 'src/services/memoService.ts', symbol: 'api.patchMemo' }],
		endpoint: 'memo.patch',
		note: 'Carries three journeys at once: edit content, archive (rowStatus ARCHIVED) and restore from the recycle bin (rowStatus NORMAL).',
	},
	{
		helper: 'pinMemo',
		method: 'POST',
		path: '/api/memo/:id/organizer',
		query: null,
		request: '{ pinned: true }',
		response: 'ignored — the store patch is applied optimistically',
		session: 'required',
		consumers: [{ file: 'src/services/memoService.ts', symbol: 'api.pinMemo' }],
		endpoint: 'memo.organizer',
		note: 'Shares one route with unpinMemo; only the body differs.',
	},
	{
		helper: 'unpinMemo',
		method: 'POST',
		path: '/api/memo/:id/organizer',
		query: null,
		request: '{ pinned: false }',
		response: 'ignored — the store patch is applied optimistically',
		session: 'required',
		consumers: [{ file: 'src/services/memoService.ts', symbol: 'api.unpinMemo' }],
		endpoint: 'memo.organizer',
		note: 'The second half of the organizer route.',
	},
	{
		helper: 'deleteMemo',
		method: 'DELETE',
		path: '/api/memo/:id',
		query: null,
		request: 'none',
		response: 'ignored',
		session: 'required',
		consumers: [{ file: 'src/services/memoService.ts', symbol: 'api.deleteMemo' }],
		endpoint: 'memo.delete',
		note: 'Permanent delete from the recycle bin, distinct from the archive patch above.',
	},
	{
		helper: 'getShortcutList',
		method: 'GET',
		path: '/api/shortcut',
		query: null,
		request: 'none',
		response: `${ENVELOPE} as Shortcut[]; the sidebar splits them by rowStatus into pinned and unpinned`,
		session: 'required',
		consumers: [{ file: 'src/services/shortcutService.ts', symbol: 'api.getShortcutList' }],
		endpoint: 'shortcut.list',
		note: 'Fetched on ShortcutList mount, so it is part of the first behind-the-gate paint.',
	},
	{
		helper: 'createShortcut',
		method: 'POST',
		path: '/api/shortcut',
		query: null,
		request: 'ShortcutCreate { title, payload } where payload is a JSON-encoded filter array',
		response: `${ENVELOPE} as Shortcut`,
		session: 'required',
		consumers: [{ file: 'src/services/shortcutService.ts', symbol: 'api.createShortcut' }],
		endpoint: 'shortcut.create',
		note: 'The saved-search journey: the dialog encodes the active filters into payload.',
	},
	{
		helper: 'patchShortcut',
		method: 'PATCH',
		path: '/api/shortcut/:id',
		query: null,
		request: 'ShortcutPatch { id, title?, payload?, rowStatus? }',
		response: `${ENVELOPE} as Shortcut`,
		session: 'required',
		consumers: [{ file: 'src/services/shortcutService.ts', symbol: 'api.patchShortcut' }],
		endpoint: 'shortcut.patch',
		note: 'Rename, re-filter, and pin/unpin — the sidebar pins a shortcut by setting rowStatus ARCHIVED.',
	},
	{
		helper: 'deleteShortcutById',
		method: 'DELETE',
		path: '/api/shortcut/:id',
		query: null,
		request: 'none',
		response: 'ignored',
		session: 'required',
		consumers: [{ file: 'src/services/shortcutService.ts', symbol: 'api.deleteShortcutById' }],
		endpoint: 'shortcut.delete',
		note: 'Removes the shortcut from the sidebar list.',
	},
	{
		helper: 'uploadFile',
		method: 'POST',
		path: '/api/resource',
		query: null,
		request: 'multipart/form-data with one `file` part',
		response: `${ENVELOPE} as Resource; the editor inserts \`![](/h/r/{id}/{filename})\` into the memo body`,
		session: 'required',
		consumers: [{ file: 'src/services/resourceService.ts', symbol: 'api.uploadFile' }],
		endpoint: null,
		note: 'WITHHELD. No journey uploads a file, and the inserted URL points at a `/h/r/:id/:filename` byte stream outside /api that the projection would also have to invent. The projection refuses it as a named withheld endpoint rather than fabricating a resource pipeline.',
	},
	{
		helper: 'getTagList',
		method: 'GET',
		path: '/api/tag',
		query: null,
		request: 'none',
		response: `${ENVELOPE} as string[] rendered by the sidebar tag list`,
		session: 'required',
		consumers: [{ file: 'src/services/memoService.ts', symbol: 'api.getTagList' }],
		endpoint: 'tag.list',
		note: "Server-derived in the real backend. The projection derives it from the seeded memo content under the client's own `#tag ` rule so the tag list and the client-side tag filter agree.",
	},
]);

/**
 * Surfaces the pinned client resolves without the API at all. Recorded because
 * a journey unit reading only the endpoint table would otherwise look for a
 * search or preferences route that does not exist.
 */
export const MEMOS_CLIENT_ONLY_SURFACES = Object.freeze([
	{
		surface: 'search, tag filter and type filter',
		implementation: 'src/helpers/filter.ts over the already-fetched memo list',
		note: 'No request is issued when the user searches or picks a tag; the filter runs against the store.',
	},
	{
		surface: 'editor preferences (split words, hide image urls, markdown parser)',
		implementation: 'src/helpers/storage.ts writing localStorage',
		note: 'Preference toggles never reach the API. Only account settings (name, password, open-id reset) do, through PATCH /api/user/me.',
	},
	{
		surface: 'uploaded image bytes',
		implementation: '`/h/r/:id/:filename`, a same-origin path outside /api',
		note: 'Reachable only after an upload, which the projection withholds.',
	},
] as const);

const AXIOS_CALL = createRegExp(
	exactly('axios.'),
	oneOrMore(charNotIn('<(\n')).groupedAs('method'),
	charNotIn('(\n').times.any(),
	exactly('('),
	charIn('"`'),
	oneOrMore(charNotIn('"`\n')).groupedAs('path'),
	charIn('"`'),
	[global],
);

const TEMPLATE_HOLE = createRegExp(exactly('${'), oneOrMore(charNotIn('}\n')), exactly('}'), [
	global,
]);

const EXPORTED_FUNCTION = createRegExp(
	exactly('export function '),
	oneOrMore(charNotIn('(\n')).groupedAs('helper'),
	exactly('('),
	[global],
);

export type ExtractedCall = { helper: string; method: string; path: string; query: string | null };

/**
 * Every axios call in the pinned helper, read out of its bytes.
 *
 * The helper file is a flat list of exported functions each containing exactly
 * one axios call, so the extraction splits on the export boundary and takes the
 * first call inside each chunk. An interpolated identifier collapses to `:id`
 * and a hard-coded query is separated from the path, which is what makes the
 * extracted shape comparable with the declaration above.
 */
export function extractMemosAxiosCalls(source: string): ExtractedCall[] {
	const calls: ExtractedCall[] = [];
	const boundaries = [...source.matchAll(EXPORTED_FUNCTION)];
	for (const [index, boundary] of boundaries.entries()) {
		const helper = boundary.groups?.helper;
		if (helper === undefined) continue;
		const start = boundary.index ?? 0;
		const end = boundaries[index + 1]?.index ?? source.length;
		const chunk = source.slice(start, end);
		const call = [...chunk.matchAll(AXIOS_CALL)][0];
		const method = call?.groups?.method;
		const raw = call?.groups?.path;
		if (method === undefined || raw === undefined) continue;
		const collapsed = raw.replace(TEMPLATE_HOLE, ':id');
		const question = collapsed.indexOf('?');
		calls.push({
			helper,
			method: method.toUpperCase(),
			path: question === -1 ? collapsed : collapsed.slice(0, question),
			query: question === -1 ? null : collapsed.slice(question),
		});
	}
	return calls;
}

export type MemosApiSurfaceVerification = {
	sourceSha256: string;
	callsExtracted: number;
	/** Declared entries the pinned helper does not contain, and the reverse. */
	declaredNotExtracted: string[];
	extractedNotDeclared: string[];
	/** Declared consumers whose pinned file does not name the claimed symbol. */
	unverifiedConsumers: string[];
	agrees: boolean;
};

const describe = (call: ExtractedCall): string =>
	`${call.helper} ${call.method} ${call.path}${call.query ?? ''}`;

/**
 * Check the declaration against the pinned tree. Nothing here trusts the
 * declaration: the helper's bytes decide the method-and-path set, and each
 * declared consumer file has to name the symbol claimed for it.
 */
export async function verifyMemosApiSurface(
	sourceRoot = MEMOS_SOURCE_ROOT,
): Promise<MemosApiSurfaceVerification> {
	const bytes = await readFile(path.join(sourceRoot, MEMOS_API_HELPER));
	const extracted = extractMemosAxiosCalls(bytes.toString('utf8'));
	const extractedKeys = new Set(extracted.map(describe));
	const declaredKeys = new Set(
		MEMOS_API_SURFACE.map((entry) =>
			describe({
				helper: entry.helper,
				method: entry.method,
				path: entry.path,
				query: entry.query,
			}),
		),
	);
	const unverifiedConsumers: string[] = [];
	for (const entry of MEMOS_API_SURFACE)
		for (const consumer of entry.consumers) {
			const text = await readFile(path.join(sourceRoot, consumer.file), 'utf8').catch(
				() => null,
			);
			if (text === null || !text.includes(consumer.symbol))
				unverifiedConsumers.push(`${consumer.file}: ${consumer.symbol}`);
		}
	const declaredNotExtracted = [...declaredKeys].filter((key) => !extractedKeys.has(key)).sort();
	const extractedNotDeclared = [...extractedKeys].filter((key) => !declaredKeys.has(key)).sort();
	return {
		sourceSha256: sha256(bytes),
		callsExtracted: extracted.length,
		declaredNotExtracted,
		extractedNotDeclared,
		unverifiedConsumers: [...new Set(unverifiedConsumers)].sort(),
		agrees:
			declaredNotExtracted.length === 0 &&
			extractedNotDeclared.length === 0 &&
			unverifiedConsumers.length === 0,
	};
}

export type MemosApiSurfaceRecord = {
	schemaVersion: string;
	slug: string;
	unit: string;
	revision: string;
	frontendRoot: string;
	sourceFile: string;
	sourceSha256: string;
	extraction: { method: string; callsExtracted: number; agreesWithDeclaration: boolean };
	sessionModel: Record<string, string>;
	endpoints: readonly MemosApiEndpoint[];
	clientOnlySurfaces: typeof MEMOS_CLIENT_ONLY_SURFACES;
	withheldEndpoints: typeof MEMOS_UNPROJECTED_ENDPOINTS;
	projection: {
		module: string;
		projectedEndpoints: readonly string[];
		seedFixture: string;
		seedSha256: string;
		behaviorDigest: string;
		/**
		 * The recorded credentials-only amendment to the frozen seed, carrying the
		 * digests it superseded so the move is auditable from the evidence alone.
		 */
		seedAmendment: typeof MEMOS_SEED_AMENDMENT;
		signinValidator: {
			source: string;
			config: typeof MEMOS_SIGNIN_VALIDATOR;
			ownerEmailPasses: boolean;
			ownerPasswordPasses: boolean;
		};
	};
	scope: string;
};

/** The enumeration exactly as it is published beside the run. */
export async function buildMemosApiSurfaceRecord(
	sourceRoot = MEMOS_SOURCE_ROOT,
): Promise<MemosApiSurfaceRecord> {
	const verification = await verifyMemosApiSurface(sourceRoot);
	if (!verification.agrees)
		throw new Error(
			`Memos API surface declaration disagrees with the pinned tree: ${canonicalize(verification)}`,
		);
	return {
		schemaVersion: 'versionless.witness-api-surface.v1',
		slug: 'react-memos-v0-1-3',
		unit: 'lrapr-t006/u11-memos-api-projection',
		revision: MEMOS_PINNED_REVISION,
		frontendRoot: 'web',
		sourceFile: `web/${MEMOS_API_HELPER}`,
		sourceSha256: verification.sourceSha256,
		extraction: {
			method: 'axios call sites read out of the pinned helper with magic-regexp, one call per exported function',
			callsExtracted: verification.callsExtracted,
			agreesWithDeclaration: verification.agrees,
		},
		sessionModel: {
			gate: 'pages/Home.tsx calls GET /api/user/me on mount and replaces history with /signin unless it yields a user',
			establish: 'POST /api/auth/login or POST /api/auth/signup, then GET /api/user/me',
			clear: 'POST /api/auth/logout',
			transport:
				'axios sets withCredentials, so the real backend carries a cookie; the loopback API seam carries no headers, so the projection holds the session as per-run in-memory state instead',
			signup: 'the sign-up button appears only while GET /api/status reports no owner; the projection grants OWNER only when no owner exists and records a USER otherwise',
		},
		endpoints: MEMOS_API_SURFACE,
		clientOnlySurfaces: MEMOS_CLIENT_ONLY_SURFACES,
		withheldEndpoints: MEMOS_UNPROJECTED_ENDPOINTS,
		projection: {
			module: 'packages/cli/src/witness/memos-projection.ts',
			projectedEndpoints: MEMOS_PROJECTED_ENDPOINTS,
			seedFixture: 'fixtures/react-memos-v0-1-3/witness-projection-seed.json',
			seedSha256: memosSeedDigest(),
			behaviorDigest: MEMOS_PROJECTION_BEHAVIOR_DIGEST,
			seedAmendment: MEMOS_SEED_AMENDMENT,
			signinValidator: {
				source: 'web/src/pages/Signin.tsx + web/src/helpers/validator.ts at the pinned revision',
				config: MEMOS_SIGNIN_VALIDATOR,
				ownerEmailPasses: memosSigninValidates(MEMOS_SEED.users[0]!.email),
				ownerPasswordPasses: memosSigninValidates(MEMOS_SEED.credentials[0]!.password),
			},
		},
		scope: 'API projection only: this unit publishes no journeys, no witness receipt and no witness run entry.',
	};
}

/** Write the enumeration into the run evidence directory. */
export async function writeMemosApiSurfaceEvidence(
	sourceRoot = MEMOS_SOURCE_ROOT,
): Promise<string> {
	const record = await buildMemosApiSurfaceRecord(sourceRoot);
	await mkdir(path.dirname(MEMOS_API_SURFACE_EVIDENCE), { recursive: true });
	await writeFile(MEMOS_API_SURFACE_EVIDENCE, `${JSON.stringify(record, null, '\t')}\n`);
	return MEMOS_API_SURFACE_EVIDENCE;
}

/** Where the projection's synthetic seed is committed as data. */
export const MEMOS_SEED_FIXTURE = path.join(
	REPOSITORY_ROOT,
	'fixtures/react-memos-v0-1-3/witness-projection-seed.json',
);

/**
 * Publish the seed the projection runs on as committed fixture data, so the
 * records a journey will read can be reviewed without reading TypeScript. The
 * test suite holds the two in lockstep by digest.
 */
export async function writeMemosProjectionSeedFixture(): Promise<string> {
	await mkdir(path.dirname(MEMOS_SEED_FIXTURE), { recursive: true });
	await writeFile(
		MEMOS_SEED_FIXTURE,
		`${JSON.stringify({ ...MEMOS_SEED, sha256: memosSeedDigest() }, null, '\t')}\n`,
	);
	return MEMOS_SEED_FIXTURE;
}

/** Read back the published enumeration. */
export async function readMemosApiSurfaceEvidence(): Promise<MemosApiSurfaceRecord> {
	return JSON.parse(await readFile(MEMOS_API_SURFACE_EVIDENCE, 'utf8')) as MemosApiSurfaceRecord;
}
