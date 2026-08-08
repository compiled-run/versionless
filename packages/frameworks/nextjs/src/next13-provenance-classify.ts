import { findArchiveFile, type ArchiveIndex } from '../../../core/src/corpus/tier-f-provenance.ts';
import {
	NEXT13_SCRIPTS,
	type Next13SourceFacts,
} from '../../../core/src/receipts/next13-provenance-classification.ts';

function source(index: ArchiveIndex, filePath: string): string {
	const text = findArchiveFile(index, filePath).bytes.toString('utf8');
	if (!text.trim()) throw new Error(`Next13 provenance source is empty: ${filePath}`);
	return text;
}

export function classifyNext13ProvenanceArchive(index: ArchiveIndex): Next13SourceFacts {
	let manifest: {
		dependencies?: Record<string, unknown>;
		devDependencies?: Record<string, unknown>;
		engines?: Record<string, unknown>;
		packageManager?: unknown;
		scripts?: Record<string, unknown>;
	};
	try {
		manifest = JSON.parse(source(index, 'package.json')) as typeof manifest;
	} catch {
		throw new Error('Next13 provenance package.json is invalid JSON');
	}
	if (
		manifest.dependencies?.next !== '13.4.8' ||
		manifest.dependencies?.react !== '18.2.0' ||
		manifest.dependencies?.contentlayer !== '0.3.4'
	)
		throw new Error('Next13 provenance exact package declarations are absent');
	if (manifest.engines !== undefined)
		throw new Error('Next13 provenance Node engine must remain absent');
	if (
		manifest.packageManager !== undefined ||
		index.files.some((file) => file.path.startsWith('.yarn/releases/'))
	)
		throw new Error('Next13 provenance pinned Yarn release must remain absent');
	const scripts = Object.entries(manifest.scripts ?? {})
		.map(([name, command]) => {
			if (!name || typeof command !== 'string' || !command)
				throw new Error('Next13 provenance package scripts are invalid');
			return { name, command };
		})
		.sort((left, right) => left.name.localeCompare(right.name));
	if (JSON.stringify(scripts) !== JSON.stringify(NEXT13_SCRIPTS))
		throw new Error('Next13 provenance package scripts differ from accepted source');
	const yarnConfiguration = source(index, '.yarnrc.yml');
	if (yarnConfiguration.trim() !== 'nodeLinker: node-modules')
		throw new Error('Next13 provenance Yarn nodeLinker differs from node-modules');
	const yarnLock = source(index, 'yarn.lock');
	const lockLines = yarnLock.split('\n');
	if (!lockLines.includes('  version: 6'))
		throw new Error('Next13 provenance Yarn metadata version is not 6');
	const resolutions = lockLines.filter((line) => line.startsWith('  resolution:')).length;
	const checksums = lockLines.filter((line) => line.startsWith('  checksum:')).length;
	if (resolutions !== 1165 || checksums !== 1110)
		throw new Error('Next13 provenance Yarn resolution or checksum count changed');
	const layout = source(index, 'app/layout.tsx');
	if (!layout.includes("from 'next/font/google'") || !layout.includes('RootLayout'))
		throw new Error('Next13 provenance root layout or next/font evidence is absent');
	const page = source(index, 'app/blog/[...slug]/page.tsx');
	if (!page.includes('generateStaticParams') || !page.includes('params: { slug: string[] }'))
		throw new Error('Next13 provenance catch-all page evidence is absent');
	const apiRoute = source(index, 'app/api/newsletter2/route.ts');
	if (!apiRoute.includes('export async function POST'))
		throw new Error('Next13 provenance POST API route evidence is absent');
	const nextConfiguration = source(index, 'next.config.js');
	if (!nextConfiguration.includes('webpack:') || !nextConfiguration.includes('@svgr/webpack'))
		throw new Error('Next13 provenance webpack/@svgr evidence is absent');
	source(index, 'contentlayer.config.ts');
	const image = source(index, 'components/Image.tsx');
	if (!image.includes('next/image'))
		throw new Error('Next13 provenance next/image evidence is absent');
	return {
		next: { declaration: '13.4.8', major: 13 },
		react: { declaration: '18.2.0' },
		packageManager: {
			name: 'yarn',
			lockfile: 'yarn.lock',
			metadataVersion: 6,
			nodeLinker: 'node-modules',
			pinnedRelease: 'absent',
			resolutions: 1165,
			checksums: 1110,
		},
		routing: {
			mode: 'app',
			layout: 'app/layout.tsx',
			page: 'app/blog/[...slug]/page.tsx',
			dynamicRoute: 'catch-all',
			generateStaticParams: 'present-not-executed',
		},
		apiRoute: {
			path: 'app/api/newsletter2/route.ts',
			method: 'POST',
			state: 'present-not-executed',
		},
		resources: {
			font: {
				module: 'next/font/google',
				evidence: 'app/layout.tsx',
				buildEgressRisk: 'present-not-executed',
			},
			contentlayer: { declaration: '0.3.4', configuration: 'contentlayer.config.ts' },
			image: { module: 'next/image', evidence: 'components/Image.tsx' },
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
		nodeEngine: 'absent',
		scripts,
	};
}
