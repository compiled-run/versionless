import { describe, expect, it } from 'vitest';
import {
	decodeWebSocketFrames,
	encodeWebSocketClose,
	encodeWebSocketFrame,
	encodeWebSocketText,
	WEBSOCKET_MAX_FRAME_BYTES,
	WEBSOCKET_OPCODES,
	webSocketAcceptKey,
	webSocketHandshakeResponse,
} from '../src/witness/websocket-frames.ts';

const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);

describe('bounded loopback WebSocket frame codec', () => {
	it('derives the RFC 6455 accept key and handshake response', () => {
		expect(webSocketAcceptKey('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
		expect(webSocketHandshakeResponse('dGhlIHNhbXBsZSBub25jZQ==').toString('utf8')).toBe(
			'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n\r\n',
		);
	});

	it('round-trips masked and unmasked text across short and extended lengths', () => {
		for (const text of ['a', 'x'.repeat(125), 'y'.repeat(126), 'z'.repeat(70_000)]) {
			const masked = decodeWebSocketFrames(encodeWebSocketText(text, { mask }));
			expect(masked.frames).toHaveLength(1);
			expect(masked.frames[0]!.opcode).toBe(WEBSOCKET_OPCODES.text);
			expect(masked.frames[0]!.payload.toString('utf8')).toBe(text);
			expect(masked.rest).toHaveLength(0);
			const plain = decodeWebSocketFrames(encodeWebSocketText(text));
			expect(plain.frames[0]!.payload.toString('utf8')).toBe(text);
		}
	});

	it('decodes several frames from one chunk and retains a partial tail', () => {
		const stream = Buffer.concat([
			encodeWebSocketText('first', { mask }),
			encodeWebSocketText('second', { mask }),
			encodeWebSocketText('third', { mask }).subarray(0, 4),
		]);
		const scan = decodeWebSocketFrames(stream);
		expect(scan.frames.map((frame) => frame.payload.toString('utf8'))).toEqual([
			'first',
			'second',
		]);
		expect(scan.rest).toHaveLength(4);
		const completed = decodeWebSocketFrames(
			Buffer.concat([scan.rest, encodeWebSocketText('third', { mask }).subarray(4)]),
		);
		expect(completed.frames[0]!.payload.toString('utf8')).toBe('third');
	});

	it('carries control opcodes and close payloads', () => {
		const close = decodeWebSocketFrames(encodeWebSocketClose(1000, 'closed'));
		expect(close.frames[0]!.opcode).toBe(WEBSOCKET_OPCODES.close);
		expect(close.frames[0]!.payload.readUInt16BE(0)).toBe(1000);
		expect(close.frames[0]!.payload.subarray(2).toString('utf8')).toBe('closed');
		const ping = decodeWebSocketFrames(
			encodeWebSocketFrame(WEBSOCKET_OPCODES.ping, Buffer.from('beat', 'utf8')),
		);
		expect(ping.frames[0]!.opcode).toBe(WEBSOCKET_OPCODES.ping);
	});

	it('refuses fragmentation, reserved bits, oversize payloads and bad masks', () => {
		const fragmented = encodeWebSocketText('partial');
		fragmented[0] = 0x01;
		expect(() => decodeWebSocketFrames(fragmented)).toThrow('fragmented');
		const reserved = encodeWebSocketText('reserved');
		reserved[0] = 0xc1;
		expect(() => decodeWebSocketFrames(reserved)).toThrow('reserved');
		const oversize = Buffer.alloc(10);
		oversize[0] = 0x81;
		oversize[1] = 127;
		oversize.writeBigUInt64BE(BigInt(WEBSOCKET_MAX_FRAME_BYTES + 1), 2);
		expect(() => decodeWebSocketFrames(oversize)).toThrow('ceiling');
		expect(() =>
			encodeWebSocketFrame(WEBSOCKET_OPCODES.text, Buffer.alloc(1), {
				mask: Buffer.alloc(3),
			}),
		).toThrow('four bytes');
		expect(() =>
			encodeWebSocketFrame(
				WEBSOCKET_OPCODES.text,
				Buffer.alloc(WEBSOCKET_MAX_FRAME_BYTES + 1),
			),
		).toThrow('ceiling');
	});
});
