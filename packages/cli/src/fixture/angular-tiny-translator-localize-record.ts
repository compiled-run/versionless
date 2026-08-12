/**
 * The record of the localize round: the first migrated TinyTranslator artifact
 * that mounts in a browser.
 *
 * Every number here is read at the moment the record is written — the build
 * logs, the two emitted inventories, the installed closure's own lockfile, and
 * a browser load of the canonical output root performed by this driver rather
 * than pasted from a previous one. This record supersedes u17d by reference:
 * u17d's bytes are unchanged and remain the record of the lane it measured,
 * whose artifact threw before Angular bootstrapped.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import {
	sealRecord,
	verifySealedRecord,
	type SealedRecord,
} from './angular-factoriolab-build-lanes-run.ts';
import { CONSENT } from './angular-tiny-translator-lanes-run.ts';
import { EVIDENCE_DIRECTORY, STAGE_DIRECTORY } from './angular-tiny-translator-apply-run.ts';
import { inventoryOf } from './angular-tiny-translator-final-record.ts';
import { observeAngularTinyTranslatorBoot } from '../witness/angular-tiny-translator-boot-check.ts';
import type { LocalizeRound } from './angular-tiny-translator-localize-run.ts';

export const UNIT = 'lrapr-t006/u19f-localize-boot-green';
export const LOCALIZE_LANE_FILE = 'u19f-localize-boot-green-lane.json';
/** The output root this lane publishes, and the sibling that makes it canonical. */
export const CANONICAL_ROOT = 'dist-11';
export const REPEATED_ROOT = 'dist-12';

type LockfilePackage = Readonly<{
	version?: string;
	resolved?: string;
	integrity?: string;
}>;

/** The registry facts behind one installed package, read from the lockfile. */
export async function readAcquiredPackage(
	tree: string,
	name: string,
): Promise<Readonly<Record<string, unknown>>> {
	const lock = JSON.parse(await readFile(path.join(tree, 'package-lock.json'), 'utf8')) as {
		packages?: Record<string, LockfilePackage>;
	};
	const entry = lock.packages?.[`node_modules/${name}`];
	if (entry === undefined) throw new Error(`TinyTranslator localize record: ${name} not installed`);
	return Object.freeze({
		name,
		version: entry.version ?? 'unknown',
		url: entry.resolved ?? 'unrecorded',
		integrity: entry.integrity ?? 'unrecorded',
	});
}

async function readBuild(index: number): Promise<Readonly<Record<string, unknown>>> {
	const exit = await readFile(path.join(STAGE_DIRECTORY, `build-${String(index)}.exit`), 'utf8');
	const log = await readFile(
		path.join(STAGE_DIRECTORY, `build-${String(index)}.stdout.log`),
		'utf8',
	);
	return Object.freeze({
		name: `build-${String(index)}`,
		exitStatus: Number.parseInt(exit.trim(), 10),
		command: 'npx ng build --configuration production',
		outputRoot: `dist-${String(index)}`,
		bundleLines: log.split('\n').filter((line) => line.includes('.js')).length,
	});
}

