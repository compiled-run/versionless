import { charNotIn, createRegExp, exactly, global, oneOrMore } from 'magic-regexp';
import { parseQuery } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

/**
 * Frozen synthetic Memos API projection.
 *
 * The retained Memos build is session-gated: `pages/Home.tsx` calls
 * `GET /api/user/me` on mount and replaces history with `/signin` whenever that
 * call does not yield a user, so nothing behind the gate can be witnessed until
 * a session exists. This module is the deterministic state machine that stands
 * in for the Go backend the pinned revision talks to: it answers exactly the
 * same-origin `/api` surface the pinned `web/src` reaches (enumerated in
 * `evidence/runs/react-memos-v0-1-3/t006-api-surface.json`), it serves only
 * data authored for this fixture, it holds every record in memory, and it never
 * contacts anything.
 *
 * Three properties make it evidence rather than a mock:
 *
 * 1. It fails closed. A path the pinned client never calls is refused with a
 *    named refusal instead of inheriting a generous default, and an enumerated
 *    endpoint this projection deliberately does not project is refused with a
 *    DIFFERENT named refusal, so "unknown to the application" and "known and
 *    withheld" can never be confused in the ledger.
 * 2. Every transport decision is ledgered — method, path, query, endpoint id,
 *    decision, status, the session state the decision left in force, and
 *    digests of the request and response bytes.
 * 3. Its behavior is frozen by digest. `MEMOS_PROJECTION_BEHAVIOR_DIGEST` is
 *    taken over the replay of a fixed transcript, so a journey cannot drift the
 *    projection's answers without the digest test failing first.
 *
 * The session is projection-local state, not a cookie: the loopback API seam
 * carries method, path, query and body but no headers, so this projection
 * records the session established by `/api/auth/login` or `/api/auth/signup`
 * inside the per-run projection instance. One browser talks to one projection
 * for one run, so the observable gate behaviour is the application's own.
 */
export const MEMOS_PROJECTION_LABEL = 'synthetic-fixture-evidence-data' as const;

/** The pinned revision whose `web/src` this projection answers. */
export const MEMOS_PINNED_REVISION = '565fe0cc567c02deb59fc04830df707ea7476d52' as const;

export type MemosRowStatus = 'NORMAL' | 'ARCHIVED';
export type MemosUserRole = 'OWNER' | 'USER';

export type MemosUser = {
	id: number;
	createdTs: number;
	updatedTs: number;
	rowStatus: MemosRowStatus;
	role: MemosUserRole;
	email: string;
	name: string;
	openId: string;
};

export type MemosMemo = {
	id: number;
	creatorId: number;
	createdTs: number;
	updatedTs: number;
	rowStatus: MemosRowStatus;
	content: string;
	pinned: boolean;
};

export type MemosShortcut = {
	id: number;
	creatorId: number;
	rowStatus: MemosRowStatus;
	createdTs: number;
	updatedTs: number;
	title: string;
	payload: string;
};

/**
 * The projection's synthetic seed, committed alongside the fixture as
 * `fixtures/react-memos-v0-1-3/witness-projection-seed.json`.
 *
 * Timestamps are UNIX seconds because that is what the pinned client expects:
 * every service multiplies `createdTs` by 1000 before it renders.
 */
export type MemosSeed = {
	label: string;
	users: readonly MemosUser[];
	credentials: readonly { userId: number; password: string }[];
	memos: readonly MemosMemo[];
	shortcuts: readonly MemosShortcut[];
	profile: { mode: string; version: string };
};

const seconds = (iso: string): number => Math.floor(Date.parse(iso) / 1000);

/**
 * The site owner. The address is on `.invalid`, which can never resolve, and
 * the passphrase below is labelled synthetic in its own value: neither is a
 * credential for anything that exists.
 *
 * The owner pair is ALSO constrained by the pinned application. `pages/Signin.tsx`
 * validates both the email field and the password field with its own
 * `{ minLength: 4, maxLength: 24, noSpace: true, noChinese: true }` config
 * BEFORE it ever calls `api.login`, so a pair the projection would accept over
 * the wire is worthless if the pinned form refuses to send it. The first frozen
 * pair (a 34-character address and a 26-character passphrase) was refused by
 * that validator on length, which closed every journey behind the
 * `GET /api/user/me` gate: signup is unreachable because the seed holds an
 * OWNER, and the dev prefill is unreachable because `profile.mode` is `prod`.
 *
 * @see MEMOS_SEED_AMENDMENT for the amendment that replaced that pair, the
 * authority it was made under, and the digests it superseded.
 */
