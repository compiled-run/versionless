import { describe, expect, test } from 'vitest';
import {
	planSqlpadTargetPackage,
	transformSqlpadBootstrap,
} from '../src/react-sqlpad-v5-5-0-migration.ts';

describe('SQLPad v5.5.0 React 18 migration', () => {
	test('changes only the authentic ReactDOM bootstrap boundary', () => {
		const source = Buffer.from(
			"import ReactDOM from 'react-dom';\nReactDOM.render(\n  <App />,\n  document.getElementById('root')\n);\n",
		);
		const result = transformSqlpadBootstrap({ sourceBytes: source });
		expect(result.changed).toBe(true);
		expect(result.code).toContain("import { createRoot } from 'react-dom/client';");
		expect(result.code).toContain("createRoot(document.getElementById('root')).render(");
		expect(result.code).not.toContain('ReactDOM.render');
	});

	test('pins React 18 and Vite 8 while removing target react-scripts', () => {
		const result = planSqlpadTargetPackage({
			packageBytes: Buffer.from(
				JSON.stringify({
					dependencies: {
						react: '^16.13.1',
						'react-dom': '^16.13.1',
						'react-scripts': '^3.4.1',
					},
					devDependencies: {},
					scripts: { build: 'react-scripts build' },
				}),
			),
		});
		const target = JSON.parse(result.packageJson) as {
			dependencies: Record<string, string>;
			devDependencies: Record<string, string>;
		};
		expect(target.dependencies).toMatchObject({
			react: '18.3.1',
			'react-dom': '18.3.1',
			scheduler: '0.23.2',
		});
		expect(target.dependencies['react-scripts']).toBeUndefined();
		expect(target.devDependencies.vite).toBe('8.0.16');
	});
});
