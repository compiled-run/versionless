import { createHash } from 'node:crypto';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

type PackageDocument = {
	name?: unknown;
	version?: unknown;
	private?: unknown;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	scripts?: Record<string, string>;
};

const reactDomImports = [
	"import ReactDOM from 'react-dom';",
	'import ReactDOM from "react-dom";',
] as const;
const reactDomClientImport = "import { createRoot } from 'react-dom/client';";
const renderCalls = [
	"ReactDOM.render(<App />, document.getElementById('root'));",
	'ReactDOM.render(<App />, document.getElementById("root"));',
] as const;
const createRootCall = "createRoot(document.getElementById('root')).render(<App />);";
const serviceWorkerImports = [
	"import * as serviceWorker from './serviceWorker';\n",
	"import serviceWorker from './serviceWorker';\n",
	"import registerServiceWorker from './registerServiceWorker';\n",
] as const;
const serviceWorkerCalls = [
	'serviceWorker.unregister();',
	'serviceWorker.register();',
	'registerServiceWorker();',
] as const;

function gitBlobSha(bytes: Uint8Array): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

function exactlyOne(source: string, candidates: readonly string[], label: string): string {
	const matches = candidates.filter(
		(candidate) =>
			source.indexOf(candidate) >= 0 &&
			source.indexOf(candidate) === source.lastIndexOf(candidate),
	);
	if (matches.length !== 1) throw new Error(`React Calculator ${label} differs`);
	return matches[0]!;
}

export function transformReactCalculatorBootstrap(input: {
	sourceBytes: Uint8Array;
	expectedGitSha: string;
}): {
	code: string;
	changed: boolean;
	edits: string[];
	sourceSha256: string;
	targetSha256: string;
} {
	if (gitBlobSha(input.sourceBytes) !== input.expectedGitSha)
		throw new Error('React Calculator bootstrap Git identity differs');
	const source = Buffer.from(input.sourceBytes).toString('utf8');
	if (source.includes(reactDomClientImport)) {
		if (
			!source.includes(createRootCall) ||
			reactDomImports.some((value) => source.includes(value))
		)
			throw new Error('React Calculator transformed bootstrap differs');
		return {
			code: source,
			changed: false,
			edits: [],
			sourceSha256: sha256(source),
			targetSha256: sha256(source),
		};
	}
	const importSpan = exactlyOne(source, reactDomImports, 'ReactDOM import');
	const renderSpan = exactlyOne(source, renderCalls, 'ReactDOM render call');
	let code = source.replace(importSpan, reactDomClientImport).replace(renderSpan, createRootCall);
	const edits = ['react-dom-render-to-createRoot'];
	const presentImports = serviceWorkerImports.filter((value) => code.includes(value));
	const presentCalls = serviceWorkerCalls.filter((value) => code.includes(value));
	if (presentImports.length > 1 || presentCalls.length > 1)
		throw new Error('React Calculator service-worker boundary is ambiguous');
	if (presentImports.length !== presentCalls.length)
		throw new Error('React Calculator service-worker import/call pair differs');
	if (presentImports[0] && presentCalls[0]) {
		code = code.replace(presentImports[0], '').replace(presentCalls[0], '');
		edits.push('service-worker-import-call-removal');
	}
	if (
		!code.includes(reactDomClientImport) ||
		!code.includes(createRootCall) ||
		reactDomImports.some((value) => code.includes(value)) ||
		serviceWorkerImports.some((value) => code.includes(value)) ||
		serviceWorkerCalls.some((value) => code.includes(value))
	)
		throw new Error('React Calculator target bootstrap semantics differ');
	return {
		code,
		changed: true,
		edits,
		sourceSha256: sha256(source),
		targetSha256: sha256(code),
	};
}

export function planReactCalculatorTargetPackage(input: {
	packageBytes: Uint8Array;
	expectedGitSha: string;
}): { packageJson: string; digest: string; changes: string[] } {
	if (gitBlobSha(input.packageBytes) !== input.expectedGitSha)
		throw new Error('React Calculator package Git identity differs');
	const value = JSON.parse(Buffer.from(input.packageBytes).toString('utf8')) as PackageDocument;
	if (
		value.dependencies?.react !== '^16.8.6' ||
		value.dependencies?.['react-dom'] !== '^16.8.6' ||
		value.dependencies?.['big.js'] !== '^5.2.2' ||
		value.dependencies?.['react-scripts'] !== undefined ||
		value.devDependencies?.['react-scripts'] !== '^3.0.1' ||
		value.scripts?.build !== 'react-scripts build'
	)
		throw new Error('React Calculator package migration source differs');
	const dependencies = { ...value.dependencies };
	dependencies.react = '18.3.1';
	dependencies['react-dom'] = '18.3.1';
	dependencies.scheduler = '0.23.2';
	const devDependencies = { ...value.devDependencies };
	delete devDependencies['react-scripts'];
	devDependencies.vite = '8.0.16';
	const scripts = {
		...value.scripts,
		start: 'vite',
		build: 'vite build',
		preview: 'vite preview',
	};
	const packageJson = `${JSON.stringify({ ...value, dependencies, devDependencies, scripts }, null, 2)}\n`;
	const changes = [
		'react-16.8.6-to-18.3.1',
		'react-dom-16.8.6-to-18.3.1',
		'react-scripts-3.0.1-to-vite-8.0.16',
		'scheduler-0.23.2-exact',
	];
	return { packageJson, changes, digest: sha256(canonicalize({ packageJson, changes })) };
}