const OWNER: MemosUser = {
	id: 1,
	createdTs: seconds('2026-08-01T09:00:00.000Z'),
	updatedTs: seconds('2026-08-01T09:00:00.000Z'),
	rowStatus: 'NORMAL',
	role: 'OWNER',
	email: 'owner@evidence.invalid',
	name: 'owner@evidence.invalid',
	openId: 'synthetic-open-id-owner',
};

export const MEMOS_OWNER_PASSWORD = 'synthetic-pass' as const;

/**
 * The pinned sign-in validator, transcribed from `web/src/pages/Signin.tsx` at
 * {@link MEMOS_PINNED_REVISION}. It is held here so the seeded owner pair can be
 * checked against the application's own rule by test rather than by reading.
 */
export const MEMOS_SIGNIN_VALIDATOR = Object.freeze({
	minLength: 4,
	maxLength: 24,
	noSpace: true,
	noChinese: true,
});

/**
 * The pinned validator's own Chinese-character class, transcribed from
 * `helpers/validator.ts` (`/[　㐀-䶿一-鿿]/`) as code-unit
 * ranges rather than a pattern, so the transcription is readable as data.
 */
const MEMOS_CHINESE_RANGES = Object.freeze([
	[0x3000, 0x3000],
	[0x3400, 0x4dbf],
	[0x4e00, 0x9fff],
] as const);

/** Whether the pinned `Signin.tsx` would send this value rather than toast it. */
export function memosSigninValidates(text: string): boolean {
	for (let index = 0; index < text.length; index += 1) {
		const unit = text.charCodeAt(index);
		if (MEMOS_CHINESE_RANGES.some(([low, high]) => unit >= low && unit <= high)) return false;
	}
	return (
		text.length >= MEMOS_SIGNIN_VALIDATOR.minLength &&
		text.length <= MEMOS_SIGNIN_VALIDATOR.maxLength &&
		!text.includes(' ')
	);
}

/**
 * The recorded seed amendment.
 *
 * The projection's behaviour is frozen by digest precisely so a journey cannot
 * drift it. That freeze is not a reason to keep a seed the pinned application's
 * own validator rejects: the freeze exists to prevent journey-driven drift, not
 * to enshrine credentials no journey can ever use. Under the recorded PM ruling
 * the owner pair — and ONLY the owner pair — was replaced with validator-passing,
 * still obviously synthetic values, and both frozen digests were re-taken. No
 * other seeded record, response envelope, session rule, mutation clock step or
 * ledger field changed, so every non-auth step of
 * {@link MEMOS_PROJECTION_BEHAVIOR_TRANSCRIPT} replays byte-identically apart
 * from the owner's own two values travelling through it.
 */
export const MEMOS_SEED_AMENDMENT = Object.freeze({
	unit: 'lrapr-t006/u12b-memos-seed-and-witness',
	authority: 'PM ruling recorded in the T006 unit log: the seed amendment is authorized',
	scope: 'credentials-only — the seeded owner email, the owner name derived from it, and the owner passphrase',
	reason:
		"the pinned pages/Signin.tsx validates BOTH fields with {minLength:4,maxLength:24,noSpace,noChinese} before calling api.login, so the frozen pair (34-character email, 26-character password) was refused by the application's own client-side validator and no journey could open the GET /api/user/me gate: signup is closed because the seed holds an OWNER and /api/status reports one, and the dev prefill is disabled because profile.mode is 'prod'",
	supersededOwnerEmail: 'owner@versionless-evidence.invalid',
	supersededOwnerPassword: 'synthetic-owner-passphrase',
	supersededSeedSha256: 'cf422f2cda23b4c777d27b2bccd68a24b53cac027dbe57347e1b150fc8cdb7ff',
	supersededBehaviorDigest: '1672b43f0f01379b74890013cf145ed87164873cff037d4b6ace072a1fa79493',
	unchanged:
		'memos, shortcuts, profile, every response envelope, the session state machine, the mutation clock and the ledger shape are untouched by this amendment',
});

const memo = (
	id: number,
	content: string,
	createdAt: string,
	rowStatus: MemosRowStatus = 'NORMAL',
	pinned = false,
): MemosMemo => ({
	id,
	creatorId: OWNER.id,
	createdTs: seconds(createdAt),
	updatedTs: seconds(createdAt),
	rowStatus,
	content,
	pinned,
});

/**
 * The seeded memos.
 *
 * Every tag is written as `#tag ` — a hash, a token, then a space — because the
 * pinned client's own `TAG_REG` (`/#(.+?) /g`) only recognises a tag that a
 * space closes. Deriving `/api/tag` under the same rule keeps the tag list the
 * sidebar renders identical to the tags the client's filter can match.
 */
