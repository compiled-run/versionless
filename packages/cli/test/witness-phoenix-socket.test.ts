import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import os from 'node:os';
import * as path from 'pathe';
import { joinURL, parseURL, withQuery } from 'ufo';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	createPapercupsProjection,
	PAPERCUPS_NOTIFICATION_TOPIC,
	PAPERCUPS_SOCKET_PATH,
	PAPERCUPS_USER,
} from '../src/witness/papercups-projection.ts';
import {
	createPhoenixSocketUpgrade,
	decodePhoenixFrame,
	encodePhoenixFrame,
	PHOENIX_FRAME_MIME,
	PHOENIX_SERIALIZER_VSN,
	phoenixServedFrames,
	type PhoenixChannelProjection,
	type PhoenixFrame,
} from '../src/witness/phoenix-socket.ts';
import { startStaticServer } from '../src/witness/real-app-run.ts';

const projection = createPapercupsProjection();
let staticRoot = '';
let server: Awaited<ReturnType<typeof startStaticServer>> | null = null;
const failures: string[] = [];

function frame(overrides: Partial<PhoenixFrame> = {}): PhoenixFrame {
	return {
		joinRef: '1',
		ref: '1',
		topic: PAPERCUPS_NOTIFICATION_TOPIC,
		event: 'phx_join',
		payload: {},
		...overrides,
	};
}

function socketUrl(): string {
	return withQuery(joinURL(server!.origin.replace('http://', 'ws://'), PAPERCUPS_SOCKET_PATH), {
		vsn: PHOENIX_SERIALIZER_VSN,
	});
}

async function exchange(pushes: PhoenixFrame[], expected: number): Promise<PhoenixFrame[]> {
	const socket = new WebSocket(socketUrl());
	const received: PhoenixFrame[] = [];
	return await new Promise<PhoenixFrame[]>((resolvePromise, reject) => {
		const timer = setTimeout(() => {
			socket.close();
			reject(new Error(`Phoenix stub returned ${received.length} of ${expected} frames`));
		}, 10_000);
		socket.addEventListener('error', () => {
			clearTimeout(timer);
			reject(new Error('Phoenix stub socket errored'));
		});
		socket.addEventListener('open', () => {
			for (const push of pushes) socket.send(encodePhoenixFrame(push));
		});
		socket.addEventListener('message', (event: MessageEvent) => {
			received.push(decodePhoenixFrame(String(event.data)));
			if (received.length < expected) return;
			clearTimeout(timer);
			socket.close();
			resolvePromise(received);
		});
	});
}

async function upgradeStatus(target: string, options: { key?: string } = {}): Promise<string> {
	const host = parseURL(server!.origin).host ?? '127.0.0.1';
	const [hostname, port] = host.split(':');
	const client = connect({ host: hostname ?? '127.0.0.1', port: Number(port) });
	const key = options.key ?? 'AAAAAAAAAAAAAAAAAAAAAA==';
	return await new Promise<string>((resolvePromise, reject) => {
		client.on('error', reject);
		client.on('connect', () =>
			client.write(
				[
					`GET ${target} HTTP/1.1`,
					`Host: ${host}`,
					'Connection: Upgrade',
					'Upgrade: websocket',
					...(key.length === 0 ? [] : [`Sec-WebSocket-Key: ${key}`]),
					'Sec-WebSocket-Version: 13',
					'',
					'',
				].join('\r\n'),
			),
		);
		client.on('data', (chunk: Buffer) => {
			client.destroy();
			resolvePromise(chunk.toString('utf8').split('\r\n')[0] ?? '');
		});
	});
}

beforeAll(async () => {
	staticRoot = await mkdtemp(path.join(os.tmpdir(), 'versionless-phoenix-'));
	await writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>papercups</title>');
	server = await startStaticServer(staticRoot, {
		api: projection.api,
		upgrade: createPhoenixSocketUpgrade({
			pathname: PAPERCUPS_SOCKET_PATH,
			projection: projection.channel,
			failure: (message) => failures.push(message),
		}),
	});
});

afterAll(async () => {
	await server?.close();
	if (staticRoot.length > 0) await rm(staticRoot, { recursive: true, force: true });
});

describe('Phoenix v2 frame codec', () => {
	it('round-trips the five element serializer array', () => {
		const original = frame({ event: 'shout', payload: { body: 'hello', count: 2 } });
		expect(encodePhoenixFrame(original)).toBe(
			`["1","1","${PAPERCUPS_NOTIFICATION_TOPIC}","shout",{"body":"hello","count":2}]`,
		);
		expect(decodePhoenixFrame(encodePhoenixFrame(original))).toEqual(original);
		const heartbeat = frame({ joinRef: null, topic: 'phoenix', event: 'heartbeat' });
		expect(decodePhoenixFrame(encodePhoenixFrame(heartbeat))).toEqual(heartbeat);
	});

	it('refuses frames that are not the Phoenix v2 wire shape', () => {
		expect(() => decodePhoenixFrame('["1","1","topic","event"]')).toThrow('five element');
		expect(() => decodePhoenixFrame('["1","1","","event",{}]')).toThrow('topic');
		expect(() => decodePhoenixFrame('["1","1","topic","",{}]')).toThrow('event');
		expect(() => decodePhoenixFrame('["1","1","topic","event",[]]')).toThrow('payload');
		expect(() => decodePhoenixFrame('["1",7,"topic","event",{}]')).toThrow('ref');
	});
});

