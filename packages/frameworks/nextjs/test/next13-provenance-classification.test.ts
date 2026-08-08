import { describe, expect, it } from 'vitest';
import type { ArchiveIndex } from '../../../core/src/corpus/tier-f-provenance.ts';
import { classifyNext13ProvenanceArchive } from '../src/next13-provenance-classify.ts';

function archive(overrides: Record<string, string> = {}): ArchiveIndex {
	const sources: Record<string, string> = {
		'package.json': JSON.stringify({
			dependencies: { next: '13.4.8', react: '18.2.0', contentlayer: '0.3.4' },
			scripts: {
				start: 'next dev',
				dev: 'cross-env INIT_CWD=$PWD next dev',
				build: "cross-env INIT_CWD=$PWD next build && cross-env NODE_OPTIONS='--experimental-json-modules' node -r esbuild-register ./scripts/postbuild.mjs",
				serve: 'next start',
				analyze: 'cross-env ANALYZE=true next build',
				lint: 'next lint --fix --dir pages --dir components --dir lib --dir layouts --dir scripts',
			},
		}),
		'.yarnrc.yml': 'nodeLinker: node-modules\n',
		'yarn.lock': [
			'__metadata:',
			'  version: 6',
			...Array.from({ length: 1165 }, (_, index) => `  resolution: package-${index}`),
			...Array.from({ length: 1110 }, (_, index) => `  checksum: checksum-${index}`),
		].join('\n'),
		'app/layout.tsx':
			"import { Inter } from 'next/font/google'; export default function RootLayout() {}",
		'app/blog/[...slug]/page.tsx':
			'export const generateStaticParams = async () => []; export default function Page({ params }: { params: { slug: string[] } }) {}',
		'app/api/newsletter2/route.ts': 'export async function POST(request: Request) {}',
		'next.config.js':
			"module.exports = { webpack: (config) => { use: ['@svgr/webpack']; return config } }",
		'contentlayer.config.ts': 'export default defineDocumentType(() => ({}))',
		'components/Image.tsx': "import Image from 'next/image'",
		...overrides,
	};
	return {
		root: 'fixture',
		manifestSha256: 'manifest',
		globalMetadata: null,
		pathMetadata: [],
		files: Object.entries(sources).map(([path, text]) => {
			const bytes = Buffer.from(text);
			return { path, bytes, byteLength: bytes.byteLength, sha256: path };
		}),
	};
}

describe('Next13 provenance archive adapter', () => {
	it('derives only the exact static Next13 source facts', () => {
		const facts = classifyNext13ProvenanceArchive(archive());
		expect(facts).toMatchObject({
			next: { declaration: '13.4.8', major: 13 },
			react: { declaration: '18.2.0' },
			packageManager: {
				metadataVersion: 6,
				nodeLinker: 'node-modules',
				pinnedRelease: 'absent',
				resolutions: 1165,
				checksums: 1110,
			},
			routing: {
				mode: 'app',
				dynamicRoute: 'catch-all',
				generateStaticParams: 'present-not-executed',
			},
			apiRoute: { method: 'POST', state: 'present-not-executed' },
			resources: {
				font: { buildEgressRisk: 'present-not-executed' },
				contentlayer: { declaration: '0.3.4' },
				image: { module: 'next/image' },
			},
			nodeEngine: 'absent',
		});
		expect(facts.scripts).toHaveLength(6);
	});

	it('rejects declaration, engine, Yarn, routing, API, resource, webpack, and script drift', () => {
		const mutations: Array<Record<string, string>> = [
			{
				'package.json': JSON.stringify({
					dependencies: { next: '13.5.0', react: '18.2.0', contentlayer: '0.3.4' },
					scripts: {},
				}),
			},
			{ '.yarn/releases/yarn.cjs': 'synthetic pinned release' },
			{
				'package.json': JSON.stringify({
					dependencies: { next: '13.4.8', react: '18.2.0', contentlayer: '0.3.4' },
					packageManager: 'yarn@4.0.2',
					scripts: {},
				}),
			},
			{
				'package.json': JSON.stringify({
					dependencies: { next: '13.4.8', react: '18.2.0', contentlayer: '0.3.4' },
					engines: { node: '>=18' },
					scripts: {},
				}),
			},
			{ '.yarnrc.yml': 'nodeLinker: pnp' },
			{ 'yarn.lock': '__metadata:\n  version: 5\n' },
			{ 'app/layout.tsx': 'export default function RootLayout() {}' },
			{ 'app/blog/[...slug]/page.tsx': 'export default function Page() {}' },
			{ 'app/api/newsletter2/route.ts': 'export async function GET() {}' },
			{ 'next.config.js': 'module.exports = {}' },
			{ 'contentlayer.config.ts': '' },
			{ 'components/Image.tsx': 'export function Image() {}' },
		];
		for (const override of mutations)
			expect(() => classifyNext13ProvenanceArchive(archive(override))).toThrow();
	});
});