export const MEMOS_SEED: MemosSeed = Object.freeze({
	label: MEMOS_PROJECTION_LABEL,
	users: Object.freeze([OWNER]),
	credentials: Object.freeze([{ userId: OWNER.id, password: MEMOS_OWNER_PASSWORD }]),
	memos: Object.freeze([
		memo(
			1,
			'Pinned the era baseline for the retained build. #evidence tracked in the run ledger.',
			'2026-08-02T09:00:00.000Z',
			'NORMAL',
			true,
		),
		memo(
			2,
			'The origin bundler is itself Vite, six majors back. #migration notes stay with the lane.',
			'2026-08-03T09:00:00.000Z',
		),
		memo(
			3,
			'Config translation replaced the removed client APIs. #migration #evidence both apply.',
			'2026-08-04T09:00:00.000Z',
		),
		memo(
			4,
			'Superseded draft kept only to prove restore from the recycle bin. #archive holds it.',
			'2026-08-05T09:00:00.000Z',
			'ARCHIVED',
		),
	]),
	shortcuts: Object.freeze([
		{
			id: 1,
			creatorId: OWNER.id,
			rowStatus: 'ARCHIVED',
			createdTs: seconds('2026-08-06T09:00:00.000Z'),
			updatedTs: seconds('2026-08-06T09:00:00.000Z'),
			title: 'Evidence',
			payload:
				'[{"type":"TAG","value":{"operator":"CONTAIN","value":"evidence"},"relation":"AND"}]',
		},
		{
			id: 2,
			creatorId: OWNER.id,
			rowStatus: 'NORMAL',
			createdTs: seconds('2026-08-07T09:00:00.000Z'),
			updatedTs: seconds('2026-08-07T09:00:00.000Z'),
			title: 'Migration',
			payload:
				'[{"type":"TAG","value":{"operator":"CONTAIN","value":"migration"},"relation":"AND"}]',
		},
	] as readonly MemosShortcut[]),
	profile: Object.freeze({ mode: 'prod', version: '0.1.3' }),
});

/** sha256 over the canonicalized seed, so the committed fixture copy cannot drift. */
export const memosSeedDigest = (): string => sha256(canonicalize(MEMOS_SEED));

/**
 * The mutation clock. Records the projection mints get timestamps from a fixed
 * origin advanced one step per mutation, so two runs of the same journey
 * produce identical records without reading the wall clock.
 */
const MUTATION_CLOCK_ORIGIN_SECONDS = seconds('2026-08-09T00:00:00.000Z');
const MUTATION_CLOCK_STEP_SECONDS = 60;

const MEMO_TAG = createRegExp(
	exactly('#'),
	oneOrMore(charNotIn(' \n\t#')).groupedAs('tag'),
	exactly(' '),
	[global],
);

/** Tags the pinned client's own `TAG_REG` would find in this content. */
export function memosTagsInContent(content: string): string[] {
	const found: string[] = [];
	for (const match of content.matchAll(MEMO_TAG)) {
		const tag = match.groups?.tag;
		if (tag !== undefined && tag.length > 0 && !found.includes(tag)) found.push(tag);
	}
	return found;
}

export type MemosApiRequest = {
	method: string;
	pathname: string;
	search: string;
	body: Buffer;
};

export type MemosApiResponse = { status: number; contentType: string; body: Buffer };

export type MemosProjectionDecision =
	| 'served'
	| 'refused-unknown'
	| 'refused-unprojected'
	| 'declined-non-api';

export type MemosProjectionLedgerRecord = {
	sequence: number;
	method: string;
	pathname: string;
	search: string;
	endpoint: string | null;
	decision: MemosProjectionDecision;
	status: number | null;
	/** Whether a session stood open once this decision had been taken. */
	authenticated: boolean;
	requestSha256: string;
	responseSha256: string | null;
};

export type MemosProjection = {
	api(request: MemosApiRequest): Promise<MemosApiResponse | null>;
	ledger(): MemosProjectionLedgerRecord[];
	sessionUserId(): number | null;
	memos(): MemosMemo[];
	shortcuts(): MemosShortcut[];
	users(): MemosUser[];
};

/**
 * The endpoints this projection answers, keyed by the ledger id it records.
 * `POST /api/resource` is enumerated in the pinned client and deliberately NOT
 * projected: nothing in the journey surface uploads a file, and answering an
 * upload would mean inventing a resource pipeline whose bytes no witness ever
 * sees.
 */
export const MEMOS_PROJECTED_ENDPOINTS = Object.freeze([
	'status',
	'auth.login',
	'auth.signup',
	'auth.logout',
	'user.create',
	'user.list',
	'user.me.get',
	'user.me.patch',
	'memo.list',
	'memo.create',
	'memo.patch',
	'memo.organizer',
	'memo.delete',
	'tag.list',
	'shortcut.list',
	'shortcut.create',
	'shortcut.patch',
	'shortcut.delete',
] as const);

