import { createHash } from 'node:crypto';
import { parseTemplate, TmplAstElement, type TmplAstNode } from '@angular/compiler';

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
export type AngularTemplateAnalysis = Readonly<{
	path: string;
	sha256: string;
	byteLength: number;
	diagnostics: readonly string[];
	elements: readonly AngularTemplateElement[];
	comments: readonly AngularTemplateComment[];
	legacyLexicalPrefixes: readonly AngularLexicalPrefix[];
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

function visit(nodes: readonly TmplAstNode[], elements: AngularTemplateElement[]): void {
	for (const node of nodes) {
		if (node instanceof TmplAstElement)
			elements.push({
				name: node.name,
				attributes: Object.fromEntries(
					node.attributes.map((attribute) => [attribute.name, attribute.value]),
				),
				location: location(node.sourceSpan),
			});
		const children = 'children' in node ? node.children : undefined;
		if (Array.isArray(children)) visit(children, elements);
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
	visit(parsed.nodes, elements);
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
