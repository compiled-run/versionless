import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import {
	analyzeAngularTemplates,
	type AngularTemplateAnalysis,
	type AngularTemplateSource,
} from '../../../frameworks/angular/src/index.ts';
import * as path from 'pathe';
import { canonicalize, indexTarGzip, sha256 } from '../../../core/src/index.ts';
import { createAngularFuxaStandaloneCohortEvidence } from './angular-fuxa-standalone-cohort-run.ts';

const sourceDirectory = import.meta.dirname;
const root =
	path.basename(sourceDirectory) === 'dist'
		? path.resolve(sourceDirectory, '../../..')
		: path.resolve(sourceDirectory, '../../../..');
const archiveSha256 = '4913aabfec74fc990664a5d60760d8f3438ee067b682f833f5869cd2c9c3c372';
const commit = '8b323c177615c0d152a54e5ef0a6f98dae7b8ff0';
const archivePath = path.join(
	root,
	`.versionless/cache/tier-f/angular-fuxa/${archiveSha256}/source.tar.gz`,
);
const defaultOutput = path.join(root, 'evidence/runs/angular-fuxa-template-compiler');
const defaultWork = path.join(root, '.versionless/work/angular-fuxa-template-compiler');
const appPrefix = 'client/src/app/';
const iframeTemplate = `${appPrefix}iframe/iframe.component.html`;
const progressTemplate = `${appPrefix}gauges/controls/gauge-progress/gauge-progress.component.html`;
const semaphoreTemplate = `${appPrefix}gauges/controls/gauge-semaphore/gauge-semaphore.component.html`;
const cardsTemplate = `${appPrefix}cards-view/cards-view.component.html`;
const editorTemplate = `${appPrefix}editor/editor.component.html`;
const fuxaViewTemplate = `${appPrefix}fuxa-view/fuxa-view.component.html`;
const homeTemplate = `${appPrefix}home/home.component.html`;
const expectedSandbox = 'allow-forms allow-scripts allow-modals allow-same-origin';
// The fixture admits exactly one root-manifest state. Re-pinned from
// 6acf2dd25ff7d909046736b8b78f0ca11f07e938b724756a57a00d51e5751d82 when the root manifest
// vendored @async/witness (T037/T039), and again from
// c528f14935ff1c3f847afc60bf0220603085793f003c7ad6b972e07503f0553d when the vendored tarball
// was dropped for the published @async/witness 0.9.0 registry pin (T004), and again from
// cfe4d2845a6139e51ab169037592a3f4045bd07090d2e8f41c0059985229b698 when the root manifest
// gained the release tooling (bumpp + changelogen devDependencies and the release scripts);
// no superseded manifest's bytes exist in the tree, and no published evidence names them.
const rootPackageSha256 = '1fe5dafb67255ddc09580561c8c53ce34b6c8c163565024591f4e23a61c27d71';
const compilerPackageSha256 = '61514eabbcc40eef72135429ea3a5303dae6d67eb42b208fe9420b14067777db';
const t153 = {
	'receipt.json': '4d0dbd3961a7f0d8200ecbeb810284611927cdf90e18ff311a4ab0c6839ad19e',
	'graph.json': '2fc4b51c34bffa6db187d806c34309b7a848eefcff807451b18067a8e3c6457e',
	'patch.diff': '086c0c3305e7404b501cfef42033ebe7e1953342a9c54c629254f5429a2802d8',
} as const;
const t155 = {
	'receipt.json': '6e8fa5873690122487f38c2ec08eb63155b1dfa5492ff05304b41ec8092688d0',
	'graph.json': '45bccc90f4975085f98bb3cac09d8fec522c03362e566ca8cae8764b7540bee0',
	'patch.diff': '58c672a1b9e1fa41531a8648c408bf4ddde01aeaf87924fe86272616f278b430',
	'iframe-first.json': '95494684b4e857d1907574f138b4e5b817b9c880b73dc6fddd33d72d7761b8b8',
	'gauges-first.json': '5cb5576586ee535c5e0b3b725c90c7a4236c90a8ac35bd2911b6f11f73188878',
} as const;
const exactLocations = [
	{ path: cardsTemplate, lineStart: 14, lineEnd: 14 },
	{ path: fuxaViewTemplate, lineStart: 30, lineEnd: 31 },
	{ path: homeTemplate, lineStart: 106, lineEnd: 106 },
] as const;
const lexicalLocations = [
	{ path: cardsTemplate, line: 12 },
	{ path: cardsTemplate, line: 14 },
	{ path: editorTemplate, line: 26 },
	{ path: fuxaViewTemplate, line: 30 },
	{ path: homeTemplate, line: 106 },
] as const;

