import { readFileSync } from 'node:fs';
import * as path from 'pathe';
import { joinURL } from 'ufo';
import { defineConfig } from 'vite';
import {
	craProcessEnvironmentDefines,
	createCraViteAdapter,
} from '../../packages/frameworks/react/src/index.ts';

/**
 * The Vite 8 target configuration for the cypress-realworld-app holdout. It is
 * the frozen create-react-app adapter composition applied as it stands, with
 * nothing holdout-specific in it: the only application knowledge here is the
 * three facts every create-react-app fixture states — where the public
 * directory is, which file is the HTML template, and which environment the
 * build inlines. The environment is not hand-listed: it is read from the
 * application's own committed `.env` under create-react-app's own `REACT_APP_`
 * prefix rule, so this file carries no value the application does not declare.
 */

const target = process.cwd();

/** Environment keys create-react-app inlines beyond the app's own `.env`. */
const buildEnvironment = { NODE_ENV: 'production', PUBLIC_URL: '' } as const;

/**
 * create-react-app's environment prefix rule: of everything a `.env` declares,
 * only the `REACT_APP_`-prefixed keys reach the browser bundle. Exported so the
 * rule is testable as a pure function rather than asserted by a comment.
 */
export const craEnvironmentPrefix = 'REACT_APP_';

/**
 * Parse a dotenv document the way create-react-app's loader does for the subset
 * this corpus relies on: `KEY=value` lines, blank lines and `#` comments
 * ignored, surrounding quotes stripped. Only prefixed keys are returned.
 */
export function craPrefixedEnvironment(document: string): Readonly<Record<string, string>> {
	const entries: [string, string][] = [];
	for (const line of document.split('\n')) {
		const trimmed = line.trim();
		if (trimmed === '' || trimmed.startsWith('#')) continue;
		const separator = trimmed.indexOf('=');
		if (separator <= 0) continue;
		const key = trimmed.slice(0, separator).trim();
		if (!key.startsWith(craEnvironmentPrefix)) continue;
		const raw = trimmed.slice(separator + 1).trim();
		const unquoted =
			(raw.startsWith('"') && raw.endsWith('"') && raw.length > 1) ||
			(raw.startsWith("'") && raw.endsWith("'") && raw.length > 1)
				? raw.slice(1, -1)
				: raw;
		entries.push([key, unquoted]);
	}
	entries.sort(([left], [right]) => (left === right ? 0 : left < right ? -1 : 1));
	return Object.freeze(Object.fromEntries(entries));
}

/**
 * The environment this build inlines, for an application rooted at `root`: the
 * two keys create-react-app always defines plus every `REACT_APP_` key the
 * application's own `.env` declares. Taking the root as an argument keeps the
 * record independent of the working directory a reader happens to compute it
 * from.
 */
export function craBuildEnvironment(root: string): Readonly<Record<string, string>> {
	let dotenv = '';
	try {
		dotenv = readFileSync(path.join(root, '.env'), 'utf8');
	} catch {
		dotenv = '';
	}
	return Object.freeze({ ...buildEnvironment, ...craPrefixedEnvironment(dotenv) });
}

export const environment = craBuildEnvironment(target);

export default defineConfig({
	root: target,
	base: joinURL('/', ''),
	publicDir: false,
	plugins: [
		...createCraViteAdapter({
			publicDirectory: path.join(target, 'public'),
			templateFile: 'index.html',
		}),
	],
	define: craProcessEnvironmentDefines(environment),
	build: {
		outDir: path.join(target, 'build-vite'),
		emptyOutDir: true,
		sourcemap: true,
	},
});
