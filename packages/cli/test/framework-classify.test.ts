import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../core/src/receipts/canonicalize.ts';
import {
	classifyFrameworkDescriptor,
	runFrameworkClassification,
} from '../src/framework-classify.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const fixtures = path.join(root, 'packages/frameworks/nextjs/test/fixtures');
const offline = { VERSIONLESS_NETWORK_MODE: 'offline' };
const execFileAsync = promisify(execFile);

describe('framework:classify', () => {
	it('emits byte-identical canonical Next.js receipts with zero network attempts', async () => {
		for (const name of ['next12-pages.json', 'next13-app.json', 'next14-app.json']) {
			const descriptorPath = path.join(fixtures, name);
			const first = await runFrameworkClassification({
				descriptorPath,
				offline: true,
				environment: offline,
				rootDir: root,
			});
			const second = await runFrameworkClassification({
				descriptorPath,
				offline: true,
				environment: offline,
				rootDir: root,
			});
			expect(canonicalize(first)).toBe(canonicalize(second));
			expect(first.classification).toMatchObject({ framework: 'nextjs', adapter: 'nextjs' });
			expect(first.locality.networkAttempts).toBe(0);
			expect(new Set(Object.values(first.execution))).toEqual(new Set(['not-tested']));
		}
	});

	it('loads both packed entrypoints and dispatches framework:classify', async () => {
		const environment = { ...process.env, ...offline, NPM_CONFIG_OFFLINE: 'true' };
		await expect(
			execFileAsync(
				process.execPath,
				['--input-type=module', '--eval', "await import('./packages/cli/dist/index.js')"],
				{ cwd: root, env: environment },
			),
		).resolves.toMatchObject({ stderr: '' });

		const descriptorPath = path.join(fixtures, 'next12-pages.json');
		const result = await execFileAsync(
			process.execPath,
			[
				path.join(root, 'packages/cli/dist/cli.js'),
				'framework:classify',
				'--descriptor',
				descriptorPath,
				'--offline',
			],
			{ cwd: root, env: environment },
		);
		expect(result.stderr).toBe('');
		const receipt = JSON.parse(result.stdout) as Record<string, unknown>;
		expect(receipt).toMatchObject({
			classification: { framework: 'nextjs', adapter: 'nextjs' },
			locality: { networkAttempts: 0 },
		});
	});

	it('distinguishes explicit generic React without granting Next.js semantics', () => {
		const receipt = classifyFrameworkDescriptor({
			schemaVersion: 'versionless.react-descriptor.v1',
			id: 'synthetic-react-only',
			synthetic: true,
			framework: 'react',
			executionRequested: false,
			supportClaim: false,
			packageDetected: true,
			nextPackageDetected: false,
		});
		expect(receipt.classification).toEqual({
			framework: 'react',
			adapter: 'generic-react',
			inventory: {
				packageDetected: true,
				nextPackageDetected: false,
				nextjsRouting: 'not-applicable',
				nextjsRuntime: 'not-applicable',
			},
		});
	});

	it('fails closed without offline mode and for unsupported or support-seeking dispatch', async () => {
		const descriptorPath = path.join(fixtures, 'next12-pages.json');
		await expect(
			runFrameworkClassification({
				descriptorPath,
				offline: false,
				environment: offline,
				rootDir: root,
			}),
		).rejects.toThrow('requires --offline');
		await expect(
			runFrameworkClassification({
				descriptorPath,
				offline: true,
				environment: {},
				rootDir: root,
			}),
		).rejects.toThrow('VERSIONLESS_NETWORK_MODE=offline');
		expect(() => classifyFrameworkDescriptor({ framework: 'angular' })).toThrow(
			'Unsupported framework dispatch',
		);
		const next = JSON.parse(await readFile(descriptorPath, 'utf8')) as Record<string, unknown>;
		next.supportClaim = true;
		expect(() => classifyFrameworkDescriptor(next)).toThrow('support claims are forbidden');
	});

	it('refuses nonportable and escaped descriptor paths', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-classify-'));
		try {
			const outside = path.join(directory, 'descriptor.json');
			await writeFile(outside, '{}');
			await expect(
				runFrameworkClassification({
					descriptorPath: outside,
					offline: true,
					environment: offline,
					rootDir: root,
				}),
			).rejects.toThrow('escapes the workspace');
			await expect(
				runFrameworkClassification({
					descriptorPath: 'packages/../outside.json',
					offline: true,
					environment: offline,
					rootDir: root,
				}),
			).rejects.toThrow('normalized');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
