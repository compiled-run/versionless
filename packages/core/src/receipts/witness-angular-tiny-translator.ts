import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import {
	WITNESS_DOWNLOAD_CAPTURE_RULE,
	WITNESS_FILE_INPUT_LOAD_RULE,
	WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
} from './witness-real-app.ts';
import type {
	WitnessConsoleErrorInventory,
	WitnessConsoleErrorInventoryEntry,
	WitnessDownloadCaptureInventory,
	WitnessFailedRequestInventory,
	WitnessFailedRequestInventoryEntry,
	WitnessFileInputLoadInventory,
	WitnessFileInputSurfaceEntry,
	WitnessMeasuredScrollAbsence,
	WitnessMockedNonLoopbackSeamEntry,
	WitnessMockedNonLoopbackSeamInventory,
	WitnessRealAppRun,
	WitnessRenderedStyleEvidence,
	WitnessRenderedStyleMeasurement,
	WitnessServiceWorkerRequestEvent,
	WitnessServiceWorkerTelemetry,
} from './witness-real-app.ts';

export const WITNESS_ANGULAR_TINY_TRANSLATOR_SCHEMA =
	'versionless.witness-angular-tiny-translator.v1' as const;
export const WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH =
	'evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json' as const;
export const ANGULAR_TINY_TRANSLATOR_FIXTURE = 'angular-tiny-translator-v0-12-0' as const;
export const ANGULAR_TINY_TRANSLATOR_APP = 'angular-tiny-translator' as const;

/**
 * The immutable TinyTranslator source identity, bound here so the browser proof
 * cannot silently rebind itself to a different revision or archive.
 *
 * The pin is a lightweight tag — no tag object, no tagger, no signature — so the
 * ref is recorded alongside what actually carries the identity: the commit sha,
 * the root tree sha and the archive digest. Saying which of them the identity
 * rests on is the point of recording all four.
 */
export const ANGULAR_TINY_TRANSLATOR_SOURCE = Object.freeze({
	repository: 'https://github.com/martinroob/tiny-translator',
	ref: 'refs/tags/v0.12.0',
	tagKind: 'lightweight — no tag object, no tagger and no signature; the commit is unsigned',
	revision: '08dcacf6a41d5a6f6dfbc71d858adcdc4c85691a',
	rootTreeSha: 'ba39de904e28030dcc8a09e28bbd1b0db7247bb7',
	archiveSha256: '424209463bcccca1714d520e2f68c55d54b204c69367bbeefcdf930d01d3ac18',
	archiveBytes: 186861,
	frontendRoot: '.',
	license: 'MIT',
	licenseSha256: 'b33e2f180e3d22c42c1511895a448e9aafb848a51a43a9cfae163f19f7288fb9',
});

/**
 * The two build-lane receipts this browser proof stands on, each bound by the
 * digest it declares for itself and by the sha256 of its exact bytes, so the
 * proof cannot be re-pointed at a rebuilt or edited build receipt.
 *
 * Each entry also names the ONE output root the browser proof is allowed to
 * serve for that lane, and the sibling build whose byte-identity is what makes
 * that root canonical rather than merely most recent: each lane built twice
 * into a cleaned directory and emitted the same inventory, file for file and
 * digest for digest. Serving `rebuild-1` or `dist-7` is therefore serving the
 * lane, not one arbitrary build of it, and the verifier below re-reads the
 * byte-identity claim out of the bound receipt rather than trusting this list.
 *
 * The migrated entry is `u19k`, and the chain that leads to it is the point.
 * u17d built a green, deterministic lane whose artifact throws before Angular
 * bootstraps; u19f repaired the boot and published a root that mounts; a driven
 * browser then found that the mounted application takes a typed translation
 * nowhere. Each record's bytes are unchanged and each remains the record of what
 * it measured — every supersession here is by reference, never by rewrite —
 * because each was contradicted by a measurement the previous round could not
 * make. u19k is the lane whose artifact both mounts and keeps what is typed into
 * it, and it is the only migrated lane this proof is allowed to serve.
 */
export const ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS = Object.freeze([
	Object.freeze({
		lane: 'baseline',
		path: 'evidence/runs/angular-tiny-translator-v0-12-0/u17-era-baseline.json',
		schemaVersion: 'versionless.angular-tiny-translator-era-baseline.v1',
		digest: 'f996cc39a4b24f30782591e967ddf02fe8448a950db71015ff9f9d214f8c23b6',
		sha256: '43ba7cbea92a931566d44bb74e0006a7e541f5f77e8ee589d6814aaa48ab17c5',
		canonicalRoot: 'dist/rebuild-1',
		repeatedRoot: 'dist/rebuild-2',
		files: 524,
		byteIdenticalSibling: true,
	}),
	Object.freeze({
		lane: 'migrated',
		path: 'evidence/runs/angular-tiny-translator-v0-12-0/u19k-cva-legacy-disabled-state-lane.json',
		schemaVersion: 'versionless.angular-tiny-translator-cva-lane.v1',
		digest: '67ee98601be55f947ffec86cc1e00f3753b4deb2575c821cb3c6d12713c41135',
		sha256: '98713ed1530d73f1f0801faa318d6b22a5783a1c2d98efeef1206a8cb1dd5771',
		canonicalRoot: 'dist-13',
		repeatedRoot: 'dist-14',
		files: 524,
		byteIdenticalSibling: true,
	}),
]);

/**
 * The migrated lane's supersession chain, published so a reader can see that the
 * binding above is the end of a sequence of measurements rather than a choice.
 *
 * Every record in it is immutable and still on disk. Each was superseded by
 * reference — the later record names the earlier one and says what it could not
 * see — and each supersession was forced by a browser measurement, which is the
 * whole argument this vertical makes: a build lane can be green, deterministic
 * and byte-stable over a lane that does not work.
 */
export const ANGULAR_TINY_TRANSLATOR_MIGRATED_LANE_CHAIN = Object.freeze([
	Object.freeze({
		record: 'evidence/runs/angular-tiny-translator-v0-12-0/u17d-final-green-lane.json',
		root: 'dist-7',
		published: 'a green, deterministic, byte-stable production build of the eleven-major lift',
		contradictedBy:
			'a browser load: the artifact throws `process is not defined` before Angular bootstraps',
	}),
	Object.freeze({
		record: 'evidence/runs/angular-tiny-translator-v0-12-0/u19f-localize-boot-green-lane.json',
		root: 'dist-11',
		published: 'the first migrated artifact of this cell that mounts and renders its own title',
		contradictedBy:
			'a driven browser: a translation typed into the editor never reaches the outer control, and the export carries the original text under a changed state',
	}),
	Object.freeze({
		record:
			'evidence/runs/angular-tiny-translator-v0-12-0/u19k-cva-legacy-disabled-state-lane.json',
		root: 'dist-13',
		published:
			'the lane that mounts AND keeps what is typed into it: the discriminator that caught the loss agrees across both lanes',
		contradictedBy: null,
	}),
]);

