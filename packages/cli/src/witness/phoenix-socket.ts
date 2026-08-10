import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { parseQuery, parseURL } from 'ufo';
import type { WitnessSocketLedgerRecorder } from './socket-ledger.ts';
import {
	decodeWebSocketFrames,
	encodeWebSocketClose,
	encodeWebSocketFrame,
	encodeWebSocketText,
	WEBSOCKET_OPCODES,
	webSocketHandshakeResponse,
} from './websocket-frames.ts';

/**
 * Phoenix v2 socket stub for the bounded loopback witness server.
 *
 * The Phoenix JavaScript client (1.5.x) serializes every message as the JSON
 * array `[join_ref, ref, topic, event, payload]` and appends `vsn=2.0.0` to the
 * socket endpoint. This module implements exactly that wire shape plus the
 * lifecycle replies the client requires (`phx_join`, `heartbeat`, `phx_leave`),
 * and delegates application semantics to a channel projection.
 *
 * The stub is loopback-only by construction: it answers on the socket the HTTP
 * server already accepted and never dials out.
 */
export const PHOENIX_SERIALIZER_VSN = '2.0.0' as const;
export const PHOENIX_FRAME_MIME = 'application/vnd.phoenix.v2+json' as const;
export const PHOENIX_HANDSHAKE_MIME = 'application/http' as const;
export const PHOENIX_HEARTBEAT_TOPIC = 'phoenix' as const;

export type PhoenixFrame = {
	joinRef: string | null;
	ref: string | null;
	topic: string;
	event: string;
	payload: Record<string, unknown>;
};

export type PhoenixChannelReply = {
	status: 'ok' | 'error';
	response: Record<string, unknown>;
	broadcasts?: Array<{ event: string; payload: Record<string, unknown> }>;
};

export type PhoenixChannelProjection = {
	join(topic: string, payload: Record<string, unknown>): PhoenixChannelReply;
	event(topic: string, event: string, payload: Record<string, unknown>): PhoenixChannelReply;
};

function reference(value: unknown, label: string): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string') throw new Error(`Phoenix frame ${label} must be a string or null`);
	return value;
}

export function encodePhoenixFrame(frame: PhoenixFrame): string {
	return JSON.stringify([frame.joinRef, frame.ref, frame.topic, frame.event, frame.payload]);
}

export function decodePhoenixFrame(text: string): PhoenixFrame {
	const parsed = JSON.parse(text) as unknown;
	if (!Array.isArray(parsed) || parsed.length !== 5)
		throw new Error('Phoenix v2 frame must be a five element array');
	const [joinRef, ref, topic, event, payload] = parsed as unknown[];
	if (typeof topic !== 'string' || topic.length === 0)
		throw new Error('Phoenix frame topic must be a non-empty string');
	if (typeof event !== 'string' || event.length === 0)
		throw new Error('Phoenix frame event must be a non-empty string');
	if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
		throw new Error('Phoenix frame payload must be an object');
	return {
		joinRef: reference(joinRef, 'join_ref'),
		ref: reference(ref, 'ref'),
		topic,
		event,
		payload: payload as Record<string, unknown>,
	};
}

export function phoenixReplyFrame(frame: PhoenixFrame, reply: PhoenixChannelReply): PhoenixFrame {
	return {
		joinRef: frame.joinRef,
		ref: frame.ref,
		topic: frame.topic,
		event: 'phx_reply',
		payload: { status: reply.status, response: reply.response },
	};
}

/**
 * Frames the stub serves in answer to one client frame: always the `phx_reply`
 * for the client's ref, followed by any channel broadcast the projection asked
 * for (for example the `shout` echo that makes a sent reply visible).
 */
export function phoenixServedFrames(
	frame: PhoenixFrame,
	projection: PhoenixChannelProjection,
): PhoenixFrame[] {
	if (frame.event === 'heartbeat' && frame.topic === PHOENIX_HEARTBEAT_TOPIC)
		return [phoenixReplyFrame(frame, { status: 'ok', response: {} })];
	const reply: PhoenixChannelReply =
		frame.event === 'phx_join'
			? projection.join(frame.topic, frame.payload)
			: frame.event === 'phx_leave'
				? { status: 'ok', response: {} }
				: projection.event(frame.topic, frame.event, frame.payload);
	return [
		phoenixReplyFrame(frame, reply),
		...(reply.broadcasts ?? []).map((broadcast) => ({
			joinRef: frame.joinRef,
			ref: null,
			topic: frame.topic,
			event: broadcast.event,
			payload: broadcast.payload,
		})),
	];
}

