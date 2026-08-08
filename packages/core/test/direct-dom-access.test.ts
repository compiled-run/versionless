import { describe, expect, it } from 'vite-plus/test';
import {
	analyzeDirectDomAccess,
	classifyDirectDomOrigin,
	directDomInventoryDigest,
	DirectDomAnalysisError,
} from '../src/analysis/direct-dom-access.ts';

describe('direct DOM semantic inventory', () => {
	it('classifies semantic globals, aliases, computed members, contexts, and shadowing', () => {
		const inventory = analyzeDirectDomAccess({
			id: 'semantic-case',
			files: [
				{
					path: 'src/globals.ts',
					source: 'export const pageDocument = document;',
				},
				{
					path: 'src/widget.tsx',
					source: `import React, { useEffect as afterPaint } from 'react';
import ReactDOM, { findDOMNode as locate } from 'react-dom';
import { pageDocument as page } from './globals';
const localDocument = document;
export function Widget() {
  const ref = React.useRef(null);
  const renderWidth = ref.current.offsetWidth;
  const click = () => ref.current.focus();
  afterPaint(() => ref.current.scrollIntoView());
  page['querySelector']('.cross-file');
  localDocument.getElementById('local-alias');
  document.querySelectorAll('.direct');
  ReactDOM['findDOMNode'](ref.current);
  locate(ref.current);
  ref.current.innerHTML = '<b>fixture</b>';
  getComputedStyle(ref.current);
  jQuery('.legacy');
  $('.legacy-short');
  window.analytics;
  return <button onClick={click}>{renderWidth}</button>;
}
export function shadowed(document: { querySelector(value: string): unknown }, $: unknown) {
  document.querySelector('.not-global');
  return $;
}
ReactDOM.render(<Widget />, document.body);`,
				},
			],
		});
		expect(inventory.counts.byCategory).toEqual({
			'document-selector': 3,
			'reactdom-find-dom-node': 2,
			'html-write': 1,
			'imperative-node-call': 2,
			'layout-read': 2,
			'unresolved-jquery': 2,
		});
		expect(inventory.counts.total).toBe(12);
		expect(inventory.windowGlobals).toHaveLength(1);
		expect(inventory.sites.some((site) => site.member === '.not-global')).toBe(false);
		expect(
			inventory.sites.find((site) => site.member === 'scrollIntoView')?.phase,
		).toMatchObject({ status: 'known', value: 'effect' });
		expect(inventory.sites.find((site) => site.member === 'focus')).toMatchObject({
			phase: { status: 'known', value: 'event' },
			ownership: { status: 'known', value: 'component-react-ref' },
		});
		expect(inventory.sites.find((site) => site.member === 'offsetWidth')?.phase).toMatchObject({
			status: 'known',
			value: 'render',
		});
		expect(
			inventory.sites
				.filter((site) => site.category === 'document-selector')
				.every((site) => site.ownership.value === 'external-global-document'),
		).toBe(true);
		expect(
			inventory.sites
				.filter((site) => site.category === 'unresolved-jquery')
				.every((site) => site.ownership.status === 'unknown'),
		).toBe(true);
		expect(inventory.sites.every((site) => !site.path.startsWith('/'))).toBe(true);
		expect(directDomInventoryDigest(inventory)).toBe(inventory.integrity.canonicalDigest);
	});

	it('requires resolved React evidence for component and execution phases', () => {
		const inventory = analyzeDirectDomAccess({
			id: 'semantic-context-adversaries',
			files: [
				{
					path: 'context.tsx',
					source: `import React, { Component, useEffect } from 'react';
function Helper() {
  document.querySelector('.helper');
  return <span />;
}
class Fake {
  render() { document.querySelector('.fake-render'); return <div />; }
  componentDidMount() { document.querySelector('.fake-lifecycle'); }
}
class Real extends Component {
  render() { document.querySelector('.real-render'); return <div />; }
  componentDidMount() { document.querySelector('.real-lifecycle'); }
}
function EventComponent() {
  const ref = React.useRef(null);
  const base = () => ref.current.focus();
  const alias = base;
  const shared = () => document.querySelector('.multiple');
  const nested = () => () => document.querySelector('.nested');
  useEffect(() => ref.current.scrollIntoView());
  return <div>
    <button onClick={alias} />
    <button onMouseDown={() => document.querySelector('.inline')} />
    <button onFocus={shared} onBlur={shared} />
    <button onKeyDown={nested} />
  </div>;
}
function useEffectShadow(callback: () => void) { callback(); }
function ShadowedHooks() {
  useEffectShadow(() => document.querySelector('.shadowed-hook'));
  return <div />;
}
const unknownNode = { focus() {} };
unknownNode.focus();
const root = <><EventComponent /><ShadowedHooks /><Real /></>;`,
				},
			],
		});
		const selectorSites = inventory.sites.filter(
			(site) => site.category === 'document-selector',
		);
		expect(selectorSites.map((site) => [site.location.line, site.phase.value])).toEqual([
			[3, 'unknown'],
			[7, 'unknown'],
			[8, 'unknown'],
			[11, 'render'],
			[12, 'lifecycle'],
			[18, 'unknown'],
			[19, 'unknown'],
			[23, 'event'],
			[30, 'unknown'],
		]);
		expect(inventory.sites.find((site) => site.member === 'scrollIntoView')).toMatchObject({
			phase: { status: 'known', value: 'effect' },
			component: { status: 'known', value: 'EventComponent' },
			ownership: { status: 'known', value: 'component-react-ref' },
		});
		expect(
			inventory.sites.filter((site) => site.member === 'focus').map((site) => site.ownership),
		).toEqual([
			expect.objectContaining({ status: 'known', value: 'component-react-ref' }),
			expect.objectContaining({ status: 'unknown', value: null }),
		]);
	});

	it('separates origins and preserves unknown semantic facts', () => {
		const inventory = analyzeDirectDomAccess({
			id: 'origins',
			files: [
				{ path: 'src/app.ts', source: 'document.querySelector("main");' },
				{ path: 'test/app.spec.ts', source: 'document.querySelector("main");' },
				{ path: 'generated/templates/page.js', source: 'document.querySelector("main");' },
				{ path: 'vendor/library.min.js', source: 'document.querySelector("main");' },
			],
		});
		expect(inventory.counts.byOrigin).toEqual({
			production: 1,
			test: 1,
			'generated-template': 1,
			'bundled-vendor': 1,
		});
		expect(inventory.counts.unknownComponents).toBe(4);
		expect(inventory.sites.every((site) => site.phase.value === 'module')).toBe(true);
		expect(classifyDirectDomOrigin('vendor/x.js').kind).toBe('bundled-vendor');
	});

	it('is deterministic across input order', () => {
		const files = [
			{ path: 'b.ts', source: 'window.location; document.querySelector("b")' },
			{ path: 'a.ts', source: 'document.getElementById("a")' },
		];
		const first = analyzeDirectDomAccess({ id: 'stable', files });
		const second = analyzeDirectDomAccess({ id: 'stable', files: [...files].reverse() });
		expect(second).toEqual(first);
		const altered = structuredClone(first);
		altered.integrity.canonicalDigest = 'not-the-digest';
		expect(directDomInventoryDigest(altered)).toBe(first.integrity.canonicalDigest);
	});

	it('keeps Yuku-proven CommonJS export chains opaque without skipping their ASTs', () => {
		const inventory = analyzeDirectDomAccess({
			id: 'commonjs-boundaries',
			files: [
				{
					path: 'common.js',
					source: `module.exports.handler = () => document.querySelector('.direct');
module['exports']['nested'].handler = () => document.getElementById('computed');`,
				},
				{
					path: 'entry.jsx',
					source: `import { handler } from './common';
function App() { return <button onClick={handler} />; }
const root = <App />;`,
				},
			],
		});
		expect(inventory.sites).toHaveLength(2);
		expect(inventory.sites.map((site) => site.path)).toEqual(['common.js', 'common.js']);
		expect(inventory.sites.map((site) => site.phase)).toEqual([
			expect.objectContaining({ status: 'unknown', value: 'unknown' }),
			expect.objectContaining({ status: 'unknown', value: 'unknown' }),
		]);
		expect(inventory.sites.every((site) => site.component.status === 'unknown')).toBe(true);
		expect(
			inventory.sites.every((site) => site.ownership.value === 'external-global-document'),
		).toBe(true);
	});

	it('fails closed on malformed CommonJS JSX and ordinary ESM link diagnostics', () => {
		expect(() =>
			analyzeDirectDomAccess({
				id: 'malformed-commonjs',
				files: [{ path: 'common.js', source: 'module.exports.Widget = () => <main>;' }],
			}),
		).toThrow(DirectDomAnalysisError);
		expect(() =>
			analyzeDirectDomAccess({
				id: 'missing-esm-export',
				files: [
					{ path: 'entry.ts', source: "import { missing } from './module'; missing();" },
					{ path: 'module.ts', source: 'export const present = true;' },
				],
			}),
		).toThrow(DirectDomAnalysisError);
	});

	it('fails closed on parser diagnostics', () => {
		expect(() =>
			analyzeDirectDomAccess({
				id: 'invalid',
				files: [{ path: 'broken.ts', source: 'const value: = ;' }],
			}),
		).toThrow(DirectDomAnalysisError);
	});
});