export const MEMOS_UNPROJECTED_ENDPOINTS = Object.freeze([
	{
		endpoint: 'resource.upload',
		method: 'POST',
		path: '/api/resource',
		reason:
			'no journey uploads a file; projecting an upload would mean inventing a resource ' +
			'pipeline and a `/h/r/:id/:filename` byte stream that no witness observes',
	},
] as const);

function json(value: unknown, status = 200): MemosApiResponse {
	return {
		status,
		contentType: 'application/json',
		body: Buffer.from(JSON.stringify(value), 'utf8'),
	};
}

const envelope = (data: unknown, status = 200): MemosApiResponse => json({ data }, status);

const failure = (status: number, error: string, message: string): MemosApiResponse =>
	json({ error, message }, status);

const unknownPath = (method: string, pathname: string): MemosApiResponse =>
	failure(
		404,
		'unknown-endpoint',
		`Memos synthetic projection refuses an endpoint the pinned client never calls: ${method} ${pathname}`,
	);

const unprojectedPath = (endpoint: string, reason: string): MemosApiResponse =>
	failure(
		501,
		'unprojected-endpoint',
		`Memos synthetic projection withholds the enumerated endpoint ${endpoint}: ${reason}`,
	);

function parsedBody(body: Buffer): Record<string, unknown> {
	if (body.length === 0) return {};
	const parsed: unknown = JSON.parse(body.toString('utf8'));
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
		throw new Error('Memos synthetic projection requires a JSON object body');
	return parsed as Record<string, unknown>;
}

const stringField = (source: Record<string, unknown>, key: string): string | null => {
	const value = source[key];
	return typeof value === 'string' ? value : null;
};

const queryValue = (query: Record<string, string | string[]>, key: string): string | null => {
	const value = query[key];
	if (typeof value === 'string') return value;
	return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null;
};

const numericSuffix = (pathname: string, prefix: string, suffix = ''): number | null => {
	if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
	const raw = pathname.slice(prefix.length, pathname.length - suffix.length);
	if (raw.length === 0 || raw.split('').some((digit) => digit < '0' || digit > '9')) return null;
	return Number.parseInt(raw, 10);
};

type Handled = { endpoint: string; response: MemosApiResponse };

/**
 * One projection instance. `createMemosProjection()` is called once per run by
 * the loopback seam, so every run starts from the frozen seed rather than
 * inheriting another run's mutations.
 */