/**
 * The amendments this schema has taken, each one a claim it used to make that a
 * measurement contradicted.
 *
 * An amendment is recorded rather than applied silently, because the corrected
 * claim and the corrected receipt are the same object: a reader who only sees
 * the current text cannot tell whether it was measured or assumed. Each entry
 * names what was claimed, what was measured, what the schema does now, and the
 * record the measurement lives in.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_RECORDED_AMENDMENTS = Object.freeze([
	Object.freeze({
		subject: 'service-worker registration',
		claimed:
			'the application never attempts a registration, so every run carries an empty observer trace and zero worker events',
		measured:
			'both lanes register at the literal `%BASE_HREF%ngsw-worker.js`, the request is answered 400, the registration is refused, and the browser still opens an observer record for the attempt',
		amendment:
			'the run carries a `refusedServiceWorker` shape instead: every settled fact of the zero-worker shape is still asserted — nothing registered, installing, waiting, active, controlling or cached at any of three checkpoints — and the attempt trace is recorded exactly, with every event required to name the script and the scope the application asked for',
		record: 'evidence/runs/angular-tiny-translator-v0-12-0/u19d-witness-calibration-red.json',
	}),
	Object.freeze({
		subject: 'console-error parity across the lanes',
		claimed:
			'the two lanes agree on their console-error inventories, so the inventory travels whole in the lane-independent behavior digest',
		measured:
			'each framework reports the SAME refused registration in its own words — Angular 5 lets it escape into zone.js as an uncaught in-promise error with a stack, Angular 16 catches it in `SwRegistrationOptions` and prints one line',
		amendment:
			'the membership is pinned per lane and checked exactly against the published per-lane inventory; only the policy, the total and the entry count travel in the parity digest, exactly as the mocked-seam membership already did',
		record: 'evidence/runs/angular-tiny-translator-v0-12-0/u19d-witness-calibration-red.json',
	}),
	Object.freeze({
		subject: 'the canonical migrated output root',
		claimed:
			'the migrated lane this proof serves is u17d’s `dist-7`, on the strength of a green, deterministic, byte-stable build',
		measured:
			'`dist-7` throws before Angular bootstraps, and `dist-11` — which mounts — silently discards a typed translation',
		amendment:
			'the binding moved twice, each time by reference and each time forced by a browser measurement; `dist-13` is the served root and the chain is published in full',
		record:
			'evidence/runs/angular-tiny-translator-v0-12-0/u19k-cva-legacy-disabled-state-lane.json',
	}),
]);

/**
 * The three findings this vertical's browser phase produced, and what each one
 * cost to repair. They are carried in the receipt because they are the cell's
 * result: the build lanes were green before any of them was known.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_MIGRATION_FINDINGS = Object.freeze([
	Object.freeze({
		finding: 'the migrated bundle threw `process is not defined` before Angular bootstrapped',
		invisibleTo: 'both build lanes — green, deterministic and byte-stable over the same artifact',
		foundBy: 'a browser load of the canonical output root',
		cause: 'the era build inlined Node core globals the Angular 16 browser builder does not',
		repair: 'the node-core-runtime-globals coherence capability, generic and cell-driven',
		record: 'evidence/runs/angular-tiny-translator-v0-12-0/u19e-node-core-runtime-globals.json',
	}),
	Object.freeze({
		finding: 'the migrated bundle then threw `$localize is not defined` at bootstrap',
		invisibleTo: 'both build lanes',
		foundBy: 'a browser load of the next canonical output root',
		cause: "this application's templates are i18n-marked, and the Angular 16 compiler emits `$localize` tagged templates the bundle evaluates at run time where the era compiler substituted translations into its factories",
		repair:
			"the template-i18n-runtime capability, which reads the markers out of the compiler's own parse and declares the package and entry point the target cell publishes",
		record:
			'evidence/runs/angular-tiny-translator-v0-12-0/u19f-localize-boot-green-lane.json',
	}),
	Object.freeze({
		finding:
			'the mounted migrated application silently discarded a typed translation: the textarea went dirty, the outer control stayed pristine, and the export carried the ORIGINAL text under `state="final"`',
		invisibleTo:
			'both build lanes and the boot check — the artifact builds, mounts, renders and exports',
		foundBy:
			"the journey's own settled-reaction anchor: the application enables its undo control exactly when it has taken an edit, and on the migrated lane it never did",
		cause: "the application's own `setDisabledState` rebuilds the `FormGroup` its debounced subscription watches; Angular 16 calls that method on every accessor as it attaches a control, and Angular 5 called it only for a control already disabled, so the latent bug never fired on the era cell. Both rival hypotheses were refuted by measurement — our own rxjs pipe translation by a positive control that emitted on time, and a dual-rxjs interaction by a closure census finding one runtime-reachable copy",
		repair:
			"the forms-legacy-call-set-disabled-state capability, which declares the vendor's own `callSetDisabledState: 'whenDisabledForLegacyCode'` switch on the modules that attach accessors and leaves the defective accessor exactly as its authors wrote it",
		record: 'evidence/runs/angular-tiny-translator-v0-12-0/u19i-data-loss-cause.json',
	}),
]);

/**
 * The seam this application reaches for outside loopback in the ERA lane,
 * pinned query-free by the standing rule.
 *
 * `src/index.html` links the Material Icons stylesheet unconditionally, so every
 * document load of the era build requests it. The harness answers it inside the
 * browser context: nothing leaves the machine, and the request is still written
 * down, because a seam that is answered is still a seam the application has.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_BASELINE_SEAMS = Object.freeze([
	Object.freeze({ method: 'GET', path: 'https://fonts.googleapis.com/icon' }),
]) as readonly WitnessMockedNonLoopbackSeamEntry[];

/**
 * The migrated lane's seams are pinned by ORIGIN rather than by full path, and
 * the reason is worth stating plainly rather than hiding in a looser check.
 *
 * The Angular 16 builder inlines the Google Fonts stylesheet into the document
 * at build time, so the migrated build never asks `fonts.googleapis.com` for
 * anything at run time; what it asks for instead is the font file the inlined
 * `@font-face` rule points at, on `fonts.gstatic.com`, under a path the font
 * provider itself mints and versions. That path is a fact about the provider's
 * CDN on the day the build ran, not a fact about this migration, and inventing
 * one here would be a pin nobody measured. So the schema pins what the
 * migration decides — that every migrated seam is a `fonts.gstatic.com` GET and
 * that no migrated seam is on `fonts.googleapis.com` at all — and the published
 * receipt pins the exact member, identically across all four runs.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_SEAM_ORIGINS = Object.freeze({
	baseline: 'https://fonts.googleapis.com',
	migrated: 'https://fonts.gstatic.com',
});

/**
 * The divergence between the two lanes' seams, recorded as a declared
 * difference rather than normalized away.
 *
 * It is a genuine, observable change across the migration: the era build asks
 * the network for a stylesheet at run time, and the migrated build already has
 * that stylesheet in its document and asks only for the font. Both are answered
 * in-context, neither leaves the machine, and neither lane ends up with the
 * glyphs — which is what the two icon degradations below record.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_FONT_SEAM_DIFFERENCE = Object.freeze({
	state: 'recorded-behavioral-migration-difference',
	baseline: 'requests-the-icon-stylesheet-from-fonts-googleapis-com-at-runtime',
	migrated:
		'ships-the-stylesheet-inlined-by-the-builder-and-requests-only-the-font-from-fonts-gstatic-com',
	cause: 'the Angular 16 builder inlines Google Fonts into the document at build time and emits a preconnect for the font host; the era Angular CLI 1.5 builder emitted the stylesheet link untouched',
	answeredInContext: true,
	successfulNonLoopbackInEitherLane: 0,
	masked: false,
});

/**
 * The two distinct ways `mat-icon` degrades with the font seam answered
 * in-context, one per lane. Both lanes render ligature text instead of glyphs,
 * and they arrive there differently:
 *
 * - the era build never receives the stylesheet, so no `@font-face` rule and no
 *   `Material Icons` family ever reach the page at all;
 * - the migrated build already carries the inlined rule, so the family IS
 *   declared and applied — and the font file behind it is the thing that never
 *   arrives.
 *
 * Recording them as one degradation would erase a real difference between the
 * lanes, so each is asserted separately and the difference between them is
 * declared. The measured resolved family is carried in the run, and it has to
 * agree with the lane's `iconFontFamilyDeclared` flag.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_MAT_ICON_DEGRADATIONS = Object.freeze({
	baseline: Object.freeze({
		state: 'measured-icon-degradation',
		cause: 'icon-stylesheet-answered-in-context-so-no-font-face-rule-reaches-the-page',
		iconFontFamilyDeclared: false,
		rendersLigatureText: true,
		masked: false,
	}),
	migrated: Object.freeze({
		state: 'measured-icon-degradation',
		cause: 'stylesheet-inlined-at-build-time-and-its-font-file-answered-in-context',
		iconFontFamilyDeclared: true,
		rendersLigatureText: true,
		masked: false,
	}),
});

/**
 * What this application actually does about a service worker, measured.
 *
 * The receipt used to claim the opposite — that the application never attempted
 * a registration and the zero was its own behavior. A browser load of either
 * lane's production output contradicts that flatly: the application registers a
 * worker at the literal `%BASE_HREF%ngsw-worker.js`, the placeholder
 * unsubstituted, and the request comes back 400 because no worker is shipped at
 * that path or any other. Upstream substitutes the placeholder in a separate
 * `replace` npm script that its `build-prod-<lang>` chain runs and that
 * `ng build` alone never runs, so the plain production variant — the only one
 * either lane builds — carries the defect by construction.
 *
 * It is an era defect that survives the migration unchanged, in both directions:
 * the migration did not introduce it, and no capability in this vertical
 * repaired it. Recording it is the point. A proof that pinned zero service
 * workers and got one by not looking is a proof that can be contradicted by
 * opening the page.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_SERVICE_WORKER_ATTEMPT = Object.freeze({
	state: 'measured-era-defect-carried-across-the-migration',
	attempted: true,
	script: '%BASE_HREF%ngsw-worker.js',
	httpStatus: 400,
	registered: false,
	shippedWorkerFiles: 0,
	cause: 'the registration argument carries the un-substituted literal `%BASE_HREF%`, which upstream replaces in a separate npm script that `ng build` never runs, and the plain production variant ships no worker script at any path',
	introducedByMigration: false,
	repairedHere: false,
	masked: false,
});

/** The family name the inlined rule declares, matched against the measurement. */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_ICON_FONT_FAMILY = 'Material Icons' as const;

