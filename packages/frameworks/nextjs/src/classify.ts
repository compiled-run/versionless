import { charIn, createRegExp, oneOrMore } from 'magic-regexp';
import { isAbsolute, normalize } from 'pathe';
import { normalizeURL, parseURL } from 'ufo';

export const NEXTJS_DESCRIPTOR_SCHEMA = 'versionless.nextjs-descriptor.v1' as const;

export type EvidenceState = 'present' | 'absent' | 'unknown';

export interface NextjsClassification {
	framework: 'nextjs';
	versions: { next: string; react: string };
	routing: {
		mode: 'pages' | 'app' | 'mixed';
		pages: string[];
		app: string[];
	};
	rendering: Record<'ssr' | 'ssg' | 'isr' | 'rsc', EvidenceFact>;
	boundaries: {
		serverComponents: string[];
		clientComponents: string[];
		apiRoutes: string[];
		middleware: string[];
		dataFetching: string[];
		serverOnlyModules: string[];
		image: EvidenceFact;
		staticAssets: string[];
	};
	productionStack: {
		owner: 'nextjs';
		compiler: 'swc' | 'babel' | 'unknown';
		bundler: 'webpack' | 'turbopack' | 'unknown';
		preserved: true;
		viteReplacement: false;
		unpluginReplacement: false;
	};
	runtime: {
		node: { state: 'declared' | 'unknown'; value: string | null };
		packageManager: {
			name: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
			lockfile: string | null;
		};
	};
	localityBoundaries: {
		server: BoundaryFact;
		database: BoundaryFact;
		auth: BoundaryFact;
		payment: BoundaryFact;
		egress: BoundaryFact & { origins: string[] };
	};
}

interface EvidenceFact {
	state: EvidenceState;
	evidence: string[];
}

interface BoundaryFact {
	state: 'present' | 'none-declared' | 'unknown';
	details: string[];
}

