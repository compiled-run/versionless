import { describe, expect, it } from 'vitest';
import {
	createMemosProjection,
	MEMOS_OWNER_PASSWORD,
	MEMOS_PROJECTED_ENDPOINTS,
	MEMOS_PROJECTION_BEHAVIOR_DIGEST,
	MEMOS_SEED,
	MEMOS_UNPROJECTED_ENDPOINTS,
	memosTagsInContent,
	replayMemosProjectionBehavior,
	type MemosApiResponse,
	type MemosProjection,
} from '../src/witness/memos-projection.ts';

type Envelope = { data?: unknown; error?: string; message?: string };
type MemoRow = { id: number; content: string; rowStatus: string; pinned: boolean };
type ShortcutRow = { id: number; title: string; rowStatus: string };
type UserRow = { id: number; email: string; name: string; role: string; openId: string };

const OWNER_EMAIL = MEMOS_SEED.users[0]!.email;

function decode(response: MemosApiResponse | null): Envelope {
	if (response === null) throw new Error('the projection declined this path');
	return JSON.parse(response.body.toString('utf8')) as Envelope;
}

const call = async (
	projection: MemosProjection,
	method: string,
	pathname: string,
	options: { search?: string; body?: unknown } = {},
): Promise<MemosApiResponse | null> =>
	await projection.api({
		method,
		pathname,
		search: options.search ?? '',
		body:
			options.body === undefined
				? Buffer.alloc(0)
				: Buffer.from(JSON.stringify(options.body), 'utf8'),
	});

const signIn = async (projection: MemosProjection): Promise<void> => {
	const response = await call(projection, 'POST', '/api/auth/login', {
		body: { email: OWNER_EMAIL, password: MEMOS_OWNER_PASSWORD },
	});
	expect(response?.status).toBe(200);
};

const rows = <T>(response: MemosApiResponse | null): T[] => decode(response).data as T[];