/**
 * The closed list of rendered-appearance probes the journey measures, identical
 * in both lanes so the two measurements are comparable at all.
 *
 * Selectors are element- and attribute-based on purpose: Angular Material's own
 * class names were rewritten onto MDC between 5.0.0-rc.2 and 16.2, and a probe
 * pinned to a class name would be measuring the framework's naming rather than
 * the application's appearance.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES = Object.freeze([
	Object.freeze({
		label: 'application-toolbar',
		selector: 'mat-toolbar',
		properties: Object.freeze(['background-color', 'color']),
	}),
	Object.freeze({
		label: 'material-icon',
		selector: 'mat-icon',
		properties: Object.freeze(['font-family', 'font-size']),
	}),
	Object.freeze({
		label: 'raised-button',
		selector: 'button[mat-raised-button]',
		properties: Object.freeze(['background-color', 'border-radius', 'font-family']),
	}),
	Object.freeze({
		label: 'document-body',
		selector: 'body',
		properties: Object.freeze(['background-color', 'margin-top']),
	}),
]);

/**
 * The probes whose resolved values are allowed to differ across the eleven-major
 * lift, each with the reason it differs. This is a declaration, not an
 * allowance, and it is checked in both directions: a probe outside this list
 * that differs fails the run, and a probe inside it that does NOT differ fails
 * too — a declared difference that stopped being real is a stale claim, and
 * leaving it standing would let the receipt describe a migration that no longer
 * happened.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_DIFFERENCES = Object.freeze([
	Object.freeze({
		label: 'material-icon',
		why: 'the two lanes degrade differently: the era lane never receives a Material Icons rule, and the migrated lane applies the inlined one whose font never arrives',
	}),
	Object.freeze({
		label: 'raised-button',
		why: 'Angular Material reimplemented the raised button on MDC between 5.0.0-rc.2 and 16.2, so the shipped shape and type ramp are different by construction rather than by regression',
	}),
]);

/**
 * The application's routing shape, pinned instead of a route sequence.
 *
 * The router runs with `useHash: true`, so every navigation is a fragment. What
 * a browser proof can be held to here is that each recorded route is a hash
 * route naming one of the application's own declared routes, in the same
 * sequence in every lane and pass — and that is what is checked. A pinned
 * sequence belongs to the journey that drives it, and this unit drives none.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_ROUTE_SHAPE = Object.freeze({
	router: 'angular-router-use-hash',
	prefix: '#/',
	known: Object.freeze([
		'/autotranslatesummary',
		'/configureautotranslate',
		'/createproject',
		'/editproject',
		'/home',
		'/selectfilter',
		'/translate',
	]),
});

/**
 * The file-input surface the application declares, and the exact synthetic
 * fixture the harness is allowed to load into it.
 *
 * The fixture is authored for this proof and contains no third party's content:
 * a translation file's units are the application's data, and a real one would
 * put somebody else's strings into published evidence. It is bound by byte
 * length and digest here, so a journey cannot quietly load a different file
 * than the one this schema declares.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES = Object.freeze([
	Object.freeze({
		label: 'translation-file',
		selector: 'input[type=file]',
		fixturePath: 'fixtures/angular-tiny-translator-v0-12-0/witness/synthetic-messages.xlf',
	}),
]) as readonly WitnessFileInputSurfaceEntry[];

/** The synthetic fixture's exact identity, bound so the load cannot drift. */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE = Object.freeze({
	fileName: 'synthetic-messages.xlf',
	format: 'XLIFF 1.2',
	transUnits: 3,
	bytes: 1079,
	sha256: '9740ca22119d02d660c8ad595be9bb5de4a33bef9473f5a0e5a11da6c53d2284',
});

/**
 * The download surface the application declares. TinyTranslator's export is a
 * client-side download through its own downloader service — the file is built
 * in the browser and handed to the browser, and nothing is uploaded anywhere.
 * The context accepts downloads only because this declaration exists.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_DOWNLOAD_SURFACE = Object.freeze({
	state: 'declared-client-side-download',
	produced: 'the applications own downloader service, client-side, through file-saver',
	uploaded: false,
	leftTheMachine: false,
	expectedDownloads: 1,
});

/**
 * The migration's accommodation framing.
 *
 * Zero manual migration steps is the claim, and the inventory that backs it is
 * not restated here: it is referenced in the bound migrated build receipt,
 * which itemises all nine changed application files and the five capabilities
 * that changed them. The journey obligation is the other half — the one
 * declared difference the build lanes could not observe, named so that the
 * browser proof is required to observe it rather than inherit it.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_ACCOMMODATIONS = Object.freeze({
	manualMigrationSteps: 0,
	inventory: Object.freeze({
		record:
			'evidence/runs/angular-tiny-translator-v0-12-0/u19k-cva-legacy-disabled-state-lane.json',
		applicationFilesChanged: 10,
		capabilities: 8,
		note: 'Every edit was made by a generic capability reading the installed closure, the compiler, the application\u2019s own templates or its own value accessors. Nine application files and five capabilities are itemised in u17d, which u19f supersedes by reference and u19k supersedes in turn; the tenth file is the runtime-globals shim u19e generated. The three capabilities added after u17d are the ones the browser phase forced \u2014 node-core-runtime-globals and template-i18n-runtime made the artifact evaluate at all, and forms-legacy-call-set-disabled-state made it keep what a translator types. The third changed no new file: it added an import and two configured module factories to the module that bootstraps, which is already one of the nine. The first two also changed two configuration files, the workspace and the manifest, which are not application source and are itemised in u19e and u19f.',
	}),
	journeyObligations: Object.freeze([
		'FileReader-service parity: the migrated lane inserted a `typeof` guard where `FileReader.result` is typed `string | ArrayBuffer`, and the build lane recorded as a declared difference that nothing it ran observed the guarded statements. The browser proof must load a translation file through the application own file input in BOTH lanes and assert the parse is identical, which is what turns that declared difference into an observed one.',
	]),
});

/** The per-lane assertion the icon degradation is recorded as, with its measurement. */
export type WitnessAngularTinyTranslatorMatIcon = {
	state: 'measured-icon-degradation';
	cause: string;
	iconFontFamilyDeclared: boolean;
	rendersLigatureText: true;
	masked: false;
	/** The family the browser actually resolved for the probed icon element. */
	resolvedFontFamily: string;
	/** The ligature text the icon rendered instead of a glyph. */
	renderedText: string;
};

/** The FileReader parity reading, identical in both lanes by obligation. */
export type WitnessAngularTinyTranslatorFileReaderParity = {
	state: 'measured-identical-parse-across-lanes';
	assertion: string;
	parsedUnits: number;
	parsedDigest: string;
};

export type WitnessAngularTinyTranslatorPersistence = {
	store: 'browser-local-storage';
	service: 'the applications own BackendLocalStorageService behind BackendServiceAPI';
	backend: 'none';
	stubbed: false;
	keysBeforeJourney: string[];
	keysAfterJourney: string[];
	survivesOnlineReload: true;
};

export type WitnessAngularTinyTranslatorJourney = {
	matIcon: WitnessAngularTinyTranslatorMatIcon;
	fileReaderParity: WitnessAngularTinyTranslatorFileReaderParity;
	persistence: WitnessAngularTinyTranslatorPersistence;
};

/**
 * The refused-registration evidence, recorded per run.
 *
 * This is the shape the first recorded amendment produced. Every settled fact of
 * the zero-worker shape is still asserted here — nothing registered, installing,
 * waiting, active, controlling the page or cached, at each of three checkpoints
 * spanning the journey — and what is NOT asserted away is the attempt trace: a
 * browser that refuses a registration still opens a record of the attempt, and
 * pretending otherwise would have been a claim this application contradicts on
 * every load. Each event is required to name the script and the scope the
 * application asked for.
 */
export type WitnessAngularTinyTranslatorRefusedServiceWorker = {
	attempt: { script: string; scopePath: string };
	checkpoints: Array<{
		phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
		state: 'timeout';
		registrations: 0;
		controller: null;
		cacheNames: [];
		attemptEvents: WitnessServiceWorkerTelemetry['workerEvents'];
	}>;
	/** The worker scripts the build emitted, which for both lanes is none. */
	outputFiles: Array<{ path: string; beforeSha256: string; afterSha256: string }>;
	/** Every service-worker-scoped request the run observed, wall clock stripped. */
	requests: WitnessServiceWorkerRequestEvent[];
	workerEvents: WitnessServiceWorkerTelemetry['workerEvents'];
};

