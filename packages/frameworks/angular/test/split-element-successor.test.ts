import { describe, expect, it } from 'vitest';
import {
	checkElementSplit,
	readUnknownElements,
	resolveSplitElementSuccessors,
	DOCUMENTED_ELEMENT_SPLITS,
	type ComponentSurfaceReading,
	type DocumentedElementSplit,
	type ElementSplitReading,
} from '../src/split-element-successor.ts';

const component = (
	name: string,
	elements: readonly string[],
	extra: Partial<ComponentSurfaceReading> = {},
): ComponentSurfaceReading =>
	Object.freeze({
		component: name,
		elements: Object.freeze(elements),
		extendsChain: Object.freeze([]),
		inputs: Object.freeze([]),
		outputs: Object.freeze([]),
		contentChildComponent: null,
		...extra,
	});

/** The chips surface Material 16.2.14 declares, as the driver reads it. */
const chips: ElementSplitReading = Object.freeze({
	package: '@angular/material',
	version: '16.2.14',
	replaced: 'mat-chip-list',
	replacedStillDeclared: false,
	complete: true,
	textInput: Object.freeze({
		directive: 'MatChipInput',
		element: 'input',
		hostBinding: 'matChipInputFor',
		hostComponent: 'MatChipGrid',
	}),
	components: Object.freeze([
		component('MatChip', ['mat-basic-chip', 'mat-chip'], {
			inputs: Object.freeze(['removable', 'value']),
			outputs: Object.freeze(['removed']),
		}),
		component('MatChipGrid', ['mat-chip-grid'], {
			extendsChain: Object.freeze(['MatChipGridBase', 'MatChipSet']),
			inputs: Object.freeze(['errorStateMatcher', 'placeholder', 'required', 'value']),
			outputs: Object.freeze(['change', 'valueChange']),
			contentChildComponent: 'MatChipRow',
		}),
		component('MatChipListbox', ['mat-chip-listbox'], {
			extendsChain: Object.freeze(['MatChipSet']),
			inputs: Object.freeze(['compareWith', 'multiple', 'selectable', 'value']),
			outputs: Object.freeze(['change']),
			contentChildComponent: 'MatChipOption',
		}),
		component('MatChipOption', ['mat-basic-chip-option', 'mat-chip-option'], {
			extendsChain: Object.freeze(['MatChip']),
		}),
		component('MatChipRow', ['mat-basic-chip-row', 'mat-chip-row'], {
			extendsChain: Object.freeze(['MatChip']),
		}),
		component('MatChipSet', ['mat-chip-set'], {
			inputs: Object.freeze(['disabled', 'role']),
			contentChildComponent: 'MatChip',
		}),
	]),
});

const split = DOCUMENTED_ELEMENT_SPLITS[0] as DocumentedElementSplit;

const inputBearing = [
	'<mat-form-field>',
	'  <mat-chip-list #listRef>',
	'    <mat-chip (removed)="remove(item.id)" *ngFor="let item of items" [removable]="true">',
	'      {{item.title}}',
	'    </mat-chip>',
	'    <input [matChipInputFor]="listRef" [placeholder]="label">',
	'  </mat-chip-list>',
	'</mat-form-field>',
	'',
].join('\n');

const staticDisplay = [
	'<mat-chip-list>',
	'  <mat-chip (click)="pick(1)">one</mat-chip>',
	'  <mat-chip *ngIf="two" (click)="pick(2)">two</mat-chip>',
	'</mat-chip-list>',
	'',
].join('\n');

const selectable = [
	'<mat-chip-list [multiple]="true" (change)="onChange($event)">',
	'  <mat-chip>one</mat-chip>',
	'</mat-chip-list>',
	'',
].join('\n');

describe('readUnknownElements', () => {
	it('takes the element and the template each NG8001 names, once each', () => {
		const log = [
			"Error: src/app/ui/a.component.html:2:3 - error NG8001: 'mat-chip-list' is not a known element:",
			"Error: src/app/ui/a.component.html:9:3 - error NG8001: 'mat-chip-list' is not a known element:",
			"Error: src/app/ui/b.component.html:23:3 - error NG8001: 'mat-chip-list' is not a known element:",
			'Error: src/app/ui/b.component.html:4:1 - error TS2339: something else entirely.',
		].join('\n');
		const byFile = readUnknownElements(log);
		expect([...byFile.keys()].sort()).toEqual([
			'src/app/ui/a.component.html',
			'src/app/ui/b.component.html',
		]);
		expect(byFile.get('src/app/ui/a.component.html')).toEqual(['mat-chip-list']);
	});
});

describe('checkElementSplit', () => {
	it('accepts the documented split the installed declarations agree with', () => {
		expect(checkElementSplit(split, chips)).toEqual([]);
	});

	it('refuses when the tree still declares the element the split claims is gone', () => {
		const still = { ...chips, replacedStillDeclared: true };
		expect(checkElementSplit(split, still).join(' ')).toContain(
			'still declares <mat-chip-list>',
		);
	});

	it('refuses a claimed input-bearing successor the text-input directive contradicts', () => {
		const wrong: ElementSplitReading = {
			...chips,
			textInput: { ...chips.textInput!, hostComponent: 'MatChipListbox' },
		};
		expect(checkElementSplit(split, wrong).join(' ')).toContain(
			'types its matChipInputFor binding to MatChipListbox',
		);
	});

	it('refuses a general successor the other two do not extend', () => {
		const unrelated: ElementSplitReading = {
			...chips,
			components: chips.components.map((entry) =>
				entry.component === 'MatChipGrid' || entry.component === 'MatChipListbox'
					? { ...entry, extendsChain: Object.freeze([]) }
					: entry,
			),
		};
		expect(checkElementSplit(split, unrelated).join(' ')).toContain(
			'is not the unspecialised container',
		);
	});

	it('refuses an incomplete reading outright', () => {
		expect(checkElementSplit(split, { ...chips, complete: false })).toHaveLength(1);
	});
});