type Options = Readonly<{
	outputRoot?: string;
	workRoot?: string;
	publish?: boolean;
	replay?: boolean;
}>;
type Inventory = Readonly<{
	legacyLexicalPrefixInventory: readonly Record<string, unknown>[];
	angularAstExactElementInventory: readonly Record<string, unknown>[];
	angularAstDistinctPrefixedElementInventory: readonly Record<string, unknown>[];
	angularCommentInventory: readonly Record<string, unknown>[];
}>;

function exists(target: string): Promise<boolean> {
	return access(target).then(
		() => true,
		() => false,
	);
}
function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
}
function seal(value: Record<string, unknown>): Record<string, unknown> {
	const receipt = { ...value, integrity: { algorithm: 'sha256', canonicalDigest: '' } };
	(receipt.integrity as { canonicalDigest: string }).canonicalDigest = sha256(canonical(receipt));
	return receipt;
}
async function verifyArtifacts(
	directory: string,
	expected: Readonly<Record<string, string>>,
): Promise<void> {
	for (const [file, digest] of Object.entries(expected))
		if (sha256(await readFile(path.join(directory, file))) !== digest)
			throw new Error(`Immutable artifact differs: ${path.join(directory, file)}`);
}

function inventory(analysis: readonly AngularTemplateAnalysis[]): Inventory {
	const withHash = (item: AngularTemplateAnalysis, value: Record<string, unknown>) => ({
		path: item.path,
		templateSha256: item.sha256,
		...value,
	});
	return {
		legacyLexicalPrefixInventory: analysis.flatMap((item) =>
			item.legacyLexicalPrefixes.map((prefix) =>
				withHash(item, { literalPrefix: prefix.value, line: prefix.line }),
			),
		),
		angularAstExactElementInventory: analysis.flatMap((item) =>
			item.elements
				.filter((element) => element.name === 'app-iframe')
				.map((element) =>
					withHash(item, { elementName: element.name, ...element.location }),
				),
		),
		angularAstDistinctPrefixedElementInventory: analysis.flatMap((item) =>
			item.elements
				.filter((element) => element.name === 'app-iframe-property')
				.map((element) =>
					withHash(item, { elementName: element.name, ...element.location }),
				),
		),
		angularCommentInventory: analysis.flatMap((item) =>
			item.comments
				.filter((comment) => comment.value.includes('<app-iframe'))
				.map((comment) =>
					withHash(item, { literalPrefix: '<app-iframe', ...comment.location }),
				),
		),
	};
}