export type WitnessAngularTinyTranslatorRun = WitnessRealAppRun & {
	refusedServiceWorker: WitnessAngularTinyTranslatorRefusedServiceWorker;
	consoleErrorInventory: WitnessConsoleErrorInventory;
	failedRequestInventory: WitnessFailedRequestInventory;
	mockedNonLoopbackSeams: WitnessMockedNonLoopbackSeamInventory;
	fileInputLoads: WitnessFileInputLoadInventory;
	downloadCaptures: WitnessDownloadCaptureInventory;
	renderedStyles: WitnessRenderedStyleEvidence;
	applicationJourney: WitnessAngularTinyTranslatorJourney;
	scrollAbsence: WitnessMeasuredScrollAbsence;
	behaviorDigest: string;
};

export type WitnessAngularTinyTranslatorMutation = {
	failure: 'witness-semantic-assertion';
	intendedFailure: true;
	lane: 'migrated';
	seam: string;
	path: string;
	offset: number;
	beforeSha256: string;
	mutatedSha256: string;
	afterRestoreSha256: string;
	restoredByteIdentically: true;
	restoredRun: 'pass';
	restoredBehaviorDigest: string;
};

export type WitnessAngularTinyTranslatorReceipt = {
	schemaVersion: typeof WITNESS_ANGULAR_TINY_TRANSLATOR_SCHEMA;
	result: 'pass';
	fixture: typeof ANGULAR_TINY_TRANSLATOR_FIXTURE;
	source: typeof ANGULAR_TINY_TRANSLATOR_SOURCE;
	provenance: Record<string, unknown>;
	canonicalReceipts: Array<{
		lane: 'baseline' | 'migrated';
		path: string;
		schemaVersion: string;
		digest: string;
		sha256: string;
		canonicalRoot: string;
		repeatedRoot: string;
		files: number;
		byteIdenticalSibling: true;
	}>;
	runs: WitnessAngularTinyTranslatorRun[];
	mutation: WitnessAngularTinyTranslatorMutation;
	consoleErrors: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>
	>;
	failedRequests: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>
	>;
	/**
	 * The exact per-lane seam membership as published. The baseline half is the
	 * pinned constant; the migrated half is the exact member the runs observed,
	 * held to the declared origin rule and required to be identical in every run.
	 */
	mockedSeams: Record<'baseline' | 'migrated', WitnessMockedNonLoopbackSeamEntry[]>;
	fontSeamDifference: typeof WITNESS_ANGULAR_TINY_TRANSLATOR_FONT_SEAM_DIFFERENCE;
	serviceWorkerAttempt: typeof WITNESS_ANGULAR_TINY_TRANSLATOR_SERVICE_WORKER_ATTEMPT;
	/** The supersession chain behind the migrated lane this proof serves. */
	migratedLaneChain: typeof ANGULAR_TINY_TRANSLATOR_MIGRATED_LANE_CHAIN;
	/** What the browser phase found that no build lane could, and what repaired it. */
	migrationFindings: typeof WITNESS_ANGULAR_TINY_TRANSLATOR_MIGRATION_FINDINGS;
	/** The claims this schema used to make that a measurement contradicted. */
	amendments: typeof WITNESS_ANGULAR_TINY_TRANSLATOR_RECORDED_AMENDMENTS;
	/**
	 * The outcome of the one obligation the build lanes handed this proof: the
	 * declared FileReader difference, arbitrated by loading a file through the
	 * application's own input in both lanes and comparing what it parsed.
	 */
	fileReaderArbitration: {
		state: 'arbitrated-declared-difference';
		obligation: string;
		outcome: 'identical-parse-in-both-lanes';
		parsedUnits: number;
		parsedDigest: string;
		inBehaviorDigest: true;
	};
	matIconDegradations: Record<'baseline' | 'migrated', WitnessAngularTinyTranslatorMatIcon>;
	renderedStyleParity: {
		state: 'measured-resolved-styles-with-declared-differences';
		probes: number;
		declaredDifferences: typeof WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_DIFFERENCES;
		otherProbesAgree: true;
	};
	fileInput: {
		surfaces: readonly WitnessFileInputSurfaceEntry[];
		fixture: typeof WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE;
		rule: typeof WITNESS_FILE_INPUT_LOAD_RULE;
	};
	downloads: {
		surface: typeof WITNESS_ANGULAR_TINY_TRANSLATOR_DOWNLOAD_SURFACE;
		rule: typeof WITNESS_DOWNLOAD_CAPTURE_RULE;
		/** Per run, the downloads that run read back. */
		captured: Array<{
			lane: 'baseline' | 'migrated';
			pass: 1 | 2;
			files: Array<{ suggestedFilename: string; bytes: number; sha256: string }>;
		}>;
	};
	persistence: {
		store: 'browser-local-storage';
		backend: 'none';
		stubbed: false;
		survivesOnlineReload: true;
	};
	routeShape: typeof WITNESS_ANGULAR_TINY_TRANSLATOR_ROUTE_SHAPE;
	scrollAbsence: WitnessMeasuredScrollAbsence;
	accommodations: typeof WITNESS_ANGULAR_TINY_TRANSLATOR_ACCOMMODATIONS;
	readiness: {
		angularLineage: { ready: 1; total: 4; counted: false };
		overall: { ready: 3; total: 12 };
	};
	locality: {
		mode: 'offline';
		successfulNonLoopback: 0;
		osWideIsolation: false;
		mockedNonLoopbackSeams: number;
	};
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

const exact = (left: unknown, right: unknown): boolean =>
	canonicalize(left) === canonicalize(right);

const sha256Digest = (value: unknown): boolean => typeof value === 'string' && value.length === 64;

export function witnessAngularTinyTranslatorRawDigest(
	run: WitnessAngularTinyTranslatorRun | WitnessRealAppRun,
): string {
	const { pass: _pass, result: _result, semanticDigest: _semanticDigest, ...raw } = run;
	const withoutBehavior = { ...raw } as Record<string, unknown>;
	delete withoutBehavior.behaviorDigest;
	return sha256(canonicalize(withoutBehavior));
}

/** The probe labels whose values are allowed to differ between the lanes. */
function declaredDifferenceLabels(): string[] {
	return WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_DIFFERENCES.map((entry) => entry.label);
}

/**
 * The rendered-style projection that participates in the parity digest: the
 * probes the lanes must agree on, in full, plus the LABELS of the ones they are
 * declared to disagree on. Folding the declared-difference values in would make
 * the two lanes disagree about a difference the receipt already records;
 * dropping the labels would let a probe leave the declaration unnoticed.
 */
function renderedStyleProjection(evidence: WitnessRenderedStyleEvidence | undefined): unknown {
	const differing = new Set(declaredDifferenceLabels());
	return {
		state: evidence?.state,
		agreeing: (evidence?.probes ?? []).filter((probe) => !differing.has(probe.label)),
		declaredDifferenceLabels: (evidence?.probes ?? [])
			.map((probe) => probe.label)
			.filter((label) => differing.has(label)),
	};
}

/**
 * Lane-independent behavior projection.
 *
 * Production bytes are lane-specific by construction — eleven majors of bundler
 * apart — so the byte inventory stays in the run and out of this digest. So do
 * the three things this migration genuinely changed: the font seam, the icon
 * degradation and the two declared style differences. Each of them is verified
 * exactly against its own pinned per-lane record elsewhere, and what is left
 * here is everything the two lanes must agree on, including the file the page
 * was handed, the file the page produced, and what the store settled to.
 */
export function witnessAngularTinyTranslatorBehaviorDigest(
	run: WitnessAngularTinyTranslatorRun | WitnessRealAppRun,
): string {
	const journey = (run as WitnessAngularTinyTranslatorRun).applicationJourney as
		| WitnessAngularTinyTranslatorJourney
		| undefined;
	const seams = run.mockedNonLoopbackSeams;
	return sha256(
		canonicalize({
			app: run.app,
			framework: run.framework,
			interactions: run.interactions,
			assertions: run.assertions,
			routes: run.routes,
			trackedEvents: run.trackedEvents,
			witnessRecord: run.witnessRecord,
			cleanPage: run.cleanPage,
			offlineEvidence: run.offlineEvidence,
			servedStaticPolicy: {
				transport: run.servedStatic.transport,
				documentFallback: run.servedStatic.documentFallback,
				missingAssets: run.servedStatic.missingAssets,
				traversal: run.servedStatic.traversal,
				byteIdentical: run.servedStatic.byteIdentical,
				hmrControls: run.servedStatic.hmrControls,
				serviceWorkerScripts: run.servedStatic.serviceWorkers.length,
			},
			// Amended by measurement: the two lanes report the SAME refused
			// registration in their own frameworks' words, so the membership is the
			// recorded per-lane difference and only the accounting travels. The
			// messages themselves are checked exactly, per lane, against the
			// inventory the receipt publishes.
			consoleErrorPolicy: {
				policy: run.consoleErrorInventory?.policy,
				originPlaceholder: run.consoleErrorInventory?.originPlaceholder,
				outsideInventory: run.consoleErrorInventory?.outsideInventory,
				entries: run.consoleErrorInventory?.observed.length,
				total: run.consoleErrorInventory?.total,
			},
			failedRequestInventory: run.failedRequestInventory,
			// The settled half of the refused registration, which both lanes must
			// agree on. The attempt trace itself stays in the run: each lane's
			// browser opens its own record of the same refusal, and each event is
			// held to naming the script and scope the application asked for.
			refusedServiceWorkerSettled: {
				attempt: (run as WitnessAngularTinyTranslatorRun).refusedServiceWorker?.attempt,
				outputFiles: (run as WitnessAngularTinyTranslatorRun).refusedServiceWorker
					?.outputFiles,
				checkpoints: (
					(run as WitnessAngularTinyTranslatorRun).refusedServiceWorker?.checkpoints ?? []
				).map((checkpoint) => ({
					phase: checkpoint.phase,
					state: checkpoint.state,
					registrations: checkpoint.registrations,
					controller: checkpoint.controller,
					cacheNames: checkpoint.cacheNames,
				})),
			},
			// The membership is the recorded difference, so only the shape and the
			// count travel; the members themselves are checked per lane.
			mockedSeamPolicy: {
				policy: seams?.policy,
				pathPolicy: seams?.pathPolicy,
				outsideInventory: seams?.outsideInventory,
				successfulNonLoopback: seams?.successfulNonLoopback,
				members: seams?.category.length,
				observed: seams?.observed.length,
				absent: seams?.absent.length,
			},
			// The file handed to the page and the file the page produced are
			// lane-independent by obligation: a migration that changed either of
			// them changed the application's behavior.
			fileInputLoads: run.fileInputLoads,
			downloadCaptures: run.downloadCaptures,
			renderedStyles: renderedStyleProjection(run.renderedStyles),
			matIcon: {
				state: journey?.matIcon.state,
				rendersLigatureText: journey?.matIcon.rendersLigatureText,
				masked: journey?.matIcon.masked,
				renderedText: journey?.matIcon.renderedText,
			},
			fileReaderParity: journey?.fileReaderParity,
			persistence: journey?.persistence,
			scrollAbsence: run.scrollAbsence,
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessAngularTinyTranslatorDigest(
	receipt: WitnessAngularTinyTranslatorReceipt,
): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

function assertConsoleErrorInventory(
	inventory: WitnessConsoleErrorInventory | undefined,
	pinned: readonly WitnessConsoleErrorInventoryEntry[],
	label: string,
): void {
	const expected = pinned.map((entry) => ({ message: entry.message, count: entry.count }));
	if (
		inventory === undefined ||
		inventory.policy !== 'exact-app-scoped-expected-console-errors' ||
		inventory.originPlaceholder !== '{production-static-origin}' ||
		!exact(inventory.outsideInventory, []) ||
		!exact(inventory.expected, expected) ||
		!exact(inventory.observed, expected) ||
		inventory.total !== expected.reduce((sum, entry) => sum + entry.count, 0)
	)
		throw new Error(`Angular TinyTranslator console-error inventory differs: ${label}`);
}

function assertFailedRequestInventory(
	inventory: WitnessFailedRequestInventory | undefined,
	pinned: readonly WitnessFailedRequestInventoryEntry[],
	label: string,
): void {
	const expected = pinned.map((entry) => ({
		method: entry.method,
		path: entry.path,
		reason: entry.reason,
		count: entry.count,
	}));
	if (
		inventory === undefined ||
		inventory.policy !== 'exact-app-scoped-expected-failed-requests' ||
		!exact(inventory.outsideInventory, []) ||
		!exact(inventory.expected, expected) ||
		!exact(inventory.observed, expected) ||
		inventory.total !== expected.reduce((sum, entry) => sum + entry.count, 0)
	)
		throw new Error(`Angular TinyTranslator failed-request inventory differs: ${label}`);
}

/**
 * The per-lane seam membership, checked against what the migration decides
 * rather than against a path the font provider mints: the baseline is the
 * pinned member exactly, and every migrated member is a GET on the declared
 * font-file origin with none left on the stylesheet origin. Every declared
 * member is accounted for as observed or absent, and nothing may sit outside
 * the declaration.
 */
function assertMockedSeams(
	inventory: WitnessMockedNonLoopbackSeamInventory | undefined,
	lane: 'baseline' | 'migrated',
	published: WitnessMockedNonLoopbackSeamEntry[],
	label: string,
): void {
	const originated = (entry: WitnessMockedNonLoopbackSeamEntry): boolean =>
		entry.method === 'GET' &&
		entry.path.startsWith(`${WITNESS_ANGULAR_TINY_TRANSLATOR_SEAM_ORIGINS[lane]}/`);
	if (
		inventory === undefined ||
		inventory.policy !== 'exact-app-scoped-mocked-non-loopback-seams' ||
		inventory.pathPolicy !== WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE ||
		!exact(inventory.outsideInventory, []) ||
		inventory.successfulNonLoopback !== 0 ||
		inventory.category.length === 0 ||
		!inventory.category.every(originated) ||
		!exact(inventory.category, published) ||
		inventory.observed.length + inventory.absent.length !== inventory.category.length ||
		inventory.observed.some((observation) => observation.requests < 1)
	)
		throw new Error(`Angular TinyTranslator mocked seam inventory differs: ${label}`);
	if (
		lane === 'baseline' &&
		!exact(inventory.category, WITNESS_ANGULAR_TINY_TRANSLATOR_BASELINE_SEAMS)
	)
		throw new Error(`Angular TinyTranslator baseline seam membership differs: ${label}`);
}

/**
 * The file-input mechanism as evidence: the declared surfaces are exactly the
 * pinned ones, the one declared surface was loaded, and the bytes handed to the
 * page are the bound synthetic fixture's own — by name, length and digest.
 */
function assertFileInputLoads(
	inventory: WitnessFileInputLoadInventory | undefined,
	label: string,
): void {
	const fixture = WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE;
	const surface = WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES[0];
	const loaded = inventory?.loaded[0];
	if (
		inventory === undefined ||
		surface === undefined ||
		inventory.policy !== 'declared-file-input-surfaces-only' ||
		inventory.rule !== WITNESS_FILE_INPUT_LOAD_RULE ||
		!exact(inventory.declared, WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES) ||
		!exact(inventory.unused, []) ||
		!exact(inventory.outsideDeclaration, []) ||
		inventory.loaded.length !== 1 ||
		loaded === undefined ||
		loaded.label !== surface.label ||
		loaded.selector !== surface.selector ||
		loaded.fixturePath !== surface.fixturePath ||
		loaded.fileName !== fixture.fileName ||
		loaded.bytes !== fixture.bytes ||
		loaded.sha256 !== fixture.sha256
	)
		throw new Error(`Angular TinyTranslator file-input evidence differs: ${label}`);
}

/**
 * The download mechanism as evidence. The suggested filename is recorded rather
 * than pinned — the application mints it from the project the journey created —
 * and the bytes behind it are required to be real: a zero-byte export would be
 * a download that happened and a file that did not.
 */
function assertDownloadCaptures(
	inventory: WitnessDownloadCaptureInventory | undefined,
	label: string,
): void {
	if (
		inventory === undefined ||
		inventory.policy !== 'declared-download-surface-only' ||
		inventory.rule !== WITNESS_DOWNLOAD_CAPTURE_RULE ||
		inventory.acceptDownloads !== true ||
		inventory.captured.length !==
			WITNESS_ANGULAR_TINY_TRANSLATOR_DOWNLOAD_SURFACE.expectedDownloads ||
		inventory.captured.some(
			(file) =>
				file.suggestedFilename.length === 0 ||
				!Number.isInteger(file.bytes) ||
				file.bytes < 1 ||
				!sha256Digest(file.sha256),
		)
	)
		throw new Error(`Angular TinyTranslator download evidence differs: ${label}`);
}

/**
 * Every probe measured, in the pinned order, with the pinned properties — and
 * nothing else. A run that quietly dropped a property from a probe would be
 * claiming a narrower measurement than the one this schema declares.
 */
function assertRenderedStyles(
	evidence: WitnessRenderedStyleEvidence | undefined,
	label: string,
): void {
	if (
		evidence === undefined ||
		evidence.state !== 'measured-resolved-styles' ||
		evidence.probes.length !== WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES.length ||
		evidence.probes.some((probe, index) => {
			const pinned = WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES[index];
			return (
				pinned === undefined ||
				probe.label !== pinned.label ||
				probe.selector !== pinned.selector ||
				!exact(Object.keys(probe.properties).sort(), [...pinned.properties].sort()) ||
				Object.values(probe.properties).some((value) => value.length === 0) ||
				probe.width < 0 ||
				probe.height < 0
			);
		})
	)
		throw new Error(`Angular TinyTranslator rendered-style measurement differs: ${label}`);
}

/**
 * The declared differences, checked in both directions across the lane pair: a
 * probe outside the declaration must resolve identically, and a probe inside it
 * must actually differ.
 */
function assertRenderedStyleDifferences(
	baseline: WitnessRenderedStyleMeasurement[],
	migrated: WitnessRenderedStyleMeasurement[],
): void {
	const declared = new Set(declaredDifferenceLabels());
	for (const [index, probe] of baseline.entries()) {
		const other = migrated[index];
		if (other === undefined || other.label !== probe.label)
			throw new Error('Angular TinyTranslator rendered-style lanes are not comparable');
		const same = exact(probe.properties, other.properties);
		if (declared.has(probe.label) === same)
			throw new Error(
				`Angular TinyTranslator rendered-style declared difference differs: ${probe.label}`,
			);
	}
}

function assertMatIcon(
	journey: WitnessAngularTinyTranslatorJourney | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = WITNESS_ANGULAR_TINY_TRANSLATOR_MAT_ICON_DEGRADATIONS[lane];
	const icon = journey?.matIcon;
	if (
		icon === undefined ||
		icon.state !== pinned.state ||
		icon.cause !== pinned.cause ||
		icon.iconFontFamilyDeclared !== pinned.iconFontFamilyDeclared ||
		icon.rendersLigatureText !== true ||
		icon.masked !== false ||
		icon.renderedText.length === 0 ||
		// The measurement has to agree with the lane's own account of itself: a
		// baseline that resolved the icon family, or a migrated lane that did
		// not, is not the degradation this receipt describes.
		icon.resolvedFontFamily.includes(WITNESS_ANGULAR_TINY_TRANSLATOR_ICON_FONT_FAMILY) !==
			pinned.iconFontFamilyDeclared
	)
		throw new Error(`Angular TinyTranslator mat-icon degradation differs: ${label}`);
}

function assertFileReaderParity(
	journey: WitnessAngularTinyTranslatorJourney | undefined,
	label: string,
): void {
	const parity = journey?.fileReaderParity;
	if (
		parity === undefined ||
		parity.state !== 'measured-identical-parse-across-lanes' ||
		parity.assertion.length === 0 ||
		!Number.isInteger(parity.parsedUnits) ||
		parity.parsedUnits !== WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.transUnits ||
		!sha256Digest(parity.parsedDigest)
	)
		throw new Error(`Angular TinyTranslator FileReader parity differs: ${label}`);
}

function assertPersistence(
	journey: WitnessAngularTinyTranslatorJourney | undefined,
	label: string,
): void {
	const persistence = journey?.persistence;
	const sorted = (values: string[]): boolean =>
		values.join('\n') === [...values].sort().join('\n') &&
		new Set(values).size === values.length;
	if (
		persistence === undefined ||
		persistence.store !== 'browser-local-storage' ||
		persistence.backend !== 'none' ||
		persistence.stubbed !== false ||
		persistence.survivesOnlineReload !== true ||
		!Array.isArray(persistence.keysBeforeJourney) ||
		!Array.isArray(persistence.keysAfterJourney) ||
		!sorted(persistence.keysBeforeJourney) ||
		!sorted(persistence.keysAfterJourney) ||
		persistence.keysAfterJourney.length === 0 ||
		// The journey writes to the store; it may not take anything out of it.
		persistence.keysBeforeJourney.some((key) => !persistence.keysAfterJourney.includes(key))
	)
		throw new Error(`Angular TinyTranslator persistence evidence differs: ${label}`);
}

/**
 * Every recorded route is a hash route naming one of the application's own
 * declared routes. The sequence itself belongs to the journey and is required
 * to be identical across the four runs by the behavior digest.
 */
function assertRouteShape(routes: string[], label: string): void {
	const known = WITNESS_ANGULAR_TINY_TRANSLATOR_ROUTE_SHAPE.known as readonly string[];
	if (!Array.isArray(routes) || routes.length === 0)
		throw new Error(`Angular TinyTranslator route shape differs: ${label}`);
	for (const route of routes) {
		const hash = route.startsWith('/#/') ? route.slice(1) : route;
		if (!hash.startsWith(WITNESS_ANGULAR_TINY_TRANSLATOR_ROUTE_SHAPE.prefix))
			throw new Error(`Angular TinyTranslator route is not a hash route: ${route}`);
		const [named] = hash.slice(1).split('?');
		if (!known.includes(named ?? ''))
			throw new Error(`Angular TinyTranslator route is not a declared route: ${route}`);
	}
}

/**
 * The refused registration, asserted as the first recorded amendment defines it.
 *
 * The settled facts are held exactly: three checkpoints in journey order, each
 * with nothing registered, nothing controlling and no cache, and no worker
 * script emitted by either build. The trace is held to naming the attempt — a
 * registration event at the scope the application asked for, or a version event
 * for the script it asked for that never got as far as running — and it may not
 * be empty, because a browser that refused a registration recorded one.
 */
function assertRefusedServiceWorker(
	refused: WitnessAngularTinyTranslatorRefusedServiceWorker | undefined,
	attempt: typeof WITNESS_ANGULAR_TINY_TRANSLATOR_SERVICE_WORKER_ATTEMPT,
	label: string,
): void {
	const phases = ['before-interactions', 'after-interactions', 'after-online-reload'];
	const names = (
		events: WitnessAngularTinyTranslatorRefusedServiceWorker['workerEvents'],
	): boolean =>
		events.length !== 0 &&
		events.every((event) =>
			event.kind === 'registration'
				? event.scopePath === '/'
				: event.kind === 'version'
					? event.scriptPath.endsWith(attempt.script) && event.runningStatus === 'stopped'
					: false,
		);
	if (
		refused === undefined ||
		!refused.attempt.script.endsWith(attempt.script) ||
		refused.attempt.scopePath !== '/' ||
		!exact(
			refused.checkpoints.map((checkpoint) => checkpoint.phase),
			phases,
		) ||
		refused.checkpoints.some(
			(checkpoint) =>
				checkpoint.state !== 'timeout' ||
				checkpoint.registrations !== 0 ||
				checkpoint.controller !== null ||
				checkpoint.cacheNames.length !== 0 ||
				!names(checkpoint.attemptEvents),
		) ||
		refused.outputFiles.length !== attempt.shippedWorkerFiles ||
		!names(refused.workerEvents) ||
		// The 400 the registration is answered with is an answered request, never a
		// failed one, so nothing here may appear in the failed-request inventory.
		refused.requests.some((request) => typeof request.source !== 'string')
	)
		throw new Error(`Angular TinyTranslator refused service-worker evidence differs: ${label}`);
}

function assertScrollAbsence(
	absence: WitnessMeasuredScrollAbsence | undefined,
	label: string,
): void {
	if (
		absence === undefined ||
		absence.state !== 'measured-no-overflowing-document' ||
		absence.claimed !== false ||
		absence.documentOverflow.length === 0 ||
		!Array.isArray(absence.routes) ||
		absence.routes.length === 0 ||
		absence.routes.some(
			(route) =>
				route.route.length === 0 ||
				route.clientHeight !== absence.viewport.height ||
				route.scrollHeight > route.clientHeight,
		)
	)
		throw new Error(`Angular TinyTranslator scroll-absence measurement differs: ${label}`);
}

export function parseWitnessAngularTinyTranslatorReceipt(
	value: unknown,
): WitnessAngularTinyTranslatorReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Angular TinyTranslator Witness receipt must be an object');
	const receipt = value as WitnessAngularTinyTranslatorReceipt;
	const expectedRuns = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	if (
		receipt.schemaVersion !== WITNESS_ANGULAR_TINY_TRANSLATOR_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== ANGULAR_TINY_TRANSLATOR_FIXTURE ||
		!exact(receipt.source, ANGULAR_TINY_TRANSLATOR_SOURCE) ||
		!Array.isArray(receipt.canonicalReceipts) ||
		!exact(receipt.canonicalReceipts, ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS) ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('Angular TinyTranslator Witness binding differs');
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		if (
			!expectedRuns.delete(key) ||
			run.app !== ANGULAR_TINY_TRANSLATOR_APP ||
			run.framework !== 'angular' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			run.witnessRecord.consoleErrors !== run.consoleErrorInventory?.total ||
			run.witnessRecord.failedRequests !== run.failedRequestInventory?.total ||
			run.offlineEvidence.state !== 'not-applicable' ||
			// Amended by measurement: this run's observer trace is NOT empty, and
			// asserting that it was is the claim the browser contradicted. What is
			// required instead is that the finalized trace is exactly the trace the
			// refused attempt left, held to naming the attempt below.
			!exact(run.observerFinalization.workerEvents, run.refusedServiceWorker?.workerEvents) ||
			run.servedStatic.byteIdentical !== true ||
			run.scrollSurface !== undefined ||
			run.interactions.length === 0 ||
			run.semanticDigest !== witnessAngularTinyTranslatorRawDigest(run) ||
			run.behaviorDigest !== witnessAngularTinyTranslatorBehaviorDigest(run)
		)
			throw new Error(`Angular TinyTranslator Witness run differs: ${key}`);
		assertRouteShape(run.routes, key);
		assertConsoleErrorInventory(
			run.consoleErrorInventory,
			receipt.consoleErrors?.[run.lane] ?? [],
			key,
		);
		assertFailedRequestInventory(
			run.failedRequestInventory,
			receipt.failedRequests?.[run.lane] ?? [],
			key,
		);
		assertMockedSeams(
			run.mockedNonLoopbackSeams,
			run.lane,
			receipt.mockedSeams?.[run.lane] ?? [],
			key,
		);
		assertFileInputLoads(run.fileInputLoads, key);
		assertDownloadCaptures(run.downloadCaptures, key);
		assertRenderedStyles(run.renderedStyles, key);
		assertMatIcon(run.applicationJourney, run.lane, key);
		assertFileReaderParity(run.applicationJourney, key);
		assertPersistence(run.applicationJourney, key);
		assertRefusedServiceWorker(
			run.refusedServiceWorker,
			WITNESS_ANGULAR_TINY_TRANSLATOR_SERVICE_WORKER_ATTEMPT,
			key,
		);
		assertScrollAbsence(run.scrollAbsence, key);
		behaviors.add(run.behaviorDigest);
	}
	const baseline = receipt.runs.find((run) => run.lane === 'baseline');
	const migrated = receipt.runs.find((run) => run.lane === 'migrated');
	if (baseline === undefined || migrated === undefined)
		throw new Error('Angular TinyTranslator Witness lane pair is incomplete');
	assertRenderedStyleDifferences(baseline.renderedStyles.probes, migrated.renderedStyles.probes);
	assertScrollAbsence(receipt.scrollAbsence, 'receipt');
	if (
		expectedRuns.size !== 0 ||
		behaviors.size !== 1 ||
		!exact(receipt.mockedSeams?.baseline, WITNESS_ANGULAR_TINY_TRANSLATOR_BASELINE_SEAMS) ||
		exact(receipt.mockedSeams.baseline, receipt.mockedSeams.migrated) ||
		!exact(receipt.fontSeamDifference, WITNESS_ANGULAR_TINY_TRANSLATOR_FONT_SEAM_DIFFERENCE) ||
		!exact(
			receipt.serviceWorkerAttempt,
			WITNESS_ANGULAR_TINY_TRANSLATOR_SERVICE_WORKER_ATTEMPT,
		) ||
		!exact(receipt.migratedLaneChain, ANGULAR_TINY_TRANSLATOR_MIGRATED_LANE_CHAIN) ||
		// The chain has to end at the lane this proof actually serves, or the story
		// it tells is about some other build.
		receipt.migratedLaneChain.at(-1)?.record !==
			receipt.canonicalReceipts.find((bound) => bound.lane === 'migrated')?.path ||
		receipt.migratedLaneChain.at(-1)?.contradictedBy !== null ||
		!exact(receipt.migrationFindings, WITNESS_ANGULAR_TINY_TRANSLATOR_MIGRATION_FINDINGS) ||
		!exact(receipt.amendments, WITNESS_ANGULAR_TINY_TRANSLATOR_RECORDED_AMENDMENTS) ||
		receipt.fileReaderArbitration?.state !== 'arbitrated-declared-difference' ||
		receipt.fileReaderArbitration.outcome !== 'identical-parse-in-both-lanes' ||
		receipt.fileReaderArbitration.inBehaviorDigest !== true ||
		// The arbitration is the journey's own reading, not a second claim beside
		// it: it has to be the parity the runs measured, in both lanes.
		!exact(
			receipt.accommodations.journeyObligations,
			[receipt.fileReaderArbitration.obligation],
		) ||
		receipt.fileReaderArbitration.parsedUnits !==
			baseline.applicationJourney.fileReaderParity.parsedUnits ||
		receipt.fileReaderArbitration.parsedDigest !==
			baseline.applicationJourney.fileReaderParity.parsedDigest ||
		receipt.fileReaderArbitration.parsedDigest !==
			migrated.applicationJourney.fileReaderParity.parsedDigest ||
		!exact(receipt.matIconDegradations?.baseline, baseline.applicationJourney.matIcon) ||
		!exact(receipt.matIconDegradations.migrated, migrated.applicationJourney.matIcon) ||
		receipt.renderedStyleParity?.state !==
			'measured-resolved-styles-with-declared-differences' ||
		receipt.renderedStyleParity.probes !==
			WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES.length ||
		receipt.renderedStyleParity.otherProbesAgree !== true ||
		!exact(
			receipt.renderedStyleParity.declaredDifferences,
			WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_DIFFERENCES,
		) ||
		!exact(receipt.fileInput?.surfaces, WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES) ||
		!exact(receipt.fileInput.fixture, WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE) ||
		receipt.fileInput.rule !== WITNESS_FILE_INPUT_LOAD_RULE ||
		!exact(receipt.downloads?.surface, WITNESS_ANGULAR_TINY_TRANSLATOR_DOWNLOAD_SURFACE) ||
		receipt.downloads.rule !== WITNESS_DOWNLOAD_CAPTURE_RULE ||
		receipt.downloads.captured.length !== receipt.runs.length ||
		receipt.downloads.captured.some((entry, index) => {
			const run = receipt.runs[index];
			return (
				run === undefined ||
				entry.lane !== run.lane ||
				entry.pass !== run.pass ||
				!exact(entry.files, run.downloadCaptures.captured)
			);
		}) ||
		!exact(receipt.persistence, {
			store: 'browser-local-storage',
			backend: 'none',
			stubbed: false,
			survivesOnlineReload: true,
		}) ||
		!exact(receipt.routeShape, WITNESS_ANGULAR_TINY_TRANSLATOR_ROUTE_SHAPE) ||
		!exact(receipt.accommodations, WITNESS_ANGULAR_TINY_TRANSLATOR_ACCOMMODATIONS) ||
		receipt.mutation?.intendedFailure !== true ||
		receipt.mutation.failure !== 'witness-semantic-assertion' ||
		receipt.mutation.lane !== 'migrated' ||
		receipt.mutation.seam.length === 0 ||
		receipt.mutation.restoredByteIdentically !== true ||
		receipt.mutation.restoredRun !== 'pass' ||
		receipt.mutation.beforeSha256 !== receipt.mutation.afterRestoreSha256 ||
		receipt.mutation.beforeSha256 === receipt.mutation.mutatedSha256 ||
		!behaviors.has(receipt.mutation.restoredBehaviorDigest) ||
		!exact(receipt.readiness, {
			angularLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		}) ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.osWideIsolation !== false ||
		receipt.locality.mockedNonLoopbackSeams !== receipt.mockedSeams.migrated.length ||
		!Array.isArray(receipt.nonclaims) ||
		receipt.nonclaims.length === 0 ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessAngularTinyTranslatorDigest(receipt)
	)
		throw new Error('Angular TinyTranslator Witness integrity differs');
	return receipt;
}

export function renderWitnessAngularTinyTranslatorReceipt(
	receipt: WitnessAngularTinyTranslatorReceipt,
): string {
	const lanes = receipt.canonicalReceipts
		.map(
			(bound) =>
				`${bound.lane} \`${bound.path}\` (${bound.digest.slice(0, 12)}) served from \`${bound.canonicalRoot}\`, byte-identical to \`${bound.repeatedRoot}\` across ${bound.files} files`,
		)
		.join('; ');
	const seams = (lane: 'baseline' | 'migrated'): string =>
		receipt.mockedSeams[lane].map((seam) => `${seam.method} ${seam.path}`).join(', ');
	const icon = (lane: 'baseline' | 'migrated'): string =>
		`${lane}: ${receipt.matIconDegradations[lane].cause}, resolved family \`${receipt.matIconDegradations[lane].resolvedFontFamily}\`, rendered \`${receipt.matIconDegradations[lane].renderedText}\``;
	const differences = receipt.renderedStyleParity.declaredDifferences
		.map((entry) => `\`${entry.label}\` — ${entry.why}`)
		.join('; ');
	const findings = receipt.migrationFindings
		.map(
			(entry) =>
				`  - ${entry.finding} — invisible to ${entry.invisibleTo}; found by ${entry.foundBy}; cause: ${entry.cause}; repaired by ${entry.repair} (\`${entry.record}\`)`,
		)
		.join('\n');
	const chain = receipt.migratedLaneChain
		.map(
			(entry) =>
				`  - \`${entry.record}\` (${entry.root}) published ${entry.published}${entry.contradictedBy === null ? ' — this is the lane served here' : `, contradicted by ${entry.contradictedBy}`}`,
		)
		.join('\n');
	const amendments = receipt.amendments
		.map(
			(entry) =>
				`  - ${entry.subject}: claimed ${entry.claimed}; measured ${entry.measured}; amended so that ${entry.amendment} (\`${entry.record}\`)`,
		)
		.join('\n');
	const downloads = receipt.downloads.captured
		.map(
			(entry) =>
				`${entry.lane} pass ${entry.pass}: ${entry.files
					.map((file) => `\`${file.suggestedFilename}\` ${file.bytes} bytes`)
					.join(', ')}`,
		)
		.join(' | ');
	return `# TinyTranslator v0.12.0 — direct Witness browser proof

- Result: pass
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Runs: 2 baseline + 2 migrated production-static browser journeys
- Behavioral parity: ${receipt.runs[0]!.behaviorDigest}
- Bound build lanes: ${lanes}
- Migration: Angular 5.0.3 to Angular 16.2 — eleven majors, the longest lift in the corpus — at ${receipt.accommodations.manualMigrationSteps} manual migration steps; the ${receipt.accommodations.inventory.applicationFilesChanged} changed application files and ${receipt.accommodations.inventory.capabilities} capabilities that changed them are itemised in \`${receipt.accommodations.inventory.record}\`
- Journey obligation carried into this proof: ${receipt.accommodations.journeyObligations.join(' ')}
- FileReader arbitration: ${receipt.fileReaderArbitration.outcome} — the application's own input was handed the same file in both lanes and both parsed ${String(receipt.fileReaderArbitration.parsedUnits)} units to digest \`${receipt.fileReaderArbitration.parsedDigest.slice(0, 12)}\`; the parse participates in the behavioral parity digest above, so the obligation is discharged by measurement rather than by assertion
- What the browser phase found that the build lanes could not:
${findings}
- Migrated lane supersession chain (every record immutable, every supersession by reference):
${chain}
- Recorded schema amendments (claims this receipt used to make that a measurement contradicted):
${amendments}
- File handed to the page: \`${receipt.fileInput.fixture.fileName}\` (${receipt.fileInput.fixture.format}, ${receipt.fileInput.fixture.transUnits} units, ${receipt.fileInput.fixture.bytes} bytes, sha256 ${receipt.fileInput.fixture.sha256.slice(0, 12)}), through the one declared surface. ${receipt.fileInput.rule}
- Files the page produced: ${downloads}. ${receipt.downloads.rule}
- Mocked non-loopback seams (answered in-context, none left the machine) — baseline: ${seams('baseline')}; migrated: ${seams('migrated')}
- Recorded font-seam difference: ${receipt.fontSeamDifference.cause}; masked: ${String(receipt.fontSeamDifference.masked)}
- Service worker: the application attempts a registration at \`${receipt.serviceWorkerAttempt.script}\` and the request is answered ${String(receipt.serviceWorkerAttempt.httpStatus)}; registered: ${String(receipt.serviceWorkerAttempt.registered)}; introduced by the migration: ${String(receipt.serviceWorkerAttempt.introducedByMigration)}; masked: ${String(receipt.serviceWorkerAttempt.masked)}
- Icon degradation, measured per lane — ${icon('baseline')}; ${icon('migrated')}
- Rendered appearance: ${receipt.renderedStyleParity.probes} probes measured off the live page in both lanes; every probe outside the declared differences resolves identically. Declared differences: ${differences}
- Persistence: ${receipt.persistence.store}, backend ${receipt.persistence.backend}, stubbed: ${String(receipt.persistence.stubbed)}, survives an online reload: ${String(receipt.persistence.survivesOnlineReload)}
- Routing: ${receipt.routeShape.router}; every recorded route is a \`${receipt.routeShape.prefix}\` route naming one of the application's own ${receipt.routeShape.known.length} declared routes
- Mutation proof: \`${receipt.mutation.seam}\` in \`${receipt.mutation.path}\` at offset ${receipt.mutation.offset} made the journey red, byte-identical restoration made it green again
- Scroll: ${receipt.scrollAbsence.state} — ${receipt.scrollAbsence.documentOverflow}
- Angular lineage readiness: unchanged at ${receipt.readiness.angularLineage.ready}/${receipt.readiness.angularLineage.total}; this vertical is not counted

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export function witnessAngularTinyTranslatorAggregateMember(digestValue: string) {
	return {
		id: 'witness-angular-tiny-translator',
		framework: 'angular',
		track: 'production-readiness-direct-witness-angular5-to-angular16-browser-builder',
		bundler: 'angular-cli-1.5.4-webpack-3.8.1-to-angular-16.2-browser-builder',
		runtime: 'node-8.9.3-to-node-16.20.2',
		result: 'pass',
		receipt: WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
		digest: digestValue,
	};
}

/**
 * Re-reads each bound build receipt and checks the byte-identity this proof
 * rests on out of the receipt itself rather than out of the list above: the era
 * lane declares `byteStable`, the migrated lane declares an identical repeated
 * build, and each must cover the file count the canonical root was served with.
 */
function assertBoundBuildReceipt(
	bound: WitnessAngularTinyTranslatorReceipt['canonicalReceipts'][number],
	parsed: Record<string, unknown>,
): void {
	if (parsed.schemaVersion !== bound.schemaVersion || parsed.digest !== bound.digest)
		throw new Error(
			`Angular TinyTranslator bound build receipt identity differs: ${bound.path}`,
		);
	if (bound.lane === 'baseline') {
		const inventory = parsed.inventory;
		if (
			parsed.byteStable !== true ||
			!Array.isArray(inventory) ||
			inventory.length !== bound.files
		)
			throw new Error(`Angular TinyTranslator era lane byte-identity differs: ${bound.path}`);
		return;
	}
	const determinism = parsed.determinism as { identical?: unknown; files?: unknown } | undefined;
	if (determinism?.identical !== true || determinism.files !== bound.files)
		throw new Error(
			`Angular TinyTranslator migrated lane byte-identity differs: ${bound.path}`,
		);
}

export async function verifyWitnessAngularTinyTranslatorEvidence(rootDir = '.') {
	const root = resolve(rootDir);
	const receiptPath = join(root, WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH);
	const receipt = parseWitnessAngularTinyTranslatorReceipt(
		JSON.parse(await readFile(receiptPath, 'utf8')),
	);
	for (const bound of receipt.canonicalReceipts) {
		const bytes = await readFile(join(root, bound.path));
		if (sha256(bytes) !== bound.sha256)
			throw new Error(
				`Angular TinyTranslator bound build receipt bytes drifted: ${bound.path}`,
			);
		assertBoundBuildReceipt(
			bound,
			JSON.parse(bytes.toString('utf8')) as Record<string, unknown>,
		);
	}
	const fixture = await readFile(
		join(root, WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES[0]!.fixturePath),
	);
	if (
		sha256(fixture) !== WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.sha256 ||
		fixture.length !== WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.bytes
	)
		throw new Error('Angular TinyTranslator synthetic file-input fixture drifted');
	if (
		(await readFile(join(dirname(receiptPath), 'receipt.md'), 'utf8')) !==
		renderWitnessAngularTinyTranslatorReceipt(receipt)
	)
		throw new Error('Angular TinyTranslator human Witness receipt differs');
	return {
		valid: true as const,
		digest: receipt.integrity.canonicalDigest,
		artifacts: 0,
		receipt,
	};
}
