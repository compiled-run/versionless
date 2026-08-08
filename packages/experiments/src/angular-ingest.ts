import { readFileSync } from 'node:fs';
import { parseTemplate } from '@angular/compiler';
import { createRegExp, exactly, wordBoundary } from 'magic-regexp';
import { analyze } from 'yuku-analyzer';

const file = process.argv[2];
if (!file) throw new Error('usage: angular-ingest <component.ts>');
const source = readFileSync(file, 'utf8');
const module = analyze(source, { lang: 'ts', path: file });
console.log('yuku diagnostics:', module.diagnostics.length);
for (const cls of module.findAll('ClassDeclaration')) {
	const decorator = cls.decorators?.find(
		(item: any) => item.expression?.callee?.name === 'Component',
	) as any;
	if (!decorator) continue;
	const members = cls.body.body
		.filter((member: any) => member.key?.name && member.key.name !== 'constructor')
		.map((member: any) => member.key.name as string);
	const argument = decorator.expression.arguments[0] as any;
	const property = argument?.properties?.find((item: any) => item.key?.name === 'template');
	if (!property) continue;
	const template = source.slice(property.value.start + 1, property.value.end - 1);
	const parsed = parseTemplate(template, file);
	const refs = members.filter((name) =>
		createRegExp(wordBoundary, exactly(name), wordBoundary).test(template),
	);
	console.log(
		`@Component class ${(cls as any).id.name}`,
		'template errors:',
		parsed.errors?.length ?? 0,
		'references:',
		refs.join(', ') || 'none',
	);
}
