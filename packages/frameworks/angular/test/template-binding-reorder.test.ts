import { describe, expect, it } from 'vitest';
import {
	readDirectiveBindingDependencies,
	reorderTemplateBindings,
	type DirectiveBindingReading,
} from '../src/template-binding-reorder.ts';

/**
 * The `super-productivity` `SplitComponent` shape, reduced to the members the
 * capability reads: two element inputs and an `@Input() set` accessor that
 * dereferences both through the injected `Renderer2`.
 */
const SPLIT_COMPONENT = `
import { Component, Input, Renderer2 } from '@angular/core';
@Component({ selector: 'split', template: '' })
export class SplitComponent {
  @Input() splitTopEl;
  @Input() splitBottomEl;
  @Input() containerEl;
  pos: number;
  constructor(private _renderer: Renderer2) {}
  @Input() set splitPos(pos: number) {
    if (pos !== this.pos) {
      this._renderer.addClass(this.splitTopEl, 'isAnimatable');
      this._renderer.addClass(this.splitBottomEl, 'isAnimatable');
    }
  }
}
`;

/** A call site binding the dependent input before the inputs it dereferences. */
const UNSAFE_CALL_SITE = `<split (posChanged)="p=$event"
       [containerEl]="c"
       [splitPos]="p"
       [splitTopEl]="top"
       [splitBottomEl]="bottom"></split>`;

describe('reading a directive for setter dependencies', () => {
	it('reads the split shape: which input the setter dereferences, and that they are inputs', () => {
		const [reading, ...rest] = readDirectiveBindingDependencies('split.component.ts', SPLIT_COMPONENT);
		expect(rest).toEqual([]);
		expect(reading?.component).toBe('SplitComponent');
		expect(reading?.selector).toBe('split');
		expect(reading?.inputs).toEqual([
			'containerEl',
			'splitBottomEl',
			'splitPos',
			'splitTopEl',
		]);
		expect(reading?.setterDependencies).toEqual([
			{ input: 'splitPos', dependsOn: ['splitBottomEl', 'splitTopEl'] },
		]);
	});

	it('reads a renderer obtained through inject() as well as through the constructor', () => {
		const injected = `
import { Component, Input, Renderer2, inject } from '@angular/core';
@Component({ selector: 'split', template: '' })
export class SplitComponent {
  @Input() splitTopEl;
  private r = inject(Renderer2);
  @Input() set splitPos(v: number) { this.r.setStyle(this.splitTopEl, 'height', '1px'); }
}`;
		const [reading] = readDirectiveBindingDependencies('split.ts', injected);
		expect(reading?.setterDependencies).toEqual([{ input: 'splitPos', dependsOn: ['splitTopEl'] }]);
	});

	it('reads a `.classList` dereference as a throwing dependency', () => {
		const classList = `
import { Component, Input } from '@angular/core';
@Component({ selector: 'split', template: '' })
export class SplitComponent {
  @Input() el;
  @Input() set active(v: boolean) { this.el.classList.toggle('on', v); }
}`;
		const [reading] = readDirectiveBindingDependencies('split.ts', classList);
		expect(reading?.setterDependencies).toEqual([{ input: 'active', dependsOn: ['el'] }]);
	});

	it('carries the alias when an @Input renames its member for the template', () => {
		const aliased = `
import { Component, Input, Renderer2 } from '@angular/core';
@Component({ selector: 'split', template: '' })
export class SplitComponent {
  @Input('topEl') splitTopEl;
  constructor(private r: Renderer2) {}
  @Input('pos') set splitPos(v: number) { this.r.addClass(this.splitTopEl, 'x'); }
}`;
		const [reading] = readDirectiveBindingDependencies('split.ts', aliased);
		expect(reading?.inputs).toEqual(['pos', 'topEl']);
		expect(reading?.setterDependencies).toEqual([{ input: 'pos', dependsOn: ['topEl'] }]);
	});

	it('records no dependency for a dereference that cannot throw on order', () => {
		const stored = `
import { Component, Input } from '@angular/core';
@Component({ selector: 'split', template: '' })
export class SplitComponent {
  @Input() splitTopEl;
  private cached;
  @Input() set splitPos(v: number) { this.cached = this.splitTopEl; }
}`;
		const [reading] = readDirectiveBindingDependencies('split.ts', stored);
		expect(reading?.setterDependencies).toEqual([]);
	});

	it('records no dependency on a member that is not an input of the directive', () => {
		const nonInput = `
import { Component, Input, Renderer2 } from '@angular/core';
@Component({ selector: 'split', template: '' })
export class SplitComponent {
  private hostEl;
  constructor(private r: Renderer2) {}
  @Input() set splitPos(v: number) { this.r.addClass(this.hostEl, 'x'); }
}`;
		const [reading] = readDirectiveBindingDependencies('split.ts', nonInput);
		expect(reading?.setterDependencies).toEqual([]);
	});

	it('reads nothing from a module that declares no @angular/core directive', () => {
		const plain = `export class Helper { run() { return 1; } }`;
		expect(readDirectiveBindingDependencies('helper.ts', plain)).toEqual([]);
	});
});

