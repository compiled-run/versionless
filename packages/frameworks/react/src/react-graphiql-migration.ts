import { createHash } from 'node:crypto';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

const packageGitSha = 'bf491a471e327167d1aafdb7238437ad6c15097e' as const;
const exampleGitSha = 'd316db2ffd6d63427edbc9bb475b750820fcd74e' as const;
const schemaGitSha = 'e8dafd36a9ae9cd1adb3d265174d0afb497e4baa' as const;
const examplePackageGitSha = '2cf9353097f4f39a33ed9b40ed6f334cec446442' as const;

const cdnReplacements = Object.freeze([
	[
		'//cdn.jsdelivr.net/es6-promise/4.0.5/es6-promise.auto.min.js',
		'/vendor/es6-promise.auto.min.js',
	],
	['//cdn.jsdelivr.net/fetch/0.9.0/fetch.min.js', '/vendor/fetch.min.js'],
	['//cdn.jsdelivr.net/react/15.4.2/react.min.js', '/vendor/react.min.js'],
	['//cdn.jsdelivr.net/react/15.4.2/react-dom.min.js', '/vendor/react-dom.min.js'],
] as const);

type GraphiQLPackage = {
	name?: unknown;
	version?: unknown;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	scripts?: Record<string, string>;
};

function gitBlobSha(bytes: Uint8Array): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

function replaceExactlyOnce(source: string, before: string, after: string, label: string): string {
	if (source.indexOf(before) < 0 || source.indexOf(before) !== source.lastIndexOf(before))
		throw new Error(`GraphiQL ${label} boundary differs`);
	return source.replace(before, after);
}

export function planGraphiQLTargetPackage(input: {
	packageBytes: Uint8Array;
	expectedGitSha?: string;
}): { packageJson: string; changes: string[]; digest: string } {
	if (gitBlobSha(input.packageBytes) !== (input.expectedGitSha ?? packageGitSha))
		throw new Error('GraphiQL package Git identity differs');
	const value = JSON.parse(Buffer.from(input.packageBytes).toString('utf8')) as GraphiQLPackage;
	if (
		value.name !== 'graphiql' ||
		value.version !== '0.13.0' ||
		value.devDependencies?.react !== '15.6.2' ||
		value.devDependencies?.['react-dom'] !== '15.6.2' ||
		value.devDependencies?.browserify !== '16.2.3' ||
		value.peerDependencies?.react !== '^15.6.0 || ^16.0.0' ||
		value.peerDependencies?.['react-dom'] !== '^15.6.0 || ^16.0.0' ||
		value.scripts?.['build-js'] !== 'bash ./resources/build.sh'
	)
		throw new Error('GraphiQL package migration source differs');
	const dependencies = { ...value.dependencies };
	const devDependencies = {
		...value.devDependencies,
		react: '18.3.1',
		'react-dom': '18.3.1',
		scheduler: '0.23.2',
	};
	const peerDependencies = {
		...value.peerDependencies,
		react: '^18.3.1',
		'react-dom': '^18.3.1',
	};
	const scripts = { ...value.scripts };
	const packageJson = `${JSON.stringify({ ...value, dependencies, devDependencies, peerDependencies, scripts }, null, 2)}\n`;
	const changes = [
		'react-15.6.2-to-18.3.1',
		'react-dom-15.6.2-to-18.3.1',
		'scheduler-0.23.2-exact',
		'vite-8.0.16-versionless-adapter-build',
	];
	return { packageJson, changes, digest: sha256(canonicalize({ packageJson, changes })) };
}

export function transformGraphiQLExample(input: {
	htmlBytes: Uint8Array;
	lane: 'baseline' | 'target';
	expectedGitSha?: string;
}): { html: string; changes: string[]; digest: string } {
	if (gitBlobSha(input.htmlBytes) !== (input.expectedGitSha ?? exampleGitSha))
		throw new Error('GraphiQL example Git identity differs');
	let html = Buffer.from(input.htmlBytes).toString('utf8');
	const changes: string[] = [];
	for (const [remote, local] of cdnReplacements) {
		html = replaceExactlyOnce(html, remote, local, `CDN asset ${remote}`);
		changes.push(`local-mirror:${local}`);
	}
	if (input.lane === 'target') {
		html = replaceExactlyOnce(
			html,
			'/vendor/react.min.js',
			'/vendor/react-18.3.1.js',
			'React asset',
		);
		html = replaceExactlyOnce(
			html,
			'/vendor/react-dom.min.js',
			'/vendor/react-dom-18.3.1.js',
			'ReactDOM asset',
		);
		html = replaceExactlyOnce(html, '/graphiql.js', '/graphiql-vite.js', 'Vite bundle');
		html = replaceExactlyOnce(
			html,
			`ReactDOM.render(
        React.createElement(GraphiQL, {`,
			`ReactDOM.createRoot(document.getElementById('graphiql')).render(
        React.createElement(GraphiQL, {`,
			'React createRoot call',
		);
		html = replaceExactlyOnce(
			html,
			`        }),
        document.getElementById('graphiql')
      );`,
			`        })
      );`,
			'React render container',
		);
		changes.push('react-dom-render-to-createRoot', 'browserify-bundle-to-vite-bundle');
	}
	return { html, changes, digest: sha256(canonicalize({ html, changes })) };
}

export function planGraphiQLTargetExamplePackage(input: {
	packageBytes: Uint8Array;
	expectedGitSha?: string;
}): { packageJson: string; changes: string[]; digest: string } {
	if (gitBlobSha(input.packageBytes) !== (input.expectedGitSha ?? examplePackageGitSha))
		throw new Error('GraphiQL example package Git identity differs');
	const value = JSON.parse(Buffer.from(input.packageBytes).toString('utf8')) as {
		dependencies?: Record<string, string>;
		optionalDependencies?: Record<string, string>;
		scripts?: Record<string, string>;
	};
	if (
		value.dependencies?.graphiql !== '../' ||
		value.dependencies?.graphql !== '^0.10.1' ||
		value.optionalDependencies?.react !== '^15.4.2' ||
		value.optionalDependencies?.['react-dom'] !== '^15.4.2' ||
		value.scripts?.start !== 'node server.js'
	)
		throw new Error('GraphiQL example package migration source differs');
	const optionalDependencies = {
		...value.optionalDependencies,
		react: '18.3.1',
		'react-dom': '18.3.1',
	};
	const packageJson = `${JSON.stringify({ ...value, optionalDependencies }, null, 2)}\n`;
	const changes = ['example-react-15.4.2-to-18.3.1', 'example-react-dom-15.4.2-to-18.3.1'];
	return { packageJson, changes, digest: sha256(canonicalize({ packageJson, changes })) };
}

const mutationBefore = `    isTest: {
      type: GraphQLBoolean,
      description: 'Is this a test schema? Sure it is.',
      resolve: () => {
        return true;
      },
    },`;
const mutationAfter = mutationBefore.replace('return true;', 'return false;');

export function mutateGraphiQLIsTest(input: { schemaBytes: Uint8Array; expectedGitSha?: string }): {
	code: string;
	sourceSha256: string;
	mutatedSha256: string;
} {
	if (gitBlobSha(input.schemaBytes) !== (input.expectedGitSha ?? schemaGitSha))
		throw new Error('GraphiQL schema Git identity differs');
	const source = Buffer.from(input.schemaBytes).toString('utf8');
	const code = replaceExactlyOnce(source, mutationBefore, mutationAfter, 'isTest mutation');
	return { code, sourceSha256: sha256(source), mutatedSha256: sha256(code) };
}