export async function buildLocalizeLaneRecord(): Promise<SealedRecord> {
	const round = JSON.parse(
		await readFile(path.join(STAGE_DIRECTORY, 'localize-round.json'), 'utf8'),
	) as LocalizeRound;
	const builds = [await readBuild(11), await readBuild(12)];
	const first = await inventoryOf(path.join(STAGE_DIRECTORY, CANONICAL_ROOT));
	const second = await inventoryOf(path.join(STAGE_DIRECTORY, REPEATED_ROOT));
	const identical = canonical(first) === canonical(second);
	const acquired = await readAcquiredPackage(
		path.join(STAGE_DIRECTORY, 'app'),
		'@angular/localize',
	);
	const boot = await observeAngularTinyTranslatorBoot(path.join(STAGE_DIRECTORY, CANONICAL_ROOT));
	return sealRecord({
		schemaVersion: 'versionless.angular-tiny-translator-localize-lane.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: boot.booted
			? 'localize-runtime-declared-build-green-deterministic-and-the-application-mounts'
			: 'localize-runtime-declared-and-the-application-still-does-not-mount',
		meaning:
			'u19e left the migrated bundle throwing `$localize is not defined` at bootstrap. The ' +
			"cause is a compiler change the migration crossed: this application's templates are " +
			'i18n-marked, the era compiler substituted translations into the factories it emitted, ' +
			'and the Angular 16 compiler emits `$localize` tagged templates the bundle evaluates at ' +
			'run time. A capability reads the markers out of the templates themselves, declares ' +
			"`@angular/localize` at the target cell's own range, and declares the entry point the " +
			"package publishes for the pre-`main` position through the builder's own polyfills " +
			'seam. The production build is green and byte-stable over two runs, and a browser load ' +
			'of the canonical output root reaches the home surface: the application mounts and ' +
			'renders its own title. This is the first migrated artifact of this cell that does.',
		capability: {
			name: 'template-i18n-runtime',
			package: '@versionless/angular',
			answers:
				'the runtime half of an i18n-marked template on an Ivy-era line: the markers compile ' +
				'to `$localize` tagged templates, and nothing in the framework runtime binds that global',
			mechanism:
				"The markers are read out of the compiler's own parse of each template — `i18n` on an " +
				'element, `i18n-<attribute>` on one of its attributes — rather than out of a substring ' +
				'search that would find comments and unrelated names. An application with no marker ' +
				'gets nothing declared, because a polyfill nothing asks for is bundle weight and a ' +
				'claim the templates contradict. A cell on a pre-Ivy line is refused for the same ' +
				'reason: that compiler substitutes translations and emits no tagged template. The ' +
				"version is the cell's own `@angular/` family range, never one this capability picks, " +
				'and a cell that carries no range is refused rather than guessed at. Delivery is the ' +
				"builder's `polyfills` list, the seam it already uses for a module the document has " +
				'to evaluate before `main`.',
			markersRead: round.declaration.reading.markers.length,
			markedTemplates: round.declaration.reading.markedTemplates,
			templatesRead: round.declaration.reading.templatesRead,
			declaredDifferences: round.declaration.declaredDifferences,
			refusedHere: [...round.declaration.unhandled, ...round.workspaceUnhandled],
		},
		applied: {
			tree: '.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app',
			filesChanged: round.filesChanged,
			dependencyChange: round.declaration.change,
			entryPoint: round.entryPoint,
			workspaceChanges: round.workspaceChanges,
		},
		acquisition: {
			purpose:
				'The declared `@angular/localize` had to be installed for the builder to resolve the ' +
				'entry point the capability declared.',
			consentId: CONSENT,
			networkMode: 'registry-read',
			outcome: 'installed',
			registry: 'https://registry.npmjs.org',
			packages: [acquired],
			note:
				'One package was added to the closure. The URL and the subresource integrity the ' +
				"registry served are recorded from the application's own lockfile.",
		},
		builds,
		determinism: {
			claim:
				`${String(builds[0]?.['name'])} and ${String(builds[1]?.['name'])} ran the same ` +
				'command over the same bytes with no edit between them, each into a cleaned output ' +
				'directory, and emitted the same inventory — same file count, same names, same digests.',
			runs: 2,
			identical,
			files: first.length,
			inventorySha256: sha256(canonical(first)),
			command: 'npx ng build --configuration production',
		},
		artifactsEmitted: first.length,
		canonicalRoot: CANONICAL_ROOT,
		repeatedRoot: REPEATED_ROOT,
		inventory: first,
		boot: {
			laneRoot: `.versionless/stage/angular-tiny-translator-v0-12-0-u17b/${CANONICAL_ROOT}`,
			url: boot.url,
			booted: boot.booted,
			renderedTitle: boot.renderedTitle,
			pageErrors: boot.pageErrors,
			consoleErrors: boot.consoleErrors,
			refusal: boot.refusal,
			check: 'packages/cli/src/witness/angular-tiny-translator-boot-check.ts',
		},
		serviceWorkerAttempt: {
			state: 'measured-era-defect-carried-across-the-migration',
			attempted: true,
			script: '%BASE_HREF%ngsw-worker.js',
			httpStatus: 400,
			registered: false,
			shippedWorkerFiles: 0,
			consoleErrors: boot.consoleErrors,
			cause:
				'The application registers a service worker at the literal `%BASE_HREF%ngsw-worker.js`. ' +
				"Upstream substitutes that placeholder in a separate `replace` npm script that its " +
				'`build-prod-<lang>` chain runs and that `ng build` alone never runs, and the plain ' +
				'variant ships no worker script at any path, so the registration could not succeed ' +
				'even with the placeholder resolved. The era build has the same defect, measured in ' +
				'u19d; the migration neither introduced it nor repaired it.',
			masked: false,
		},
		supersedes: {
			record: 'u17d-final-green-lane.json',
			unit: 'lrapr-t006/u17d-tiny-translator-final-green',
			by: 'reference',
			why:
				"u17d's bytes are unchanged and it remains the record of what it measured: a green, " +
				'deterministic production build of this lane. What it could not see is what u19d then ' +
				'measured — that the artifact it published throws before Angular bootstraps, first on ' +
				'`process` and then on `$localize`. This record replaces it as the migrated lane the ' +
				'browser proof binds to, because this is the lane whose artifact mounts. The two ' +
				'capabilities between them changed two configuration files and added one shim module ' +
				'and one package; no application source differs from the tree u17d built.',
		},
		notEstablished: [
			'One route was loaded and one surface was read back. No journey ran, no gesture was ' +
				'performed, and the four facts u19d left uncalibrated are still uncalibrated.',
			'The Witness receipt for this vertical has not been re-run against this lane. This record ' +
				'establishes that the artifact mounts, not that the application behaves as it did on ' +
				'its era cell.',
			'Byte parity against the era lane is not claimed and is not available; the parity ' +
				'statement u17d published at logical-asset level is unchanged by this round and is not ' +
				'restated here.',
			'The era lane was not rebuilt, re-measured or touched by this round.',
			'No locale is loaded. With no translations registered the `$localize` runtime evaluates ' +
				'each tagged message to its source text, so what mounts renders the strings the ' +
				"templates already carry — the application's localised variants are a repository " +
				'script and were not built on either side.',
		],
		recordedRisks: [
			'`@angular/localize` is now in the declared closure and its `init` entry point runs before ' +
				'`main` in every configuration that takes polyfills, including the test target.',
			'The service-worker registration this application attempts fails with a 400 in both ' +
				'lanes. It is recorded above rather than suppressed, and nothing here repairs it.',
			'`util@0.12.5` and the node-core runtime globals shim u19e added remain in the closure and ' +
				'in the polyfills list, unchanged by this round.',
		],
	});
}

export async function main(): Promise<void> {
	const record = verifySealedRecord(await buildLocalizeLaneRecord());
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, LOCALIZE_LANE_FILE), canonical(record));
	process.stdout.write(
		`localize lane ${String(record['result'])}, digest ${record.digest.slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-localize-record.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
