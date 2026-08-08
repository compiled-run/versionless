import { analyze, SymbolFlags } from 'yuku-analyzer';
import { createHash } from 'node:crypto';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const LOCALE_TOGGLE_SOURCE_SHA256 =
	'70c2ea867367b5dbd0820413f344bcd6c19729ef04d41c1fd9e12d43d72e8dfa';

const replacements: ReadonlyArray<readonly [string, string]> = [
	[
		"import PropTypes from 'prop-types';\nimport { connect } from 'react-redux';\nimport { createSelector } from 'reselect';",
		"import { useDispatch, useSelector } from 'react-redux';",
	],
	[
		'export function LocaleToggle(props) {\n  return (',
		'const selectLocale = makeSelectLocale();\n\nexport function LocaleToggle() {\n  const locale = useSelector(selectLocale);\n  const dispatch = useDispatch();\n  const onLocaleToggle = evt => dispatch(changeLocale(evt.target.value));\n\n  return (',
	],
	['value={props.locale}', 'value={locale}'],
	['onToggle={props.onLocaleToggle}', 'onToggle={onLocaleToggle}'],
	[
		'\nLocaleToggle.propTypes = {\n  onLocaleToggle: PropTypes.func,\n  locale: PropTypes.string,\n};\n\nconst mapStateToProps = createSelector(\n  makeSelectLocale(),\n  locale => ({\n    locale,\n  }),\n);\n\nexport function mapDispatchToProps(dispatch) {\n  return {\n    onLocaleToggle: evt => dispatch(changeLocale(evt.target.value)),\n    dispatch,\n  };\n}\n\nexport default connect(\n  mapStateToProps,\n  mapDispatchToProps,\n)(LocaleToggle);',
		'\nexport default LocaleToggle;',
	],
];

type SemanticModule = ReturnType<typeof analyze>;
function assertSymbol(
	module: SemanticModule,
	name: string,
	options: { imported?: boolean; references?: number } = {},
): void {
	const symbol = module.rootScope.find(name);
	if (!symbol) throw new Error(`Refused: missing semantic symbol ${name}`);
	if (options.imported && !symbol.has(SymbolFlags.Import))
		throw new Error(`Refused: ${name} is not the imported binding`);
	if (options.references !== undefined && symbol.references.length !== options.references)
		throw new Error(
			`Refused: ${name} reference count ${symbol.references.length} != ${options.references}`,
		);
}

export function transformReactConnectToHooks(
	source: string,
	options: { expectedSha256?: string } = {},
) {
	if (sha256(source) !== (options.expectedSha256 ?? LOCALE_TOGGLE_SOURCE_SHA256))
		throw new Error('Refused: LocaleToggle source SHA-256 mismatch');
	const module = analyze(source, { lang: 'jsx', path: 'app/containers/LocaleToggle/index.js' });
	if (module.diagnostics.length)
		throw new Error(`Refused: Yuku diagnostics: ${JSON.stringify(module.diagnostics)}`);
	assertSymbol(module, 'LocaleToggle', { references: 2 });
	assertSymbol(module, 'connect', { imported: true, references: 1 });
	assertSymbol(module, 'createSelector', { imported: true, references: 1 });
	assertSymbol(module, 'makeSelectLocale', { imported: true, references: 1 });
	assertSymbol(module, 'changeLocale', { imported: true, references: 1 });
	assertSymbol(module, 'mapStateToProps', { references: 1 });
	assertSymbol(module, 'mapDispatchToProps', { references: 1 });
	let output = source;
	const edits: Array<{ start: number; end: number; beforeSha256: string; afterSha256: string }> =
		[];
	for (const [before, after] of replacements) {
		const start = output.indexOf(before);
		if (start < 0 || output.indexOf(before, start + 1) >= 0)
			throw new Error('Refused: exact transform span missing or ambiguous');
		edits.push({
			start,
			end: start + before.length,
			beforeSha256: sha256(before),
			afterSha256: sha256(after),
		});
		output = `${output.slice(0, start)}${after}${output.slice(start + before.length)}`;
	}
	const target = analyze(output, { lang: 'jsx', path: 'app/containers/LocaleToggle/index.js' });
	if (target.diagnostics.length)
		throw new Error(
			`Refused: transformed Yuku diagnostics: ${JSON.stringify(target.diagnostics)}`,
		);
	assertSymbol(target, 'useSelector', { imported: true, references: 1 });
	assertSymbol(target, 'useDispatch', { imported: true, references: 1 });
	assertSymbol(target, 'changeLocale', { imported: true, references: 1 });
	if (target.rootScope.find('connect') || target.rootScope.find('mapStateToProps'))
		throw new Error('Refused: legacy wiring remains after transform');
	return {
		code: output,
		sourceSha256: sha256(source),
		targetSha256: sha256(output),
		semanticEngine: {
			parser: 'yuku-parser@0.7.0',
			analyzer: 'yuku-analyzer@0.7.0',
			diagnostics: 0,
		},
		preconditions: [
			'named LocaleToggle export',
			'default connect export',
			'createSelector wiring',
			'dispatch changeLocale wiring',
		],
		edits,
	};
}
