/**
 * The record of the CVA round: the first migrated TinyTranslator artifact that
 * keeps what a translator types.
 *
 * u19f's `dist-11` mounts, and a browser journey then found the thing a mounting
 * check cannot see — the migrated lane took an edit into a `FormGroup` the view
 * had been detached from, left the outer control pristine, and exported the unit
 * under a changed state with its ORIGINAL text. u19i attributed that
 * mechanically to the application's own `setDisabledState`, woken by Angular
 * 16's `callSetDisabledState: 'always'` default, and the repair is the vendor's
 * own compatibility switch declared by a capability rather than an edit to
 * anybody's logic.
 *
 * Every number here is read at the moment the record is written: the two build
 * logs, both emitted inventories, a browser load of the canonical root, and the
 * two-lane discriminator re-driven by this driver rather than pasted from the
 * round that produced it. This record supersedes u19f by reference — u19f's
 * bytes are unchanged and remain the record of the lane it measured, whose
 * artifact mounts and silently drops typed data.
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
import { measureDiscriminator } from './angular-tiny-translator-cva-behavior-run.ts';
import { observeAngularTinyTranslatorBoot } from '../witness/angular-tiny-translator-boot-check.ts';
import type { CvaRound } from './angular-tiny-translator-cva-run.ts';

export const UNIT = 'lrapr-t006/u19k-tiny-translator-publish-close';
export const CVA_LANE_FILE = 'u19k-cva-legacy-disabled-state-lane.json';
/** The output root this lane publishes, and the sibling that makes it canonical. */
export const CANONICAL_ROOT = 'dist-13';
export const REPEATED_ROOT = 'dist-14';

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

