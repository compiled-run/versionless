import { describe, expect, test } from 'vitest';
import {
	applyActualBudgetLocalOnlyOverlay,
	mutateActualBudgetTransferAvailable,
	planActualBudgetTargetWebPackage,
	transformActualBudgetReactRoot,
	transformActualBudgetWorkerImport,
} from '../src/react-actual-budget-v22-12-9-migration.ts';

describe('Actual Budget v22.12.9 bounded React migration', () => {
	test('uses only the existing avoidUpload handler seam and keeps testMode false', () => {
		const result = applyActualBudgetLocalOnlyOverlay({
			sourceBytes: Buffer.from("await send('create-budget', { testMode });\n"),
		});
		expect(result.code).toContain("send('create-budget', { testMode, avoidUpload: true })");
		expect(result.code).not.toContain('testMode: true');
		expect(result.changes).toEqual(['create-budget-existing-avoidUpload-true']);
		expect(() =>
			applyActualBudgetLocalOnlyOverlay({
				sourceBytes: Buffer.from(
					"send('create-budget', { testMode }); send('create-budget', { testMode });",
				),
			}),
		).toThrow('payload boundary differs');
	});

	test('plans exact React 18 versions while retaining the authentic Webpack source boundary', () => {
		const result = planActualBudgetTargetWebPackage({
			packageBytes: Buffer.from(
				JSON.stringify({
					name: '@actual-app/web',
					version: '22.12.03',
					dependencies: { react: '16.13.1', 'react-dom': '16.13.1' },
					devDependencies: { webpack: '4.19.1', 'worker-loader': '3.0.2' },
				}),
			),
		});
		const target = JSON.parse(result.packageJson) as {
			dependencies: Record<string, string>;
		};
		expect(target.dependencies).toMatchObject({
			react: '18.3.1',
			'react-dom': '18.3.1',
			scheduler: '0.23.2',
		});
		expect(result.changes).toContain('webpack-worker-loader-to-vite8-adapter');
	});

	test('converts only an exact ReactDOM render and dedicated worker-loader seam', () => {
		const root = transformActualBudgetReactRoot({
			sourceBytes: Buffer.from(
				"import ReactDOM from 'react-dom';\nReactDOM.render(<App />, document.getElementById('root'));\n",
			),
		});
		expect(root.code).toContain("import { createRoot } from 'react-dom/client';");
		expect(root.code).toContain(
			"createRoot(document.getElementById('root')!).render(<App />);",
		);
		const worker = transformActualBudgetWorkerImport({
			sourceBytes: Buffer.from(
				"import BackendWorker from 'worker-loader!./worker.js';\nconst worker = new BackendWorker();\n",
			),
		});
		expect(worker.code).toContain("new Worker(new URL('./worker.js', import.meta.url)");
		expect(worker.code).toContain('const worker = createBackendWorker();');
	});

	test('defines one causal finance mutation with exact restoration bytes', () => {
		const source = Buffer.from('return { category, amount: budgeted + amount };\n');
		const result = mutateActualBudgetTransferAvailable({ sourceBytes: source });
		expect(result.code).toContain('amount: budgeted - amount');
		expect(result.sourceSha256).not.toBe(result.mutatedSha256);
		expect(Buffer.from(source).toString('utf8')).toContain('amount: budgeted + amount');
	});
});
