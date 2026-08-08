import { readFileSync } from 'node:fs';
import { analyze } from 'yuku-analyzer';
const file = process.argv[2];
if (!file) throw new Error('usage: semantic-demo <source>');
const source = readFileSync(file, 'utf8');
const module = analyze(source, { lang: 'tsx', path: file });
console.log('semantic diagnostics:', module.diagnostics.length);
for (const cls of module.findAll('ClassDeclaration') as any[]) {
	const superclass = cls.superClass ? source.slice(cls.superClass.start, cls.superClass.end) : '';
	if (superclass.includes('Component')) console.log(`class ${cls.id.name} extends ${superclass}`);
}