describe('resolveSplitElementSuccessors', () => {
	it('resolves a list hosting the text input onto the component that input is typed to', () => {
		const result = resolveSplitElementSuccessors(
			'a.component.html',
			inputBearing,
			split,
			chips,
		);
		expect(result.unhandled).toEqual([]);
		expect(result.changes).toEqual([
			{
				kind: 'split-element-successor',
				line: 2,
				from: 'mat-chip-list',
				to: 'mat-chip-grid',
				shape: 'input-bearing',
				component: 'MatChipGrid',
				children: ['mat-chip → mat-chip-row'],
			},
		]);
		expect(result.source).toContain('<mat-chip-grid #listRef>');
		expect(result.source).toContain('</mat-chip-grid>');
		expect(result.source).toContain('<mat-chip-row (removed)=');
		expect(result.source).toContain('</mat-chip-row>');
		expect(result.source).not.toContain('mat-chip-list');
	});

	it('resolves a list carrying neither fact onto the container the others extend', () => {
		const result = resolveSplitElementSuccessors(
			'b.component.html',
			staticDisplay,
			split,
			chips,
		);
		expect(result.unhandled).toEqual([]);
		expect(result.changes[0]?.shape).toBe('general');
		expect(result.changes[0]?.children).toEqual([]);
		expect(result.source).toContain('<mat-chip-set>');
		expect(result.source).toContain('</mat-chip-set>');
		expect(result.source).toContain('<mat-chip (click)="pick(1)">one</mat-chip>');
	});

	it('resolves a list carrying a binding only the selection successor declares', () => {
		const result = resolveSplitElementSuccessors('c.component.html', selectable, split, chips);
		expect(result.unhandled).toEqual([]);
		expect(result.changes[0]?.shape).toBe('selection');
		expect(result.source).toContain('<mat-chip-listbox [multiple]="true"');
		expect(result.source).toContain('<mat-chip-option>one</mat-chip-option>');
	});

	it('refuses a list whose text input names some other list', () => {
		const foreign = [
			'<mat-chip-list #a></mat-chip-list>',
			'<mat-chip-list #b>',
			'  <input [matChipInputFor]="a">',
			'</mat-chip-list>',
			'',
		].join('\n');
		const result = resolveSplitElementSuccessors('d.component.html', foreign, split, chips);
		expect(result.unhandled.join(' ')).toContain('is not a reference this element declares');
		expect(result.changes).toHaveLength(1);
		expect(result.changes[0]?.line).toBe(1);
	});

	it('refuses a list whose facts match two documented shapes at once', () => {
		const both = [
			'<mat-chip-list #r [multiple]="true">',
			'  <input [matChipInputFor]="r">',
			'</mat-chip-list>',
			'',
		].join('\n');
		const result = resolveSplitElementSuccessors('e.component.html', both, split, chips);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain(
			'the facts match two documented shapes at once',
		);
	});

	it('refuses a list carrying a binding the chosen successor does not declare', () => {
		const unknown = ['<mat-chip-list [selectionMode]="x"></mat-chip-list>', ''].join('\n');
		const result = resolveSplitElementSuccessors('f.component.html', unknown, split, chips);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain('carries selectionMode');
	});

	it('leaves universal attributes alone rather than refusing on them', () => {
		const universal = ['<mat-chip-list class="x" aria-label="y"></mat-chip-list>', ''].join(
			'\n',
		);
		const result = resolveSplitElementSuccessors('g.component.html', universal, split, chips);
		expect(result.unhandled).toEqual([]);
		expect(result.source).toContain('<mat-chip-set class="x" aria-label="y">');
	});

	it('refuses a child the queried component does not extend', () => {
		const strange = [
			'<mat-chip-list>',
			'  <mat-chip-option></mat-chip-option>',
			'</mat-chip-list>',
			'',
		].join('\n');
		const result = resolveSplitElementSuccessors('h.component.html', strange, split, chips);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain('which MatChip does not extend');
	});

	it('writes nothing when the reading is of a different split', () => {
		const other: ElementSplitReading = { ...chips, replaced: 'mat-chip-thing' };
		const result = resolveSplitElementSuccessors(
			'i.component.html',
			staticDisplay,
			split,
			other,
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled).toHaveLength(1);
	});

	it('refuses to count an unparseable template as unchanged', () => {
		expect(() =>
			resolveSplitElementSuccessors(
				'j.component.html',
				'<mat-chip-list></mat-chip-set></mat-chip-list>',
				split,
				chips,
			),
		).toThrow(/does not parse/u);
	});
});

describe('DOCUMENTED_ELEMENT_SPLITS', () => {
	it('names three distinct successors for each split it claims', () => {
		for (const entry of DOCUMENTED_ELEMENT_SPLITS) {
			expect(entry.package).not.toBe('');
			expect(new Set([entry.inputBearing, entry.selection, entry.general]).size).toBe(3);
		}
	});
});