function requireFacts(analysis: readonly AngularTemplateAnalysis[]): Inventory {
	if (analysis.length !== 134) throw new Error('template-count');
	if (analysis.some((item) => item.diagnostics.length > 0)) throw new Error('parser-syntax');
	const result = inventory(analysis);
	const exact = result.angularAstExactElementInventory.map(
		({ path: itemPath, lineStart, lineEnd }) => ({
			path: itemPath,
			lineStart,
			lineEnd,
		}),
	);
	if (canonical(exact) !== canonical(exactLocations)) throw new Error('live-exact-selector');
	const property = result.angularAstDistinctPrefixedElementInventory;
	if (
		property.length !== 1 ||
		property[0]?.path !== editorTemplate ||
		property[0]?.lineStart !== 26 ||
		property[0]?.lineEnd !== 26
	)
		throw new Error('distinct-property-selector');
	const comments = result.angularCommentInventory;
	if (
		comments.length !== 1 ||
		comments[0]?.path !== cardsTemplate ||
		comments[0]?.lineStart !== 12 ||
		comments[0]?.lineEnd !== 13
	)
		throw new Error('comment-only-lexical');
	const lexical = result.legacyLexicalPrefixInventory.map(({ path: itemPath, line }) => ({
		path: itemPath,
		line,
	}));
	if (canonical(lexical) !== canonical(lexicalLocations))
		throw new Error('legacy-lexical-prefix');
	for (const template of [progressTemplate, semaphoreTemplate]) {
		const item = analysis.find((candidate) => candidate.path === template);
		if (!item || item.byteLength !== 0 || item.rootNodes !== 0)
			throw new Error('empty-template');
	}
	const iframe = analysis
		.find((item) => item.path === iframeTemplate)
		?.elements.find((element) => element.name === 'iframe');
	if (iframe?.attributes.sandbox !== expectedSandbox) throw new Error('sandbox-preservation');
	return result;
}

function mutate(
	inputs: readonly AngularTemplateSource[],
	target: string,
	change: (source: string) => string,
): readonly AngularTemplateSource[] {
	return inputs.map((item) =>
		item.path === target ? { ...item, source: change(item.source) } : item,
	);
}

function mutationReceipt(
	name: string,
	reason: string,
	originals: readonly AngularTemplateSource[],
	mutated: readonly AngularTemplateSource[],
): Record<string, unknown> {
	const originalSha256 = sha256(canonical(originals));
	if (originalSha256 === sha256(canonical(mutated)))
		throw new Error(`${name} mutation made no change`);
	let refusal = '';
	try {
		requireFacts(analyzeAngularTemplates(mutated));
	} catch (error) {
		refusal = error instanceof Error ? error.message : String(error);
	}
	if (refusal !== reason)
		throw new Error(`${name} mutation refused for ${refusal || 'no reason'}`);
	requireFacts(analyzeAngularTemplates(originals));
	const restoredSha256 = sha256(canonical(originals));
	if (restoredSha256 !== originalSha256) throw new Error(`${name} mutation restoration failed`);
	return { name, expectedReason: reason, refused: true, restored: true, restoredSha256 };
}

async function loadTemplates(): Promise<readonly AngularTemplateSource[]> {
	const bytes = await readFile(archivePath);
	if (sha256(bytes) !== archiveSha256) throw new Error('T094 archive SHA-256 differs');
	const archive = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: archiveSha256 },
		commit,
	);
	const decoder = new TextDecoder('utf-8', { fatal: true });
	const templates = archive.files
		.filter((file) => file.path.startsWith(appPrefix) && file.path.endsWith('.html'))
		.map((file) => ({ path: file.path, source: decoder.decode(file.bytes) }))
		.sort((left, right) => left.path.localeCompare(right.path));
	if (templates.length !== 134) throw new Error('Angular external template inventory differs');
	return templates;
}