export function createMemosProjection(): MemosProjection {
	const users: MemosUser[] = MEMOS_SEED.users.map((user) => structuredClone(user));
	const passwords = new Map<number, string>(
		MEMOS_SEED.credentials.map((entry) => [entry.userId, entry.password]),
	);
	const memos: MemosMemo[] = MEMOS_SEED.memos.map((record) => structuredClone(record));
	const shortcuts: MemosShortcut[] = MEMOS_SEED.shortcuts.map((record) =>
		structuredClone(record),
	);
	const records: MemosProjectionLedgerRecord[] = [];
	let session: number | null = null;
	let mutations = 0;
	let sequence = 0;

	const tick = (): number => {
		const stamp = MUTATION_CLOCK_ORIGIN_SECONDS + mutations * MUTATION_CLOCK_STEP_SECONDS;
		mutations += 1;
		return stamp;
	};
	const nextId = (rows: readonly { id: number }[]): number =>
		rows.reduce((highest, row) => (row.id > highest ? row.id : highest), 0) + 1;
	const sessionUser = (): MemosUser | null => users.find((user) => user.id === session) ?? null;
	const owner = (): MemosUser | null => users.find((user) => user.role === 'OWNER') ?? null;
	const byCreated = (left: { createdTs: number }, right: { createdTs: number }): number =>
		right.createdTs - left.createdTs;

	const unauthorized = (): MemosApiResponse =>
		failure(401, 'unauthorized', 'Memos synthetic projection has no session for this request');

	const createUser = (
		body: Record<string, unknown>,
		role: MemosUserRole,
	): MemosUser | MemosApiResponse => {
		const email = stringField(body, 'email');
		const password = stringField(body, 'password');
		if (email === null || email.length === 0 || password === null || password.length === 0)
			return failure(
				400,
				'invalid-request',
				'Memos synthetic projection requires email and password',
			);
		if (users.some((user) => user.email === email))
			return failure(
				400,
				'duplicate-user',
				`Memos synthetic projection already holds ${email}`,
			);
		const stamp = tick();
		const created: MemosUser = {
			id: nextId(users),
			createdTs: stamp,
			updatedTs: stamp,
			rowStatus: 'NORMAL',
			role,
			email,
			name: stringField(body, 'name') ?? email,
			openId: `synthetic-open-id-${nextId(users)}`,
		};
		users.push(created);
		passwords.set(created.id, password);
		return created;
	};

	const patchMe = (user: MemosUser, body: Record<string, unknown>): MemosApiResponse => {
		const name = stringField(body, 'name');
		const password = stringField(body, 'password');
		if (name !== null && name.length > 0) user.name = name;
		if (password !== null && password.length > 0) passwords.set(user.id, password);
		if (body['resetOpenId'] === true) user.openId = `synthetic-open-id-reset-${tick()}`;
		user.updatedTs = tick();
		return envelope(structuredClone(user));
	};

	const memoList = (user: MemosUser, search: string): MemosApiResponse => {
		const rowStatus = queryValue(parseQuery(search), 'rowStatus');
		const visible = memos
			.filter((record) => record.creatorId === user.id)
			.filter((record) => rowStatus === null || record.rowStatus === rowStatus)
			.sort(byCreated);
		return envelope(structuredClone(visible));
	};

	const createMemo = (user: MemosUser, body: Record<string, unknown>): MemosApiResponse => {
		const content = stringField(body, 'content');
		if (content === null || content.trim().length === 0)
			return failure(
				400,
				'invalid-request',
				'Memos synthetic projection requires memo content',
			);
		const declared = body['createdTs'];
		const stamp = typeof declared === 'number' ? declared : tick();
		const created: MemosMemo = {
			id: nextId(memos),
			creatorId: user.id,
			createdTs: stamp,
			updatedTs: stamp,
			rowStatus: 'NORMAL',
			content,
			pinned: false,
		};
		memos.push(created);
		return envelope(structuredClone(created));
	};

	const ownedMemo = (user: MemosUser, id: number): MemosMemo | null =>
		memos.find((record) => record.id === id && record.creatorId === user.id) ?? null;

	const patchMemo = (
		user: MemosUser,
		id: number,
		body: Record<string, unknown>,
	): MemosApiResponse => {
		const record = ownedMemo(user, id);
		if (record === null)
			return failure(404, 'not-found', `Memos synthetic projection holds no memo ${id}`);
		const content = stringField(body, 'content');
		const rowStatus = stringField(body, 'rowStatus');
		if (content !== null) record.content = content;
		if (rowStatus === 'NORMAL' || rowStatus === 'ARCHIVED') record.rowStatus = rowStatus;
		record.updatedTs = tick();
		return envelope(structuredClone(record));
	};

	const organizeMemo = (
		user: MemosUser,
		id: number,
		body: Record<string, unknown>,
	): MemosApiResponse => {
		const record = ownedMemo(user, id);
		if (record === null)
			return failure(404, 'not-found', `Memos synthetic projection holds no memo ${id}`);
		if (typeof body['pinned'] !== 'boolean')
			return failure(
				400,
				'invalid-request',
				'Memos synthetic projection requires a pinned flag',
			);
		record.pinned = body['pinned'];
		record.updatedTs = tick();
		return envelope(structuredClone(record));
	};

	const deleteMemo = (user: MemosUser, id: number): MemosApiResponse => {
		const index = memos.findIndex((record) => record.id === id && record.creatorId === user.id);
		if (index === -1)
			return failure(404, 'not-found', `Memos synthetic projection holds no memo ${id}`);
		memos.splice(index, 1);
		return envelope(true);
	};

	/** Tags of the session user's live memos, deduplicated and lexicographically ordered. */
	const tagList = (user: MemosUser): MemosApiResponse => {
		const tags = new Set<string>();
		for (const record of memos)
			if (record.creatorId === user.id && record.rowStatus === 'NORMAL')
				for (const tag of memosTagsInContent(record.content)) tags.add(tag);
		return envelope([...tags].sort());
	};

	const ownedShortcut = (user: MemosUser, id: number): MemosShortcut | null =>
		shortcuts.find((record) => record.id === id && record.creatorId === user.id) ?? null;

	const createShortcut = (user: MemosUser, body: Record<string, unknown>): MemosApiResponse => {
		const title = stringField(body, 'title');
		const payload = stringField(body, 'payload');
		if (title === null || title.length === 0 || payload === null || payload.length === 0)
			return failure(
				400,
				'invalid-request',
				'Memos synthetic projection requires a shortcut title and payload',
			);
		const stamp = tick();
		const created: MemosShortcut = {
			id: nextId(shortcuts),
			creatorId: user.id,
			rowStatus: 'NORMAL',
			createdTs: stamp,
			updatedTs: stamp,
			title,
			payload,
		};
		shortcuts.push(created);
		return envelope(structuredClone(created));
	};

	const patchShortcut = (
		user: MemosUser,
		id: number,
		body: Record<string, unknown>,
	): MemosApiResponse => {
		const record = ownedShortcut(user, id);
		if (record === null)
			return failure(404, 'not-found', `Memos synthetic projection holds no shortcut ${id}`);
		const title = stringField(body, 'title');
		const payload = stringField(body, 'payload');
		const rowStatus = stringField(body, 'rowStatus');
		if (title !== null && title.length > 0) record.title = title;
		if (payload !== null && payload.length > 0) record.payload = payload;
		if (rowStatus === 'NORMAL' || rowStatus === 'ARCHIVED') record.rowStatus = rowStatus;
		record.updatedTs = tick();
		return envelope(structuredClone(record));
	};

	const deleteShortcut = (user: MemosUser, id: number): MemosApiResponse => {
		const index = shortcuts.findIndex(
			(record) => record.id === id && record.creatorId === user.id,
		);
		if (index === -1)
			return failure(404, 'not-found', `Memos synthetic projection holds no shortcut ${id}`);
		shortcuts.splice(index, 1);
		return envelope(true);
	};

	const login = (body: Record<string, unknown>): MemosApiResponse => {
		const email = stringField(body, 'email');
		const password = stringField(body, 'password');
		const user = users.find((candidate) => candidate.email === email) ?? null;
		if (user === null || password === null || passwords.get(user.id) !== password)
			return failure(
				401,
				'unauthorized',
				'Memos synthetic projection rejects these sign-in values',
			);
		session = user.id;
		return envelope(structuredClone(user));
	};

	/**
	 * Signup. The pinned client only offers this button while `/api/status`
	 * reports no owner, and it always asks for `OWNER`. The projection grants
	 * `OWNER` only when no owner exists and otherwise records the account as a
	 * plain `USER`, so the role in the store is a decision this projection made
	 * rather than a role the client asserted.
	 */
	const signup = (body: Record<string, unknown>): MemosApiResponse => {
		const created = createUser(body, owner() === null ? 'OWNER' : 'USER');
		if (!('id' in created)) return created;
		session = created.id;
		return envelope(structuredClone(created));
	};

	const authenticated = (handler: (user: MemosUser) => MemosApiResponse): MemosApiResponse => {
		const user = sessionUser();
		return user === null ? unauthorized() : handler(user);
	};

	const handleUser = (request: MemosApiRequest, body: Buffer): Handled | null => {
		if (request.pathname === '/api/user' && request.method === 'GET')
			return {
				endpoint: 'user.list',
				response: authenticated(() => envelope(structuredClone(users))),
			};
		if (request.pathname === '/api/user' && request.method === 'POST')
			return {
				endpoint: 'user.create',
				response: authenticated((user) => {
					if (user.role !== 'OWNER')
						return failure(
							403,
							'forbidden',
							'Memos synthetic projection lets only the owner create members',
						);
					const created = createUser(parsedBody(body), 'USER');
					return 'id' in created ? envelope(structuredClone(created)) : created;
				}),
			};
		if (request.pathname === '/api/user/me' && request.method === 'GET')
			return {
				endpoint: 'user.me.get',
				response: authenticated((user) => envelope(structuredClone(user))),
			};
		if (request.pathname === '/api/user/me' && request.method === 'PATCH')
			return {
				endpoint: 'user.me.patch',
				response: authenticated((user) => patchMe(user, parsedBody(body))),
			};
		return null;
	};

	const handleMemo = (request: MemosApiRequest, body: Buffer): Handled | null => {
		if (request.pathname === '/api/memo' && request.method === 'GET')
			return {
				endpoint: 'memo.list',
				response: authenticated((user) => memoList(user, request.search)),
			};
		if (request.pathname === '/api/memo' && request.method === 'POST')
			return {
				endpoint: 'memo.create',
				response: authenticated((user) => createMemo(user, parsedBody(body))),
			};
		const organizerId = numericSuffix(request.pathname, '/api/memo/', '/organizer');
		if (organizerId !== null && request.method === 'POST')
			return {
				endpoint: 'memo.organizer',
				response: authenticated((user) =>
					organizeMemo(user, organizerId, parsedBody(body)),
				),
			};
		const memoId = numericSuffix(request.pathname, '/api/memo/');
		if (memoId !== null && request.method === 'PATCH')
			return {
				endpoint: 'memo.patch',
				response: authenticated((user) => patchMemo(user, memoId, parsedBody(body))),
			};
		if (memoId !== null && request.method === 'DELETE')
			return {
				endpoint: 'memo.delete',
				response: authenticated((user) => deleteMemo(user, memoId)),
			};
		return null;
	};

	const handleShortcut = (request: MemosApiRequest, body: Buffer): Handled | null => {
		if (request.pathname === '/api/shortcut' && request.method === 'GET')
			return {
				endpoint: 'shortcut.list',
				response: authenticated((user) =>
					envelope(
						structuredClone(
							shortcuts
								.filter((record) => record.creatorId === user.id)
								.sort(byCreated),
						),
					),
				),
			};
		if (request.pathname === '/api/shortcut' && request.method === 'POST')
			return {
				endpoint: 'shortcut.create',
				response: authenticated((user) => createShortcut(user, parsedBody(body))),
			};
		const shortcutId = numericSuffix(request.pathname, '/api/shortcut/');
		if (shortcutId !== null && request.method === 'PATCH')
			return {
				endpoint: 'shortcut.patch',
				response: authenticated((user) =>
					patchShortcut(user, shortcutId, parsedBody(body)),
				),
			};
		if (shortcutId !== null && request.method === 'DELETE')
			return {
				endpoint: 'shortcut.delete',
				response: authenticated((user) => deleteShortcut(user, shortcutId)),
			};
		return null;
	};

	const handle = (request: MemosApiRequest): Handled => {
		const body = request.body;
		if (request.pathname === '/api/status' && request.method === 'GET') {
			const siteOwner = owner();
			return {
				endpoint: 'status',
				response: envelope({
					...(siteOwner === null ? {} : { owner: structuredClone(siteOwner) }),
					profile: { ...MEMOS_SEED.profile },
				}),
			};
		}
		if (request.pathname === '/api/auth/login' && request.method === 'POST')
			return { endpoint: 'auth.login', response: login(parsedBody(body)) };
		if (request.pathname === '/api/auth/signup' && request.method === 'POST')
			return { endpoint: 'auth.signup', response: signup(parsedBody(body)) };
		if (request.pathname === '/api/auth/logout' && request.method === 'POST') {
			session = null;
			return { endpoint: 'auth.logout', response: envelope(true) };
		}
		if (request.pathname === '/api/tag' && request.method === 'GET')
			return { endpoint: 'tag.list', response: authenticated((user) => tagList(user)) };
		const withheld = MEMOS_UNPROJECTED_ENDPOINTS.find(
			(entry) => entry.path === request.pathname && entry.method === request.method,
		);
		if (withheld !== undefined)
			return {
				endpoint: withheld.endpoint,
				response: unprojectedPath(withheld.endpoint, withheld.reason),
			};
		const handled =
			handleUser(request, body) ?? handleMemo(request, body) ?? handleShortcut(request, body);
		return (
			handled ?? {
				endpoint: '',
				response: unknownPath(request.method, request.pathname),
			}
		);
	};

	const record = (
		request: MemosApiRequest,
		endpoint: string | null,
		decision: MemosProjectionDecision,
		response: MemosApiResponse | null,
	): void => {
		sequence += 1;
		records.push({
			sequence,
			method: request.method,
			pathname: request.pathname,
			search: request.search,
			endpoint,
			decision,
			status: response?.status ?? null,
			authenticated: session !== null,
			requestSha256: sha256(request.body),
			responseSha256: response === null ? null : sha256(response.body),
		});
	};

	const api = async (request: MemosApiRequest): Promise<MemosApiResponse | null> => {
		if (!request.pathname.startsWith('/api/')) {
			record(request, null, 'declined-non-api', null);
			return null;
		}
		const handled = handle(request);
		const endpoint = handled.endpoint.length === 0 ? null : handled.endpoint;
		const decision: MemosProjectionDecision =
			endpoint === null
				? 'refused-unknown'
				: handled.response.status === 501
					? 'refused-unprojected'
					: 'served';
		record(request, endpoint, decision, handled.response);
		return handled.response;
	};

	return {
		api,
		ledger: () => records.map((entry) => ({ ...entry })),
		sessionUserId: () => session,
		memos: () => structuredClone(memos),
		shortcuts: () => structuredClone(shortcuts),
		users: () => structuredClone(users),
	};
}

