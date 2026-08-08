import { createHash } from 'node:crypto';
import { analyze, SymbolFlags } from 'yuku-analyzer';

export const HOME_PAGE_SOURCE_SHA256 =
	'db0413d948d68980dd24db7660e1bd854cabcc4642ec15fff710f5c95131f232';
export const REPO_LIST_ITEM_SOURCE_SHA256 =
	'21a570ed27af053040ce6b503f1af0c22bbdfea52284dccb47b2dc382844d867';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

type SemanticModule = ReturnType<typeof analyze>;

function assertSymbol(
	module: SemanticModule,
	name: string,
	options: { imported?: boolean; references: number },
): void {
	const symbol = module.rootScope.find(name);
	if (!symbol) throw new Error(`Refused: missing semantic symbol ${name}`);
	if (options.imported && !symbol.has(SymbolFlags.Import))
		throw new Error(`Refused: ${name} is not the imported binding`);
	if (symbol.references.length !== options.references)
		throw new Error(
			`Refused: ${name} reference count ${symbol.references.length} != ${options.references}`,
		);
}

function transform(
	source: string,
	options: {
		path: string;
		expectedSha256: string;
		symbols: Array<[string, { imported?: boolean; references: number }]>;
		replacements: ReadonlyArray<readonly [string, string]>;
		targetSymbols: Array<[string, { imported?: boolean; references: number }]>;
	},
) {
	if (sha256(source) !== options.expectedSha256)
		throw new Error(`Refused: ${options.path} source SHA-256 mismatch`);
	const module = analyze(source, { lang: 'jsx', path: options.path });
	if (module.diagnostics.length)
		throw new Error(`Refused: Yuku diagnostics: ${JSON.stringify(module.diagnostics)}`);
	for (const [name, expectation] of options.symbols) assertSymbol(module, name, expectation);
	let code = source;
	const edits: Array<{ start: number; end: number; beforeSha256: string; afterSha256: string }> =
		[];
	for (const [before, after] of options.replacements) {
		const start = code.indexOf(before);
		if (start < 0 || code.indexOf(before, start + 1) >= 0)
			throw new Error('Refused: exact transform span missing or ambiguous');
		edits.push({
			start,
			end: start + before.length,
			beforeSha256: sha256(before),
			afterSha256: sha256(after),
		});
		code = `${code.slice(0, start)}${after}${code.slice(start + before.length)}`;
	}
	const target = analyze(code, { lang: 'jsx', path: options.path });
	if (target.diagnostics.length)
		throw new Error(
			`Refused: transformed Yuku diagnostics: ${JSON.stringify(target.diagnostics)}`,
		);
	for (const [name, expectation] of options.targetSymbols)
		assertSymbol(target, name, expectation);
	for (const legacy of [
		'connect',
		'createStructuredSelector',
		'mapStateToProps',
		'mapDispatchToProps',
	])
		if (target.rootScope.find(legacy))
			throw new Error(`Refused: legacy wiring remains: ${legacy}`);
	return {
		code,
		sourceSha256: sha256(source),
		targetSha256: sha256(code),
		semanticEngine: {
			parser: 'yuku-parser@0.7.0',
			analyzer: 'yuku-analyzer@0.7.0',
			diagnostics: 0,
		},
		edits,
	};
}

