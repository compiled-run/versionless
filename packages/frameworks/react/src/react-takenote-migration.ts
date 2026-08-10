import { createHash } from 'node:crypto';
import { canonicalize, sha256 } from '../../../core/src/index.ts';

export const REACT_TAKENOTE_REVISION = 'e0eddbb9a21ae4cf4c4c7c183f29cfd666e08331' as const;
export const REACT_TAKENOTE_HISTORICAL_RAW_PACKAGE_RESPONSE_SHA256 =
	'd8784964887b365916d02e8cf252dd439a5e4bde8fe7ae4e8bf37bccfea17800' as const;

type PackageDocument = {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	scripts?: Record<string, string>;
};

function parsePackage(
	bytes: Uint8Array,
	identity: { gitSha: string; size: number },
): PackageDocument {
	const gitSha = createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
	if (bytes.length !== identity.size || gitSha !== identity.gitSha)
		throw new Error('TakeNote immutable tree-derived package identity differs');
	const value = JSON.parse(Buffer.from(bytes).toString('utf8')) as PackageDocument;
	if (
		value.dependencies?.react !== '^16.14.0' ||
		value.devDependencies?.['node-sass'] !== '^4.14.1' ||
		!Object.keys(value.devDependencies ?? {}).some((name) => name.includes('webpack'))
	)
		throw new Error('TakeNote React16/custom-webpack baseline differs');
	return value;
}

export function planTakeNoteSassCompatibility(
	packageBytes: Uint8Array,
	identity: { gitSha: string; size: number },
): {
	packageJson: string;
	removed: 'node-sass@^4.14.1';
	added: 'sass@1.32.13';
	applicationSourceChanges: 0;
	digest: string;
} {
	const value = parsePackage(packageBytes, identity);
	const devDependencies = { ...value.devDependencies };
	delete devDependencies['node-sass'];
	devDependencies.sass = '1.32.13';
	const packageJson = `${JSON.stringify({ ...value, devDependencies }, null, 2)}\n`;
	const body = {
		packageJson,
		removed: 'node-sass@^4.14.1' as const,
		added: 'sass@1.32.13' as const,
		applicationSourceChanges: 0 as const,
	};
	return { ...body, digest: sha256(canonicalize(body)) };
}

export function planTakeNoteVite8Migration(input: {
	compatiblePackageJson: string;
	adapterSource: string;
}): {
	packageJson: string;
	adapterSource: string;
	changedFiles: ['package.json', 'vite.versionless.config.ts'];
	digest: string;
} {
	const value = JSON.parse(input.compatiblePackageJson) as PackageDocument;
	if (
		value.devDependencies?.sass !== '1.32.13' ||
		value.devDependencies['node-sass'] !== undefined ||
		!input.adapterSource.includes("from 'vite'") ||
		!input.adapterSource.includes("'process.env.DEMO'") ||
		input.adapterSource.includes('webpack') ||
		input.adapterSource.includes('serviceWorker')
	)
		throw new Error('TakeNote bounded Vite 8 migration differs');
	const devDependencies = { ...value.devDependencies, vite: '8.0.16' };
	const packageJson = `${JSON.stringify({ ...value, devDependencies }, null, 2)}\n`;
	const body = {
		packageJson,
		adapterSource: input.adapterSource,
		changedFiles: ['package.json', 'vite.versionless.config.ts'] as [
			'package.json',
			'vite.versionless.config.ts',
		],
	};
	return { ...body, digest: sha256(canonicalize(body)) };
}
