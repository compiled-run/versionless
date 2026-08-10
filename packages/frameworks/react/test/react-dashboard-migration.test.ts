import { describe, expect, test } from 'vitest';
import {
	reactDashboardJourney,
	transformReactDashboardVite8,
} from '../src/react-dashboard-migration.ts';

const manifest = JSON.stringify({
	dependencies: { react: '18.2.0', 'react-dom': '18.2.0' },
	devDependencies: { vite: '4.0.4' },
});

describe('React Dashboard Vite 8 migration', () => {
	test('performs only the pinned package and strict TypeScript config migration', () => {
		const result = transformReactDashboardVite8({
			'package.json': manifest,
			'vite.config.js': 'immutable legacy input',
			'src/index.tsx': 'unchanged',
		});
		expect(result.changedFiles).toEqual(['package.json', 'vite.config.js', 'vite.config.ts']);
		expect(result.files['vite.config.js']).toBeUndefined();
		expect(result.files['vite.config.ts']).toContain('type ConfigEnv');
		expect(result.files['vite.config.ts']).toContain('from "pathe"');
		expect(result.files['src/index.tsx']).toBe('unchanged');
		expect(JSON.parse(result.files['package.json']!)).toMatchObject({
			dependencies: { react: '18.3.1', 'react-dom': '18.3.1' },
			devDependencies: { vite: '8.0.0' },
		});
	});

	test('rejects an unpinned source baseline', () => {
		expect(() =>
			transformReactDashboardVite8({
				'package.json': manifest.replace('4.0.4', '4.1.0'),
				'vite.config.js': 'changed',
			}),
		).toThrow('pinned baseline');
	});

	test('defines meaningful add, type, drag, settings, theme, language, and persistence witnesses', () => {
		expect(reactDashboardJourney.witness).toBe('direct-browser');
		expect(reactDashboardJourney.steps.map((step) => step.action)).toEqual([
			'click',
			'click',
			'fill',
			'drag',
			'reload-and-read',
			'click',
			'click',
			'select',
			'reload-and-read',
		]);
	});
});
