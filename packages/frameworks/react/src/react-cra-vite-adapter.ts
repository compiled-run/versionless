import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { charIn, createRegExp, exactly, global, maybe, oneOrMore, whitespace, wordChar } from 'magic-regexp';
import * as path from 'pathe';

/**
 * Reusable create-react-app compatibility capabilities for a Vite build.
 *
 * Every export here is application agnostic: the shapes handled are the ones
 * create-react-app itself defines (HTML template placeholders, `process.env`
 * inlining, webpack tilde specifiers, and the copied public directory). No
 * capability branches on an application name, revision, or source string.
 */

export type CraEnvironment = Readonly<Record<string, string>>;

const templatePlaceholder = createRegExp(
	exactly('%').and(oneOrMore(wordChar).groupedAs('key')).and('%'),
	[global],
);

const tildePrefixedCssImport = createRegExp(
	exactly('@import')
		.and(oneOrMore(whitespace))
		.and(maybe(exactly('url').and(maybe(whitespace)).and('(').and(maybe(whitespace))))
		.and(charIn(`'"`))
		.and('~'),
	[global],
);

const closingBodyTag = createRegExp(
	exactly('<').and(maybe(whitespace)).and('/').and(maybe(whitespace)).and('body'),
);

export function compareUtf16CodeUnits(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

/**
 * Replace `%KEY%` template placeholders the way create-react-app's
 * InterpolateHtmlPlugin does: only keys present in the environment are
 * substituted, and unknown placeholders are preserved verbatim.
 */
export function substituteCraTemplatePlaceholders(
	template: string,
	environment: CraEnvironment,
): string {
	return template.replace(templatePlaceholder, (match: string, key: string) =>
		Object.hasOwn(environment, key) ? (environment[key] as string) : match,
	);
}

export type CraEntryDocumentOptions = Readonly<{
	template: string;
	entryModule: string;
	environment?: CraEnvironment;
}>;

/**
 * Turn a create-react-app `public/index.html` template into a Vite entry
 * document: placeholders are substituted and the application entry is injected
 * as a module script immediately before the closing body tag.
 */
export function craEntryDocument(options: CraEntryDocumentOptions): string {
	const substituted = substituteCraTemplatePlaceholders(
		options.template,
		options.environment ?? {},
	);
	const script = `<script type="module" src="${options.entryModule}"></script>`;
	const match = closingBodyTag.exec(substituted);
	if (!match) return `${substituted}${substituted.endsWith('\n') ? '' : '\n'}${script}\n`;
	return `${substituted.slice(0, match.index)}  ${script}\n  ${substituted.slice(match.index)}`;
}

/**
 * Build the `define` map create-react-app's DefinePlugin provides: one entry per
 * environment key plus the whole `process.env` object for dynamic access.
 */
export function craProcessEnvironmentDefines(
	environment: CraEnvironment,
): Readonly<Record<string, string>> {
	const keys = Object.keys(environment).sort(compareUtf16CodeUnits);
	const sorted = Object.fromEntries(keys.map((key) => [key, environment[key] as string]));
	return Object.freeze({
		...Object.fromEntries(
			keys.map((key) => [`process.env.${key}`, JSON.stringify(environment[key])]),
		),
		'process.env': JSON.stringify(sorted),
	});
}

/**
 * Rewrite webpack's tilde-prefixed bare specifiers in CSS `@import` rules to
 * plain bare specifiers, which Vite resolves through node resolution.
 */
export function rewriteWebpackTildeCssImports(code: string): string {
	return code.replace(tildePrefixedCssImport, (match: string) => match.slice(0, -1));
}

function pathWithoutQuery(id: string): string {
	const index = id.indexOf('?');
	return index === -1 ? id : id.slice(0, index);
}

export type CraTransformResult = Readonly<{ code: string; map: null }>;
export type CraTransformPlugin = Readonly<{
	name: string;
	enforce: 'pre';
	transform(code: string, id: string): CraTransformResult | null;
}>;

export function createCraTildeCssImportPlugin(): CraTransformPlugin {
	return {
		name: 'versionless-cra-tilde-css-import',
		enforce: 'pre',
		transform(code, id) {
			if (path.extname(pathWithoutQuery(id)) !== '.css') return null;
			const rewritten = rewriteWebpackTildeCssImports(code);
			return rewritten === code ? null : { code: rewritten, map: null };
		},
	};
}

async function filesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(item)));
		else if (entry.isFile()) files.push(item);
	}
	return files;
}

/**
 * The create-react-app public directory inventory: every file below the
 * directory except the excluded template, as sorted relative POSIX paths.
 */
export async function craPublicAssetPaths(
	directory: string,
	exclude: readonly string[] = [],
): Promise<readonly string[]> {
	const excluded = new Set(exclude);
	return (await filesBelow(directory))
		.map((file) => path.relative(directory, file).split(path.sep).join('/'))
		.filter((file) => !excluded.has(file))
		.sort(compareUtf16CodeUnits);
}

export type CraResolvedBuildConfig = Readonly<{ build: Readonly<{ outDir: string }> }>;
export type CraOutputPlugin = Readonly<{
	name: string;
	configResolved(config: CraResolvedBuildConfig): void;
	closeBundle: Readonly<{ order: 'post'; sequential: true; handler(): Promise<void> }>;
}>;

export type CraPublicDirectoryOptions = Readonly<{
	directory: string;
	exclude?: readonly string[];
}>;

/**
 * Copy the create-react-app public directory into the build output the way
 * `react-scripts build` does, excluding the HTML template that becomes the
 * bundled entry document.
 */
export function createCraPublicDirectoryPlugin(
	options: CraPublicDirectoryOptions,
): CraOutputPlugin {
	let outputDirectory = '';
	return {
		name: 'versionless-cra-public-directory',
		configResolved(config) {
			outputDirectory = path.resolve(config.build.outDir);
		},
		closeBundle: {
			order: 'post',
			sequential: true,
			async handler() {
				if (!outputDirectory) throw new Error('CRA public directory outDir is unresolved');
				for (const file of await craPublicAssetPaths(
					options.directory,
					options.exclude ?? [],
				)) {
					const destination = path.join(outputDirectory, file);
					await mkdir(path.dirname(destination), { recursive: true });
					await writeFile(destination, await readFile(path.join(options.directory, file)));
				}
			},
		},
	};
}

export type CraViteAdapterOptions = Readonly<{
	publicDirectory: string;
	templateFile?: string;
}>;

export type CraViteAdapterPlugins = readonly [CraTransformPlugin, CraOutputPlugin];

/**
 * The create-react-app compatibility plugin set: tilde CSS specifier rewriting
 * plus public directory replication.
 */
export function createCraViteAdapter(options: CraViteAdapterOptions): CraViteAdapterPlugins {
	return [
		createCraTildeCssImportPlugin(),
		createCraPublicDirectoryPlugin({
			directory: options.publicDirectory,
			exclude: [options.templateFile ?? 'index.html'],
		}),
	];
}
