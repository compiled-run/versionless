import { spawnSync } from 'node:child_process';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

describe('corpus conformance CLI', () => {
	it('verifies the canonical corpus offline', () => {
		const result = spawnSync(
			process.execPath,
			['--experimental-strip-types', 'packages/cli/src/cli.ts', 'corpus:verify'],
			{
				cwd: root,
				encoding: 'utf8',
				env: {
					...process.env,
					VERSIONLESS_NETWORK_MODE: 'offline',
					NPM_CONFIG_OFFLINE: 'true',
				},
			},
		);
		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			result: 'pass',
			verticals: 18,
			sourceApplications: 10,
		});
	});

	it('refuses to run without explicit offline mode', () => {
		const result = spawnSync(
			process.execPath,
			['--experimental-strip-types', 'packages/cli/src/cli.ts', 'corpus:verify'],
			{ cwd: root, encoding: 'utf8', env: { ...process.env, VERSIONLESS_NETWORK_MODE: '' } },
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('requires VERSIONLESS_NETWORK_MODE=offline');
	});
});