describe('Phoenix v2 channel replies', () => {
	const stub: PhoenixChannelProjection = {
		join: () => ({ status: 'ok', response: { joined: true } }),
		event: (_topic, event) =>
			event === 'shout'
				? {
						status: 'ok',
						response: {},
						broadcasts: [{ event: 'shout', payload: { body: 'echo' } }],
					}
				: { status: 'error', response: { reason: 'unsupported' } },
	};

	it('replies ok to phx_join, heartbeat and phx_leave on the pushed ref', () => {
		expect(phoenixServedFrames(frame({ ref: '7' }), stub)).toEqual([
			{
				joinRef: '1',
				ref: '7',
				topic: PAPERCUPS_NOTIFICATION_TOPIC,
				event: 'phx_reply',
				payload: { status: 'ok', response: { joined: true } },
			},
		]);
		const heartbeat = phoenixServedFrames(
			frame({ joinRef: null, ref: '9', topic: 'phoenix', event: 'heartbeat' }),
			stub,
		);
		expect(heartbeat).toEqual([
			{
				joinRef: null,
				ref: '9',
				topic: 'phoenix',
				event: 'phx_reply',
				payload: { status: 'ok', response: {} },
			},
		]);
		expect(phoenixServedFrames(frame({ event: 'phx_leave' }), stub)[0]!.payload).toEqual({
			status: 'ok',
			response: {},
		});
	});

	it('follows a push reply with the channel broadcast it produced', () => {
		const served = phoenixServedFrames(frame({ ref: '3', event: 'shout' }), stub);
		expect(served.map((item) => item.event)).toEqual(['phx_reply', 'shout']);
		expect(served[1]).toEqual({
			joinRef: '1',
			ref: null,
			topic: PAPERCUPS_NOTIFICATION_TOPIC,
			event: 'shout',
			payload: { body: 'echo' },
		});
		expect(phoenixServedFrames(frame({ event: 'unknown' }), stub)[0]!.payload).toEqual({
			status: 'error',
			response: { reason: 'unsupported' },
		});
	});
});

describe('Phoenix v2 socket stub over the bounded loopback upgrade seam', () => {
	it('completes the handshake, answers join and heartbeat, and echoes a reply', async () => {
		const served = await exchange(
			[
				frame({ ref: '1', payload: { ids: ['conversation-assigned'] } }),
				frame({ joinRef: null, ref: '2', topic: 'phoenix', event: 'heartbeat' }),
				frame({
					ref: '3',
					event: 'shout',
					payload: {
						body: 'Replying from the witness journey.',
						user_id: PAPERCUPS_USER.id,
						conversation_id: 'conversation-assigned',
						account_id: 'account-versionless-evidence',
						sender: 'agent',
					},
				}),
			],
			4,
		);
		expect(served.map((item) => `${item.event}:${item.ref ?? ''}`)).toEqual([
			'phx_reply:1',
			'phx_reply:2',
			'phx_reply:3',
			'shout:',
		]);
		for (const reply of served.slice(0, 3))
			expect((reply.payload as { status: string }).status).toBe('ok');
		expect(served[3]!.payload).toMatchObject({
			body: 'Replying from the witness journey.',
			conversation_id: 'conversation-assigned',
			user_id: PAPERCUPS_USER.id,
			user: { id: PAPERCUPS_USER.id, email: PAPERCUPS_USER.email },
		});
		expect(projection.messages('conversation-assigned').at(-1)?.body).toBe(
			'Replying from the witness journey.',
		);
		expect(failures).toEqual([]);
		server!.assertClean();
	});

	it('records the handshake and every served frame in the response ledger', () => {
		const socketEntries = server!.ledger().filter((entry) => entry.socket !== undefined);
		expect(socketEntries[0]).toMatchObject({
			method: 'GET',
			pathname: PAPERCUPS_SOCKET_PATH,
			query: `?vsn=${PHOENIX_SERIALIZER_VSN}`,
			destination: 'websocket',
			resolvedFile: null,
			status: 101,
			socket: { direction: 'served', kind: 'handshake', event: 'websocket:handshake' },
		});
		const frames = socketEntries.filter((entry) => entry.socket?.kind === 'frame');
		expect(frames).toHaveLength(4);
		expect(frames.map((entry) => entry.socket?.event)).toEqual([
			'phx_reply',
			'phx_reply',
			'phx_reply',
			'shout',
		]);
		for (const entry of frames) {
			expect(entry.mime).toBe(PHOENIX_FRAME_MIME);
			expect(entry.method).toBe('WS');
			expect(entry.bytes).toBeGreaterThan(0);
			expect(entry.sha256).toHaveLength(64);
		}
		expect(new Set(frames.map((entry) => entry.sha256)).size).toBe(4);
	});

	it('refuses an unknown socket path, a bad handshake and an unsupported version', async () => {
		expect(await upgradeStatus('/socket/longpoll?vsn=2.0.0')).toBe('HTTP/1.1 404 Not Found');
		expect(await upgradeStatus(`${PAPERCUPS_SOCKET_PATH}?vsn=1.0.0`)).toBe(
			'HTTP/1.1 400 Bad Request',
		);
		expect(await upgradeStatus(`${PAPERCUPS_SOCKET_PATH}?vsn=2.0.0`, { key: '' })).toBe(
			'HTTP/1.1 400 Bad Request',
		);
		expect(server!.ledger().some((entry) => entry.status === 404)).toBe(false);
		expect(failures).toEqual([]);
		server!.assertClean();
	});
});