export type MemosTranscriptStep = {
	method: string;
	pathname: string;
	search?: string;
	body?: unknown;
};

/**
 * The frozen behaviour transcript.
 *
 * It walks the whole journey surface the enumeration records — the signed-out
 * gate, the sign-in that opens it, the memo list, a memo written and edited,
 * archive and restore, the derived tag list, a shortcut created, the settings
 * patch, sign-out and the gate closing again — plus both refusals. Replaying it
 * through a fresh projection is what `MEMOS_PROJECTION_BEHAVIOR_DIGEST` covers.
 */
export const MEMOS_PROJECTION_BEHAVIOR_TRANSCRIPT: readonly MemosTranscriptStep[] = Object.freeze([
	{ method: 'GET', pathname: '/index.html' },
	{ method: 'GET', pathname: '/api/status' },
	{ method: 'GET', pathname: '/api/user/me' },
	{
		method: 'POST',
		pathname: '/api/auth/login',
		body: { email: OWNER.email, password: 'wrong-synthetic-passphrase' },
	},
	{
		method: 'POST',
		pathname: '/api/auth/login',
		body: { email: OWNER.email, password: MEMOS_OWNER_PASSWORD },
	},
	{ method: 'GET', pathname: '/api/user/me' },
	{ method: 'GET', pathname: '/api/memo' },
	{ method: 'GET', pathname: '/api/memo', search: '?rowStatus=ARCHIVED' },
	{ method: 'GET', pathname: '/api/tag' },
	{ method: 'GET', pathname: '/api/shortcut' },
	{
		method: 'POST',
		pathname: '/api/memo',
		body: { content: 'Witnessed write from the frozen transcript. #evidence recorded.' },
	},
	{
		method: 'PATCH',
		pathname: '/api/memo/5',
		body: { content: 'Edited in place. #evidence held.' },
	},
	{ method: 'POST', pathname: '/api/memo/5/organizer', body: { pinned: true } },
	{ method: 'PATCH', pathname: '/api/memo/5', body: { rowStatus: 'ARCHIVED' } },
	{ method: 'PATCH', pathname: '/api/memo/5', body: { rowStatus: 'NORMAL' } },
	{ method: 'DELETE', pathname: '/api/memo/4' },
	{ method: 'GET', pathname: '/api/tag' },
	{
		method: 'POST',
		pathname: '/api/shortcut',
		body: {
			title: 'Archive',
			payload:
				'[{"type":"TEXT","value":{"operator":"CONTAIN","value":"lane"},"relation":"AND"}]',
		},
	},
	{ method: 'PATCH', pathname: '/api/shortcut/3', body: { rowStatus: 'ARCHIVED' } },
	{ method: 'DELETE', pathname: '/api/shortcut/3' },
	{ method: 'PATCH', pathname: '/api/user/me', body: { name: 'Evidence owner' } },
	{
		method: 'POST',
		pathname: '/api/user',
		body: {
			email: 'member@versionless-evidence.invalid',
			password: 'synthetic-member-passphrase',
			name: 'member',
			role: 'USER',
		},
	},
	{ method: 'GET', pathname: '/api/user' },
	{
		method: 'POST',
		pathname: '/api/auth/signup',
		body: {
			email: 'newcomer@versionless-evidence.invalid',
			password: 'synthetic-newcomer-passphrase',
			role: 'OWNER',
			name: 'newcomer@versionless-evidence.invalid',
		},
	},
	{ method: 'GET', pathname: '/api/user/me' },
	{ method: 'POST', pathname: '/api/resource' },
	{ method: 'GET', pathname: '/api/memo/1/relations' },
	{ method: 'POST', pathname: '/api/auth/logout' },
	{ method: 'GET', pathname: '/api/user/me' },
]);

