import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { describe, expect, it } from 'vite-plus/test';
import { directDomInventoryDigest } from '../../core/src/analysis/direct-dom-access.ts';
import { canonicalize } from '../../core/src/receipts/canonicalize.ts';
import { runDirectDomInventory } from '../src/analysis/direct-dom-inventory.ts';

describe('direct-dom:inventory CLI operation', () => {
	it('writes byte-identical canonical portable offline inventories', () => {
		const root = mkdtempSync(join(tmpdir(), 'versionless-direct-dom-'));
		writeFileSync(
			join(root, 'entry.js'),
			'import { legacy } from "./legacy"; export const App = () => <main data-value={legacy} ref={() => document.querySelector("main")} />;',
		);
		writeFileSync(
			join(root, 'legacy.js'),
			'module["exports"].legacy = document.querySelector("aside");',
		);
		writeFileSync(join(root, 'logic.ts'), 'export const width = document.body.offsetWidth;');
		const firstPath = join(root, 'first.json');
		const secondPath = join(root, 'second.json');
		const first = runDirectDomInventory({
			root,
			id: 'cli-fixture',
			output: firstPath,
			offline: true,
		});
		const second = runDirectDomInventory({
			root,
			id: 'cli-fixture',
			output: secondPath,
			offline: true,
		});
		expect(readFileSync(secondPath)).toEqual(readFileSync(firstPath));
		expect(readFileSync(firstPath, 'utf8')).toBe(`${canonicalize(first)}\n`);
		expect(second.integrity.canonicalDigest).toBe(directDomInventoryDigest(second));
		expect(first.sites.map((site) => site.path)).toEqual(['entry.js', 'legacy.js', 'logic.ts']);
		expect(first.locality).toEqual({ offline: true, networkAttempts: 0, filesChanged: 0 });
	});

	it('requires offline mode and does not write refused diagnostic output', () => {
		const root = mkdtempSync(join(tmpdir(), 'versionless-direct-dom-refusal-'));
		writeFileSync(join(root, 'broken.ts'), 'const value: = ;');
		const output = join(root, 'output.json');
		expect(() =>
			runDirectDomInventory({ root, id: 'refusal', output, offline: false }),
		).toThrow('requires --offline');
		expect(() => runDirectDomInventory({ root, id: 'refusal', output, offline: true })).toThrow(
			'Yuku parser or link diagnostics',
		);
		expect(() => readFileSync(output)).toThrow();
	});
});
