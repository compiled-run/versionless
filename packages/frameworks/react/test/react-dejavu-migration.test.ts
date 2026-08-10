import { describe, expect, test } from 'vitest';
import {
	DEJAVU_TARGET,
	assertDejavuMigrationParity,
	planReactDejavuMigration,
} from '../src/react-dejavu-migration.ts';

const routes = ['/connect', '/:index/browse', '/:index/mappings'];
const requests = [
	'GET /_cat/indices',
	'GET /:index/_mapping',
	'POST /:index/_search',
	'POST /:index/_doc',
	'POST /:index/_update/:id',
	'DELETE /:index/_doc/:id',
];

describe('React Dejavu migration adapter', () => {
	test('pins React 18.3.1, Node 24.15.0 and Vite 8.0.16 while preserving behavior', () => {
		const plan = planReactDejavuMigration({
			packageJson: { scripts: { build: 'webpack' }, dependencies: { react: '16' } },
			routes,
			requestSemantics: requests,
		});
		expect(plan.target).toEqual(DEJAVU_TARGET);
		expect(plan.transformDigest).toHaveLength(64);
		expect(() =>
			assertDejavuMigrationParity(plan, {
				routes,
				requestSemantics: requests,
				outputFiles: ['index.html', 'assets/index.js'],
			}),
		).not.toThrow();
	});

	test('rejects missing behavior and forbidden target output', () => {
		expect(() =>
			planReactDejavuMigration({
				packageJson: { scripts: {}, dependencies: {} },
				routes: ['/connect'],
				requestSemantics: requests,
			}),
		).toThrow('route inventory');
		const plan = planReactDejavuMigration({
			packageJson: { scripts: {}, dependencies: {} },
			routes,
			requestSemantics: requests,
		});
		expect(() =>
			assertDejavuMigrationParity(plan, {
				routes,
				requestSemantics: requests,
				outputFiles: ['service-worker.js'],
			}),
		).toThrow('forbidden');
	});
});
