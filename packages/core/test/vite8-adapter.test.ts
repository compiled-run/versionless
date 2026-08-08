import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { build, type Plugin } from 'vite';
import {
	assertVite8KernelEvidence,
	assertVite8Restoration,
	compareUtf16CodeUnits,
	createVite8AdapterKernel,
	type Vite8KernelEvidence,
} from '../src/index.ts';

describe('shared Vite 8 adapter kernel', () => {
	it('uses explicit locale-independent UTF-16 code-unit ordering', () => {
		expect(compareUtf16CodeUnits('A', '_')).toBeLessThan(0);
		expect(compareUtf16CodeUnits('_', 'a')).toBeLessThan(0);
		expect(compareUtf16CodeUnits('equal', 'equal')).toBe(0);
		expect(compareUtf16CodeUnits('a', '_')).toBeGreaterThan(0);
	});

	it('owns ordered lifecycle, normalized inventory, repeated builds, and restoration', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-vite8-kernel-'));
		try {
			const output = path.join(directory, 'dist');
			const evidencePath = path.join(directory, 'kernel.json');
			await mkdir(path.join(output, 'assets'), { recursive: true });
			await writeFile(path.join(output, 'index.html'), '<main></main>');
			await writeFile(path.join(output, 'assets/app.js'), 'export {}');
			for (let run = 0; run < 2; run++) {
				const plugin = createVite8AdapterKernel({ profile: 'test', evidencePath });
				plugin.configResolved({ command: 'build', build: { outDir: output } });
				plugin.buildStart();
				await plugin.closeBundle.handler();
			}
			const evidence = JSON.parse(
				await readFile(evidencePath, 'utf8'),
			) as Vite8KernelEvidence;
			assertVite8KernelEvidence(evidence);
			expect(evidence.runs).toHaveLength(2);
			assertVite8Restoration(evidence.runs[0]!.output, evidence.runs[1]!.output);
			const mutation = structuredClone(evidence) as unknown as {
				runs: Array<{ lifecycle: string[] }>;
			};
			mutation.runs[0]!.lifecycle[1] = 'close-bundle';
			expect(() =>
				assertVite8KernelEvidence(mutation as unknown as Vite8KernelEvidence),
			).toThrow('lifecycle order');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('uses the installed Vite executor to await prior asynchronous closeBundle mutations', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-vite8-sequential-'));
		try {
			const fixtureRoot = await realpath(directory);
			const index = path.join(fixtureRoot, 'index.html');
			const entry = path.join(fixtureRoot, 'entry.ts');
			const output = path.join(fixtureRoot, 'dist');
			const evidencePath = path.join(fixtureRoot, 'kernel.json');
			await writeFile(index, '<script type="module" src="/entry.ts"></script>');
			await writeFile(entry, 'export const ready = true;');
			const priorMutation: Plugin = {
				name: 'prior-asynchronous-close-bundle-mutation',
				async closeBundle() {
					await new Promise((resolve) => setTimeout(resolve, 20));
					await mkdir(output, { recursive: true });
					await writeFile(path.join(output, 'prior-generated.json'), '{"ready":true}\n');
				},
			};
			await build({
				root: fixtureRoot,
				logLevel: 'silent',
				plugins: [
					priorMutation,
					createVite8AdapterKernel({ profile: 'race-test', evidencePath }),
				],
				build: { outDir: output, rollupOptions: { input: index } },
			});
			const evidence = JSON.parse(
				await readFile(evidencePath, 'utf8'),
			) as Vite8KernelEvidence;
			expect(evidence.runs[0]!.output.map((entry) => entry.path)).toContain(
				'prior-generated.json',
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
