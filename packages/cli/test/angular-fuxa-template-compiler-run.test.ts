import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256 } from '../../core/src/index.ts';
import {
	createAngularFuxaTemplateCompilerEvidence,
	verifyAngularFuxaTemplateCompiler,
} from '../src/fixture/angular-fuxa-template-compiler-run.ts';

const temporary: string[] = [];
const root = path.resolve(import.meta.dirname, '../../..');
async function directory(): Promise<string> {
	const value = await mkdtemp(path.join(os.tmpdir(), 'versionless-t159-'));
	temporary.push(value);
	return value;
}
afterEach(async () => {
	for (const target of temporary.splice(0)) await rm(target, { recursive: true, force: true });
	vi.unstubAllEnvs();
});

describe('Angular FUXA template compiler evidence', () => {
	it('requires both explicit offline controls', async () => {
		vi.stubEnv('VERSIONLESS_NETWORK_MODE', undefined);
		vi.stubEnv('NPM_CONFIG_OFFLINE', undefined);
		const base = await directory();
		await expect(
			createAngularFuxaTemplateCompilerEvidence({
				outputRoot: path.join(base, 'output'),
				workRoot: path.join(base, 'work'),
				replay: false,
			}),
		).rejects.toThrow('explicit offline mode');
	});

	it('publishes four separate inventories and six restored mutation proofs', async () => {
		vi.stubEnv('VERSIONLESS_NETWORK_MODE', 'offline');
		vi.stubEnv('NPM_CONFIG_OFFLINE', 'true');
		const base = await directory();
		const outputRoot = path.join(base, 'output');
		const workRoot = path.join(base, 'work');
		const before = sha256(
			await readFile(
				path.join(root, 'evidence/runs/angular-fuxa-standalone-cohort/receipt.json'),
			),
		);
		const artifacts = await createAngularFuxaTemplateCompilerEvidence({
			outputRoot,
			workRoot,
			replay: false,
		});
		const receipt = JSON.parse(artifacts['receipt.json']!) as {
			analysis: Record<string, unknown>;
			verification: { mutations: Array<Record<string, unknown>> };
			nonclaims: string[];
		};
		expect(receipt.analysis).toMatchObject({
			templates: 134,
			diagnostics: 0,
			legacyLexicalPrefixInventory: { matches: 5, templates: 4 },
			angularAstExactElementInventory: {
				elementName: 'app-iframe',
				elements: 3,
				templates: 3,
			},
			angularAstDistinctPrefixedElementInventory: {
				elementName: 'app-iframe-property',
				elements: 1,
				templates: 1,
			},
			angularCommentInventory: { literalPrefix: '<app-iframe', comments: 1, templates: 1 },
			emptyGaugeTemplates: 2,
			orderConvergent: true,
		});
		expect(receipt.verification.mutations).toHaveLength(6);
		expect(receipt.verification.mutations.every((item) => item.restored === true)).toBe(true);
		expect(receipt.nonclaims.join(' ')).toContain('compiler-cli/AOT');
		await expect(access(workRoot)).rejects.toThrow();
		expect(
			sha256(
				await readFile(
					path.join(root, 'evidence/runs/angular-fuxa-standalone-cohort/receipt.json'),
				),
			),
		).toBe(before);
		expect(
			await verifyAngularFuxaTemplateCompiler({ outputRoot, workRoot, replay: false }),
		).toHaveLength(64);
	});

	it('refuses changed evidence and cleans replay work', async () => {
		vi.stubEnv('VERSIONLESS_NETWORK_MODE', 'offline');
		vi.stubEnv('NPM_CONFIG_OFFLINE', 'true');
		const base = await directory();
		const outputRoot = path.join(base, 'output');
		const workRoot = path.join(base, 'work');
		await createAngularFuxaTemplateCompilerEvidence({ outputRoot, workRoot, replay: false });
		const graphPath = path.join(outputRoot, 'graph.json');
		await writeFile(
			graphPath,
			(await readFile(graphPath, 'utf8')).replace('app-iframe', 'app-frame'),
		);
		await expect(
			verifyAngularFuxaTemplateCompiler({ outputRoot, workRoot, replay: false }),
		).rejects.toThrow('evidence differs');
		await expect(access(workRoot)).rejects.toThrow();
	});
});
