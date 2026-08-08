import { findArchiveFile, type ArchiveIndex } from '../../../core/src/corpus/tier-f-provenance.ts';
import type { ProvenanceSourceFacts } from '../../../core/src/receipts/provenance-framework-classification.ts';

function versionMajor(value: unknown): number | undefined {
	if (typeof value !== 'string') return undefined;
	const start = [...value].findIndex((character) => character >= '0' && character <= '9');
	if (start === -1) return undefined;
	let digits = '';
	for (const character of value.slice(start)) {
		if (character < '0' || character > '9') break;
		digits += character;
	}
	return digits ? Number(digits) : undefined;
}

function nonemptySource(index: ArchiveIndex, file: string): string {
	const source = findArchiveFile(index, file).bytes.toString('utf8');
	if (!source.trim()) throw new Error(`Next.js provenance source is empty: ${file}`);
	return source;
}

export function classifyNextjsProvenanceArchive(index: ArchiveIndex): ProvenanceSourceFacts {
	const manifestSource = nonemptySource(index, 'package.json');
	let manifest: {
		dependencies?: Record<string, unknown>;
		devDependencies?: Record<string, unknown>;
		scripts?: Record<string, unknown>;
	};
	try {
		manifest = JSON.parse(manifestSource) as typeof manifest;
	} catch {
		throw new Error('Next.js provenance package.json is invalid JSON');
	}
	const nextDeclaration = manifest.dependencies?.next ?? manifest.devDependencies?.next;
	const reactDeclaration = manifest.dependencies?.react ?? manifest.devDependencies?.react;
	if (typeof nextDeclaration !== 'string' || versionMajor(nextDeclaration) !== 12)
		throw new Error('Next.js provenance does not declare exact major 12 evidence');
	if (typeof reactDeclaration !== 'string' || !reactDeclaration)
		throw new Error('Next.js provenance lacks a React version declaration');
	const yarnLock = nonemptySource(index, 'yarn.lock');
	if (!yarnLock.includes('# yarn lockfile v1'))
		throw new Error('Next.js provenance lockfile is not Yarn v1');
	const pagesIndex = nonemptySource(index, 'pages/index.tsx');
	if (!pagesIndex.includes('getStaticProps'))
		throw new Error('Next.js provenance Pages source lacks getStaticProps');
	const playwrightConfiguration = nonemptySource(index, 'playwright.config.ts');
	if (!playwrightConfiguration.toLowerCase().includes('playwright'))
		throw new Error('Next.js provenance Playwright configuration is not corroborated');
	const playwrightWorkflow = nonemptySource(index, '.github/workflows/playwright.yml');
	if (!playwrightWorkflow.toLowerCase().includes('playwright'))
		throw new Error('Next.js provenance Playwright workflow is not corroborated');
	const nextConfiguration = nonemptySource(index, 'next.config.js');
	if (!nextConfiguration.includes('@svgr/webpack'))
		throw new Error('Next.js provenance custom webpack loader is not corroborated');
	nonemptySource(index, 'components/Search/index.tsx');
	const scripts = Object.entries(manifest.scripts ?? {})
		.map(([name, command]) => {
			if (!name || typeof command !== 'string' || !command)
				throw new Error('Next.js provenance package scripts are invalid');
			return { name, command };
		})
		.sort((left, right) => left.name.localeCompare(right.name));
	if (scripts.length === 0) throw new Error('Next.js provenance package scripts are absent');
	return {
		next: { declaration: nextDeclaration, major: 12 },
		react: { declaration: reactDeclaration },
		packageManager: { name: 'yarn', lockfile: 'yarn.lock', format: 'v1' },
		routing: { mode: 'pages', evidence: ['pages/index.tsx'] },
		staticGeneration: { kind: 'getStaticProps', evidence: ['pages/index.tsx'] },
		playwright: {
			configuration: 'playwright.config.ts',
			workflow: '.github/workflows/playwright.yml',
			state: 'present-not-executed',
		},
		productionStack: {
			owner: 'candidate',
			framework: 'nextjs',
			bundler: 'webpack',
			customLoader: '@svgr/webpack',
			configuration: 'next.config.js',
			preserved: true,
			viteReplacement: false,
			unpluginReplacement: false,
			compatibility: 'not-tested',
		},
		searchPath: 'components/Search/index.tsx',
		scripts,
	};
}
