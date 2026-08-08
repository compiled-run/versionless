import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'pathe';
import { parse } from 'yuku-parser';
const languages: Record<string, 'jsx' | 'ts' | 'tsx'> = {
	'.js': 'jsx',
	'.jsx': 'jsx',
	'.ts': 'ts',
	'.tsx': 'tsx',
};
const skip = new Set(['node_modules', '.git', 'dist', 'build']);
function* walk(directory: string): Generator<string> {
	for (const name of readdirSync(directory)) {
		if (skip.has(name)) continue;
		const file = join(directory, name);
		if (statSync(file).isDirectory()) yield* walk(file);
		else if (languages[extname(file)]) yield file;
	}
}
for (const root of process.argv.slice(2)) {
	let files = 0;
	let failed = 0;
	for (const file of walk(root)) {
		files += 1;
		if (
			parse(readFileSync(file, 'utf8'), {
				lang: languages[extname(file)]!,
				sourceType: 'module',
			}).diagnostics.length
		)
			failed += 1;
	}
	console.log(`${root}: files parsed ${files - failed}/${files}`);
}