export async function buildCvaLaneRecord(): Promise<SealedRecord> {
	const round = JSON.parse(
		await readFile(path.join(STAGE_DIRECTORY, 'cva-round.json'), 'utf8'),
	) as CvaRound;
	const builds = [await readBuild(13), await readBuild(14)];
	const first = await inventoryOf(path.join(STAGE_DIRECTORY, CANONICAL_ROOT));
	const second = await inventoryOf(path.join(STAGE_DIRECTORY, REPEATED_ROOT));
	const identical = canonical(first) === canonical(second);
	const boot = await observeAngularTinyTranslatorBoot(path.join(STAGE_DIRECTORY, CANONICAL_ROOT));
	const discriminator = await measureDiscriminator();
	const legacy = round.declaration.accessors.filter((reading) => reading.legacy);
	return sealRecord({
		schemaVersion: 'versionless.angular-tiny-translator-cva-lane.v1',
		unit: UNIT,
		consentId: CONSENT,
		result:
			boot.booted && discriminator['agrees'] === true && discriminator['flipped'] === true
				? 'legacy-call-set-disabled-state-declared-build-green-deterministic-and-the-typed-edit-survives'
				: 'legacy-call-set-disabled-state-declared-and-the-lanes-still-disagree',
		meaning:
			'u19f left a migrated artifact that mounts. A browser journey then measured what mounting ' +
			'cannot show: a translation typed into the editor never reached the outer control, the unit ' +
			'stayed pristine, and the export carried the original text under a changed state. u19i ' +
			"attributed it to the application's own `setDisabledState`, which rebuilds the `FormGroup` " +
			'its debounced subscription watches and which Angular 16 calls on every accessor as it ' +
			'attaches — a call Angular 5 never made for an enabled control. A capability reads the ' +
			"application's own accessors, classifies what each `setDisabledState` body does, and " +
			"declares the vendor's own `callSetDisabledState: 'whenDisabledForLegacyCode'` compatibility " +
			'option on the modules that attach accessors. The production build is green and byte-stable ' +
			'over two runs, the canonical root mounts, and the discriminator that caught the loss now ' +
			'agrees across both lanes: the typed edit reaches the outer control and undo becomes ' +
			'available, exactly as it does on the era cell.',
		capability: {
			name: 'forms-legacy-call-set-disabled-state',
			package: '@versionless/angular',
			answers:
				'the call-site semantics of `ControlValueAccessor.setDisabledState` across the v15 ' +
				'boundary: Angular calls it on every accessor as it attaches a control, and an accessor ' +
				'written against the era behaviour can do work there that the era framework never ran',
			mechanism:
				"Each accessor is found by resolving what a class implements against Angular's own " +
				'`ControlValueAccessor`, never by a name match, and its `setDisabledState` body is ' +
				'classified statement by statement: assignments that only carry the disabled flag are ' +
				'toggle plumbing, and anything else is a named effect that the era guard was hiding. ' +
				'An application whose accessors only toggle gets nothing declared, because a ' +
				'compatibility switch nothing needs is a behavioural change nobody measured. The ' +
				"option is delivered through the vendor's own published `withConfig` factory on the " +
				'modules that attach accessors — the `CALL_SET_DISABLED_STATE` token is in 16.2.12 ' +
				'typings but not on its export surface, which the build refuses — and the defective ' +
				'accessor is left exactly as its authors wrote it.',
			accessorsRead: round.declaration.accessors.length,
			legacyAccessors: legacy.length,
			modulesRead: round.modulesRead,
			declaredDifferences: round.declaration.declaredDifferences,
			refusedHere: round.declaration.unhandled,
		},
		applied: {
			tree: '.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app',
			filesChanged: round.filesChanged,
			change: round.declaration.change,
			applicationLogicChanged: false,
			note:
				'One file changed: the module that bootstraps, which gained an import and two ' +
				'configured module factories. No application logic was rewritten and the accessor whose ' +
				'`setDisabledState` rebuilds its own form keeps the defect u19i attributed — the ' +
				"migration's job here is to stop the framework calling it at a moment the era framework " +
				'never did.',
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
		discriminator: {
			question:
				'After a translation is typed into the editor and the 200 ms debounce window has passed ' +
				'fifteen times over, does the undo control still carry `disabled`? The application ' +
				'enables it exactly when it has taken the edit into the unit, so the answer is the ' +
				"application's own account of whether the typed text survived.",
			driver: 'packages/cli/src/fixture/angular-tiny-translator-cva-behavior-run.ts',
			measuredHere: true,
			reading: discriminator,
			supersededReading: {
				record: 'evidence/runs/angular-tiny-translator-v0-12-0/u19i-data-loss-cause.json',
				migratedBefore:
					'the undo control still carried `disabled` after the settle window and the export ' +
					'carried the original text under `state="final"`',
			},
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
				'Upstream substitutes that placeholder in a separate `replace` npm script that its ' +
				'`build-prod-<lang>` chain runs and that `ng build` alone never runs, and the plain ' +
				'variant ships no worker script at any path, so the registration could not succeed ' +
				'even with the placeholder resolved. The era build has the same defect, measured in ' +
				'u19d; the migration neither introduced it nor repaired it.',
			masked: false,
		},
		supersedes: {
			record: 'u19f-localize-boot-green-lane.json',
			unit: 'lrapr-t006/u19f-localize-boot-green',
			by: 'reference',
			why:
				"u19f's bytes are unchanged and it remains the record of what it measured: a green, " +
				'deterministic production build whose artifact mounts, which is exactly what u19d found ' +
				'missing. What it could not see is what a driven browser then measured — that the ' +
				'application takes a typed translation nowhere. This record replaces it as the migrated ' +
				'lane the browser proof binds to, because this is the lane that keeps what is typed ' +
				'into it. One file differs from the tree u19f built, and it is the module that ' +
				'bootstraps.',
		},
		notEstablished: [
			'The application’s own `setDisabledState` still rebuilds the form its subscription ' +
				'watches. Nothing here repairs that; the framework is configured not to call it while ' +
				'attaching an enabled control, which is what the era framework did.',
			'The ICU-control drop u19i marked unmeasured is still unmeasured: the accessor rebuilds its ' +
				'group with `displayedText` alone, and no measurement here establishes what that means ' +
				'for a unit carrying ICU messages.',
			'One route was loaded and one discriminator was driven. The Witness journey for this ' +
				'vertical is published separately and is what establishes behaviour across the pair.',
			'Byte parity against the era lane is not claimed and is not available; the parity statement ' +
				'u17d published at logical-asset level is unchanged by this round and is not restated ' +
				'here.',
			'The era lane was not rebuilt, re-measured or touched by this round beyond being driven as ' +
				'the discriminator’s control.',
		],
		recordedRisks: [
			'`callSetDisabledState: whenDisabledForLegacyCode` is configured application-wide, so every ' +
				'accessor in this application — present and future — gets the pre-15 call site, ' +
				'not just the one that needed it. Angular names the pre-15 behaviour a bug in its own ' +
				'source, and the declared difference above says so.',
			'The service-worker registration this application attempts fails with a 400 in both lanes. ' +
				'It is recorded above rather than suppressed, and nothing here repairs it.',
			'`@angular/localize`, `util@0.12.5` and the node-core runtime globals shim remain in the ' +
				'closure and in the polyfills list, unchanged by this round.',
		],
	});
}

export async function main(): Promise<void> {
	const record = verifySealedRecord(await buildCvaLaneRecord());
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, CVA_LANE_FILE), canonical(record));
	process.stdout.write(
		`cva lane ${String(record['result'])}, digest ${record.digest.slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-cva-record.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
