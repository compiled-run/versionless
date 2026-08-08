import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

describe('React Avataaars Vite 8 target-only runner', () => {
	test('contains only target lanes and custom receipt boundaries', async () => {
		const source = await readFile('packages/cli/src/fixture/react-avataaars-run.ts', 'utf8');
		for (const required of [
			"'baseline-target'",
			"'migrated-target'",
			'versionless.react-avataaars-vite8-target-only.v1',
			"result: 'target-only-pass'",
			'publicDir: false',
			'history.listen(() => undefined)',
			'supports.length !== 10',
		])
			expect(
				`${source}\n${await readFile('packages/cli/src/fixture/react-avataaars-vite8.config.ts', 'utf8')}`,
			).toContain(required);
		expect(source).not.toContain("['build']");
		expect(source).not.toContain('evidence/runs/aggregate.json');
		expect(source).not.toContain('evidence/trust/');
	});

	test('preserves the exact unsupported-source-commit and nonclaim language', async () => {
		const source = await readFile('packages/cli/src/fixture/react-avataaars-run.ts', 'utf8');
		for (const statement of [
			'unsupported-source-commit',
			'No react-scripts-ts production execution or legacy/Vite parity.',
			'No bundler migration pass, source-application corpus entry, aggregate member',
			'No compliance, certification, authenticity, signer identity, or OS-wide isolation claim.',
		])
			expect(source).toContain(statement);
	});
});
