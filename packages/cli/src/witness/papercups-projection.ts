import { parseQuery } from 'ufo';
import type { PhoenixChannelProjection, PhoenixChannelReply } from './phoenix-socket.ts';

/**
 * Frozen synthetic Papercups API projection.
 *
 * Every record below is evidence data authored for this fixture. It is not a
 * captured production payload, it carries no real customer, and it is served
 * only over the bounded loopback origin so the retained Papercups build can
 * sign in, triage its inbox categories and complete one reply round-trip
 * without any network. The projection never fabricates application behavior:
 * it answers the routes the retained client actually calls and records the
 * reply the user genuinely sent.
 */
export const PAPERCUPS_PROJECTION_LABEL = 'synthetic-fixture-evidence-data' as const;
export const PAPERCUPS_SOCKET_PATH = '/socket/websocket' as const;

export type PapercupsUser = { id: number; email: string };
export type PapercupsMessage = {
	body: string;
	created_at: string;
	conversation_id: string;
	account_id: string;
	customer_id?: string;
	user_id?: number;
	user?: PapercupsUser;
};
export type PapercupsConversation = {
	id: string;
	account_id: string;
	created_at: string;
	status: 'open' | 'closed';
	priority: 'priority' | 'not_priority';
	read: boolean;
	assignee_id: number | null;
	customer_id: string;
	customer: { name: string; email: string };
	messages: PapercupsMessage[];
};

export const PAPERCUPS_USER: PapercupsUser = Object.freeze({
	id: 1,
	email: 'agent@versionless-evidence.invalid',
});
export const PAPERCUPS_ACCOUNT = Object.freeze({
	id: 'account-versionless-evidence',
	company_name: 'Versionless Evidence (synthetic)',
});
export const PAPERCUPS_SESSION = Object.freeze({
	token: 'synthetic-access-token',
	renew_token: 'synthetic-renew-token',
});

const message = (
	conversationId: string,
	customerId: string,
	body: string,
	createdAt: string,
): PapercupsMessage => ({
	body,
	created_at: createdAt,
	conversation_id: conversationId,
	account_id: PAPERCUPS_ACCOUNT.id,
	customer_id: customerId,
});

export const PAPERCUPS_CONVERSATIONS: readonly PapercupsConversation[] = Object.freeze([
	{
		id: 'conversation-unassigned',
		account_id: PAPERCUPS_ACCOUNT.id,
		created_at: '2026-08-08T09:00:00.000Z',
		status: 'open',
		priority: 'not_priority',
		read: false,
		assignee_id: null,
		customer_id: 'customer-unassigned',
		customer: { name: 'Unassigned Reporter', email: 'unassigned@versionless-evidence.invalid' },
		messages: [
			message(
				'conversation-unassigned',
				'customer-unassigned',
				'The retained baseline build cannot export the audit ledger.',
				'2026-08-08T09:00:00.000Z',
			),
		],
	},
	{
		id: 'conversation-assigned',
		account_id: PAPERCUPS_ACCOUNT.id,
		created_at: '2026-08-08T09:05:00.000Z',
		status: 'open',
		priority: 'not_priority',
		read: false,
		assignee_id: PAPERCUPS_USER.id,
		customer_id: 'customer-assigned',
		customer: { name: 'Assigned Reporter', email: 'assigned@versionless-evidence.invalid' },
		messages: [
			message(
				'conversation-assigned',
				'customer-assigned',
				'The migrated lane still needs a receipt for the widget embed.',
				'2026-08-08T09:05:00.000Z',
			),
		],
	},
	{
		id: 'conversation-priority',
		account_id: PAPERCUPS_ACCOUNT.id,
		created_at: '2026-08-08T09:10:00.000Z',
		status: 'open',
		priority: 'priority',
		read: false,
		assignee_id: null,
		customer_id: 'customer-priority',
		customer: { name: 'Priority Reporter', email: 'priority@versionless-evidence.invalid' },
		messages: [
			message(
				'conversation-priority',
				'customer-priority',
				'The pinned production inbox is stuck behind the offline mirror.',
				'2026-08-08T09:10:00.000Z',
			),
		],
	},
	{
		id: 'conversation-closed',
		account_id: PAPERCUPS_ACCOUNT.id,
		created_at: '2026-08-08T09:15:00.000Z',
		status: 'closed',
		priority: 'not_priority',
		read: true,
		assignee_id: PAPERCUPS_USER.id,
		customer_id: 'customer-closed',
		customer: { name: 'Closed Reporter', email: 'closed@versionless-evidence.invalid' },
		messages: [
			message(
				'conversation-closed',
				'customer-closed',
				'Resolved: the dependency closure rebuilt byte identically.',
				'2026-08-08T09:15:00.000Z',
			),
		],
	},
]);