export type PhoenixSocketUpgrade = (
	request: IncomingMessage,
	socket: Duplex,
	head: Buffer,
	record: WitnessSocketLedgerRecorder,
) => void;

function headerValue(request: IncomingMessage, name: string): string {
	const value = request.headers[name];
	if (typeof value === 'string') return value;
	return Array.isArray(value) ? (value[0] ?? '') : '';
}

function refuse(socket: Duplex, status: number, reason: string): void {
	socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
}

export function createPhoenixSocketUpgrade(options: {
	pathname: string;
	projection: PhoenixChannelProjection;
	failure?: (message: string) => void;
}): PhoenixSocketUpgrade {
	return (request, socket, head, record) => {
		const parsed = parseURL(request.url ?? '/');
		const pathname = parsed.pathname || '/';
		const query = parsed.search ?? '';
		if (pathname !== options.pathname) {
			refuse(socket, 404, 'Not Found');
			return;
		}
		const key = headerValue(request, 'sec-websocket-key');
		if (
			headerValue(request, 'upgrade').toLowerCase() !== 'websocket' ||
			headerValue(request, 'sec-websocket-version') !== '13' ||
			key.length === 0
		) {
			refuse(socket, 400, 'Bad Request');
			return;
		}
		if (parseQuery(query).vsn !== PHOENIX_SERIALIZER_VSN) {
			refuse(socket, 400, 'Bad Request');
			return;
		}
		const handshake = webSocketHandshakeResponse(key);
		if ('setNoDelay' in socket && typeof socket.setNoDelay === 'function')
			socket.setNoDelay(true);
		socket.write(handshake);
		record({
			method: request.method ?? 'GET',
			pathname,
			query,
			status: 101,
			mime: PHOENIX_HANDSHAKE_MIME,
			body: handshake,
			socket: {
				direction: 'served',
				kind: 'handshake',
				topic: '',
				event: 'websocket:handshake',
				ref: null,
				joinRef: null,
			},
		});
		const serve = (frame: PhoenixFrame): void => {
			const text = encodePhoenixFrame(frame);
			socket.write(encodeWebSocketText(text));
			record({
				method: 'WS',
				pathname,
				query,
				status: 101,
				mime: PHOENIX_FRAME_MIME,
				body: Buffer.from(text, 'utf8'),
				socket: {
					direction: 'served',
					kind: 'frame',
					topic: frame.topic,
					event: frame.event,
					ref: frame.ref,
					joinRef: frame.joinRef,
				},
			});
		};
		const fail = (message: string): void => {
			options.failure?.(message);
			socket.write(encodeWebSocketClose(1002, 'protocol error'));
			socket.destroy();
		};
		let pending: Buffer = Buffer.alloc(0);
		const consume = (chunk: Buffer): void => {
			pending = Buffer.concat([pending, chunk]);
			const scan = decodeWebSocketFrames(pending);
			pending = scan.rest;
			for (const frame of scan.frames) {
				if (frame.opcode === WEBSOCKET_OPCODES.close) {
					socket.end(encodeWebSocketClose(1000, 'closed'));
					return;
				}
				if (frame.opcode === WEBSOCKET_OPCODES.ping) {
					socket.write(encodeWebSocketFrame(WEBSOCKET_OPCODES.pong, frame.payload));
					continue;
				}
				if (frame.opcode === WEBSOCKET_OPCODES.pong) continue;
				if (frame.opcode !== WEBSOCKET_OPCODES.text)
					throw new Error('Phoenix v2 socket stub accepts text frames only');
				for (const served of phoenixServedFrames(
					decodePhoenixFrame(frame.payload.toString('utf8')),
					options.projection,
				))
					serve(served);
			}
		};
		socket.on('data', (chunk: Buffer) => {
			try {
				consume(chunk);
			} catch (error: unknown) {
				fail(error instanceof Error ? error.message : String(error));
			}
		});
		socket.on('error', (error: Error) => {
			options.failure?.(error.message);
			socket.destroy();
		});
		if (head.length > 0)
			try {
				consume(Buffer.from(head));
			} catch (error: unknown) {
				fail(error instanceof Error ? error.message : String(error));
			}
	};
}
