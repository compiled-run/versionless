import { createHash } from 'node:crypto';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

const sourceImport = "import ReactDOM from 'react-dom';";
const targetImport = "import { createRoot } from 'react-dom/client';";
const sourceOpen = 'ReactDOM.render(\n';
const sourceClose = "  document.getElementById('root')\n);";
const targetOpen = "createRoot(document.getElementById('root')).render(\n";
const targetClose = ');';

function gitBlobSha(bytes: Uint8Array): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

export function transformSqlpadBootstrap(input: {
	sourceBytes: Uint8Array;
	expectedGitSha?: string;
}): { code: string; sourceSha256: string; targetSha256: string; changed: boolean } {
	if (input.expectedGitSha && gitBlobSha(input.sourceBytes) !== input.expectedGitSha)
		throw new Error('SQLPad bootstrap Git identity differs');
	const source = Buffer.from(input.sourceBytes).toString('utf8');
	if (source.includes(targetImport)) {
		if (source.includes(sourceImport) || !source.includes(targetOpen))
			throw new Error('SQLPad transformed bootstrap differs');
		return {
			code: source,
			sourceSha256: sha256(source),
			targetSha256: sha256(source),
			changed: false,
		};
	}
	if (
		source.indexOf(sourceImport) < 0 ||
		source.indexOf(sourceImport) !== source.lastIndexOf(sourceImport) ||
		source.indexOf(sourceOpen) < 0 ||
		source.indexOf(sourceOpen) !== source.lastIndexOf(sourceOpen) ||
		source.indexOf(sourceClose) < 0 ||
		source.indexOf(sourceClose) !== source.lastIndexOf(sourceClose)
	)
		throw new Error('SQLPad ReactDOM render boundary differs');
	const code = source
		.replace(sourceImport, targetImport)
		.replace(sourceOpen, targetOpen)
		.replace(sourceClose, targetClose);
	if (code.includes(sourceImport) || code.includes(sourceOpen) || !code.includes(targetOpen))
		throw new Error('SQLPad React 18 bootstrap migration differs');
	return {
		code,
		sourceSha256: sha256(source),
		targetSha256: sha256(code),
		changed: true,
	};
}

export function planSqlpadTargetPackage(input: {
	packageBytes: Uint8Array;
	expectedGitSha?: string;
}): { packageJson: string; digest: string; changes: string[] } {
	if (input.expectedGitSha && gitBlobSha(input.packageBytes) !== input.expectedGitSha)
		throw new Error('SQLPad package Git identity differs');
	const value = JSON.parse(Buffer.from(input.packageBytes).toString('utf8')) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		scripts?: Record<string, string>;
	};
	if (
		value.dependencies?.react !== '^16.13.1' ||
		value.dependencies?.['react-dom'] !== '^16.13.1' ||
		value.dependencies?.['react-scripts'] !== '^3.4.1' ||
		value.scripts?.build !== 'react-scripts build'
	)
		throw new Error('SQLPad legacy package identity differs');
	const dependencies = { ...value.dependencies };
	dependencies.react = '18.3.1';
	dependencies['react-dom'] = '18.3.1';
	dependencies.scheduler = '0.23.2';
	delete dependencies['react-scripts'];
	const devDependencies = { ...value.devDependencies, vite: '8.0.16' };
	const scripts = {
		...value.scripts,
		start: 'vite',
		build: 'vite build',
		preview: 'vite preview',
	};
	const packageJson = `${JSON.stringify({ ...value, dependencies, devDependencies, scripts }, null, 2)}\n`;
	const changes = [
		'react-16.13.1-to-18.3.1',
		'react-dom-16.13.1-to-18.3.1',
		'react-scripts-3.4.1-to-vite-8.0.16',
		'scheduler-0.23.2-exact',
	];
	return { packageJson, changes, digest: sha256(canonicalize({ packageJson, changes })) };
}
