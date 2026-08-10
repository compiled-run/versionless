import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import {
	planReactCalculatorTargetPackage,
	transformReactCalculatorBootstrap,
} from '../src/react-calculator-migration.ts';

const gitSha = (bytes: Uint8Array): string =>
	createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');

const exactPackageBytes = Buffer.from(`{
  "name": "calculator",
  "version": "0.1.0",
  "license": "MIT",
  "homepage": "http://ahfarmer.github.io/calculator",
  "devDependencies": {
    "chai": "^4.2.0",
    "gh-pages": "^2.0.1",
    "prettier": "^1.17.1",
    "react-scripts": "^3.0.1"
  },
  "dependencies": {
    "big.js": "^5.2.2",
    "github-fork-ribbon-css": "^0.2.1",
    "react": "^16.8.6",
    "react-dom": "^16.8.6"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test --env=jsdom",
    "eject": "react-scripts eject",
    "deploy": "gh-pages -d build"
  },
  "prettier": {
    "trailingComma": "all"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
`);

describe('React Calculator bounded target migration', () => {
	test('performs an identity-gated idempotent createRoot and service-worker migration', () => {
		const bytes = Buffer.from(
			"import ReactDOM from 'react-dom';\nimport * as serviceWorker from './serviceWorker';\nReactDOM.render(<App />, document.getElementById('root'));\nserviceWorker.unregister();\n",
		);
		const result = transformReactCalculatorBootstrap({
			sourceBytes: bytes,
			expectedGitSha: gitSha(bytes),
		});
		expect(result.code).toContain("import { createRoot } from 'react-dom/client';");
		expect(result.code).toContain(
			"createRoot(document.getElementById('root')).render(<App />);",
		);
		expect(result.code).not.toContain('serviceWorker');
		expect(result.edits).toEqual([
			'react-dom-render-to-createRoot',
			'service-worker-import-call-removal',
		]);
		const again = transformReactCalculatorBootstrap({
			sourceBytes: Buffer.from(result.code),
			expectedGitSha: gitSha(Buffer.from(result.code)),
		});
		expect(again.changed).toBe(false);
	});

	test('pins the exact React18/Vite8 target and preserves calculator dependencies', () => {
		expect(exactPackageBytes).toHaveLength(881);
		expect(gitSha(exactPackageBytes)).toBe('33df28fc715d9353f96b2f71c4719ffad500280b');
		const result = planReactCalculatorTargetPackage({
			packageBytes: exactPackageBytes,
			expectedGitSha: '33df28fc715d9353f96b2f71c4719ffad500280b',
		});
		const target = JSON.parse(result.packageJson) as {
			dependencies: Record<string, string>;
			devDependencies: Record<string, string>;
			scripts: Record<string, string>;
		};
		expect(target.dependencies).toEqual({
			'big.js': '^5.2.2',
			'github-fork-ribbon-css': '^0.2.1',
			react: '18.3.1',
			'react-dom': '18.3.1',
			scheduler: '0.23.2',
		});
		expect(target.devDependencies).toEqual({
			chai: '^4.2.0',
			'gh-pages': '^2.0.1',
			prettier: '^1.17.1',
			vite: '8.0.16',
		});
		expect(target.scripts).toEqual({
			start: 'vite',
			build: 'vite build',
			test: 'react-scripts test --env=jsdom',
			eject: 'react-scripts eject',
			deploy: 'gh-pages -d build',
			preview: 'vite preview',
		});
	});

	test('refuses moved, duplicated, malformed and wrong-version react-scripts buckets', () => {
		const exact = JSON.parse(exactPackageBytes.toString('utf8')) as Record<string, unknown>;
		const dependencies = exact.dependencies as Record<string, unknown>;
		const devDependencies = exact.devDependencies as Record<string, unknown>;
		for (const changed of [
			{ ...exact, devDependencies: { ...devDependencies, 'react-scripts': undefined } },
			{
				...exact,
				dependencies: { ...dependencies, 'react-scripts': '^3.0.1' },
				devDependencies: { ...devDependencies, 'react-scripts': undefined },
			},
			{ ...exact, dependencies: { ...dependencies, 'react-scripts': '^3.0.1' } },
			{ ...exact, devDependencies: { ...devDependencies, 'react-scripts': '^3.0.2' } },
			{ ...exact, devDependencies: ['react-scripts'] },
		]) {
			const bytes = Buffer.from(JSON.stringify(changed));
			expect(() =>
				planReactCalculatorTargetPackage({
					packageBytes: bytes,
					expectedGitSha: gitSha(bytes),
				}),
			).toThrow('package migration source differs');
		}
	});

	test('refuses identity drift and ambiguous bootstrap boundaries', () => {
		const bytes = Buffer.from("import ReactDOM from 'react-dom';");
		expect(() =>
			transformReactCalculatorBootstrap({ sourceBytes: bytes, expectedGitSha: 'drift' }),
		).toThrow('Git identity differs');
		expect(() =>
			transformReactCalculatorBootstrap({
				sourceBytes: bytes,
				expectedGitSha: gitSha(bytes),
			}),
		).toThrow('render call differs');
	});
});
