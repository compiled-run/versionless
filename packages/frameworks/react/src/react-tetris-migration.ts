import { createHash } from 'node:crypto';
import { canonicalize, sha256 } from '../../../core/src/index.ts';

type PackageDocument = {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	scripts?: Record<string, string>;
};

function gitBlobSha(bytes: Uint8Array): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

export function planReactTetrisTarget(input: {
	packageBytes: Uint8Array;
	packageIdentity: { gitSha: string; size: number };
	adapterSource: string;
}): {
	packageJson: string;
	applicationSourceChanges: 0;
	bootstrapCompatibilityRequired: true;
	digest: string;
} {
	if (
		input.packageBytes.length !== input.packageIdentity.size ||
		gitBlobSha(input.packageBytes) !== input.packageIdentity.gitSha
	)
		throw new Error('React Tetris tree-derived package identity differs');
	const value = JSON.parse(Buffer.from(input.packageBytes).toString('utf8')) as PackageDocument;
	const react = value.dependencies?.react ?? value.devDependencies?.react;
	if (
		(!react?.includes('15.') && !react?.includes('16.') && !react?.includes('17.')) ||
		!value.scripts?.build ||
		!input.adapterSource.includes("from 'vite'") ||
		input.adapterSource.includes('webpack') ||
		input.adapterSource.includes('serviceWorker')
	)
		throw new Error('React Tetris bounded React18/Vite8 migration differs');
	const packageJson = `${JSON.stringify({ ...value, dependencies: { ...value.dependencies, react: '18.3.1', 'react-dom': '18.3.1' }, devDependencies: { ...value.devDependencies, vite: '8.0.16' } }, null, 2)}\n`;
	const body = {
		packageJson,
		applicationSourceChanges: 0 as const,
		bootstrapCompatibilityRequired: true as const,
	};
	return { ...body, digest: sha256(canonicalize(body)) };
}
