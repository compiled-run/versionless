import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'pathe';
import { parseTemplate } from '@angular/compiler';
function* walk(directory: string): Generator<string> {
	for (const name of readdirSync(directory)) {
		const file = join(directory, name);
		if (statSync(file).isDirectory()) yield* walk(file);
		else if (file.endsWith('.html')) yield file;
	}
}
for (const root of process.argv.slice(2)) {
	let files = 0;
	let failed = 0;
	for (const file of walk(root)) {
		files += 1;
		if (parseTemplate(readFileSync(file, 'utf8'), file).errors?.length) failed += 1;
	}
	console.log(`${root}: templates parsed ${files - failed}/${files}`);
}