export const PAPERCUPS_NOTIFICATION_TOPIC = `notification:${PAPERCUPS_ACCOUNT.id}` as const;
const REPLY_CLOCK_ORIGIN = Date.parse('2026-08-08T10:00:00.000Z');
const REPLY_CLOCK_STEP_MS = 60_000;

export type PapercupsApiRequest = {
	method: string;
	pathname: string;
	search: string;
	body: Buffer;
};
export type PapercupsApiResponse = { status: number; contentType: string; body: Buffer };

export type PapercupsProjection = {
	api(request: PapercupsApiRequest): Promise<PapercupsApiResponse | null>;
	channel: PhoenixChannelProjection;
	conversations(search: string): PapercupsConversation[];
	messages(conversationId: string): PapercupsMessage[];
	replies(): PapercupsMessage[];
};

function json(value: unknown, status = 200): PapercupsApiResponse {
	return {
		status,
		contentType: 'application/json',
		body: Buffer.from(JSON.stringify(value), 'utf8'),
	};
}

function envelope(data: unknown): PapercupsApiResponse {
	return json({ data });
}

function failClosed(pathname: string): PapercupsApiResponse {
	return json(
		{
			error: {
				status: 404,
				message: `Papercups synthetic projection refuses unknown path: ${pathname}`,
			},
		},
		404,
	);
}

function queryValue(query: Record<string, string | string[]>, key: string): string | null {
	const value = query[key];
	if (typeof value === 'string') return value;
	return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null;
}

function parsedBody(body: Buffer): Record<string, unknown> {
	if (body.length === 0) return {};
	const parsed = JSON.parse(body.toString('utf8')) as unknown;
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
		throw new Error('Papercups synthetic projection requires a JSON object body');
	return parsed as Record<string, unknown>;
}

