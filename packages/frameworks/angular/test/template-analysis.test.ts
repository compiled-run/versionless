import { describe, expect, it } from 'vitest';
import { analyzeAngularTemplate, analyzeAngularTemplates } from '../src/index.ts';

describe('Angular template analysis', () => {
	it('keeps lexical, exact AST, distinct prefixed AST, and comment evidence separate', () => {
		const result = analyzeAngularTemplate({
			path: 'component.html',
			source: '<!-- <app-iframe></app-iframe> -->\n<app-iframe></app-iframe>\n<app-iframe-property></app-iframe-property>',
		});
		expect(result.diagnostics).toEqual([]);
		expect(result.legacyLexicalPrefixes.map((item) => item.line)).toEqual([1, 2, 3]);
		expect(result.elements.filter((item) => item.name === 'app-iframe')).toHaveLength(1);
		expect(result.elements.filter((item) => item.name === 'app-iframe-property')).toHaveLength(
			1,
		);
		expect(result.comments.filter((item) => item.value.includes('<app-iframe'))).toHaveLength(
			1,
		);
	});

	it('preserves locations, literal attributes, empty templates, and diagnostics', () => {
		const iframe = analyzeAngularTemplate({
			path: 'iframe.html',
			source: '<iframe sandbox="allow-scripts"></iframe>',
		});
		expect(iframe.elements[0]).toMatchObject({
			name: 'iframe',
			attributes: { sandbox: 'allow-scripts' },
			location: { lineStart: 1, lineEnd: 1 },
		});
		expect(analyzeAngularTemplate({ path: 'empty.html', source: '' })).toMatchObject({
			byteLength: 0,
			diagnostics: [],
			elements: [],
			rootNodes: 0,
		});
		expect(
			analyzeAngularTemplate({ path: 'bad.html', source: '<div' }).diagnostics,
		).not.toEqual([]);
	});

	it('sorts a multi-template inventory deterministically', () => {
		expect(
			analyzeAngularTemplates([
				{ path: 'z.html', source: '<div></div>' },
				{ path: 'a.html', source: '<span></span>' },
			]).map((item) => item.path),
		).toEqual(['a.html', 'z.html']);
	});
});