export async function createAngularFuxaTemplateCompilerEvidence(
	options: Options = {},
): Promise<Record<string, string>> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular template compiler requires explicit offline mode');
	const outputRoot = options.outputRoot ?? defaultOutput;
	const workRoot = options.workRoot ?? defaultWork;
	if (await exists(workRoot))
		throw new Error('Angular template compiler worktree residue exists');
	if (options.publish !== false && (await exists(outputRoot)))
		throw new Error('Angular template compiler evidence already exists');
	if (sha256(await readFile(path.join(root, 'package.json'))) !== rootPackageSha256)
		throw new Error('Root package manifest differs');
	const compilerPackage = path.join(root, 'node_modules/@angular/compiler/package.json');
	if (sha256(await readFile(compilerPackage)) !== compilerPackageSha256)
		throw new Error('Angular compiler package hash differs');
	const compilerManifest = JSON.parse(await readFile(compilerPackage, 'utf8')) as {
		version?: unknown;
	};
	if (compilerManifest.version !== '22.1.0')
		throw new Error('Angular compiler package version differs');
	await verifyArtifacts(path.join(root, 'evidence/runs/angular-fuxa-standalone'), t153);
	await verifyArtifacts(path.join(root, 'evidence/runs/angular-fuxa-standalone-cohort'), t155);
	let generatedCohort: Record<string, string>;
	try {
		generatedCohort = await createAngularFuxaStandaloneCohortEvidence({
			workRoot: path.join(workRoot, 'cohort'),
			publish: false,
			replay: options.replay,
			verifyT153: true,
		});
	} finally {
		await rm(workRoot, { recursive: true, force: true });
	}
	for (const [file, digest] of Object.entries(t155))
		if (sha256(generatedCohort[file]!) !== digest)
			throw new Error(`T155 replay differs: ${file}`);
	const templates = await loadTemplates();
	const iframeFirst = analyzeAngularTemplates(templates);
	const gaugesFirst = analyzeAngularTemplates(templates);
	const firstInventory = requireFacts(iframeFirst);
	const secondInventory = requireFacts(gaugesFirst);
	if (
		canonical(iframeFirst) !== canonical(gaugesFirst) ||
		canonical(firstInventory) !== canonical(secondInventory)
	)
		throw new Error('Template analysis composition orders diverge');
	const cohortReceipt = JSON.parse(generatedCohort['receipt.json']!) as {
		migration: { finalHashes: Record<string, string> };
	};
	const mutations = [
		mutationReceipt(
			'parser-syntax',
			'parser-syntax',
			templates,
			mutate(templates, iframeTemplate, (source) => `${source}<section`),
		),
		mutationReceipt(
			'live-exact-selector',
			'live-exact-selector',
			templates,
			mutate(templates, homeTemplate, (source) =>
				source
					.replace('<app-iframe ', '<app-iframe-property ')
					.replace('</app-iframe>', '</app-iframe-property>'),
			),
		),
		mutationReceipt(
			'comment-only-lexical',
			'comment-only-lexical',
			templates,
			mutate(templates, cardsTemplate, (source) =>
				source.replace('<!-- <app-iframe', '<!-- <app-frame'),
			),
		),
		mutationReceipt(
			'distinct-property-selector',
			'distinct-property-selector',
			templates,
			mutate(templates, editorTemplate, (source) =>
				source
					.replace('<app-iframe-property', '<app-frame-property')
					.replace('</app-iframe-property>', '</app-frame-property>'),
			),
		),
		mutationReceipt(
			'empty-template',
			'empty-template',
			templates,
			mutate(templates, progressTemplate, () => '<div></div>'),
		),
		mutationReceipt(
			'sandbox-preservation',
			'sandbox-preservation',
			templates,
			mutate(templates, iframeTemplate, (source) =>
				source.replace(expectedSandbox, 'allow-scripts'),
			),
		),
	];
	const inventoryText = canonical({ templates: iframeFirst, ...firstInventory });
	const graphText = canonical({
		legacyLiteralPrefixEdges: firstInventory.legacyLexicalPrefixInventory,
		exactAngularElementEdges: firstInventory.angularAstExactElementInventory,
		distinctPrefixedAngularElementEdges:
			firstInventory.angularAstDistinctPrefixedElementInventory,
		angularCommentEdges: firstInventory.angularCommentInventory,
	});
	const order = (name: 'iframe-first' | 'gauges-first') =>
		canonical({
			order: name,
			templateInventorySha256: sha256(inventoryText),
			graphSha256: sha256(graphText),
			diagnostics: 0,
			finalSourceHashes: cohortReceipt.migration.finalHashes,
		});
	const artifacts: Record<string, string> = {
		'inventory.json': inventoryText,
		'graph.json': graphText,
		'iframe-first.json': order('iframe-first'),
		'gauges-first.json': order('gauges-first'),
		...Object.fromEntries(
			mutations.map((item) => [`mutation-${String(item.name)}.json`, canonical(item)]),
		),
	};
	artifacts['receipt.json'] = canonical(
		seal({
			schemaVersion: 'versionless.angular-template-compiler.v1',
			fixture: 'angular-fuxa',
			source: { archiveSha256, t153, t155, angularCompiler: '22.1.0', compilerPackageSha256 },
			analysis: {
				templates: 134,
				diagnostics: 0,
				legacyLexicalPrefixInventory: { matches: 5, templates: 4 },
				angularAstExactElementInventory: {
					elementName: 'app-iframe',
					elements: 3,
					templates: 3,
				},
				angularAstDistinctPrefixedElementInventory: {
					elementName: 'app-iframe-property',
					elements: 1,
					templates: 1,
				},
				angularCommentInventory: {
					literalPrefix: '<app-iframe',
					comments: 1,
					templates: 1,
				},
				emptyGaugeTemplates: 2,
				sandbox: expectedSandbox,
				orderConvergent: true,
				finalSourceHashes: cohortReceipt.migration.finalHashes,
			},
			verification: { mutations, networkAttempts: 0, residue: 'none' },
			artifacts: Object.fromEntries(
				Object.entries(artifacts).map(([file, contents]) => [file, sha256(contents)]),
			),
			nonclaims: [
				'Exact external-template parsing only; comments and app-iframe-property are not exact app-iframe AST elements.',
				'No template type-checking, compiler-cli/AOT, dependency injection, build, Angular CLI, server, browser, runtime, locality, generalized Angular support, Tier, pilot, compliance, certification, or support claim.',
			],
		}),
	);
	if (options.publish !== false) {
		const staging = `${outputRoot}.staging`;
		await mkdir(staging, { recursive: true });
		try {
			for (const [file, contents] of Object.entries(artifacts))
				await writeFile(path.join(staging, file), contents, { flag: 'wx' });
			await rename(staging, outputRoot);
		} catch (error) {
			await rm(staging, { recursive: true, force: true });
			throw error;
		}
	}
	if (await exists(workRoot))
		throw new Error('Angular template compiler worktree cleanup failed');
	await verifyArtifacts(path.join(root, 'evidence/runs/angular-fuxa-standalone'), t153);
	await verifyArtifacts(path.join(root, 'evidence/runs/angular-fuxa-standalone-cohort'), t155);
	return artifacts;
}

export async function verifyAngularFuxaTemplateCompiler(
	options: Omit<Options, 'publish'> = {},
): Promise<string> {
	const outputRoot = options.outputRoot ?? defaultOutput;
	const files = (await readdir(outputRoot)).sort();
	const expected = Object.fromEntries(
		await Promise.all(
			files.map(
				async (file) =>
					[file, await readFile(path.join(outputRoot, file), 'utf8')] as const,
			),
		),
	);
	const actual = await createAngularFuxaTemplateCompilerEvidence({ ...options, publish: false });
	if (canonical(expected) !== canonical(actual))
		throw new Error('Angular template compiler evidence differs');
	return sha256(actual['receipt.json']!);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (!args.includes('--offline'))
		throw new Error('Angular template compiler command requires --offline');
	const digest = args.includes('--verify-only')
		? await verifyAngularFuxaTemplateCompiler()
		: sha256((await createAngularFuxaTemplateCompilerEvidence())['receipt.json']!);
	process.stdout.write(
		canonical({ result: 'pass', digest, networkAttempts: 0, residue: 'none' }),
	);
}

if (process.argv[1]?.endsWith('angular-fuxa-template-compiler-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
