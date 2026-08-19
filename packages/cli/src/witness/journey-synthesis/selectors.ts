/**
 * How a selector string is classified.
 *
 * The classification decides whether a synthesized step is worth replaying at
 * all. A `data-test` attribute is a name the application maintains on purpose
 * and survives a re-render; `div > ul > li:nth-child(3)` is a description of one
 * particular render and survives nothing. Both are recorded, but a reader can
 * tell them apart, which is the point.
 */

import type { SelectorBasis } from './types.ts';

const ATTRIBUTE_BASES: ReadonlyArray<{
	readonly attribute: string;
	readonly basis: SelectorBasis;
}> = Object.freeze([
	{ attribute: 'data-test', basis: 'data-test' },
	{ attribute: 'data-cy', basis: 'data-cy' },
	{ attribute: 'data-testid', basis: 'data-testid' },
	{ attribute: 'data-test-id', basis: 'data-testid' },
]);

/**
 * Classify a CSS selector by the strongest attribute it names.
 *
 * A compound selector that mentions a test attribute anywhere is classified by
 * that attribute rather than by its weakest part, because the test attribute is
 * the part that will still resolve after a migration.
 */
export function selectorBasisOfCss(selector: string): SelectorBasis {
	for (const { attribute, basis } of ATTRIBUTE_BASES)
		if (selector.includes(`[${attribute}`) || selector.includes(`[data-attr="${attribute}"`))
			return basis;
	return 'css';
}

/** A selector is durable when it names a test attribute, a role, or a label. */
export const DURABLE_SELECTOR_BASES: readonly SelectorBasis[] = Object.freeze([
	'data-test',
	'data-cy',
	'data-testid',
	'test-id',
	'role',
	'label',
	'placeholder',
]);

export function isDurableSelector(basis: SelectorBasis): boolean {
	return DURABLE_SELECTOR_BASES.includes(basis);
}
