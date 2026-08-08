import { spawnSync } from 'node:child_process';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

describe('trust CLI boundary', () => {
	it('rejects network ingest without explicit consent before making a request', () => {
		const result = spawnSync(
			process.execPath,
			['--experimental-strip-types', 'packages/cli/src/cli.ts', 'trust:ingest'],
			{
				cwd: root,
				encoding: 'utf8',
				env: { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline' },
			},
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('requires --allow-network');
	});
});
