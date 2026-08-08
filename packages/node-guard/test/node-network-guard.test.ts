import { spawn } from 'node:child_process';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';

describe('Node network guard', () => {
	test('packed CommonJS preload refuses non-loopback sockets', async () => {
		const guard = path.resolve('packages/node-guard/dist/index.cjs');
		const result = await new Promise<{ code: number | null; stderr: string }>((resolve) => {
			const child = spawn(
				process.execPath,
				[
					'-e',
					"require('net').connect(443, 'example.com').on('error', e => { console.error(e.message); process.exit(e.code === 'EVERSIONLESSNETWORK' ? 0 : 2); })",
				],
				{
					env: {
						...process.env,
						VERSIONLESS_NETWORK_MODE: 'offline',
						NODE_OPTIONS: `--require=${guard}`,
					},
				},
			);
			const chunks: Buffer[] = [];
			child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
			child.on('exit', (code) => resolve({ code, stderr: Buffer.concat(chunks).toString() }));
		});
		expect(result.code).toBe(0);
		expect(result.stderr).toContain('VERSIONLESS_OFFLINE_BLOCKED:example.com');
	});
});