describe('reordering a template call site', () => {
	const readings = readDirectiveBindingDependencies('split.component.ts', SPLIT_COMPONENT);

	it('moves the dereferenced inputs before the setter that dereferences them', () => {
		const migration = reorderTemplateBindings('page.html', UNSAFE_CALL_SITE, readings);
		expect(migration.changed).toBe(true);
		expect(migration.unhandled).toEqual([]);
		expect(migration.changes).toHaveLength(1);
		const change = migration.changes[0];
		expect(change?.before).toEqual(['containerEl', 'splitPos', 'splitTopEl', 'splitBottomEl']);
		expect(change?.after).toEqual(['containerEl', 'splitTopEl', 'splitBottomEl', 'splitPos']);
		expect(change?.edges).toEqual(['splitBottomEl -> splitPos', 'splitTopEl -> splitPos']);
		// splitPos now follows both inputs it dereferences.
		const posAt = migration.source.indexOf('[splitPos]');
		expect(posAt).toBeGreaterThan(migration.source.indexOf('[splitTopEl]'));
		expect(posAt).toBeGreaterThan(migration.source.indexOf('[splitBottomEl]'));
	});

	it('moves binding tokens whole, leaving every value and the outputs untouched', () => {
		const migration = reorderTemplateBindings('page.html', UNSAFE_CALL_SITE, readings);
		// Every authored `[name]="value"` token survives byte-for-byte.
		for (const token of [
			'[containerEl]="c"',
			'[splitPos]="p"',
			'[splitTopEl]="top"',
			'[splitBottomEl]="bottom"',
			'(posChanged)="p=$event"',
		])
			expect(migration.source).toContain(token);
		// The output binding is still first; only inputs moved among themselves.
		expect(migration.source.indexOf('(posChanged)')).toBeLessThan(
			migration.source.indexOf('[containerEl]'),
		);
		// Same set of characters, just reordered — no value was rewritten.
		expect([...migration.source].sort().join('')).toEqual([...UNSAFE_CALL_SITE].sort().join(''));
	});

	it('leaves a call site already in a safe order byte-for-byte unchanged', () => {
		const safe = `<split [splitTopEl]="top" [splitBottomEl]="bottom" [splitPos]="p"></split>`;
		const migration = reorderTemplateBindings('page.html', safe, readings);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(safe);
		expect(migration.changes).toEqual([]);
		expect(migration.unhandled).toEqual([]);
	});

	it('does not reorder a site that binds the setter but not the input it needs', () => {
		const partial = `<split [splitPos]="p" [containerEl]="c"></split>`;
		const migration = reorderTemplateBindings('page.html', partial, readings);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(partial);
	});

	it('makes no change for a directive whose inputs carry no setter dependency', () => {
		const inert: readonly DirectiveBindingReading[] = [
			Object.freeze({
				component: 'PlainComponent',
				selector: 'plain',
				inputs: Object.freeze(['a', 'b']),
				setterDependencies: Object.freeze([]),
			}),
		];
		const migration = reorderTemplateBindings('page.html', `<plain [b]="1" [a]="2"></plain>`, inert);
		expect(migration.changed).toBe(false);
		expect(migration.changes).toEqual([]);
	});
});

describe('refusals that leave the template alone', () => {
	it('refuses a cyclic dependency: no binding order can satisfy both setters', () => {
		const cyclic: readonly DirectiveBindingReading[] = [
			Object.freeze({
				component: 'CycleComponent',
				selector: 'cycle',
				inputs: Object.freeze(['a', 'b']),
				setterDependencies: Object.freeze([
					Object.freeze({ input: 'a', dependsOn: Object.freeze(['b']) }),
					Object.freeze({ input: 'b', dependsOn: Object.freeze(['a']) }),
				]),
			}),
		];
		const migration = reorderTemplateBindings('page.html', `<cycle [a]="x" [b]="y"></cycle>`, cyclic);
		expect(migration.changed).toBe(false);
		expect(migration.changes).toEqual([]);
		expect(migration.unhandled).toHaveLength(1);
		expect(migration.unhandled[0]).toContain('cycle');
		expect(migration.unhandled[0]).toContain('a -> b');
		expect(migration.unhandled[0]).toContain('b -> a');
	});

	it('reports a selector shape it cannot match, and reorders nothing on its account', () => {
		const classSelector: readonly DirectiveBindingReading[] = [
			Object.freeze({
				component: 'ClassComponent',
				selector: '.some-class',
				inputs: Object.freeze(['a', 'b']),
				setterDependencies: Object.freeze([
					Object.freeze({ input: 'a', dependsOn: Object.freeze(['b']) }),
				]),
			}),
		];
		const migration = reorderTemplateBindings('page.html', `<div [a]="x" [b]="y"></div>`, classSelector);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toHaveLength(1);
		expect(migration.unhandled[0]).toContain('.some-class');
	});

	it('reports a template that does not parse rather than counting it unchanged', () => {
		const readings = readDirectiveBindingDependencies('split.component.ts', SPLIT_COMPONENT);
		const migration = reorderTemplateBindings('page.html', `<split [splitPos]="p" </split`, readings);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.length).toBeGreaterThan(0);
	});

	it('matches an attribute-selector directive and reorders its bound inputs', () => {
		const attribute: readonly DirectiveBindingReading[] = [
			Object.freeze({
				component: 'AttrComponent',
				selector: '[appSplit]',
				inputs: Object.freeze(['appSplit', 'pos', 'topEl']),
				setterDependencies: Object.freeze([
					Object.freeze({ input: 'pos', dependsOn: Object.freeze(['topEl']) }),
				]),
			}),
		];
		const migration = reorderTemplateBindings(
			'page.html',
			`<div appSplit [pos]="p" [topEl]="t"></div>`,
			attribute,
		);
		expect(migration.changed).toBe(true);
		expect(migration.source.indexOf('[pos]')).toBeGreaterThan(migration.source.indexOf('[topEl]'));
	});
});
