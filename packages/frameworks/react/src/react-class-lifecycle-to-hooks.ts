import { createHash } from 'node:crypto';
import { createRegExp, exactly } from 'magic-regexp';
import { analyze, SymbolFlags } from 'yuku-analyzer';

export const AVATAAARS_APP_SOURCE_SHA256 =
	'78f34e49e318159358d450fc631f3ab07138498bd1e3f63e668720f4c90bfd74';

const before = `export default class App extends React.Component {
  componentDidMount () {
    // force an update if the URL changes
    history.listen(() => this.forceUpdate())
  }

  render () {
    return <Main />
  }
}`;

const after = `export default function App () {
  const [, forceUpdate] = React.useReducer((value: number) => value + 1, 0)

  React.useEffect(() => {
    const unlisten = history.listen(() => forceUpdate())
    return unlisten
  }, [])

  return <Main />
}`;

const beforePattern = createRegExp(exactly(before));
const afterPattern = createRegExp(exactly(after));
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function semantics(source: string, target: boolean): void {
	const module = analyze(source, { lang: 'tsx', path: 'src/components/App.tsx' });
	if (module.diagnostics.length)
		throw new Error(
			`Refused: Avataaars Yuku diagnostics: ${JSON.stringify(module.diagnostics)}`,
		);
	const history = module.rootScope.find('history');
	if (!history?.has(SymbolFlags.Import) || history.references.length !== 1)
		throw new Error('Refused: history is not the single imported listener binding');
	if (!module.rootScope.find('App')) throw new Error('Refused: App binding is absent');
	if (target) {
		const react = module.rootScope.find('React');
		if (!react?.has(SymbolFlags.Import) || react.references.length !== 2)
			throw new Error('Refused: React hook bindings differ');
	}
}

export function transformReactClassLifecycleToHooks(source: string) {
	if (afterPattern.test(source)) {
		if (source.indexOf(after) !== source.lastIndexOf(after))
			throw new Error('Refused: transformed Avataaars shape is ambiguous');
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
	if (digest(source) !== AVATAAARS_APP_SOURCE_SHA256)
		throw new Error('Refused: Avataaars App source SHA-256 mismatch');
	if (!beforePattern.test(source) || source.indexOf(before) !== source.lastIndexOf(before))
		throw new Error('Refused: exact Avataaars lifecycle shape is absent or ambiguous');
	semantics(source, false);
	const start = source.indexOf(before);
	const code = `${source.slice(0, start)}${after}${source.slice(start + before.length)}`;
	semantics(code, true);
	return {
		code,
		changed: true,
		sourceSha256: digest(source),
		targetSha256: digest(code),
		edits: [
			{
				start,
				end: start + before.length,
				beforeSha256: digest(before),
				afterSha256: digest(after),
			},
		],
		semanticEngine: {
			parser: 'yuku-parser@0.7.0',
			analyzer: 'yuku-analyzer@0.7.0',
			diagnostics: 0,
		},
	};
}
