/**
 * The record of the offline-faithful rebuild: the migrated TinyTranslator lane
 * with the Angular 16 font inliner turned off.
 *
 * u21 read `dist-13/index.html` and found CSS that exists in no input — an
 * `@font-face` rule for Material Icons v145 pointing at `fonts.gstatic.com`,
 * which is the body of a stylesheet the builder fetched from
 * `fonts.googleapis.com` while the build was running. u21 established that from
 * the document alone and said so: it observed no build and captured no traffic.
 * This round observes the build.
 *
 * Every number here is read at the moment the record is written: three build
 * logs, three egress logs, two emitted inventories, the source and emitted
 * documents, and a browser load of the canonical root. The control build is
 * part of the evidence rather than a rehearsal — it is the same workspace u19k
 * built, run under the same guard, and it goes red on the fetch. A green
 * control would have meant the guard was measuring nothing.
 *
 * This record supersedes u19k by reference. u19k's bytes are unchanged and it
 * remains the record of what it measured: the first migrated lane whose
 * artifact both mounts and keeps what a translator types. What it could not see
 * is that the document it published had been assembled with help from a third
 * party.
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
import { APPLIED_TREE, EVIDENCE_DIRECTORY, STAGE_DIRECTORY } from './angular-tiny-translator-apply-run.ts';
import { inventoryOf } from './angular-tiny-translator-final-record.ts';
import { observeAngularTinyTranslatorBoot } from '../witness/angular-tiny-translator-boot-check.ts';
import {
	CANONICAL_ROOT,
	REPEATED_ROOT,
	UNIT,
	type FontRound,
} from './angular-tiny-translator-u22-font-run.ts';

export const FONT_LANE_FILE = 'u22-offline-font-lane.json';
/** The u21 reading this round answers, bound by the digest it published. */
export const LOCALITY_FINDING = Object.freeze({
	record: 'evidence/runs/angular-tiny-translator-v0-12-0/u21-font-inline-locality.json',
	digest: '35ec08ef10c83f07d9924f9fda18a9818983d1d2fde7adf61b1371602bea5c59',
});

/** Every `<link>` href in a document, in document order. */
function linkHrefs(html: string): readonly string[] {
	return Object.freeze(
		[...html.matchAll(/<link\b[^>]*href="([^"]+)"/g)].map((match) => match[1] as string),
	);
}

/** How many `@font-face` rules a document carries in its own bytes. */
function fontFaceRules(html: string): number {
	return html.split('@font-face').length - 1;
}

