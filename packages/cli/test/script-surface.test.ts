import { spawnSync } from 'node:child_process';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

describe('script-surface CLI', () => {
	it('verifies the canonical eighteen lanes offline', () => {
		const result = spawnSync(
			process.execPath,
			['--experimental-strip-types', 'packages/cli/src/cli.ts', 'script-surface:verify'],
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
		expect(JSON.parse(result.stdout)).toEqual({
			result: 'pass',
			verticals: 9,
			sourceApplications: 2,
			lanes: 18,
			externalScriptsIntroduced: 0,
		});
	});

	it('refuses to run without offline mode', () => {
		const result = spawnSync(
			process.execPath,
			['--experimental-strip-types', 'packages/cli/src/cli.ts', 'script-surface:verify'],
			{ cwd: root, encoding: 'utf8', env: { ...process.env, VERSIONLESS_NETWORK_MODE: '' } },
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('requires VERSIONLESS_NETWORK_MODE=offline');
	});
});
