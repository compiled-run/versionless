import { describe, expect, it } from 'vitest';
import {
	createPapercupsProjection,
	PAPERCUPS_ACCOUNT,
	PAPERCUPS_CONVERSATIONS,
	PAPERCUPS_NOTIFICATION_TOPIC,
	PAPERCUPS_SESSION,
	PAPERCUPS_USER,
	type PapercupsApiResponse,
} from '../src/witness/papercups-projection.ts';

type Envelope = { data: unknown };
type ConversationRow = {
	id: string;
	status: string;
	priority: string;
	assignee_id: number | null;
	messages: Array<{ body: string; created_at: string; user_id?: number }>;
};

function decode(response: PapercupsApiResponse | null): Envelope {
	if (response === null) throw new Error('projection declined the path');
	return JSON.parse(response.body.toString('utf8')) as Envelope;
}

async function get(
	projection: ReturnType<typeof createPapercupsProjection>,
	pathname: string,
	search = '',
): Promise<PapercupsApiResponse | null> {
	return await projection.api({ method: 'GET', pathname, search, body: Buffer.alloc(0) });
}

function ids(response: PapercupsApiResponse | null): string[] {
	return (decode(response).data as ConversationRow[]).map((row) => row.id);
}

describe('synthetic Papercups API projection', () => {
	it('declines non-API paths and fails closed on unknown API paths', async () => {
		const projection = createPapercupsProjection();
		expect(await get(projection, '/index.html')).toBeNull();
		const unknown = await get(projection, '/api/slack/authorization');
		expect(unknown?.status).toBe(404);
		expect(JSON.stringify(decode(unknown))).toContain('refuses unknown path');
		const unknownConversation = await get(projection, '/api/conversations/missing');
		expect(unknownConversation?.status).toBe(404);
	});

	it('serves the sign-in surface the retained client calls', async () => {
		const projection = createPapercupsProjection();
		const session = await projection.api({
			method: 'POST',
			pathname: '/api/session',
			search: '',
			body: Buffer.from(
				JSON.stringify({ user: { email: 'agent@example.test', password: 'secret' } }),
			),
		});
		expect(session?.contentType).toBe('application/json');
		expect(decode(session).data).toEqual(PAPERCUPS_SESSION);
		expect(decode(await get(projection, '/api/me')).data).toEqual(PAPERCUPS_USER);
		expect(decode(await get(projection, '/api/accounts/me')).data).toEqual(PAPERCUPS_ACCOUNT);
		expect(decode(await get(projection, '/api/messages/count')).data).toEqual({
			count: PAPERCUPS_CONVERSATIONS.length,
		});
		expect(
			decode(
				await projection.api({
					method: 'DELETE',
					pathname: '/api/session',
					search: '',
					body: Buffer.alloc(0),
				}),
			),
		).toEqual({ ok: true });
	});

	it('disambiguates the conversation inbox by query string', async () => {
		const projection = createPapercupsProjection();
		expect(ids(await get(projection, '/api/conversations', '?status=open'))).toEqual([
			'conversation-unassigned',
			'conversation-assigned',
			'conversation-priority',
		]);
		expect(
			ids(
				await get(
					projection,
					'/api/conversations',
					`?assignee_id=${PAPERCUPS_USER.id}&status=open`,
				),
			),
		).toEqual(['conversation-assigned']);
		expect(
			ids(await get(projection, '/api/conversations', '?priority=priority&status=open')),
		).toEqual(['conversation-priority']);
		expect(ids(await get(projection, '/api/conversations', '?status=closed'))).toEqual([
			'conversation-closed',
		]);
		expect(ids(await get(projection, '/api/conversations'))).toHaveLength(
			PAPERCUPS_CONVERSATIONS.length,
		);
	});

	it('carries distinct visible messages for every inbox category', async () => {
		const projection = createPapercupsProjection();
		const previews = PAPERCUPS_CONVERSATIONS.map(
			(conversation) => projection.messages(conversation.id).at(-1)?.body ?? '',
		);
		expect(new Set(previews).size).toBe(PAPERCUPS_CONVERSATIONS.length);
		expect(previews.every((preview) => preview.length > 0)).toBe(true);
		const detail = decode(await get(projection, '/api/conversations/conversation-priority'));
		expect((detail.data as ConversationRow).messages).toHaveLength(1);
	});

	it('applies a conversation update from the request body', async () => {
		const projection = createPapercupsProjection();
		const updated = await projection.api({
			method: 'PUT',
			pathname: '/api/conversations/conversation-priority',
			search: '',
			body: Buffer.from(JSON.stringify({ conversation: { status: 'closed', read: true } })),
		});
		expect((decode(updated).data as ConversationRow).status).toBe('closed');
		expect(ids(await get(projection, '/api/conversations', '?status=closed'))).toEqual([
			'conversation-priority',
			'conversation-closed',
		]);
		expect(
			ids(await get(projection, '/api/conversations', '?priority=priority&status=open')),
		).toEqual([]);
	});

	it('round-trips a reply through the channel projection into the API projection', () => {
		const projection = createPapercupsProjection();
		expect(projection.channel.join(PAPERCUPS_NOTIFICATION_TOPIC, {}).status).toBe('ok');
		expect(projection.channel.join('presence:other', {}).status).toBe('error');
		const reply = projection.channel.event(PAPERCUPS_NOTIFICATION_TOPIC, 'shout', {
			body: 'Acknowledged — the migration receipt is attached.',
			user_id: PAPERCUPS_USER.id,
			conversation_id: 'conversation-assigned',
			account_id: PAPERCUPS_ACCOUNT.id,
			sender: 'agent',
		});
		expect(reply.status).toBe('ok');
		expect(reply.broadcasts?.[0]?.event).toBe('shout');
		expect(reply.broadcasts?.[0]?.payload).toMatchObject({
			body: 'Acknowledged — the migration receipt is attached.',
			conversation_id: 'conversation-assigned',
			user: { id: PAPERCUPS_USER.id },
		});
		const messages = projection.messages('conversation-assigned');
		expect(messages).toHaveLength(2);
		expect(messages[1]!.user_id).toBe(PAPERCUPS_USER.id);
		expect(projection.replies()).toHaveLength(1);
		expect(
			projection.conversations('?status=open').find((row) => row.id === 'conversation-assigned')
				?.messages,
		).toHaveLength(2);
	});

	it('keeps reply timestamps deterministic and refuses unusable channel pushes', () => {
		const first = createPapercupsProjection();
		const second = createPapercupsProjection();
		for (const projection of [first, second])
			for (const body of ['first reply', 'second reply'])
				projection.channel.event(PAPERCUPS_NOTIFICATION_TOPIC, 'shout', {
					body,
					user_id: PAPERCUPS_USER.id,
					conversation_id: 'conversation-unassigned',
				});
		expect(first.replies().map((reply) => reply.created_at)).toEqual(
			second.replies().map((reply) => reply.created_at),
		);
		expect(first.replies().map((reply) => reply.created_at)).toEqual([
			'2026-08-08T10:00:00.000Z',
			'2026-08-08T10:01:00.000Z',
		]);
		expect(
			first.channel.event(PAPERCUPS_NOTIFICATION_TOPIC, 'shout', {
				body: 'lost',
				conversation_id: 'conversation-missing',
			}).status,
		).toBe('error');
		expect(
			first.channel.event(PAPERCUPS_NOTIFICATION_TOPIC, 'unsupported', {}).status,
		).toBe('error');
		expect(
			first.channel.event(PAPERCUPS_NOTIFICATION_TOPIC, 'read', {
				conversation_id: 'conversation-unassigned',
			}).status,
		).toBe('ok');
		expect(
			first.channel.event(PAPERCUPS_NOTIFICATION_TOPIC, 'watch:many', { conversation_ids: [] })
				.status,
		).toBe('ok');
	});

	it('never mutates the frozen projection seed', () => {
		const projection = createPapercupsProjection();
		projection.channel.event(PAPERCUPS_NOTIFICATION_TOPIC, 'shout', {
			body: 'mutation probe',
			user_id: PAPERCUPS_USER.id,
			conversation_id: 'conversation-closed',
		});
		expect(PAPERCUPS_CONVERSATIONS.every((row) => row.messages.length === 1)).toBe(true);
		expect(createPapercupsProjection().messages('conversation-closed')).toHaveLength(1);
	});
});
