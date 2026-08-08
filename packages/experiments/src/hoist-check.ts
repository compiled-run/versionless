import { createRegExp, letter } from 'magic-regexp';
import { analyze } from 'yuku-analyzer';
const source = `import React, { useState } from 'react'; export function Invoice({ items }) { const [selected, setSelected] = useState(null); function Row({ item }) { return <li onClick={() => setSelected(item)}>{format(item.amount)}</li>; } function Footer() { return <b>{format(0)}</b>; } return <ul><Row /><Footer /></ul>; } function format(n) { return '$' + n.toFixed(2); }`;
const module = analyze(source, { lang: 'jsx', path: 'hoist-check.jsx' });
const startsWithUppercase = createRegExp(letter.uppercase.at.lineStart());
const functions = module
	.findAll('FunctionDeclaration')
	.filter((item: any) => startsWithUppercase.test(item.id.name));
for (const fn of functions.slice(1) as any[]) {
	const captures = module
		.capturesOf(fn)
		.filter((item: any) => item.symbol.scope !== module.rootScope);
	console.log(
		captures.length
			? `${fn.id.name}: UNSAFE to hoist — captures: ${captures.map((item: any) => item.symbol.name).join(', ')}`
			: `${fn.id.name}: safe to hoist`,
	);
}
