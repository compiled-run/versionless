import { spawnSync } from 'node:child_process';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

describe('runtime script observation CLI', () => {
	it('requires explicit offline configuration and output', () => {
		const result = spawnSync(
			process.execPath,
			[
				'--experimental-strip-types',
				'packages/cli/src/cli.ts',
				'runtime-script-observation:verify',
			],
			{ cwd: root, encoding: 'utf8', env: { ...process.env, VERSIONLESS_NETWORK_MODE: '' } },
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('requires --offline, --config, and --output');
	});
});