export async function buildFontLaneRecord(): Promise<SealedRecord> {
	const round = JSON.parse(
		await readFile(path.join(STAGE_DIRECTORY, 'font-round.json'), 'utf8'),
	) as FontRound;
	const first = await inventoryOf(path.join(STAGE_DIRECTORY, CANONICAL_ROOT));
	const second = await inventoryOf(path.join(STAGE_DIRECTORY, REPEATED_ROOT));
	const identical = canonical(first) === canonical(second);
	const sourceIndex = await readFile(path.join(APPLIED_TREE, 'src/index.html'), 'utf8');
	const emittedIndex = await readFile(
		path.join(STAGE_DIRECTORY, CANONICAL_ROOT, 'index.html'),
		'utf8',
	);
	const supersededIndex = await readFile(
		path.join(STAGE_DIRECTORY, 'dist-13', 'index.html'),
		'utf8',
	);
	const boot = await observeAngularTinyTranslatorBoot(path.join(STAGE_DIRECTORY, CANONICAL_ROOT));
	const fontLinks = linkHrefs(emittedIndex).filter((href) => href.includes('fonts.googleapis.com'));
	const sourceFontLinks = linkHrefs(sourceIndex).filter((href) =>
		href.includes('fonts.googleapis.com'),
	);
	const egressFree = round.builds.every((build) => build.egressAttempts.length === 0);
	const green = round.builds.every((build) => build.exitStatus === 0);
	return sealRecord({
		schemaVersion: 'versionless.angular-tiny-translator-offline-font-lane.v1',
		unit: UNIT,
		consentId: CONSENT,
		result:
			green && egressFree && identical && boot.booted && fontFaceRules(emittedIndex) === 0
				? 'font-inlining-disabled-build-green-offline-deterministic-and-the-era-font-seam-restored'
				: 'font-inlining-disabled-and-the-lane-did-not-come-back-clean',
		meaning:
			'The Angular 16 browser builder inlines every Google Fonts stylesheet an application links, ' +
			'and it does it by fetching the stylesheet from the font host while the build runs. u19k ' +
			"published a lane built that way without knowing it. This round turns the inliner off with " +
			'the landed capability and rebuilds twice, and it measures the fetch rather than reasoning ' +
			'about it: every build here runs under an in-process guard that records and refuses any ' +
			'connection to a non-loopback address. The control build — the workspace exactly as u19k ' +
			'left it — reaches for `fonts.googleapis.com` and dies when it cannot have it. The two ' +
			'builds after the capability make no attempt at all, are green, and emit the same inventory ' +
			'file for file and digest for digest. The emitted document carries the application own ' +
			'`<link>` to the icon stylesheet again, which is exactly what the era build emitted: the ' +
			'browser fetches it at runtime, and the migrated lane is once more offline-buildable and ' +
			'behaviour-faithful at the same time.',
		answers: LOCALITY_FINDING,
		capability: {
			name: 'font-inlining-disable',
			package: '@versionless/angular',
			module: 'packages/frameworks/angular/src/font-inlining-disable.ts',
			answers:
				"the modern browser builder's `optimization.fonts.inline` default, which is on and which " +
				'the devkit own schema documents as requiring internet access',
			mechanism:
				'The capability reads two things and nothing else: the builder name, because ' +
				'`:server` declares an `optimization` option with no `fonts` member and would reject the ' +
				'key, and the shape of whatever `optimization` value the workspace declares. A declared ' +
				'`false` is left alone so that turning the inliner off can never switch optimisation on; ' +
				'a declared `true` or an ABSENT option becomes an explicit object carrying the schema own ' +
				'defaults for scripts and styles plus `fonts.inline: false`, because an absent option is ' +
				'the schema `true` and therefore inlines. Base options are written even when they declare ' +
				'nothing; a named configuration is rewritten only when it declares the option itself.',
			workspace: round.application.workspace,
			targetsRead: round.application.targetsRead,
			inliningTargets: round.application.inliningTargets,
			sites: round.application.sites,
			declaredDifferences: round.application.declaredDifferences,
			appliedByThisRound: round.application.changed,
		},
		applied: {
			tree: '.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app',
			filesChanged: ['angular.json'],
			applicationSourceChanged: false,
			note:
				'One file changed and it is not application source: the workspace. No component, module, ' +
				'template, style or polyfill differs from the tree u19k built, and the emitted bundles ' +
				'below are the ones u19k emitted — the difference between the two lanes is one document.',
		},
		egressGuard: {
			state: 'measured-process-scoped-refusal',
			mechanism:
				'Every build this round ran was preloaded with a guard that patches the socket connect ' +
				'every http, https and tls client ends up at and the DNS lookup that precedes it. Each ' +
				'attempt is written to a JSON-lines file with its host and port BEFORE it is refused, so ' +
				'a build that made no attempt and a build whose attempt was refused are distinguishable ' +
				'facts rather than one silent one.',
			source: 'packages/cli/src/fixture/angular-tiny-translator-u22-font-run.ts',
			scope: 'process',
			osWideIsolation: false,
		},
		control: {
			question:
				'Does the build as u19k left it actually need the font host, or was the inlined rule ' +
				'already lying around somewhere?',
			build: round.control,
			reading:
				round.control.exitStatus === 0
					? 'the control build came back GREEN with the inliner on, so this round measures nothing about the fetch'
					: 'the control build reached for the font host and died when it could not have it, which is the defect u21 read out of the document, observed',
			establishes:
				'The inlined `@font-face` rule u21 found in `dist-13/index.html` was fetched during the ' +
				'build. It is not in any input, it is not in any cache the build can reach, and the ' +
				'build cannot be run at all where the font host cannot be.',
		},
		builds: round.builds,
		egressFree,
		determinism: {
			claim:
				'build-15 and build-16 ran the same command over the same bytes with no edit between ' +
				'them, each into a cleaned output directory, under the same egress guard, and emitted ' +
				'the same inventory — same file count, same names, same digests.',
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
		document: {
			state: 'measured-era-faithful-font-seam',
			sourceIndex: 'src/index.html',
			sourceFontLinks,
			emittedIndex: `${CANONICAL_ROOT}/index.html`,
			emittedFontLinks: fontLinks,
			inlinedFontFaceRules: fontFaceRules(emittedIndex),
			supersededInlinedFontFaceRules: fontFaceRules(supersededIndex),
			preconnectEmitted: emittedIndex.includes('rel="preconnect"'),
			reading:
				'The emitted document links the same stylesheet the application own source links, and ' +
				'carries no `@font-face` rule and no preconnect the builder minted. The superseded ' +
				'document carried one inlined rule and one preconnect, neither of which appears in any ' +
				'input.',
		},
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
		supersedes: {
			record: 'u19k-cva-legacy-disabled-state-lane.json',
			unit: 'lrapr-t006/u19k-tiny-translator-publish-close',
			by: 'reference',
			why:
				"u19k's bytes are unchanged and it remains the record of what it measured: the first " +
				'migrated artifact of this cell that both mounts and keeps what a translator types. What ' +
				'it could not see is that the document it published had been assembled with help from a ' +
				'third party — the builder fetched a stylesheet from the font host mid-build and pasted ' +
				'it in. This record replaces it as the migrated lane the browser proof binds to, because ' +
				'this is the lane whose bytes are a function of its declared inputs. One file differs ' +
				'from the tree u19k built, and it is the workspace.',
		},
		notEstablished: [
			'The guard is process-scoped. It establishes what these build processes attempted; it does ' +
				'not establish that the machine was offline, and it says nothing about any other process.',
			'Nothing here establishes that this application makes no other undeclared request. It ' +
				'establishes that these three builds made exactly the attempts recorded above.',
			'The runtime request the era build made and this lane restores is still a request. It is ' +
				'answered inside the browser context by the Witness proof and never leaves the machine ' +
				'there; nothing here establishes what it does in a browser nobody is driving.',
			'The behavioural claims u19k made are not re-established by this round. One route was ' +
				'loaded. The Witness journey for this vertical is published separately and is what ' +
				'establishes behaviour across the lane pair against this artifact.',
			'Byte parity against the era lane is not claimed and is not available; eleven majors of ' +
				'bundler produce different names and different byte counts by construction.',
			'The era lane was not rebuilt, re-measured or touched by this round.',
		],
		recordedRisks: [
			'Every other migrated Angular lane in this corpus built with the same builder default. This ' +
				'record establishes the defect and the repair for THIS lane only; the rebuild list u21 ' +
				'published is what says which others are affected.',
			'The service-worker registration this application attempts still fails with a 400 in both ' +
				'lanes, unchanged by this round and unrepaired.',
			'`callSetDisabledState: whenDisabledForLegacyCode`, `@angular/localize`, `util@0.12.5` and ' +
				'the node-core runtime globals shim are all still in this lane exactly as u19k left them.',
		],
	});
}

export async function main(): Promise<void> {
	const record = verifySealedRecord(await buildFontLaneRecord());
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	const bytes = canonical(record);
	await writeFile(path.join(EVIDENCE_DIRECTORY, FONT_LANE_FILE), bytes);
	process.stdout.write(
		`font lane ${String(record['result'])}, digest ${record.digest.slice(0, 12)}, ` +
			`bytes sha256 ${sha256(bytes)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-u22-font-record.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