export type MemosBehaviorReplayStep = {
	step: MemosTranscriptStep;
	status: number | null;
	body: unknown;
};

export type MemosBehaviorReplay = {
	steps: MemosBehaviorReplayStep[];
	ledger: MemosProjectionLedgerRecord[];
	digest: string;
};

/** Replay the frozen transcript through a fresh projection and digest the result. */
export async function replayMemosProjectionBehavior(): Promise<MemosBehaviorReplay> {
	const projection = createMemosProjection();
	const steps: MemosBehaviorReplayStep[] = [];
	for (const step of MEMOS_PROJECTION_BEHAVIOR_TRANSCRIPT) {
		const response = await projection.api({
			method: step.method,
			pathname: step.pathname,
			search: step.search ?? '',
			body:
				step.body === undefined
					? Buffer.alloc(0)
					: Buffer.from(JSON.stringify(step.body), 'utf8'),
		});
		steps.push({
			step,
			status: response?.status ?? null,
			body:
				response === null ? null : (JSON.parse(response.body.toString('utf8')) as unknown),
		});
	}
	const ledger = projection.ledger();
	return { steps, ledger, digest: sha256(canonicalize({ steps, ledger })) };
}

/**
 * The frozen behaviour digest.
 *
 * Any change to a seeded record, a response envelope, the session state
 * machine, the mutation clock or the ledger shape moves this value, so a
 * journey unit cannot quietly reshape the projection underneath its own
 * assertions.
 *
 * It moved exactly once, from `1672b43f0f01379b74890013cf145ed87164873cff037d4b6ace072a1fa79493`
 * to the value below, under {@link MEMOS_SEED_AMENDMENT}: the owner credentials
 * the transcript signs in with are part of the replayed bytes, so amending them
 * necessarily re-takes this digest. Nothing else in the transcript's answers
 * changed.
 */
export const MEMOS_PROJECTION_BEHAVIOR_DIGEST =
	'b17da56bba70249f1d3b25b2837083b80ba0ae8c1c2899f710fc1eaf9b059902' as const;