const homeReplacements = [
	[
		"import { connect } from 'react-redux';\nimport { compose } from 'redux';\nimport { createStructuredSelector } from 'reselect';",
		"import { useDispatch, useSelector } from 'react-redux';",
	],
	[
		`const mapStateToProps = createStructuredSelector({
  repos: makeSelectRepos(),
  username: makeSelectUsername(),
  loading: makeSelectLoading(),
  error: makeSelectError(),
});

export function mapDispatchToProps(dispatch) {
  return {
    onChangeUsername: evt => dispatch(changeUsername(evt.target.value)),
    onSubmitForm: evt => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(loadRepos());
    },
  };
}

const withConnect = connect(
  mapStateToProps,
  mapDispatchToProps,
);

export default compose(
  withConnect,
  memo,
)(HomePage);`,
		`const selectRepos = makeSelectRepos();
const selectUsername = makeSelectUsername();
const selectLoading = makeSelectLoading();
const selectError = makeSelectError();

export function HomePageHooks() {
  const repos = useSelector(selectRepos);
  const username = useSelector(selectUsername);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const dispatch = useDispatch();
  const onChangeUsername = evt => dispatch(changeUsername(evt.target.value));
  const onSubmitForm = evt => {
    if (evt !== undefined && evt.preventDefault) evt.preventDefault();
    dispatch(loadRepos());
  };

  return (
    <HomePage
      username={username}
      loading={loading}
      error={error}
      repos={repos}
      onSubmitForm={onSubmitForm}
      onChangeUsername={onChangeUsername}
    />
  );
}

export default memo(HomePageHooks);`,
	],
] as const;

const repoReplacements = [
	[
		"import { connect } from 'react-redux';\nimport { createStructuredSelector } from 'reselect';",
		"import { useSelector } from 'react-redux';",
	],
	[
		`export default connect(
  createStructuredSelector({
    currentUser: makeSelectCurrentUser(),
  }),
)(RepoListItem);`,
		`const selectCurrentUser = makeSelectCurrentUser();

export function RepoListItemHooks({ item }) {
  const currentUser = useSelector(selectCurrentUser);
  return <RepoListItem item={item} currentUser={currentUser} />;
}

RepoListItemHooks.propTypes = {
  item: PropTypes.object,
};

export default RepoListItemHooks;`,
	],
] as const;

export function transformHomePageConnectToHooks(
	source: string,
	options: { expectedSha256?: string } = {},
) {
	return transform(source, {
		path: 'app/containers/HomePage/index.js',
		expectedSha256: options.expectedSha256 ?? HOME_PAGE_SOURCE_SHA256,
		replacements: homeReplacements,
		symbols: [
			['HomePage', { references: 2 }],
			['connect', { imported: true, references: 1 }],
			['compose', { imported: true, references: 1 }],
			['createStructuredSelector', { imported: true, references: 1 }],
			['makeSelectRepos', { imported: true, references: 1 }],
			['makeSelectUsername', { imported: true, references: 1 }],
			['makeSelectLoading', { imported: true, references: 1 }],
			['makeSelectError', { imported: true, references: 1 }],
			['loadRepos', { imported: true, references: 1 }],
			['changeUsername', { imported: true, references: 1 }],
			['mapStateToProps', { references: 1 }],
			['mapDispatchToProps', { references: 1 }],
		],
		targetSymbols: [
			['HomePage', { references: 2 }],
			['HomePageHooks', { references: 1 }],
			['useSelector', { imported: true, references: 4 }],
			['useDispatch', { imported: true, references: 1 }],
			['loadRepos', { imported: true, references: 1 }],
			['changeUsername', { imported: true, references: 1 }],
		],
	});
}

export function transformRepoListItemConnectToHooks(
	source: string,
	options: { expectedSha256?: string } = {},
) {
	return transform(source, {
		path: 'app/containers/RepoListItem/index.js',
		expectedSha256: options.expectedSha256 ?? REPO_LIST_ITEM_SOURCE_SHA256,
		replacements: repoReplacements,
		symbols: [
			['RepoListItem', { references: 2 }],
			['connect', { imported: true, references: 1 }],
			['createStructuredSelector', { imported: true, references: 1 }],
			['makeSelectCurrentUser', { imported: true, references: 1 }],
		],
		targetSymbols: [
			['RepoListItem', { references: 2 }],
			['RepoListItemHooks', { references: 2 }],
			['useSelector', { imported: true, references: 1 }],
			['makeSelectCurrentUser', { imported: true, references: 1 }],
		],
	});
}
