import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import {
	mutateGraphiQLIsTest,
	planGraphiQLTargetPackage,
	planGraphiQLTargetExamplePackage,
	transformGraphiQLExample,
} from '../src/react-graphiql-migration.ts';

const gitSha = (bytes: Uint8Array): string =>
	createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');

describe('GraphiQL 0.13 bounded migration', () => {
	test('preserves unrelated package maps while pinning the React18/Vite8 target', () => {
		const bytes = Buffer.from(
			JSON.stringify({
				name: 'graphiql',
				version: '0.13.0',
				dependencies: { codemirror: '^5.47.0' },
				devDependencies: {
					browserify: '16.2.3',
					chai: '4.2.0',
					react: '15.6.2',
					'react-dom': '15.6.2',
				},
				peerDependencies: {
					graphql: '^14.0.0',
					react: '^15.6.0 || ^16.0.0',
					'react-dom': '^15.6.0 || ^16.0.0',
				},
				scripts: { 'build-js': 'bash ./resources/build.sh', test: 'jest' },
			}),
		);
		const target = JSON.parse(
			planGraphiQLTargetPackage({ packageBytes: bytes, expectedGitSha: gitSha(bytes) })
				.packageJson,
		) as {
			dependencies: Record<string, string>;
			devDependencies: Record<string, string>;
			peerDependencies: Record<string, string>;
		};
		expect(target.dependencies).toEqual({ codemirror: '^5.47.0' });
		expect(target.devDependencies).toMatchObject({
			browserify: '16.2.3',
			chai: '4.2.0',
			react: '18.3.1',
			'react-dom': '18.3.1',
			scheduler: '0.23.2',
		});
		expect(target.peerDependencies).toEqual({
			graphql: '^14.0.0',
			react: '^18.3.1',
			'react-dom': '^18.3.1',
		});
	});

	test('localizes all four exact CDN assets and applies only target createRoot/Vite seams', () => {
		const html = Buffer.from(
			`<script src="//cdn.jsdelivr.net/es6-promise/4.0.5/es6-promise.auto.min.js"></script>\n<script src="//cdn.jsdelivr.net/fetch/0.9.0/fetch.min.js"></script>\n<script src="//cdn.jsdelivr.net/react/15.4.2/react.min.js"></script>\n<script src="//cdn.jsdelivr.net/react/15.4.2/react-dom.min.js"></script>\n<script src="/graphiql.js"></script>\nReactDOM.render(\n        React.createElement(GraphiQL, {\n        }),\n        document.getElementById('graphiql')\n      );`,
		);
		const baseline = transformGraphiQLExample({
			htmlBytes: html,
			lane: 'baseline',
			expectedGitSha: gitSha(html),
		});
		expect(baseline.html).not.toContain('cdn.jsdelivr.net');
		expect(baseline.changes).toHaveLength(4);
		const target = transformGraphiQLExample({
			htmlBytes: html,
			lane: 'target',
			expectedGitSha: gitSha(html),
		});
		expect(target.html).toContain('ReactDOM.createRoot');
		expect(target.html).toContain('/graphiql-vite.js');
	});

	test('mutates only the exact isTest resolver and refuses identity drift', () => {
		const bytes = Buffer.from(
			`const x = {\n    isTest: {\n      type: GraphQLBoolean,\n      description: 'Is this a test schema? Sure it is.',\n      resolve: () => {\n        return true;\n      },\n    },\n};\n`,
		);
		const result = mutateGraphiQLIsTest({ schemaBytes: bytes, expectedGitSha: gitSha(bytes) });
		expect(result.code).toContain('return false;');
		expect(result.code).not.toContain('return true;');
		expect(() => mutateGraphiQLIsTest({ schemaBytes: bytes, expectedGitSha: 'drift' })).toThrow(
			'Git identity differs',
		);
	});

	test('identity-binds and updates only the example React optional edges', () => {
		const bytes = Buffer.from(
			JSON.stringify({
				dependencies: { express: '^4.13.3', graphiql: '../', graphql: '^0.10.1' },
				optionalDependencies: { react: '^15.4.2', 'react-dom': '^15.4.2' },
				scripts: { setup: 'cp ../graphiql.js ../graphiql.css .', start: 'node server.js' },
			}),
		);
		const target = JSON.parse(
			planGraphiQLTargetExamplePackage({
				packageBytes: bytes,
				expectedGitSha: gitSha(bytes),
			}).packageJson,
		) as Record<string, any>;
		expect(target.dependencies).toEqual({
			express: '^4.13.3',
			graphiql: '../',
			graphql: '^0.10.1',
		});
		expect(target.optionalDependencies).toEqual({ react: '18.3.1', 'react-dom': '18.3.1' });
		expect(target.scripts).toEqual({
			setup: 'cp ../graphiql.js ../graphiql.css .',
			start: 'node server.js',
		});
	});
});