describe('synthetic Memos API projection', () => {
	it('declines non-API paths and refuses unknown API paths by name', async () => {
		const projection = createMemosProjection();
		expect(await call(projection, 'GET', '/index.html')).toBeNull();
		expect(await call(projection, 'GET', '/h/r/1/synthetic.png')).toBeNull();
		const unknown = await call(projection, 'GET', '/api/memo/1/relations');
		expect(unknown?.status).toBe(404);
		expect(decode(unknown).message).toContain('never calls');
		// A method the pinned client never uses on a path it does use is unknown too.
		expect((await call(projection, 'PUT', '/api/memo/1'))?.status).toBe(404);
		expect((await call(projection, 'GET', '/api/memo/not-a-number'))?.status).toBe(404);
		const decisions = projection.ledger().map((entry) => entry.decision);
		expect(decisions.slice(0, 2)).toEqual(['declined-non-api', 'declined-non-api']);
		expect(decisions.slice(2)).toEqual([
			'refused-unknown',
			'refused-unknown',
			'refused-unknown',
		]);
	});

	it('refuses an enumerated-but-withheld endpoint distinguishably from an unknown one', async () => {
		const projection = createMemosProjection();
		await signIn(projection);
		const withheld = MEMOS_UNPROJECTED_ENDPOINTS[0]!;
		const response = await call(projection, withheld.method, withheld.path, { body: {} });
		expect(response?.status).toBe(501);
		expect(decode(response).error).toBe('unprojected-endpoint');
		expect(decode(response).message).toContain(withheld.endpoint);
		const entry = projection.ledger().at(-1);
		expect(entry?.decision).toBe('refused-unprojected');
		expect(entry?.endpoint).toBe(withheld.endpoint);
		expect(MEMOS_PROJECTED_ENDPOINTS).not.toContain(withheld.endpoint);
	});

	it('holds the session gate closed until sign-in and opens it again on sign-out', async () => {
		const projection = createMemosProjection();
		const status = decode(await call(projection, 'GET', '/api/status')).data as {
			owner: UserRow;
			profile: { mode: string; version: string };
		};
		expect(status.owner.email).toBe(OWNER_EMAIL);
		expect(status.profile.version).toBe('0.1.3');
		expect(status.owner).not.toHaveProperty('password');
		// The gate the pinned Home.tsx reads.
		expect((await call(projection, 'GET', '/api/user/me'))?.status).toBe(401);
		expect((await call(projection, 'GET', '/api/memo'))?.status).toBe(401);
		expect(projection.sessionUserId()).toBeNull();
		const wrong = await call(projection, 'POST', '/api/auth/login', {
			body: { email: OWNER_EMAIL, password: 'not-the-synthetic-passphrase' },
		});
		expect(wrong?.status).toBe(401);
		expect(projection.sessionUserId()).toBeNull();
		await signIn(projection);
		expect(projection.sessionUserId()).toBe(MEMOS_SEED.users[0]!.id);
		expect((decode(await call(projection, 'GET', '/api/user/me')).data as UserRow).email).toBe(
			OWNER_EMAIL,
		);
		expect(decode(await call(projection, 'POST', '/api/auth/logout')).data).toBe(true);
		expect((await call(projection, 'GET', '/api/user/me'))?.status).toBe(401);
	});

	it('signs a new account up into a working session without granting it the owner role', async () => {
		const projection = createMemosProjection();
		const created = await call(projection, 'POST', '/api/auth/signup', {
			body: {
				email: 'member@versionless-evidence.invalid',
				password: 'synthetic-member-passphrase',
				role: 'OWNER',
				name: 'member@versionless-evidence.invalid',
			},
		});
		expect(created?.status).toBe(200);
		const user = decode(created).data as UserRow;
		expect(user.role).toBe('USER');
		expect(projection.sessionUserId()).toBe(user.id);
		// A signed-up account owns nothing seeded and cannot mint members.
		expect(rows<MemoRow>(await call(projection, 'GET', '/api/memo'))).toEqual([]);
		expect((await call(projection, 'POST', '/api/user', { body: {} }))?.status).toBe(403);
		expect(
			(
				await call(projection, 'POST', '/api/auth/signup', {
					body: { email: OWNER_EMAIL, password: 'synthetic-duplicate' },
				})
			)?.status,
		).toBe(400);
		// It can still sign back in with the values it registered.
		await call(projection, 'POST', '/api/auth/logout');
		expect(
			(
				await call(projection, 'POST', '/api/auth/login', {
					body: {
						email: 'member@versionless-evidence.invalid',
						password: 'synthetic-member-passphrase',
					},
				})
			)?.status,
		).toBe(200);
	});

	it('serves the memo family the list, editor and recycle bin reach', async () => {
		const projection = createMemosProjection();
		await signIn(projection);
		const all = rows<MemoRow>(await call(projection, 'GET', '/api/memo'));
		expect(all).toHaveLength(MEMOS_SEED.memos.length);
		expect(all[0]!.id).toBe(4);
		const archived = rows<MemoRow>(
			await call(projection, 'GET', '/api/memo', { search: '?rowStatus=ARCHIVED' }),
		);
		expect(archived.map((row) => row.id)).toEqual([4]);
		const created = decode(
			await call(projection, 'POST', '/api/memo', {
				body: { content: 'Written by the projection test. #evidence held.' },
			}),
		).data as MemoRow;
		expect(created.id).toBe(5);
		expect(created.rowStatus).toBe('NORMAL');
		const edited = decode(
			await call(projection, 'PATCH', '/api/memo/5', {
				body: { content: 'Edited. #lane held.' },
			}),
		).data as MemoRow;
		expect(edited.content).toBe('Edited. #lane held.');
		expect(
			(
				decode(
					await call(projection, 'POST', '/api/memo/5/organizer', {
						body: { pinned: true },
					}),
				).data as MemoRow
			).pinned,
		).toBe(true);
		// Archive, then restore, which is one route used two ways.
		await call(projection, 'PATCH', '/api/memo/5', { body: { rowStatus: 'ARCHIVED' } });
		expect(
			rows<MemoRow>(
				await call(projection, 'GET', '/api/memo', { search: '?rowStatus=ARCHIVED' }),
			).map((row) => row.id),
		).toEqual([5, 4]);
		await call(projection, 'PATCH', '/api/memo/5', { body: { rowStatus: 'NORMAL' } });
		expect(
			rows<MemoRow>(
				await call(projection, 'GET', '/api/memo', { search: '?rowStatus=NORMAL' }),
			)
				.map((row) => row.id)
				.includes(5),
		).toBe(true);
		expect(decode(await call(projection, 'DELETE', '/api/memo/4')).data).toBe(true);
		expect((await call(projection, 'DELETE', '/api/memo/4'))?.status).toBe(404);
		expect(
			(await call(projection, 'POST', '/api/memo', { body: { content: '  ' } }))?.status,
		).toBe(400);
	});

	it('derives the tag list from live memo content under the client tag rule', async () => {
		const projection = createMemosProjection();
		await signIn(projection);
		expect(memosTagsInContent('one #alpha and #beta here')).toEqual(['alpha', 'beta']);
		// The client's TAG_REG only closes a tag on a space, and the archived seed
		// memo is not live, so neither contributes.
		expect(memosTagsInContent('trailing #gamma')).toEqual([]);
		expect(rows<string>(await call(projection, 'GET', '/api/tag'))).toEqual([
			'evidence',
			'migration',
		]);
		await call(projection, 'POST', '/api/memo', {
			body: { content: 'A new #lane opened here.' },
		});
		expect(rows<string>(await call(projection, 'GET', '/api/tag'))).toEqual([
			'evidence',
			'lane',
			'migration',
		]);
		await call(projection, 'PATCH', '/api/memo/5', { body: { rowStatus: 'ARCHIVED' } });
		expect(rows<string>(await call(projection, 'GET', '/api/tag'))).toEqual([
			'evidence',
			'migration',
		]);
	});

	it('serves the shortcut family the sidebar reaches', async () => {
		const projection = createMemosProjection();
		await signIn(projection);
		const seeded = rows<ShortcutRow>(await call(projection, 'GET', '/api/shortcut'));
		expect(seeded.map((row) => row.title)).toEqual(['Migration', 'Evidence']);
		const created = decode(
			await call(projection, 'POST', '/api/shortcut', {
				body: { title: 'Lane', payload: '[]' },
			}),
		).data as ShortcutRow;
		expect(created.id).toBe(3);
		expect(created.rowStatus).toBe('NORMAL');
		expect(
			(
				decode(
					await call(projection, 'PATCH', '/api/shortcut/3', {
						body: { rowStatus: 'ARCHIVED', title: 'Lane pinned' },
					}),
				).data as ShortcutRow
			).title,
		).toBe('Lane pinned');
		expect(decode(await call(projection, 'DELETE', '/api/shortcut/3')).data).toBe(true);
		expect((await call(projection, 'PATCH', '/api/shortcut/3', { body: {} }))?.status).toBe(
			404,
		);
		expect(
			(await call(projection, 'POST', '/api/shortcut', { body: { title: 'no payload' } }))
				?.status,
		).toBe(400);
	});

	it('serves the account-settings family and the member list', async () => {
		const projection = createMemosProjection();
		await signIn(projection);
		const renamed = decode(
			await call(projection, 'PATCH', '/api/user/me', { body: { name: 'Evidence owner' } }),
		).data as UserRow;
		expect(renamed.name).toBe('Evidence owner');
		const reset = decode(
			await call(projection, 'PATCH', '/api/user/me', { body: { resetOpenId: true } }),
		).data as UserRow;
		expect(reset.openId).not.toBe(MEMOS_SEED.users[0]!.openId);
		// A password change is honoured by the very next sign-in.
		await call(projection, 'PATCH', '/api/user/me', {
			body: { password: 'synthetic-rotated' },
		});
		await call(projection, 'POST', '/api/auth/logout');
		expect(
			(
				await call(projection, 'POST', '/api/auth/login', {
					body: { email: OWNER_EMAIL, password: MEMOS_OWNER_PASSWORD },
				})
			)?.status,
		).toBe(401);
		expect(
			(
				await call(projection, 'POST', '/api/auth/login', {
					body: { email: OWNER_EMAIL, password: 'synthetic-rotated' },
				})
			)?.status,
		).toBe(200);
		const member = decode(
			await call(projection, 'POST', '/api/user', {
				body: {
					email: 'member@versionless-evidence.invalid',
					password: 'synthetic-member-passphrase',
					name: 'member',
					role: 'USER',
				},
			}),
		).data as UserRow;
		expect(member.role).toBe('USER');
		expect(
			rows<UserRow>(await call(projection, 'GET', '/api/user')).map((row) => row.id),
		).toEqual([1, 2]);
	});

	it('ledgers every transport decision with request and response digests', async () => {
		const projection = createMemosProjection();
		await signIn(projection);
		await call(projection, 'GET', '/api/memo', { search: '?rowStatus=ARCHIVED' });
		const ledger = projection.ledger();
		expect(ledger.map((entry) => entry.sequence)).toEqual([1, 2]);
		expect(ledger[0]).toMatchObject({
			method: 'POST',
			pathname: '/api/auth/login',
			endpoint: 'auth.login',
			decision: 'served',
			status: 200,
		});
		expect(ledger[1]).toMatchObject({
			search: '?rowStatus=ARCHIVED',
			endpoint: 'memo.list',
			authenticated: true,
		});
		expect(ledger.every((entry) => /^[0-9a-f]{64}$/.test(entry.requestSha256))).toBe(true);
		expect(ledger.every((entry) => /^[0-9a-f]{64}$/.test(entry.responseSha256 ?? ''))).toBe(
			true,
		);
		// The ledger is a copy: a caller cannot edit the projection's record.
		ledger[0]!.status = 999;
		expect(projection.ledger()[0]!.status).toBe(200);
	});

	it('replays the frozen transcript identically twice and matches the frozen digest', async () => {
		const first = await replayMemosProjectionBehavior();
		const second = await replayMemosProjectionBehavior();
		expect(first.digest).toBe(second.digest);
		expect(first.steps).toEqual(second.steps);
		expect(first.ledger).toEqual(second.ledger);
		expect(first.digest).toBe(MEMOS_PROJECTION_BEHAVIOR_DIGEST);
		// The transcript really exercises every projected endpoint plus both refusals.
		const endpoints = new Set(
			first.ledger.map((entry) => entry.endpoint).filter((entry) => entry !== null),
		);
		for (const endpoint of MEMOS_PROJECTED_ENDPOINTS)
			expect(endpoints.has(endpoint)).toBe(true);
		const decisions = new Set(first.ledger.map((entry) => entry.decision));
		expect([...decisions].sort()).toEqual([
			'declined-non-api',
			'refused-unknown',
			'refused-unprojected',
			'served',
		]);
	});

	it('never mutates the frozen seed, and hands every reader its own copy', async () => {
		const projection = createMemosProjection();
		await signIn(projection);
		await call(projection, 'POST', '/api/memo', {
			body: { content: 'mutation probe #lane .' },
		});
		await call(projection, 'PATCH', '/api/user/me', { body: { name: 'mutated' } });
		await call(projection, 'DELETE', '/api/memo/1');
		expect(MEMOS_SEED.memos).toHaveLength(4);
		expect(MEMOS_SEED.users[0]!.name).toBe(MEMOS_SEED.users[0]!.email);
		const fresh = createMemosProjection();
		await signIn(fresh);
		expect(rows<MemoRow>(await call(fresh, 'GET', '/api/memo'))).toHaveLength(4);
		const handed = fresh.memos();
		handed[0]!.content = 'edited outside the projection';
		expect(fresh.memos()[0]!.content).not.toBe('edited outside the projection');
	});
});