export function createPapercupsProjection(): PapercupsProjection {
	const conversations: PapercupsConversation[] = PAPERCUPS_CONVERSATIONS.map((conversation) =>
		structuredClone(conversation),
	);
	const replies: PapercupsMessage[] = [];
	const byId = (id: string): PapercupsConversation | undefined =>
		conversations.find((conversation) => conversation.id === id);
	const filtered = (search: string): PapercupsConversation[] => {
		const query = parseQuery(search);
		const status = queryValue(query, 'status');
		const priority = queryValue(query, 'priority');
		const assignee = queryValue(query, 'assignee_id');
		return conversations.filter(
			(conversation) =>
				(status === null || conversation.status === status) &&
				(priority === null || conversation.priority === priority) &&
				(assignee === null || `${conversation.assignee_id ?? ''}` === assignee),
		);
	};
	const appendReply = (
		conversationId: string,
		body: string,
		userId: number,
	): PapercupsMessage | null => {
		const conversation = byId(conversationId);
		if (conversation === undefined || typeof body !== 'string' || body.trim().length === 0)
			return null;
		const reply: PapercupsMessage = {
			body,
			created_at: new Date(
				REPLY_CLOCK_ORIGIN + replies.length * REPLY_CLOCK_STEP_MS,
			).toISOString(),
			conversation_id: conversationId,
			account_id: PAPERCUPS_ACCOUNT.id,
			user_id: userId,
			user: { ...PAPERCUPS_USER },
		};
		conversation.messages.push(reply);
		conversation.read = true;
		replies.push(reply);
		return reply;
	};
	const updateConversation = (id: string, body: Buffer): PapercupsApiResponse => {
		const conversation = byId(id);
		if (conversation === undefined) return failClosed(`/api/conversations/${id}`);
		const updates = parsedBody(body).conversation;
		if (updates !== undefined && (updates === null || typeof updates !== 'object'))
			throw new Error('Papercups synthetic projection requires a conversation update object');
		const requested = (updates ?? {}) as Partial<PapercupsConversation>;
		if (requested.status === 'open' || requested.status === 'closed')
			conversation.status = requested.status;
		if (requested.priority === 'priority' || requested.priority === 'not_priority')
			conversation.priority = requested.priority;
		if (typeof requested.read === 'boolean') conversation.read = requested.read;
		if (typeof requested.assignee_id === 'number' || requested.assignee_id === null)
			conversation.assignee_id = requested.assignee_id;
		return envelope(conversation);
	};
	const api = async (request: PapercupsApiRequest): Promise<PapercupsApiResponse | null> => {
		if (!request.pathname.startsWith('/api/')) return null;
		if (request.pathname === '/api/session')
			return request.method === 'DELETE' ? json({ ok: true }) : envelope(PAPERCUPS_SESSION);
		if (request.pathname === '/api/session/renew') return envelope(PAPERCUPS_SESSION);
		if (request.pathname === '/api/me') return envelope(PAPERCUPS_USER);
		if (request.pathname === '/api/accounts/me') return envelope(PAPERCUPS_ACCOUNT);
		if (request.pathname === '/api/messages/count')
			return envelope({
				count: conversations.reduce(
					(total, conversation) => total + conversation.messages.length,
					0,
				),
			});
		if (request.pathname === '/api/conversations')
			return envelope(structuredClone(filtered(request.search)));
		if (request.pathname.startsWith('/api/conversations/')) {
			const id = request.pathname.slice('/api/conversations/'.length);
			if (id.length === 0 || id.includes('/')) return failClosed(request.pathname);
			if (request.method === 'GET') {
				const conversation = byId(id);
				return conversation === undefined
					? failClosed(request.pathname)
					: envelope(structuredClone(conversation));
			}
			return updateConversation(id, request.body);
		}
		return failClosed(request.pathname);
	};
	const channel: PhoenixChannelProjection = {
		join: (topic) =>
			topic === PAPERCUPS_NOTIFICATION_TOPIC || topic.startsWith('conversation:')
				? { status: 'ok', response: {} }
				: {
						status: 'error',
						response: { reason: `unsupported topic: ${topic}` },
					},
		event: (topic, event, payload): PhoenixChannelReply => {
			if (event === 'shout') {
				const conversationId = payload.conversation_id;
				const body = payload.body;
				const userId = payload.user_id;
				const reply =
					typeof conversationId === 'string' && typeof body === 'string'
						? appendReply(
								conversationId,
								body,
								typeof userId === 'number' ? userId : PAPERCUPS_USER.id,
							)
						: null;
				return reply === null
					? { status: 'error', response: { reason: 'unknown conversation' } }
					: {
							status: 'ok',
							response: {},
							broadcasts: [
								{
									event: 'shout',
									payload: { ...reply } as Record<string, unknown>,
								},
							],
						};
			}
			if (event === 'read') {
				const conversationId = payload.conversation_id;
				const conversation =
					typeof conversationId === 'string' ? byId(conversationId) : undefined;
				if (conversation === undefined)
					return { status: 'error', response: { reason: 'unknown conversation' } };
				conversation.read = true;
				return { status: 'ok', response: { conversation_id: conversation.id } };
			}
			if (event === 'watch:one' || event === 'watch:many')
				return { status: 'ok', response: {} };
			return {
				status: 'error',
				response: { reason: `unsupported event: ${topic} ${event}` },
			};
		},
	};
	return {
		api,
		channel,
		conversations: (search) => structuredClone(filtered(search)),
		messages: (conversationId) => structuredClone(byId(conversationId)?.messages ?? []),
		replies: () => structuredClone(replies),
	};
}
