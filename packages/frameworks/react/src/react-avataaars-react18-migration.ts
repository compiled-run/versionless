import { createHash } from 'node:crypto';
import { analyze, SymbolFlags } from 'yuku-analyzer';
import { transformReactClassLifecycleToHooks } from './react-class-lifecycle-to-hooks.ts';

export const AVATAAARS_INDEX_SOURCE_SHA256 =
	'd685c7683cf2a5037dceab162e2cb6d1f0a872821f758c54c5c5629c11acff79' as const;

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

const reactDomImport = "import * as ReactDOM from 'react-dom'";
const reactDomClientImport = "import { createRoot } from 'react-dom/client'";
const serviceWorkerImport = "import registerServiceWorker from './registerServiceWorker'\n";
const applicationRender =
	"  ReactDOM.render(<App />, document.getElementById('root') as HTMLElement)\n  registerServiceWorker()";
const applicationCreateRoot =
	"  createRoot(document.getElementById('root') as HTMLElement).render(<App />)";
const rendererRender = '  ReactDOM.render(<Renderer />, document.body)';
const rendererCreateRoot = '  createRoot(document.body).render(<Renderer />)';

function unique(source: string, span: string, label: string): number {
	const start = source.indexOf(span);
	if (start < 0 || start !== source.lastIndexOf(span))
		throw new Error(`Refused: Avataaars ${label} span is absent or ambiguous`);
	return start;
}

function assertTargetSemantics(source: string): void {
	const module = analyze(source, { lang: 'tsx', path: 'src/index.tsx' });
	if (module.diagnostics.length)
		throw new Error(
			`Refused: Avataaars index diagnostics: ${JSON.stringify(module.diagnostics)}`,
		);
	const createRoot = module.rootScope.find('createRoot');
	if (!createRoot?.has(SymbolFlags.Import) || createRoot.references.length !== 2)
		throw new Error('Refused: Avataaars createRoot binding differs');
	if (module.rootScope.find('registerServiceWorker'))
		throw new Error('Refused: obsolete service-worker binding remains');
}

export function transformAvataaarsReact18Index(source: string) {
	if (source.includes(reactDomClientImport)) {
		if (
			source.includes(reactDomImport) ||
			source.includes(serviceWorkerImport) ||
			source.includes('registerServiceWorker()') ||
			source.indexOf(applicationCreateRoot) !== source.lastIndexOf(applicationCreateRoot) ||
			source.indexOf(rendererCreateRoot) !== source.lastIndexOf(rendererCreateRoot)
		)
			throw new Error('Refused: transformed Avataaars React 18 index is ambiguous');
		assertTargetSemantics(source);
		return {
			code: source,
			changed: false,
			edits: [],
			sourceSha256: digest(source),
			targetSha256: digest(source),
		};
	}
	if (digest(source) !== AVATAAARS_INDEX_SOURCE_SHA256)
		throw new Error('Refused: Avataaars index source SHA-256 mismatch');
	unique(source, reactDomImport, 'ReactDOM import');
	unique(source, serviceWorkerImport, 'service-worker import');
	unique(source, applicationRender, 'application render');
	unique(source, rendererRender, 'renderer render');
	const code = source
		.replace(reactDomImport, reactDomClientImport)
		.replace(serviceWorkerImport, '')
		.replace(applicationRender, applicationCreateRoot)
		.replace(rendererRender, rendererCreateRoot);
	assertTargetSemantics(code);
	return {
		code,
		changed: true,
		sourceSha256: digest(source),
		targetSha256: digest(code),
		edits: [
			'react-dom-render-to-createRoot',
			'obsolete-registerServiceWorker-import-call-removal',
			'renderer-render-to-createRoot',
		],
	};
}

export function transformAvataaarsReact18(source: { index: string; app: string }) {
	const index = transformAvataaarsReact18Index(source.index);
	const app = transformReactClassLifecycleToHooks(source.app);
	return {
		changed: index.changed || app.changed,
		index,
		app,
	};
}
