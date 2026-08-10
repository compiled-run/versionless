import { createHash } from 'node:crypto';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const ACTUAL_BUDGET_REVISION = '3edf94714540837c67e6ac521efef3eed5e15bc6' as const;
export const ACTUAL_BUDGET_TREE = '1dcc782100f84487473a871b5af099769ab90a07' as const;

type JsonRecord = Record<string, unknown>;

function objectRecord(value: unknown, label: string): JsonRecord {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Actual Budget ${label} must be an object`);
	return value as JsonRecord;
}

function stringRecord(value: unknown, label: string): Record<string, string> {
	const record = objectRecord(value, label);
	for (const entry of Object.values(record))
		if (typeof entry !== 'string') throw new Error(`Actual Budget ${label} differs`);
	return record as Record<string, string>;
}

function gitBlobSha(bytes: Uint8Array): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

function assertGitIdentity(bytes: Uint8Array, expectedGitSha?: string): void {
	if (expectedGitSha !== undefined && gitBlobSha(bytes) !== expectedGitSha)
		throw new Error('Actual Budget immutable Git blob identity differs');
}

function replaceUnique(source: string, candidates: readonly string[], replacement: string): string {
	const matches = candidates.filter(
		(candidate) =>
			source.indexOf(candidate) >= 0 &&
			source.indexOf(candidate) === source.lastIndexOf(candidate),
	);
	if (matches.length !== 1) throw new Error('Actual Budget exact migration boundary differs');
	return source.replace(matches[0]!, replacement);
}

export function applyActualBudgetLocalOnlyOverlay(input: {
	sourceBytes: Uint8Array;
	expectedGitSha?: string;
}): { code: string; sourceSha256: string; outputSha256: string; changes: readonly string[] } {
	assertGitIdentity(input.sourceBytes, input.expectedGitSha);
	const source = Buffer.from(input.sourceBytes).toString('utf8');
	const candidates = [
		"send('create-budget', { testMode })",
		"send('create-budget', {\n      testMode\n    })",
		"send('create-budget', {\n      testMode,\n    })",
		"send('create-budget', {\n        testMode\n      })",
		"send('create-budget', {\n        testMode,\n      })",
	] as const;
	const matching = candidates.find(
		(candidate) =>
			source.indexOf(candidate) >= 0 &&
			source.indexOf(candidate) === source.lastIndexOf(candidate),
	);
	if (!matching || candidates.filter((candidate) => source.includes(candidate)).length !== 1)
		throw new Error('Actual Budget create-budget payload boundary differs');
	const code = source.replace(
		matching,
		matching.replace('testMode', 'testMode, avoidUpload: true'),
	);
	if (
		code.includes('testMode: true') ||
		code.includes('testMode = true') ||
		!code.includes('avoidUpload: true')
	)
		throw new Error('Actual Budget local-only overlay semantics differ');
	return {
		code,
		sourceSha256: sha256(source),
		outputSha256: sha256(code),
		changes: ['create-budget-existing-avoidUpload-true'] as const,
	};
}

export function planActualBudgetTargetWebPackage(input: {
	packageBytes: Uint8Array;
	expectedGitSha?: string;
}): { packageJson: string; changes: readonly string[]; digest: string } {
	assertGitIdentity(input.packageBytes, input.expectedGitSha);
	const manifest = objectRecord(
		JSON.parse(Buffer.from(input.packageBytes).toString('utf8')),
		'web package',
	);
	if (manifest.name !== '@actual-app/web' || manifest.version !== '22.12.03')
		throw new Error('Actual Budget web package identity differs');
	const dependencies = stringRecord(manifest.dependencies, 'web dependencies');
	const devDependencies = stringRecord(manifest.devDependencies, 'web devDependencies');
	if (
		dependencies.react !== '16.13.1' ||
		dependencies['react-dom'] !== '16.13.1' ||
		devDependencies.webpack !== '4.19.1' ||
		devDependencies['worker-loader'] !== '3.0.2'
	)
		throw new Error('Actual Budget legacy React/Webpack boundary differs');
	const targetDependencies = {
		...dependencies,
		react: '18.3.1',
		'react-dom': '18.3.1',
		scheduler: '0.23.2',
	};
	const packageJson = `${JSON.stringify({ ...manifest, dependencies: targetDependencies }, null, 2)}\n`;
	const changes = [
		'react-16.13.1-to-18.3.1',
		'react-dom-16.13.1-to-18.3.1',
		'scheduler-0.23.2-exact',
		'webpack-worker-loader-to-vite8-adapter',
	] as const;
	return { packageJson, changes, digest: sha256(canonicalize({ packageJson, changes })) };
}

export function transformActualBudgetReactRoot(input: {
	sourceBytes: Uint8Array;
	expectedGitSha?: string;
}): { code: string; changes: readonly string[]; digest: string } {
	assertGitIdentity(input.sourceBytes, input.expectedGitSha);
	let code = Buffer.from(input.sourceBytes).toString('utf8');
	code = replaceUnique(
		code,
		["import ReactDOM from 'react-dom';", "import * as ReactDOM from 'react-dom';"],
		"import { createRoot } from 'react-dom/client';",
	);
	const renderCandidates = [
		"ReactDOM.render(<App />, document.getElementById('root'));",
		'ReactDOM.render(<App />, document.getElementById("root"));',
		"ReactDOM.render(<App />, document.getElementById('root'))",
		'ReactDOM.render(<App />, document.getElementById("root"))',
	] as const;
	const render = renderCandidates.find((candidate) => code.includes(candidate));
	if (
		!render ||
		code.indexOf('ReactDOM.render(') < 0 ||
		code.indexOf('ReactDOM.render(') !== code.lastIndexOf('ReactDOM.render(')
	)
		throw new Error('Actual Budget ReactDOM.render boundary differs');
	const terminator = render.endsWith(';') ? ';' : '';
	code = code.replace(
		render,
		`createRoot(document.getElementById('root')!).render(<App />)${terminator}`,
	);
	const changes = ['react-dom-render-to-createRoot'] as const;
	return { code, changes, digest: sha256(canonicalize({ code, changes })) };
}

export function transformActualBudgetWorkerImport(input: {
	sourceBytes: Uint8Array;
	expectedGitSha?: string;
}): { code: string; changes: readonly string[]; digest: string } {
	assertGitIdentity(input.sourceBytes, input.expectedGitSha);
	const source = Buffer.from(input.sourceBytes).toString('utf8');
	const workerLoaderImports = [
		"import BackendWorker from 'worker-loader!./worker';",
		"import BackendWorker from 'worker-loader!./worker.js';",
		"import BackendWorker from 'worker-loader!../worker';",
		"import BackendWorker from 'worker-loader!../worker.js';",
	] as const;
	const selected = workerLoaderImports.find((candidate) => source.includes(candidate));
	if (
		!selected ||
		workerLoaderImports.filter((candidate) => source.includes(candidate)).length !== 1
	)
		throw new Error('Actual Budget worker-loader boundary differs');
	const workerPath = selected.includes('../worker') ? '../worker.js' : './worker.js';
	const code = source.replace(
		selected,
		`const createBackendWorker = (): Worker => new Worker(new URL('${workerPath}', import.meta.url), { type: 'module' });`,
	);
	const constructorCandidates = ['new BackendWorker()', 'new BackendWorker'] as const;
	const constructor = constructorCandidates.find(
		(candidate) =>
			code.indexOf(candidate) >= 0 && code.indexOf(candidate) === code.lastIndexOf(candidate),
	);
	if (!constructor) throw new Error('Actual Budget worker construction boundary differs');
	const transformed = code.replace(constructor, 'createBackendWorker()');
	const changes = ['worker-loader-to-vite-dedicated-worker'] as const;
	return {
		code: transformed,
		changes,
		digest: sha256(canonicalize({ code: transformed, changes })),
	};
}

export function mutateActualBudgetTransferAvailable(input: {
	sourceBytes: Uint8Array;
	expectedGitSha?: string;
}): { code: string; sourceSha256: string; mutatedSha256: string } {
	assertGitIdentity(input.sourceBytes, input.expectedGitSha);
	const source = Buffer.from(input.sourceBytes).toString('utf8');
	const before = 'amount: budgeted + amount';
	const after = 'amount: budgeted - amount';
	if (source.indexOf(before) < 0 || source.indexOf(before) !== source.lastIndexOf(before))
		throw new Error('Actual Budget transferAvailable mutation boundary differs');
	if (source.includes(after))
		throw new Error('Actual Budget transferAvailable is already mutated');
	const code = source.replace(before, after);
	return { code, sourceSha256: sha256(source), mutatedSha256: sha256(code) };
}
