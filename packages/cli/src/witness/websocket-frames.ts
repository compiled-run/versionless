import { createHash } from 'node:crypto';

/**
 * Minimal RFC 6455 frame codec for the bounded loopback witness server.
 *
 * The codec is deliberately narrow: it accepts only complete (FIN) frames, it
 * never negotiates extensions, and it refuses payloads above a fixed ceiling so
 * a malformed client cannot grow the harness heap. It performs no I/O.
 */
export const WEBSOCKET_ACCEPT_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11' as const;
export const WEBSOCKET_MAX_FRAME_BYTES = 1_048_576;
export const WEBSOCKET_OPCODES = {
	continuation: 0x0,
	text: 0x1,
	binary: 0x2,
	close: 0x8,
	ping: 0x9,
	pong: 0xa,
} as const;

export type WebSocketOpcode = (typeof WEBSOCKET_OPCODES)[keyof typeof WEBSOCKET_OPCODES];
export type WebSocketFrame = { opcode: number; payload: Buffer };
export type WebSocketFrameScan = { frames: WebSocketFrame[]; rest: Buffer };

export function webSocketAcceptKey(key: string): string {
	return createHash('sha1').update(`${key}${WEBSOCKET_ACCEPT_GUID}`).digest('base64');
}

export function webSocketHandshakeResponse(key: string): Buffer {
	return Buffer.from(
		[
			'HTTP/1.1 101 Switching Protocols',
			'Upgrade: websocket',
			'Connection: Upgrade',
			`Sec-WebSocket-Accept: ${webSocketAcceptKey(key)}`,
			'',
			'',
		].join('\r\n'),
		'utf8',
	);
}

export function encodeWebSocketFrame(
	opcode: number,
	payload: Buffer,
	options: { mask?: Buffer } = {},
): Buffer {
	if (payload.length > WEBSOCKET_MAX_FRAME_BYTES)
		throw new Error('WebSocket frame exceeds the bounded loopback payload ceiling');
	const mask = options.mask;
	if (mask !== undefined && mask.length !== 4)
		throw new Error('WebSocket mask key must be exactly four bytes');
	const extended = payload.length < 126 ? 0 : payload.length <= 0xffff ? 2 : 8;
	const header = Buffer.alloc(2 + extended + (mask === undefined ? 0 : 4));
	header[0] = 0x80 | opcode;
	header[1] =
		(mask === undefined ? 0 : 0x80) |
		(extended === 0 ? payload.length : extended === 2 ? 126 : 127);
	if (extended === 2) header.writeUInt16BE(payload.length, 2);
	if (extended === 8) header.writeBigUInt64BE(BigInt(payload.length), 2);
	if (mask === undefined) return Buffer.concat([header, payload]);
	mask.copy(header, 2 + extended);
	const masked = Buffer.from(payload);
	for (let index = 0; index < masked.length; index += 1)
		masked[index] = masked[index]! ^ mask[index % 4]!;
	return Buffer.concat([header, masked]);
}

export function encodeWebSocketText(text: string, options: { mask?: Buffer } = {}): Buffer {
	return encodeWebSocketFrame(WEBSOCKET_OPCODES.text, Buffer.from(text, 'utf8'), options);
}

export function encodeWebSocketClose(code: number, reason: string): Buffer {
	const reasonBytes = Buffer.from(reason, 'utf8');
	const payload = Buffer.alloc(2 + reasonBytes.length);
	payload.writeUInt16BE(code, 0);
	reasonBytes.copy(payload, 2);
	return encodeWebSocketFrame(WEBSOCKET_OPCODES.close, payload);
}

export function decodeWebSocketFrames(buffer: Buffer): WebSocketFrameScan {
	const frames: WebSocketFrame[] = [];
	let offset = 0;
	while (offset + 2 <= buffer.length) {
		const first = buffer[offset]!;
		const second = buffer[offset + 1]!;
		if ((first & 0x70) !== 0)
			throw new Error('WebSocket reserved bits are not supported by the witness stub');
		if ((first & 0x80) === 0)
			throw new Error('WebSocket fragmented frames are not supported by the witness stub');
		const opcode = first & 0x0f;
		const masked = (second & 0x80) !== 0;
		let length = second & 0x7f;
		let cursor = offset + 2;
		if (length === 126) {
			if (cursor + 2 > buffer.length) break;
			length = buffer.readUInt16BE(cursor);
			cursor += 2;
		} else if (length === 127) {
			if (cursor + 8 > buffer.length) break;
			const extended = buffer.readBigUInt64BE(cursor);
			if (extended > BigInt(WEBSOCKET_MAX_FRAME_BYTES))
				throw new Error('WebSocket frame exceeds the bounded loopback payload ceiling');
			length = Number(extended);
			cursor += 8;
		}
		if (length > WEBSOCKET_MAX_FRAME_BYTES)
			throw new Error('WebSocket frame exceeds the bounded loopback payload ceiling');
		if (masked && cursor + 4 > buffer.length) break;
		const mask = masked ? buffer.subarray(cursor, cursor + 4) : null;
		if (masked) cursor += 4;
		if (cursor + length > buffer.length) break;
		const payload = Buffer.from(buffer.subarray(cursor, cursor + length));
		if (mask !== null)
			for (let index = 0; index < payload.length; index += 1)
				payload[index] = payload[index]! ^ mask[index % 4]!;
		frames.push({ opcode, payload });
		offset = cursor + length;
	}
	return { frames, rest: Buffer.from(buffer.subarray(offset)) };
}
