import { createHash } from 'node:crypto';
import {
	parseTemplate,
	TmplAstElement,
	TmplAstTemplate,
	type TmplAstNode,
} from '@angular/compiler';

export type AngularTemplateSource = Readonly<{ path: string; source: string }>;
export type AngularTemplateLocation = Readonly<{ lineStart: number; lineEnd: number }>;
export type AngularTemplateElement = Readonly<{
	name: string;
	attributes: Readonly<Record<string, string>>;
	location: AngularTemplateLocation;
}>;
export type AngularTemplateComment = Readonly<{
	value: string;
	location: AngularTemplateLocation;
}>;
export type AngularLexicalPrefix = Readonly<{ value: '<app-iframe'; line: number }>;
/**
 * One i18n marker the template parser recognised.
 *
 * The parser strips these from the attribute list and turns them into message
 * metadata, so a marker is not visible in {@link AngularTemplateElement} at all
 * and a substring search for `i18n` would find comments and unrelated names
 * instead. What is recorded here is the marker as the template spells it —
 * `i18n` on the element, `i18n-<attribute>` on one of its attributes — on the
 * node the parser attached the message to.
 */
export type AngularTemplateI18nMarker = Readonly<{
	marker: string;
	element: string;
	line: number;
}>;
export type AngularTemplateAnalysis = Readonly<{
	path: string;
	sha256: string;
	byteLength: number;
	diagnostics: readonly string[];
	elements: readonly AngularTemplateElement[];
	comments: readonly AngularTemplateComment[];
	legacyLexicalPrefixes: readonly AngularLexicalPrefix[];
	i18nMarkers: readonly AngularTemplateI18nMarker[];
	rootNodes: number;
}>;

function hash(source: string): string {
	return createHash('sha256').update(source).digest('hex');
}

function location(span: {
	start: { line: number };
	end: { line: number };
}): AngularTemplateLocation {
	return { lineStart: span.start.line + 1, lineEnd: span.end.line + 1 };
}

function collectI18nMarkers(
	node: TmplAstElement | TmplAstTemplate,
	markers: AngularTemplateI18nMarker[],
): void {
	const name = node instanceof TmplAstElement ? node.name : (node.tagName ?? 'ng-template');
	const line = location(node.sourceSpan).lineStart;
	if (node.i18n !== undefined) markers.push({ marker: 'i18n', element: name, line });
	for (const attribute of node.attributes)
		if (attribute.i18n !== undefined)
			markers.push({ marker: `i18n-${attribute.name}`, element: name, line });
}

function visit(
	nodes: readonly TmplAstNode[],
	elements: AngularTemplateElement[],
	markers: AngularTemplateI18nMarker[],
): void {
	for (const node of nodes) {
		if (node instanceof TmplAstElement || node instanceof TmplAstTemplate)
			collectI18nMarkers(node, markers);
		if (node instanceof TmplAstElement)
			elements.push({
				name: node.name,
				attributes: Object.fromEntries(
					node.attributes.map((attribute) => [attribute.name, attribute.value]),
				),
				location: location(node.sourceSpan),
			});
		const children = 'children' in node ? node.children : undefined;
		if (Array.isArray(children)) visit(children, elements, markers);
	}
}

function lexicalPrefixes(source: string): AngularLexicalPrefix[] {
	const needle = '<app-iframe' as const;
	const values: AngularLexicalPrefix[] = [];
	let offset = 0;
	while (true) {
		const found = source.indexOf(needle, offset);
		if (found < 0) return values;
		values.push({ value: needle, line: source.slice(0, found).split('\n').length });
		offset = found + needle.length;
	}
}

export function analyzeAngularTemplate(input: AngularTemplateSource): AngularTemplateAnalysis {
	const parsed = parseTemplate(input.source, input.path, {
		preserveWhitespaces: true,
		collectCommentNodes: true,
	});
	const elements: AngularTemplateElement[] = [];
	const i18nMarkers: AngularTemplateI18nMarker[] = [];
	visit(parsed.nodes, elements, i18nMarkers);
	return {
		path: input.path,
		sha256: hash(input.source),
		byteLength: Buffer.byteLength(input.source),
		diagnostics: (parsed.errors ?? []).map((error) => error.toString()),
		elements,
		comments: (parsed.commentNodes ?? []).map((comment) => ({
			value: comment.value ?? '',
			location: location(comment.sourceSpan),
		})),
		legacyLexicalPrefixes: lexicalPrefixes(input.source),
		i18nMarkers,
		rootNodes: parsed.nodes.length,
	};
}

export function analyzeAngularTemplates(
	inputs: readonly AngularTemplateSource[],
): readonly AngularTemplateAnalysis[] {
	return [...inputs]
		.sort((left, right) => left.path.localeCompare(right.path))
		.map(analyzeAngularTemplate);
}