const portableIdPattern = createRegExp(
	oneOrMore(charIn('0123456789-').from('a', 'z')).at.lineStart().at.lineEnd(),
);
const backslashPattern = createRegExp('\\');

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Next.js descriptor ${label} must be an object`);
	return value as Record<string, unknown>;
}

function exactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
	label: string,
): void {
	const actual = Object.keys(value).sort().join('\n');
	const wanted = [...expected].sort().join('\n');
	if (actual !== wanted) throw new Error(`Next.js descriptor ${label} fields are invalid`);
}

function string(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0)
		throw new Error(`Next.js descriptor ${label} must be a non-empty string`);
	return value;
}

function portablePath(value: unknown, label: string): string {
	const item = string(value, label);
	const normalized = normalize(item);
	if (
		isAbsolute(item) ||
		backslashPattern.test(item) ||
		normalized !== item ||
		normalized === '..' ||
		normalized.startsWith('../')
	)
		throw new Error(`Next.js descriptor ${label} is not a portable normalized path`);
	return item;
}

function uniquePaths(value: unknown, label: string): string[] {
	if (!Array.isArray(value)) throw new Error(`Next.js descriptor ${label} must be an array`);
	const paths = value.map((item, index) => portablePath(item, `${label}[${index}]`));
	if (new Set(paths).size !== paths.length)
		throw new Error(`Next.js descriptor ${label} contains duplicate paths`);
	return [...paths].sort();
}

function evidenceFact(value: unknown, label: string): EvidenceFact {
	const item = record(value, label);
	exactKeys(item, ['state', 'evidence'], label);
	if (item.state !== 'present' && item.state !== 'absent' && item.state !== 'unknown')
		throw new Error(`Next.js descriptor ${label}.state is invalid`);
	const evidence = uniquePaths(item.evidence, `${label}.evidence`);
	if ((item.state === 'present') !== evidence.length > 0)
		throw new Error(`Next.js descriptor ${label} evidence contradicts its state`);
	return { state: item.state, evidence };
}

function boundaryFact(value: unknown, label: string): BoundaryFact {
	const item = record(value, label);
	exactKeys(item, ['state', 'details'], label);
	if (item.state !== 'present' && item.state !== 'none-declared' && item.state !== 'unknown')
		throw new Error(`Next.js descriptor ${label}.state is invalid`);
	if (!Array.isArray(item.details) || item.details.some((detail) => typeof detail !== 'string'))
		throw new Error(`Next.js descriptor ${label}.details must be strings`);
	const details = [...new Set(item.details as string[])].sort();
	if (details.length !== item.details.length)
		throw new Error(`Next.js descriptor ${label}.details contains duplicates`);
	if ((item.state === 'present') !== details.length > 0)
		throw new Error(`Next.js descriptor ${label} details contradict its state`);
	return { state: item.state, details };
}

function origin(value: unknown, label: string): string {
	const item = string(value, label);
	const parsed = parseURL(item);
	if (
		(parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
		!parsed.host ||
		parsed.pathname !== '/' ||
		parsed.search ||
		parsed.hash ||
		normalizeURL(item) !== item
	)
		throw new Error(`Next.js descriptor ${label} must be a canonical HTTP origin`);
	return item;
}

export function classifyNextjsDescriptor(value: unknown): {
	id: string;
	descriptor: unknown;
	inventory: NextjsClassification;
} {
	const root = record(value, 'root');
	exactKeys(
		root,
		[
			'schemaVersion',
			'id',
			'synthetic',
			'framework',
			'executionRequested',
			'supportClaim',
			'versions',
			'routing',
			'rendering',
			'boundaries',
			'productionStack',
			'runtime',
			'localityBoundaries',
		],
		'root',
	);
	if (root.schemaVersion !== NEXTJS_DESCRIPTOR_SCHEMA)
		throw new Error('Unsupported Next.js descriptor schema');
	const id = string(root.id, 'id');
	if (!portableIdPattern.test(id)) throw new Error('Next.js descriptor id is not portable');
	if (root.synthetic !== true) throw new Error('Next.js descriptor must be explicitly synthetic');
	if (root.framework !== 'nextjs') throw new Error('Next.js descriptor framework mismatch');
	if (root.executionRequested !== false)
		throw new Error('Next.js descriptor candidate execution is forbidden');
	if (root.supportClaim !== false)
		throw new Error('Next.js descriptor support claims are forbidden');

	const versions = record(root.versions, 'versions');
	exactKeys(versions, ['next', 'react'], 'versions');
	const routing = record(root.routing, 'routing');
	exactKeys(routing, ['mode', 'pages', 'app'], 'routing');
	if (routing.mode !== 'pages' && routing.mode !== 'app' && routing.mode !== 'mixed')
		throw new Error('Next.js descriptor routing.mode is invalid');
	const pages = uniquePaths(routing.pages, 'routing.pages');
	const app = uniquePaths(routing.app, 'routing.app');
	const expectedMode =
		pages.length > 0 && app.length > 0 ? 'mixed' : pages.length > 0 ? 'pages' : 'app';
	if ((pages.length === 0 && app.length === 0) || routing.mode !== expectedMode)
		throw new Error('Next.js descriptor routing mode contradicts route inventory');

	const rendering = record(root.rendering, 'rendering');
	exactKeys(rendering, ['ssr', 'ssg', 'isr', 'rsc'], 'rendering');
	const boundaries = record(root.boundaries, 'boundaries');
	exactKeys(
		boundaries,
		[
			'serverComponents',
			'clientComponents',
			'apiRoutes',
			'middleware',
			'dataFetching',
			'serverOnlyModules',
			'image',
			'staticAssets',
		],
		'boundaries',
	);
	const productionStack = record(root.productionStack, 'productionStack');
	exactKeys(
		productionStack,
		['owner', 'compiler', 'bundler', 'preserved', 'viteReplacement', 'unpluginReplacement'],
		'productionStack',
	);
	if (
		productionStack.owner !== 'nextjs' ||
		!['swc', 'babel', 'unknown'].includes(String(productionStack.compiler)) ||
		!['webpack', 'turbopack', 'unknown'].includes(String(productionStack.bundler)) ||
		productionStack.preserved !== true ||
		productionStack.viteReplacement !== false ||
		productionStack.unpluginReplacement !== false
	)
		throw new Error('Next.js production stack must remain explicit and preserved');

	const runtime = record(root.runtime, 'runtime');
	exactKeys(runtime, ['node', 'packageManager'], 'runtime');
	const node = record(runtime.node, 'runtime.node');
	exactKeys(node, ['state', 'value'], 'runtime.node');
	if (
		(node.state !== 'declared' && node.state !== 'unknown') ||
		(node.state === 'declared' &&
			(typeof node.value !== 'string' || node.value.length === 0)) ||
		(node.state === 'unknown' && node.value !== null)
	)
		throw new Error('Next.js descriptor Node boundary is contradictory');
	const packageManager = record(runtime.packageManager, 'runtime.packageManager');
	exactKeys(packageManager, ['name', 'lockfile'], 'runtime.packageManager');
	if (!['npm', 'yarn', 'pnpm', 'bun', 'unknown'].includes(String(packageManager.name)))
		throw new Error('Next.js descriptor package manager is invalid');
	const lockfile =
		packageManager.lockfile === null
			? null
			: portablePath(packageManager.lockfile, 'runtime.packageManager.lockfile');
	if ((packageManager.name === 'unknown') !== (lockfile === null))
		throw new Error('Next.js descriptor package manager/lockfile is contradictory');

	const locality = record(root.localityBoundaries, 'localityBoundaries');
	exactKeys(locality, ['server', 'database', 'auth', 'payment', 'egress'], 'localityBoundaries');
	const egress = record(locality.egress, 'localityBoundaries.egress');
	exactKeys(egress, ['state', 'details', 'origins'], 'localityBoundaries.egress');
	const egressFact = boundaryFact(
		{ state: egress.state, details: egress.details },
		'localityBoundaries.egress',
	);
	if (!Array.isArray(egress.origins))
		throw new Error('Next.js descriptor localityBoundaries.egress.origins must be an array');
	const origins = egress.origins.map((item, index) =>
		origin(item, `localityBoundaries.egress.origins[${index}]`),
	);
	if (
		new Set(origins).size !== origins.length ||
		(egressFact.state === 'present') !== origins.length > 0
	)
		throw new Error('Next.js descriptor egress origins contradict its state');

	return {
		id,
		descriptor: root,
		inventory: {
			framework: 'nextjs',
			versions: {
				next: string(versions.next, 'versions.next'),
				react: string(versions.react, 'versions.react'),
			},
			routing: { mode: routing.mode, pages, app },
			rendering: {
				ssr: evidenceFact(rendering.ssr, 'rendering.ssr'),
				ssg: evidenceFact(rendering.ssg, 'rendering.ssg'),
				isr: evidenceFact(rendering.isr, 'rendering.isr'),
				rsc: evidenceFact(rendering.rsc, 'rendering.rsc'),
			},
			boundaries: {
				serverComponents: uniquePaths(
					boundaries.serverComponents,
					'boundaries.serverComponents',
				),
				clientComponents: uniquePaths(
					boundaries.clientComponents,
					'boundaries.clientComponents',
				),
				apiRoutes: uniquePaths(boundaries.apiRoutes, 'boundaries.apiRoutes'),
				middleware: uniquePaths(boundaries.middleware, 'boundaries.middleware'),
				dataFetching: uniquePaths(boundaries.dataFetching, 'boundaries.dataFetching'),
				serverOnlyModules: uniquePaths(
					boundaries.serverOnlyModules,
					'boundaries.serverOnlyModules',
				),
				image: evidenceFact(boundaries.image, 'boundaries.image'),
				staticAssets: uniquePaths(boundaries.staticAssets, 'boundaries.staticAssets'),
			},
			productionStack: {
				owner: 'nextjs',
				compiler: productionStack.compiler as 'swc' | 'babel' | 'unknown',
				bundler: productionStack.bundler as 'webpack' | 'turbopack' | 'unknown',
				preserved: true,
				viteReplacement: false,
				unpluginReplacement: false,
			},
			runtime: {
				node: {
					state: node.state as 'declared' | 'unknown',
					value: node.value as string | null,
				},
				packageManager: {
					name: packageManager.name as 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown',
					lockfile,
				},
			},
			localityBoundaries: {
				server: boundaryFact(locality.server, 'localityBoundaries.server'),
				database: boundaryFact(locality.database, 'localityBoundaries.database'),
				auth: boundaryFact(locality.auth, 'localityBoundaries.auth'),
				payment: boundaryFact(locality.payment, 'localityBoundaries.payment'),
				egress: { ...egressFact, origins: [...origins].sort() },
			},
		},
	};
}
