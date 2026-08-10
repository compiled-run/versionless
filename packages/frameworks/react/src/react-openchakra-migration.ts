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

export function planOpenChakraVite8Migration(input: {
	packageBytes: Uint8Array;
	packageIdentity: { gitSha: string; size: number };
	adapterSource: string;
}): {
	packageJson: string;
	adapterSource: string;
	changedFiles: ['package.json', 'vite.versionless.config.ts'];
	applicationSourceChanges: 0;
	digest: string;
} {
	if (
		input.packageBytes.length !== input.packageIdentity.size ||
		gitBlobSha(input.packageBytes) !== input.packageIdentity.gitSha
	)
		throw new Error('OpenChakra tree-derived package identity differs');
	const value = JSON.parse(Buffer.from(input.packageBytes).toString('utf8')) as PackageDocument;
	const react = value.dependencies?.react ?? value.devDependencies?.react;
	if (
		(!react?.includes('17.') && !react?.includes('16.')) ||
		!value.scripts?.build ||
		!input.adapterSource.includes("from 'vite'") ||
		input.adapterSource.includes('webpack') ||
		input.adapterSource.includes('serviceWorker')
	)
		throw new Error('OpenChakra bounded Vite 8 migration differs');
	const packageJson = `${JSON.stringify(
		{ ...value, devDependencies: { ...value.devDependencies, vite: '8.0.16' } },
		null,
		2,
	)}\n`;
	const body = {
		packageJson,
		adapterSource: input.adapterSource,
		changedFiles: ['package.json', 'vite.versionless.config.ts'] as [
			'package.json',
			'vite.versionless.config.ts',
		],
		applicationSourceChanges: 0 as const,
	};
	return { ...body, digest: sha256(canonicalize(body)) };
}
