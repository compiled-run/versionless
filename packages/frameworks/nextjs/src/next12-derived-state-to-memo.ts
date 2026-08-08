import { createHash } from 'node:crypto';
import { createRegExp, exactly } from 'magic-regexp';
import { analyze, SymbolFlags } from 'yuku-analyzer';

export const KILLEDBYGOOGLE_APP_SOURCE_SHA256 =
	'b3a48d2095754c46f64594c7d0cd49c2c65cc45a3baeaf992d6525617d27fe25';

const importBefore = "import { FC, useEffect, useState } from 'react';";
const importAfter = "import { FC, useEffect, useMemo, useState } from 'react';";
const stateBefore = '    const [listItems, updateListItems] = useState(items);\n';
const effectBefore: string = `    useEffect(() => {
        const regexp = new RegExp(searchTerm.toLowerCase().replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'i');
        const list = activeFilter === 'all' ? items :
            items.filter(el => el.type === activeFilter);
        // If search goes empty
        if (searchTerm === '') {
            // Reset the list.
            updateListItems(list);
        } else {
            // Otherwise filter the list by name and description
            updateListItems(list.filter(el =>
                regexp.test(el.name.toLowerCase()) ||
                regexp.test(el.description.toLowerCase())
            ));
        }
    }, [searchTerm, activeFilter, items]);`;
const effectAfter: string = `    const listItems = useMemo(() => {
        const regexp = new RegExp(searchTerm.toLowerCase().replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'i');
        const list = activeFilter === 'all' ? items :
            items.filter(el => el.type === activeFilter);
        // If search goes empty
        if (searchTerm === '') {
            // Reset the list.
            return list;
        }
        // Otherwise filter the list by name and description
        return list.filter(el =>
            regexp.test(el.name.toLowerCase()) ||
            regexp.test(el.description.toLowerCase())
        );
    }, [searchTerm, activeFilter, items]);`;

const importBeforePattern = createRegExp(exactly(importBefore));
const importAfterPattern = createRegExp(exactly(importAfter));
const stateBeforePattern = createRegExp(exactly(stateBefore));
const effectBeforePattern = createRegExp(exactly(effectBefore));
const effectAfterPattern = createRegExp(exactly(effectAfter));
const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

function requireSingle(source: string, value: string, label: string): number {
	const start = source.indexOf(value);
	if (start < 0 || source.indexOf(value, start + 1) >= 0)
		throw new Error(`Refused: Killed by Google ${label} is absent or ambiguous`);
	return start;
}

function semantics(source: string, target: boolean): void {
	const module = analyze(source, { lang: 'tsx', path: 'components/App.tsx' });
	if (module.diagnostics.length)
		throw new Error(
			`Refused: Killed by Google Yuku diagnostics: ${JSON.stringify(module.diagnostics)}`,
		);
	if (!module.rootScope.find('App')) throw new Error('Refused: missing semantic binding App');
	const useEffect = module.rootScope.find('useEffect');
	const useState = module.rootScope.find('useState');
	if (!useEffect?.has(SymbolFlags.Import) || !useState?.has(SymbolFlags.Import))
		throw new Error('Refused: React state/effect imports are not semantic imports');
	const useMemo = module.rootScope.find('useMemo');
	if (target !== Boolean(useMemo?.has(SymbolFlags.Import)))
		throw new Error('Refused: useMemo semantic state differs');
	if (!source.includes("window.umami.trackEvent(searchTerm, 'search')"))
		throw new Error('Refused: analytics effect differs');
}

export function transformNext12DerivedStateToMemo(source: string) {
	if (importAfterPattern.test(source) && effectAfterPattern.test(source)) {
		requireSingle(source, importAfter, 'transformed import');
		requireSingle(source, effectAfter, 'transformed memo');
		if (stateBeforePattern.test(source))
			throw new Error('Refused: legacy derived list state remains after transformation');
		semantics(source, true);
		return {
			code: source,
			changed: false,
			sourceSha256: digest(source),
			targetSha256: digest(source),
			edits: [],
			semanticEngine: {
				parser: 'yuku-parser@0.7.0',
				analyzer: 'yuku-analyzer@0.7.0',
				diagnostics: 0,
			},
		};
	}
	if (digest(source) !== KILLEDBYGOOGLE_APP_SOURCE_SHA256)
		throw new Error('Refused: Killed by Google App source SHA-256 mismatch');
	if (
		!importBeforePattern.test(source) ||
		!stateBeforePattern.test(source) ||
		!effectBeforePattern.test(source)
	)
		throw new Error('Refused: exact Killed by Google derived-state shape is absent');
	semantics(source, false);
	const replacements = [
		[importBefore, importAfter],
		[stateBefore, ''],
		[effectBefore, effectAfter],
	] as const;
	let code = source;
	const edits: Array<{ start: number; end: number; beforeSha256: string; afterSha256: string }> =
		[];
	for (const [before, after] of replacements) {
		const start = requireSingle(code, before, 'approved transform span');
		edits.push({
			start,
			end: start + before.length,
			beforeSha256: digest(before),
			afterSha256: digest(after),
		});
		code = `${code.slice(0, start)}${after}${code.slice(start + before.length)}`;
	}
	semantics(code, true);
	return {
		code,
		changed: true,
		sourceSha256: digest(source),
		targetSha256: digest(code),
		edits,
		semanticEngine: {
			parser: 'yuku-parser@0.7.0',
			analyzer: 'yuku-analyzer@0.7.0',
			diagnostics: 0,
		},
	};
}
