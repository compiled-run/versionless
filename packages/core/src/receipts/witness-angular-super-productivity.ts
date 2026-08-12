import { createRegExp, digit } from 'magic-regexp';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import {
	WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
	WITNESS_REAL_APP_DRAG_SURFACES,
} from './witness-real-app.ts';
import type {
	WitnessConsoleErrorInventory,
	WitnessConsoleErrorInventoryEntry,
	WitnessFailedRequestInventory,
	WitnessFailedRequestInventoryEntry,
	WitnessMeasuredScrollAbsence,
	WitnessMockedNonLoopbackSeamEntry,
	WitnessMockedNonLoopbackSeamInventory,
	WitnessRealAppRun,
	WitnessRenderedStyleEvidence,
	WitnessRenderedStyleMeasurement,
	WitnessScrollSurface,
	WitnessServiceWorkerTelemetry,
} from './witness-real-app.ts';

export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SCHEMA =
	'versionless.witness-angular-super-productivity.v1' as const;
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH =
	'evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.json' as const;
export const ANGULAR_SUPER_PRODUCTIVITY_FIXTURE = 'angular-super-productivity-v2-13-15' as const;
export const ANGULAR_SUPER_PRODUCTIVITY_APP = 'angular-super-productivity' as const;

/**
 * The immutable Super Productivity source identity, bound here so the browser
 * proof cannot silently rebind itself to a different revision or archive.
 *
 * The tag is annotated and unsigned, which is a different fact from the
 * lightweight tags elsewhere in this corpus and is recorded as such: an
 * annotated tag is its own object with its own sha, and naming that sha
 * alongside the commit is what lets a reader tell which of them the pin is on.
 * The upstream owner moved from a personal account to an organisation between
 * the scout pass and the ingest, and GitHub answers the old path with a 301 to
 * the same numeric repository; the identity below is content-addressed and is
 * unchanged by that rename.
 */
export const ANGULAR_SUPER_PRODUCTIVITY_SOURCE = Object.freeze({
	repository: 'https://github.com/super-productivity/super-productivity',
	repositoryAtScoutTime: 'https://github.com/johannesjo/super-productivity',
	ref: 'refs/tags/v2.13.15',
	tagKind: 'annotated — a tag object exists and is unsigned; the commit is unsigned',
	tagObjectSha: '8d33ba1f606390b2545f04e90506e36b1f9be859',
	revision: '2943c5c4f13c3ce4dece0abf4f9c39739dde4192',
	rootTreeSha: 'c609e059de5c000e5a95799d33427b4c1df04d1e',
	treeBlobs: 967,
	archiveSha256: 'dead2f5334350459f930f5d5235322e5af38e577c79557d3370e497bf15f24eb',
	archiveBytes: 4072238,
	frontendRoot: '.',
	license: 'MIT',
	licenseSha256: '2e279de19632b5694d24b0ac06fd5b837ec487bf821302d9ce195379850a5fcb',
});

/**
 * The two build-lane records this browser proof stands on, each bound by the
 * digest it declares for itself and by the sha256 of its exact bytes, so the
 * proof cannot be re-pointed at a rebuilt or edited build record.
 *
 * Neither lane is byte-stable, and neither entry claims to be. The
 * TinyTranslator vertical could bind two lanes on `byteIdenticalSibling: true`
 * because both of its lanes emitted the same inventory twice; this application
 * emits a generated service-worker manifest that stamps the build's wall clock
 * into itself, so a byte-identity claim would be false in both lanes and a
 * lane bound on one would be a lane bound on nothing. What each entry carries
 * instead is the determinism record the bound receipt actually published,
 * verbatim in its shape and re-read out of the record by the verifier below.
 *
 * The ERA entry is not the original era-baseline record. That record published
 * per-file digests taken over a latin1 decoding of each file's bytes rather
 * than over the bytes, and u21 recomputed all 64 of them from the retained
 * tree the original was measured on. The original stays exactly as it was
 * written and is superseded by reference; what this proof binds is the
 * correction, because the correction is the record whose digests describe the
 * bytes a browser is served.
 *
 * The MIGRATED entry is not u23's dist-23 lane either. u23 built the offline-
 * faithful lane before the template-binding-reorder existed, and the lane it
 * bound throws the split regression once per load — a defect a green build
 * cannot report and u20c2e measured in a browser. u23's dist-23/dist-24 bytes
 * stay exactly as they were written and are superseded by reference; what this
 * proof binds is the u20c2g rebind lane over dist-25, the same offline, font-
 * inliner-disabled lane rebuilt from a tree carrying the reorder, deterministic
 * modulo the service-worker clock across dist-25 and dist-26, whose booting
 * bytes carry the fix and load clean.
 */
export const ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS = Object.freeze([
	Object.freeze({
		lane: 'baseline',
		path: 'evidence/runs/angular-super-productivity-v2-13-15/u21-era-baseline-digest-correction.json',
		schemaVersion: 'versionless.angular-super-productivity-era-baseline-digest-correction.v1',
		digest: 'dd695e78c6d94bbcf64e595fff170b3a7666e12af5a55d12ffc5d7f2c1985b96',
		sha256: '39cef85b3c33a1aace8ed6309cc3707b50d51c85345588236a2bf5f5593b8f18',
		canonicalRoot: '.versionless/cache/angular-super-productivity-v2-13-15-baseline/dist-run2',
		files: 64,
		corrects: Object.freeze({
			path: 'evidence/runs/angular-super-productivity-v2-13-15/u18-era-baseline.json',
			schemaVersion: 'versionless.angular-super-productivity-era-baseline.v1',
			digest: 'a1a449ce01961bf09d5b92e297e1e98781a55dcf4de4bfee49e89e75dd242803',
			sha256: 'd15bda4fd2824d1f28be0a89b148a04c0e1139279b6e95651745b2615dc06c5d',
			valuesTotal: 64,
			valuesCorrected: 42,
			valuesAlreadyCorrect: 22,
			why: 'the era lane inventory digested `bytes.toString(‘binary’)` — latin1, one code point per byte — rather than the bytes, so every file carrying a byte above 0x7f published a digest of a re-encoding of itself',
		}),
	}),
	Object.freeze({
		lane: 'migrated',
		path: 'evidence/runs/angular-super-productivity-v2-13-15/u20c2g-dist25-rebind-lane.json',
		schemaVersion: 'versionless.angular-super-productivity-dist25-rebind-lane.v1',
		digest: '18c1ced0f17b319cd3d4405ad082a46f9f842c678d02749f72fe7214f2aea5a3',
		sha256: 'c1b136972bcffb2e46ccbde1a5ea5cdb51900cdfa2d5306dfa0e4b85e7210c95',
		canonicalRoot: 'dist-25',
		repeatedRoot: 'dist-26',
		files: 62,
		inventorySha256: '2bfa70b9b69b06cba6b9bbc697c5d671799004270aa782ecd3dcd19663733a75',
	}),
]);

/**
 * What repeatability actually measured in each lane, published beside the
 * binding rather than folded into a boolean.
 *
 * The two lanes are not equally stable and saying so is the record. The era
 * lane emits a different main chunk on every build, because the application's
 * own SCSS calls Sass `random()` in a keyframe and the era toolchain reseeds it
 * per build; three consecutive rebuilds of the unmodified tree agreed on the
 * file count and on 58 of 64 paths and on none of the six below. The migrated
 * lane agrees file for file across its two builds except the generated
 * service-worker manifest, whose `timestamp` field is the build's wall clock —
 * compared key by key rather than by hash, so that the claim is about the one
 * field and not about the file.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DETERMINISM = Object.freeze({
	baseline: Object.freeze({
		state: 'measured-not-byte-stable-across-rebuilds',
		runs: 3,
		files: 64,
		identical: false,
		deterministicModuloClock: false,
		differingPaths: Object.freeze([
			'index.html',
			'main.2b292dc79b76876e9ea9.js',
			'main.2b292dc79b76876e9ea9.js.map',
			'main.932307a6bf1518696bcc.js',
			'main.932307a6bf1518696bcc.js.map',
			'ngsw.json',
		]),
		cause: 'the application’s own SCSS calls Sass `random()` inside a confetti keyframe and the era toolchain reseeds it per build, so the main chunk and its content hash move; `ngsw.json` moves both on its own clock field and whenever a hashed filename moves, and `index.html` names the hashed chunk',
		masked: false,
	}),
	migrated: Object.freeze({
		state: 'measured-deterministic-modulo-the-service-worker-manifest-timestamp',
		runs: 2,
		files: 62,
		identical: false,
		deterministicModuloClock: true,
		differingPaths: Object.freeze(['ngsw.json']),
		manifestKeysDiffering: Object.freeze(['timestamp']),
		manifestHashTableIdentical: true,
		cause: 'the generated service-worker manifest stamps the build’s wall clock into `timestamp`; the 46-entry hash table beside it is identical between the two builds, worker chunks included',
		masked: false,
	}),
});

/**
 * The Sass instability crossing the supersede boundary, recorded because it is
 * the one fact the migrated lane's determinism claim does NOT cover.
 *
 * No two runs of THIS round differed in the main chunk, which is what u18i and
 * u18j also saw. That is not the same as the instability being gone: the chunk
 * u23 emitted differs from the one u18j emitted, and the two agree byte for
 * byte through the whole of their inlined component CSS until the first
 * `box-shadow` literal of the confetti keyframe. The reading is Sass `random()`
 * called at build time, unseeded, exactly as in the era lane — so the migration
 * carries the era's instability forward rather than repairing it, and a future
 * rebuild of this lane may move the chunk again.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SASS_RANDOM_BOUNDARY = Object.freeze({
	state: 'measured-across-the-supersede-boundary-not-within-either-round',
	supersededChunk: 'main.16c574808792bb85.js',
	rebuiltChunk: 'main.96bfd856bd1e081a.js',
	firstDifferingByte: 1933667,
	insideKeyframes: true,
	withinRoundDifferences: 0,
	record: 'evidence/runs/angular-super-productivity-v2-13-15/u23-offline-font-lane.json',
	masked: false,
});

/**
 * The migrated lane's supersession chain, published so a reader can see that
 * the binding above is the end of a sequence of measurements rather than a
 * choice.
 *
 * All three records are immutable and still on disk, and every supersession is
 * by reference: u23 names u18j and says what it could not see — where forty-five
 * `@font-face` rules in its own emitted document came from, which a control
 * build that died on the fetch established was the font host reached while the
 * build ran. u20c2g in turn names u23 and says what IT could not see: the lane
 * u23 bound throws the split regression once per load, because the template-
 * binding-reorder did not exist when it built. The lane served here is dist-25,
 * which carries the reorder into the booting bytes and loads clean.
 */
export const ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_CHAIN = Object.freeze([
	Object.freeze({
		record: 'evidence/runs/angular-super-productivity-v2-13-15/u18j-worker-chunks-parity.json',
		root: 'app/dist',
		published:
			'the complete cell build story: green at 62 artifacts, both web worker chunks emitted and precached, and three builds agreeing file for file except one clock field',
		contradictedBy:
			'a reading of its own emitted document: forty-five `@font-face` rules and a `fonts.gstatic.com` preconnect that appear in no input, because the Angular 16 builder fetched the Roboto stylesheet from `fonts.googleapis.com` while the build was running',
	}),
	Object.freeze({
		record: 'evidence/runs/angular-super-productivity-v2-13-15/u23-offline-font-lane.json',
		root: 'dist-23',
		published:
			'the same lane built without asking a third party for anything: the font inliner off, the era `<link>` back in the document, zero egress attempts across two green builds under a process-scoped guard, and a control build of the previous workspace dying on the fetch it needed',
		contradictedBy:
			'a browser reading of its own dist-23 bytes: the `<split>` element binds `splitPos` before its two element inputs, so under Ivy the position setter runs against undefined elements and the work view throws `addClass` on undefined once per load — a regression invisible to the green build, fixed by the template-binding-reorder the dist-25 rebuild carries (measured by u20c2e)',
	}),
	Object.freeze({
		record: 'evidence/runs/angular-super-productivity-v2-13-15/u20c2g-dist25-rebind-lane.json',
		root: 'dist-25',
		published:
			'the same offline, font-inliner-disabled lane rebuilt from a tree carrying the template-binding-reorder: zero egress across two green builds, the same 62-artifact worker-complete census u23 measured, deterministic modulo the service-worker clock across dist-25 and dist-26, and the reorder read back out of the emitted application chunk so the fix lands in the booting bytes and the work view loads with zero page errors',
		contradictedBy: null,
	}),
]);

/**
 * What the build phase of this vertical found that no build lane could report
 * on its own, and what each finding cost to repair.
 *
 * They are carried in the receipt because they are the cell's result: the build
 * was green before either of them was known, and a green build is exactly the
 * thing that cannot report them.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATION_FINDINGS = Object.freeze([
	Object.freeze({
		finding:
			'both of the application’s web workers were constructed from a string specifier, so webpack 5 emitted no chunk for either, raised no error, and the workers would have 404’d at run time',
		invisibleTo: 'a green production build — nothing is parsed, so nothing is reported',
		foundBy:
			'a census of the emitted inventory against the era lane’s: 58 artifacts where the era lane emitted its workers, and no chunk under either worker’s logical name',
		cause: 'the era CLI carried a webpack 4 worker plugin that treated `new Worker(‘./x.worker’, …)` as a worker request; webpack 5 dropped it for a module-graph rule that recognises exactly one spelling, `new Worker(new URL(‘./x.worker’, import.meta.url), …)`, and a plain string is an ordinary argument to that rule',
		repair:
			'the web-worker-url-specifier capability, an analyzer-driven rewrite of the era construction into the URL form, provable from the workspace’s own `webWorkerTsConfig` declaration',
		record: 'evidence/runs/angular-super-productivity-v2-13-15/u18j-worker-chunks-parity.json',
	}),
	Object.freeze({
		finding:
			'the migrated production build reached `fonts.googleapis.com` while it ran and pasted forty-five `@font-face` rules and a `fonts.gstatic.com` preconnect into the emitted document, so the lane’s bytes depended on what a font host served on the build day and the lane could not be built at all where that host was unreachable',
		invisibleTo:
			'every build lane in this vertical — the build is green and the artifact is complete; the request happens before anything is looking',
		foundBy:
			'a reading of the emitted document against the application’s own source, then a control build of the same workspace under an egress guard, which died naming the stylesheet it could not retrieve',
		cause: 'the modern browser builder’s `optimization` defaults to on and its `fonts.inline` member defaults to on inside it; the devkit’s own schema documents the option as requiring internet access, and the era Angular CLI 8.3 builder had no such capability',
		repair:
			'the font-inlining-disable capability, generic over builder and declared value, which restores the era behaviour: the document ships the application’s own `<link>` and the browser fetches the stylesheet at run time',
		record: 'evidence/runs/angular-super-productivity-v2-13-15/u23-offline-font-lane.json',
	}),
]);

/**
 * The seam this application reaches for outside loopback, in BOTH lanes.
 *
 * `src/index.html` links the Roboto stylesheet unconditionally, so every
 * document load of either build requests it. The membership is shared rather
 * than per-lane because the two emitted documents carry the same link: the era
 * build emitted it, the migrated build inlined it away, and the offline-faithful
 * rebuild put it back — measured on both emitted documents, at zero inlined
 * `@font-face` rules each. The harness answers the request inside the browser
 * context: nothing leaves the machine, and the request is still written down,
 * because a seam that is answered is still a seam the application has.
 *
 * The application's `ngsw-config.json` also declares an `externalAssets` group
 * over `https://fonts.googleapis.com/**` and `https://fonts.gstatic.com/**`.
 * That group is `installMode: lazy`, so the worker caches those URLs only once
 * the page has asked for them; a request to the font-FILE host is therefore not
 * declared here, and if one is ever observed the non-masking discipline below
 * reports it by its own path and fails the run rather than absorbing it.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS = Object.freeze([
	Object.freeze({ method: 'GET', path: 'https://fonts.googleapis.com/css' }),
]) as readonly WitnessMockedNonLoopbackSeamEntry[];

/** The origin every declared seam has to sit on, identical in both lanes. */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAM_ORIGIN = 'https://fonts.googleapis.com';

/**
 * The font seam across the lane pair, as it stands after the offline-faithful
 * rebuild: there is no difference left, and saying so is the record.
 *
 * The migrated lane briefly had one. While the builder's font inliner was on,
 * the migrated document carried the stylesheet's body and asked the network
 * only for the font file, and the difference would have been a behavioural
 * change to declare and live with. It was not a property of the migration: it
 * was a builder default nobody configured, fetching a third party's bytes into
 * the output. With the inliner off, both documents ship the application's own
 * `<link>` to the same URL, both are answered in-context, and both lanes fail
 * to get the glyphs the same way.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FONT_SEAM = Object.freeze({
	state: 'measured-era-font-seam-restored-no-difference-remains',
	stylesheet: 'https://fonts.googleapis.com/css?family=Roboto:300,400,400i,500,700&display=swap',
	baseline: 'requests-the-roboto-stylesheet-from-fonts-googleapis-com-at-runtime',
	migrated: 'requests-the-roboto-stylesheet-from-fonts-googleapis-com-at-runtime',
	baselineInlinedFontFaceRules: 0,
	migratedInlinedFontFaceRules: 0,
	supersededMigratedInlinedFontFaceRules: 45,
	cause: 'the Angular 16 builder inlines Google Fonts into the document at build time by default, which moved the era browser’s run-time request into the build; the migrated cell disables that with `optimization.fonts.inline: false`, so the emitted document carries the same link the era build emitted and the browser makes the same request',
	answeredInContext: true,
	successfulNonLoopbackInEitherLane: 0,
	supersededDifference:
		'evidence/runs/angular-super-productivity-v2-13-15/u23-offline-font-lane.json',
	masked: false,
});

/** The family the linked stylesheet would declare, matched against the measurement. */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TYPEFACE = 'Roboto' as const;

/**
 * What this application does about a service worker, as far as the two build
 * lanes establish it — which is where this record stops.
 *
 * Both lanes ship a real ngsw: `ngsw-worker.js`, `safety-worker.js` and a
 * generated `ngsw.json`, all three in both emitted inventories. The
 * application registers `ngsw-worker.js` unconditionally under
 * `environment.production`, which is the configuration both lanes build. So
 * unlike every zero-worker and refused-registration vertical in this corpus,
 * the expected shape here is a registration that SUCCEEDS, in both lanes, and
 * a worker that installs, activates and takes control.
 *
 * Nothing below asserts what the browser settled to, because no browser has
 * been driven at this application yet. What the schema pins is the shape the
 * run must record — three checkpoints per lane, in journey order, each naming
 * the script the application asked for — and the non-masking discipline that
 * governs it: the settled state of each checkpoint is recorded exactly as
 * measured and travels in the parity digest, so the two lanes cannot disagree
 * about it silently, and no field here is allowed to stand in for a
 * measurement. The registration scope, the active worker version and the cache
 * names each lane settles to are pinned when this proof is published.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER = Object.freeze({
	state: 'declared-real-ngsw-in-both-lanes-settled-state-measured-at-witness-time',
	script: 'ngsw-worker.js',
	registration: 'ServiceWorkerModule.register(‘ngsw-worker.js’, {enabled: environment.production}) in the application’s own root module, and both lanes build the production configuration',
	manifest: 'ngsw.json',
	shippedWorkerFiles: Object.freeze(['ngsw-worker.js', 'safety-worker.js']),
	config: 'ngsw-config.json',
	checkpointPhases: Object.freeze([
		'before-interactions',
		'after-interactions',
		'after-online-reload',
	]),
	introducedByMigration: false,
	disabledHere: false,
	masked: false,
	pinnedAtPublish:
		'the scope, the active version and the cache names each lane settles to are recorded from the run and pinned when this proof is published; this record asserts none of them',
});

/**
 * The closed list of rendered-appearance probes the journey measures, identical
 * in both lanes so the two measurements are comparable at all.
 *
 * Selectors are element-based, or built on the application's OWN class names,
 * on purpose: Angular Material's class names were rewritten onto MDC between
 * 8.2 and 16.2, and a probe pinned to one of those would be measuring the
 * framework's naming rather than the application's appearance. Every selector
 * here resolves in the application shell on its first route — the header, the
 * drawer container and the side navigation are rendered by `app.component.html`
 * itself — and the header's project-settings control is used rather than its
 * burger control because the burger is behind an `*ngIf` on the navigation
 * layout and would resolve differently at different viewport widths.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES = Object.freeze([
	Object.freeze({
		label: 'application-header',
		selector: 'main-header',
		properties: Object.freeze(['background-color', 'color']),
	}),
	Object.freeze({
		label: 'header-icon-button',
		selector: 'main-header .project-settings-btn',
		properties: Object.freeze(['background-color', 'border-radius', 'font-family']),
	}),
	Object.freeze({
		label: 'header-icon',
		selector: 'main-header .project-settings-btn mat-icon',
		properties: Object.freeze(['font-family', 'font-size']),
	}),
	Object.freeze({
		label: 'drawer-container',
		selector: 'mat-drawer-container',
		properties: Object.freeze(['background-color', 'display']),
	}),
	Object.freeze({
		label: 'side-navigation',
		selector: 'side-nav',
		properties: Object.freeze(['background-color', 'font-family']),
	}),
	Object.freeze({
		label: 'document-body',
		selector: 'body',
		properties: Object.freeze(['background-color', 'font-family', 'margin-top']),
	}),
]);

/**
 * The rule that governs which probes are allowed to differ across the lift, and
 * how the declaration is checked.
 *
 * The membership is NOT pinned here, and that is deliberate. A declared
 * difference is a measurement — this probe resolves differently in the two
 * lanes, and here is why — and no browser has been driven at this application
 * yet. Pinning a list now would be pinning a guess about Angular Material's
 * MDC rewrite and calling it evidence. What is pinned is the discipline: the
 * receipt publishes the membership its own runs measured, every member carries
 * the reason it differs, and the parser checks the declaration in BOTH
 * directions against the lane pair.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_DIFFERENCE_RULE =
	'A probe outside the published declared-difference list must resolve identically in the two lanes, and a probe inside it must actually differ. A declared difference that stopped being real is a stale claim and fails the run, exactly as an undeclared one does. The membership is what the runs measured; the reason beside each member is what the receipt is for.' as const;

/**
 * The application's routing shape, pinned instead of a route sequence.
 *
 * The router runs with `useHash: true`, so every navigation is a fragment. What
 * a browser proof can be held to here is that each recorded route is a hash
 * route naming one of the application's own declared routes, in the same
 * sequence in every lane and pass — and that is what is checked. A pinned
 * sequence belongs to the journey that drives it, and this unit drives none.
 *
 * `daily-summary` is declared twice upstream, bare and with a `:dayStr`
 * parameter, so it is admitted as a parameterised prefix rather than by exact
 * match. The wildcard route is not admissible: it renders the work view for a
 * path the application does not declare, and a journey that reached it would
 * be recording a navigation the application did not intend.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ROUTE_SHAPE = Object.freeze({
	router: 'angular-router-use-hash',
	prefix: '#/',
	known: Object.freeze([
		'/config',
		'/daily-summary',
		'/metrics',
		'/procrastination',
		'/project-settings',
		'/projects',
		'/schedule',
		'/work-view',
		'/worklog',
	]),
	parameterised: Object.freeze(['/daily-summary']),
	wildcard: 'the application declares a `**` route onto the work view; it is not an admissible recorded route',
});

/**
 * Where this application keeps its state, read out of its own persistence
 * layer rather than inferred from a storage snapshot.
 *
 * `DatabaseService` configures localforage with an explicit driver preference
 * — IndexedDB first, WebSQL second, localStorage last — under the database
 * name `SUP` and the store name `SUP_STORE`, and every read and write in the
 * application's persistence layer goes through it. A second, smaller surface
 * uses `window.localStorage` directly for a handful of namespaced keys. Both
 * are the application's own; there is no backend in the core flow and nothing
 * here is stubbed.
 *
 * Which driver localforage actually settles on is a property of the browser and
 * is recorded from the run, not asserted: a context without IndexedDB would
 * fall through to the next driver and the application would still work, and a
 * receipt that pinned the driver would be describing the harness rather than
 * the application.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE = Object.freeze({
	store: 'browser-indexed-db-through-localforage',
	service: 'the application’s own DatabaseService over localforage, plus a namespaced localStorage surface',
	databaseName: 'SUP',
	storeName: 'SUP_STORE',
	driverPreference: Object.freeze(['INDEXEDDB', 'WEBSQL', 'LOCALSTORAGE']),
	localStorageKeyPrefix: 'SUP_',
	compression: 'lz-string, in one of the application’s two web workers',
	backend: 'none',
	stubbed: false,
});

/**
 * The migration's accommodation framing.
 *
 * Nineteen manual migration steps is the claim, and it is not a footnote: a
 * manual-migration-step is the tool saying, at a named line, that human
 * judgement is required here, and nineteen of them is the itemised bill for
 * migrating this application. The steps collapse into eight distinct decisions
 * over five families, and one of those decisions carries a payload file — a
 * local re-implementation of the one injectable the application used from a
 * package this cell cannot consume, redirected at the twenty modules that named
 * it. The inventory is final as of u18h: two later capability rounds added
 * nothing to it, and neither of them reduced it by one.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATIONS = Object.freeze({
	manualMigrationSteps: 19,
	distinctDecisions: 8,
	families: Object.freeze([
		'@ngrx/effects createEffect result typing',
		'chart.js 2 options literals',
		'ng2-charts symbols with no successor',
		'ngx-electron is not consumable by this cell',
		'three unrelated call sites',
	]),
	payloadFiles: 1,
	electronRedirectModules: 20,
	record: 'evidence/runs/angular-super-productivity-v2-13-15/u18h-capability-round.json',
	finalAsOf: 'u18h',
	reaffirmedBy: Object.freeze([
		'evidence/runs/angular-super-productivity-v2-13-15/u18i-closure-correction-green.json',
		'evidence/runs/angular-super-productivity-v2-13-15/u18j-worker-chunks-parity.json',
	]),
	note: 'The nineteen steps live in the driver’s own edit table, each as a literal replacement with its exact before and after, and the ngx-electron specifier redirect is counted as one decision rather than as twenty steps because it is one decision mechanically applied. Every other application edit in this cell was written by a generic capability from a reading of the tree.',
});

/**
 * The one payload file the accommodation inventory names, bound by byte length
 * and digest so the record cannot drift from the file it describes.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD = Object.freeze({
	path: 'fixtures/angular-super-productivity-v2-13-15/accommodations/electron.service.ts',
	appliedAs: 'src/app/core/electron/electron.service.ts',
	bytes: 4715,
	sha256: '0592883c544fb9c1e519ac659f559588ff77edd11c3a37f116d773fec670a233',
});

/**
 * The application's admission to the closed drag-surface list, stated so the
 * membership is a position the schema stands behind rather than a convenience.
 *
 * Super Productivity has a genuine drag surface — its task list reorders by
 * drag, through the era's own dragula binding — and it is the second member of
 * the closed list after jira-clone. What earns the membership is the surface
 * itself: the application's own `ng2-dragula` binding on the task list is a real
 * reorder gesture a journey can drive, so the vertical is required to drive it
 * rather than refuse it, and the parser below fails a run of this vertical that
 * records NO drag. The pin here is the REQUIREMENT and the rule its settled
 * order has to satisfy; the literal task order the reorder produces is measured
 * by the calibration driver and pinned when this proof is published, exactly as
 * the rendered-style differences and the worker's settled state are.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DRAG_SURFACE = Object.freeze({
	state: 'member-of-the-closed-drag-surface-list',
	surface: ANGULAR_SUPER_PRODUCTIVITY_APP,
	hasDragSurface: true,
	mechanism: 'ng2-dragula 2.1.1 in the era lane, on the task list',
	requirement:
		'a run of this vertical must record a genuine task-list reorder whose settled order is a permutation of the order before the move, with the application’s own store list agreeing with the rendered list after it',
	masked: false,
});

/**
 * A calibration contradiction, recorded rather than quietly fixed.
 *
 * The first calibration driver asked the live page for `work-view-page`,
 * because that is what the component's FILE is called. It resolved zero in both
 * lanes, twice, and the reason is that the component's own `selector` is
 * `work-view`: the filename and the host tag are different names for the same
 * component, and only one of them is ever in the DOM. The wrong spelling is
 * kept beside the right one in the driver's candidate list so both are asked on
 * every pass, and the counts — one and zero, in that order — are what settles
 * it. Nothing published ever carried the wrong spelling; this exists so the
 * correction is a measurement in the record rather than a silent edit.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_HOST_TAG_CORRECTION = Object.freeze({
	state: 'measured-host-tag-correction',
	corrected: 'work-view-page',
	correction: 'work-view',
	why: 'the work view component is declared in `work-view-page.component.ts` with `selector: “work-view”`; the file name is not a host tag and never resolves in the DOM',
	measuredCorrectedCount: 0,
	measuredCorrectionCount: 1,
	lanes: Object.freeze(['baseline', 'migrated']),
	published: false,
	masked: false,
});

/**
 * The second calibration contradiction, in the harness rather than in a pin.
 *
 * The IndexedDB key reader sorted its keys with `localeCompare`, which asks the
 * browser's collator. This application's store is the first one in the corpus
 * where that produces a different answer from UTF-16 code-unit order, and the
 * receipt schemas all check published key lists against `[...values].sort()` —
 * code-unit order. So the reader was returning a list its own schema would have
 * rejected, and on top of that the collator's answer depends on an ICU locale
 * nobody declared. The reader was corrected; the check was not relaxed.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_KEY_ORDER_CORRECTION = Object.freeze({
	state: 'measured-reader-ordering-correction',
	corrected: 'browser-collator-localeCompare',
	correction: 'utf16-code-unit',
	disagreedOn: Object.freeze([
		'SUP_PROJECT_META_LIST',
		'SUP_P_DEFAULT_TASKS_STATE',
		'SUP_P_DEFAULT_TASK_ATTACHMENT_STATE',
	]),
	why: 'every receipt schema in this corpus checks a published key list against `[...values].sort()`, which is code-unit order; a reader that answered in collation order was handing its schema a list the schema would refuse, and answering in a locale nobody declared while doing it',
	published: false,
	masked: false,
});

/**
 * What the browser found in the migrated lane that eight rounds of green builds
 * could not: the third invisible-to-build regression this cell has produced.
 *
 * Both lanes were driven through legs (a) and (e) by the calibration driver.
 * The era lane is clean — no page error, no console error, no failed request.
 * The migrated lane creates the task, persists it and reloads it exactly as the
 * era lane does, and while it does so its own `GLOBAL_ERROR_HANDLER` reports a
 * `TypeError` twice per load out of the work view's `split` component: an
 * `@Input() set splitPos` calls the renderer's `addClass` against an element
 * reference that is `undefined` at the time the input is set.
 *
 * It is recorded here and NOT pinned into either lane's expected-console-error
 * inventory. An expected-error inventory is an accounting mechanism for
 * diagnostics that are understood and accounted for, never an allowance, and a
 * regression admitted into one stops being visible. Both lanes therefore pin
 * the empty inventory the era lane measures, and the migrated lane stays red on
 * this until it is repaired — which is the correct state for a fact nobody has
 * fixed yet.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_REGRESSION = Object.freeze({
	state: 'measured-migrated-lane-runtime-regression-unrepaired',
	lane: 'migrated',
	error: "TypeError: Cannot read properties of undefined (reading 'classList')",
	site: 'src/app/pages/work-view/split/split.component.ts — the `@Input() set splitPos` accessor, through `@angular/platform-browser`’s `addClass`',
	perDocumentLoad: 1,
	pageErrorsPerLoad: 1,
	consoleErrorsPerLoad: 2,
	baselineOccurrences: 0,
	invisibleTo: 'both build lanes — the migrated lane is green at 62 artifacts and the input setter is never executed by a build',
	foundBy: 'the leg (a)/(e) calibration pass, driven through both lanes with the page-error and console tallies read off the box receipt',
	admittedIntoInventory: false,
	why: 'an expected-console-error inventory accounts for understood diagnostics; admitting an unrepaired regression into one would retire the only mechanism that reports it',
	masked: false,
});

/**
 * The empty per-lane console-error inventory, pinned for BOTH lanes.
 *
 * The era lane measured it. The migrated lane does not, and the difference is
 * the regression above rather than an allowance this inventory should grow to
 * fit. Pinning empty in both lanes is what keeps that difference a failure.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_CONSOLE_ERRORS = Object.freeze({
	baseline: Object.freeze([]),
	migrated: Object.freeze([]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>>;

/**
 * The empty per-lane failed-request inventory. Measured empty in both lanes:
 * every asset the document asks for is served from the bounded loopback origin,
 * and the one non-loopback request is the declared font seam, answered
 * in-context with a 200.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FAILED_REQUESTS = Object.freeze({
	baseline: Object.freeze([]),
	migrated: Object.freeze([]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>>;

/**
 * The seam membership per lane. Both lanes carry the same single member, which
 * is what the shared declaration above says and what the parser checks; this is
 * the per-lane shape the run specification consumes.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_LANE_SEAMS = Object.freeze({
	baseline: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS,
	migrated: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS,
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessMockedNonLoopbackSeamEntry[]>>;

/**
 * The two journey legs this specification drives, and every fact about them
 * that the calibration pass measured identically in both lanes.
 *
 * Leg (a) is a create: the application boots into planning mode with no tasks
 * at all, and the add-task bar is configured `[isAddToBacklog]="false"`, so a
 * title typed into it and committed with Enter lands in today's list rather
 * than in the backlog. Leg (e) is a document reload: there is no backend, the
 * task is in the application's own IndexedDB store, and what comes back is what
 * leg (a) put there.
 *
 * The key censuses are the measurement leg (e) rests on. Two keys exist before
 * anything is typed — the project meta list the application seeds itself and
 * its reminder record — and committing one task adds the four state documents
 * the application writes for the default project. Nothing is removed, which the
 * receipt schema checks in that direction as well.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_JOURNEY = Object.freeze({
	initialRoute: '/#/work-view',
	viewport: Object.freeze({ width: 1280, height: 900 }),
	/** The recorded navigations: the deep-linked work view, and the reload. */
	navigations: 2,
	hostTag: 'work-view',
	addTaskInput: 'add-task-bar input',
	taskList: 'task-list',
	taskListTask: 'task-list task',
	taskTitle: 'task-list task .task-title',
	/** Measured: the work view renders an undone list and a done list. */
	taskLists: 2,
	taskTitleText: 'Witness leg-a task',
	keysBeforeJourney: Object.freeze(['SUP_PROJECT_META_LIST', 'SUP_REMINDER']),
	/**
	 * In UTF-16 code-unit order, which is what the reader now produces and what
	 * `sortedUnique` above requires. The first calibration pass read them through
	 * the browser's collator and got `SUP_PROJECT_META_LIST` in the middle of the
	 * list; that reading disagreed with this schema, and the reader was corrected
	 * rather than the check relaxed.
	 */
	keysAfterJourney: Object.freeze([
		'SUP_PROJECT_META_LIST',
		'SUP_P_DEFAULT_ISSUE_STATE_GITHUB',
		'SUP_P_DEFAULT_ISSUE_STATE_JIRA',
		'SUP_P_DEFAULT_TASKS_STATE',
		'SUP_P_DEFAULT_TASK_ATTACHMENT_STATE',
		'SUP_REMINDER',
	]),
	localStorageKeysBeforeJourney: Object.freeze([]),
	localStorageKeysAfterJourney: Object.freeze(['SUP_LAST_ACTIVE']),
	/**
	 * The store localforage settles on in this context, recorded rather than
	 * pinned as a property of the application: the reader found the `SUP`
	 * database with `SUP_STORE` in it, which is the IndexedDB driver.
	 */
	driverInUse: 'INDEXEDDB',
	/**
	 * The application's own `ngsw-config.json` declares an `externalAssets` group
	 * over the Google Fonts hosts at `installMode: lazy`. The first document load
	 * caches nothing from it — the worker is not controlling the page yet — and
	 * the load after the reload caches the stylesheet the application's own
	 * `<link>` asks for, which is why the third checkpoint is the first one whose
	 * cache reading carries a cross-origin member.
	 */
	externalAssetCachedAfterReload:
		'https://fonts.googleapis.com/css?family=Roboto:300,400,400i,500,700&display=swap',
	/**
	 * The surface leg (b) drives: the application's own dragula-bound task list.
	 * This names WHICH surface the reorder gesture targets, not the order it
	 * settles to — that order is measured by the calibration driver and pinned
	 * when this proof is published.
	 */
	drag: 'task-list-reorder',
});

/**
 * Which probe the typeface reading is anchored on, and why it is not the one a
 * reader would reach for first.
 *
 * The schema requires the two lanes to publish the SAME typeface record,
 * because both are served the same answered stylesheet and the degradation is
 * therefore one fact measured twice rather than a difference across the lift.
 * The document body would be the obvious anchor and cannot be used for it: the
 * calibration pass measured `Roboto, "Helvetica Neue", sans-serif` in the era
 * lane and `Roboto, sans-serif` in the migrated one, because Angular Material's
 * typography configuration dropped the second family between 8.2 and 16.2. That
 * is a genuine declared style difference and it belongs in the declared-
 * difference list, not folded into a typeface record that then could not be
 * equal across lanes.
 *
 * The side navigation declares `Roboto, sans-serif` in the application's own
 * stylesheet and resolves identically in both lanes, so it is what the reading
 * is taken from. Both anchors agree on the only thing the record asserts: the
 * linked family is declared, and — with the stylesheet answered empty — no
 * `@font-face` ever defines it, so the browser falls through to the generic.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TYPEFACE_PROBE = 'side-navigation' as const;

/** Why the linked typeface degrades, in both lanes, identically. */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TYPEFACE_DEGRADATION_CAUSE =
	'the application’s own `index.html` links the Roboto stylesheet and its own styles declare the family, but the harness answers that stylesheet in-context with an empty body, so no `@font-face` rule ever defines Roboto and the browser falls through the declared list to the generic family; the declaration is what is measured, the glyphs are what never arrive, and nothing leaves the machine to fetch them' as const;

/**
 * The rendered-appearance readings the calibration pass took in both lanes, and
 * the two probes that differ.
 *
 * It is recorded rather than pinned into the receipt: the declared-difference
 * membership belongs to the runs that publish it, and no run has published yet.
 * What this is for is the next unit — it is the measurement a declared
 * difference has to be written from, and writing one from anything else is how
 * a receipt ends up declaring a difference nobody measured.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MEASURED_STYLE_DIFFERENCES = Object.freeze([
	Object.freeze({
		label: 'header-icon-button',
		property: 'font-family',
		baseline: 'Roboto, "Helvetica Neue", sans-serif',
		migrated: 'Arial',
		why: 'the era lane resolves the button through Angular Material 8’s typography config; the MDC-based button in 16.2 sets no family on the host at all, so the element falls through to the user-agent default',
	}),
	Object.freeze({
		label: 'document-body',
		property: 'font-family',
		baseline: 'Roboto, "Helvetica Neue", sans-serif',
		migrated: 'Roboto, sans-serif',
		why: 'Angular Material’s default typography configuration dropped `"Helvetica Neue"` from the family list between 8.2 and 16.2',
	}),
]);

/** One lane's service-worker checkpoint, recorded from the browser. */
export type WitnessAngularSuperProductivityServiceWorkerCheckpoint = {
	phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
	telemetry: WitnessServiceWorkerTelemetry;
};

/**
 * A lane's whole service-worker record: the three checkpoints, the worker
 * scripts the build actually shipped read before and after the run, and every
 * worker-scoped event the browser reported.
 */
export type WitnessAngularSuperProductivityServiceWorker = {
	script: string;
	checkpoints: WitnessAngularSuperProductivityServiceWorkerCheckpoint[];
	/** The worker scripts the build emitted, read from the served tree. */
	outputFiles: Array<{ path: string; beforeSha256: string; afterSha256: string }>;
	workerEvents: WitnessServiceWorkerTelemetry['workerEvents'];
};

/** How the linked typeface degrades with the stylesheet answered in-context. */
export type WitnessAngularSuperProductivityTypeface = {
	state: 'measured-typeface-degradation';
	cause: string;
	fontFaceDeclared: boolean;
	resolvedFontFamily: string;
	masked: false;
};

export type WitnessAngularSuperProductivityPersistenceEvidence = {
	store: 'browser-indexed-db-through-localforage';
	databaseName: 'SUP';
	storeName: 'SUP_STORE';
	backend: 'none';
	stubbed: false;
	/** The driver localforage settled on, recorded rather than pinned. */
	driverInUse: string;
	keysBeforeJourney: string[];
	keysAfterJourney: string[];
	localStorageKeysBeforeJourney: string[];
	localStorageKeysAfterJourney: string[];
	survivesOnlineReload: true;
};

/**
 * The settled result of the task-list reorder, leg (b).
 *
 * The gesture is a genuine dragula pointer drag on the application's own task
 * list, and what the shape pins is a RULE rather than a measured order: the
 * task that moved is named, the rendered list before and after the move are
 * both recorded, the after-order is a permutation of the before-order — nothing
 * created or lost by moving one task — the order actually changed, and the
 * order the application's own store settled to matches the order the page
 * rendered. The literal titles and the from/to positions are measured by the
 * calibration driver and pinned when this proof is published; this shape
 * refuses a run whose store disagrees with its rendered list, or one that
 * dropped or duplicated a task while moving one, or one whose "after" order is
 * the "before" order unchanged.
 */
export type WitnessAngularSuperProductivityDrag = {
	state: 'measured-task-list-reorder';
	surface: (typeof WITNESS_REAL_APP_DRAG_SURFACES)[number];
	pointer: 'genuine-dragula-pointer-down-move-up';
	movedTask: string;
	renderedOrderBefore: string[];
	renderedOrderAfter: string[];
	storeOrderAfter: string[];
};

/**
 * The settled result of starting a task's timer, leg (c).
 *
 * Starting the timer flips the control's icon and renders a running time value;
 * the shape pins the RULE the calibration driver's measurement has to satisfy
 * rather than the icons or the value themselves. The anchor is the icon flip:
 * the control shows one icon before the timer is started and a different one
 * after, so a run whose before- and after-icons are equal recorded no flip and
 * fails. A play indicator has to be present once tracking is on, and a time
 * value has to render carrying at least one digit — the exact icons, the exact
 * indicator and the exact duration are measured by the driver and pinned when
 * this proof is published.
 */
export type WitnessAngularSuperProductivityTimeTracking = {
	state: 'measured-task-time-tracking';
	iconBeforeStart: string;
	iconAfterStart: string;
	playIndicatorPresent: true;
	trackedTimeValue: string;
};

/**
 * The application-specific journey evidence.
 *
 * `typeface` and `persistence` are the facts legs (a) and (e) measure and are
 * always present. `drag` (leg b) and `timeTracking` (leg c) are the legs this
 * unit lands the SHAPE of: the parser requires both once a browser has driven
 * the journey, but they are typed optional so the producer this schema will get
 * next can populate them without the not-yet-updated wiring failing to compile.
 */
export type WitnessAngularSuperProductivityJourney = {
	typeface: WitnessAngularSuperProductivityTypeface;
	persistence: WitnessAngularSuperProductivityPersistenceEvidence;
	drag?: WitnessAngularSuperProductivityDrag;
	timeTracking?: WitnessAngularSuperProductivityTimeTracking;
};

/**
 * The scroll reading, as a union rather than a pinned shape.
 *
 * This application pins a drawer container to the viewport and scrolls inner
 * panels, and it also renders long task lists; which of the two a route
 * actually produces is a measurement, and both outcomes are honest evidence.
 * What the schema refuses is a run that carries neither, and a lane pair that
 * disagrees about which one it is.
 */
export type WitnessAngularSuperProductivityScroll =
	| WitnessScrollSurface
	| WitnessMeasuredScrollAbsence;

export type WitnessAngularSuperProductivityRun = WitnessRealAppRun & {
	serviceWorker: WitnessAngularSuperProductivityServiceWorker;
	consoleErrorInventory: WitnessConsoleErrorInventory;
	failedRequestInventory: WitnessFailedRequestInventory;
	mockedNonLoopbackSeams: WitnessMockedNonLoopbackSeamInventory;
	renderedStyles: WitnessRenderedStyleEvidence;
	applicationJourney: WitnessAngularSuperProductivityJourney;
	scroll: WitnessAngularSuperProductivityScroll;
	behaviorDigest: string;
};

export type WitnessAngularSuperProductivityMutation = {
	failure: 'witness-semantic-assertion';
	intendedFailure: true;
	lane: 'baseline' | 'migrated';
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

export type WitnessAngularSuperProductivityReceipt = {
	schemaVersion: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SCHEMA;
	result: 'pass';
	fixture: typeof ANGULAR_SUPER_PRODUCTIVITY_FIXTURE;
	source: typeof ANGULAR_SUPER_PRODUCTIVITY_SOURCE;
	provenance: Record<string, unknown>;
	canonicalReceipts: typeof ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS;
	determinism: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DETERMINISM;
	sassRandomBoundary: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SASS_RANDOM_BOUNDARY;
	runs: WitnessAngularSuperProductivityRun[];
	mutation: WitnessAngularSuperProductivityMutation;
	consoleErrors: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>
	>;
	failedRequests: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>
	>;
	/**
	 * The exact per-lane seam membership as published. Both halves are held to
	 * the one shared declaration, because both emitted documents carry the same
	 * stylesheet link and a lane that asked for something else would mean the
	 * offline-faithful rebuild did not hold.
	 */
	mockedSeams: Record<'baseline' | 'migrated', WitnessMockedNonLoopbackSeamEntry[]>;
	fontSeam: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FONT_SEAM;
	serviceWorker: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER;
	/** What each lane's worker settled to, as its own runs measured it. */
	serviceWorkerParity: Record<
		'baseline' | 'migrated',
		{
			registeredScriptPath: string;
			scope: string;
			activeAtFinalCheckpoint: string;
			controlledAtFinalCheckpoint: boolean;
			cacheNames: string[];
		}
	>;
	migratedLaneChain: typeof ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_CHAIN;
	migrationFindings: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATION_FINDINGS;
	typefaceDegradations: Record<
		'baseline' | 'migrated',
		WitnessAngularSuperProductivityTypeface
	>;
	renderedStyleParity: {
		state: 'measured-resolved-styles-with-declared-differences';
		probes: number;
		rule: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_DIFFERENCE_RULE;
		declaredDifferences: Array<{ label: string; why: string }>;
		otherProbesAgree: true;
	};
	persistence: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE;
	routeShape: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ROUTE_SHAPE;
	scroll: WitnessAngularSuperProductivityScroll;
	accommodations: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATIONS;
	accommodationPayload: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD;
	dragSurface: typeof WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DRAG_SURFACE;
	readiness: {
		angularLineage: { ready: number; total: number; counted: false };
		overall: { ready: number; total: number };
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

const sortedUnique = (values: string[]): boolean =>
	Array.isArray(values) &&
	values.join('\n') === [...values].sort().join('\n') &&
	new Set(values).size === values.length;

export function witnessAngularSuperProductivityRawDigest(
	run: WitnessAngularSuperProductivityRun | WitnessRealAppRun,
): string {
	const { pass: _pass, result: _result, semanticDigest: _semanticDigest, ...raw } = run;
	const withoutBehavior = { ...raw } as Record<string, unknown>;
	delete withoutBehavior.behaviorDigest;
	return sha256(canonicalize(withoutBehavior));
}

/**
 * The rendered-style projection that participates in the parity digest: the
 * probes the lanes must agree on, in full, plus the LABELS of the ones the
 * receipt declares they disagree on. Folding the declared-difference values in
 * would make the two lanes disagree about a difference the receipt already
 * records; dropping the labels would let a probe leave the declaration
 * unnoticed.
 */
function renderedStyleProjection(
	evidence: WitnessRenderedStyleEvidence | undefined,
	declaredDifferenceLabels: readonly string[],
): unknown {
	const differing = new Set(declaredDifferenceLabels);
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
 * Production bytes are lane-specific by construction — eight majors of bundler
 * apart — so the byte inventory stays in the run and out of this digest. So do
 * the things this migration genuinely changed: the declared style differences,
 * and each lane's own service-worker version and cache identity, which name
 * hashed bundles that cannot be the same in two lanes. What is left is
 * everything the two lanes must agree on, including the settled state of the
 * worker at each checkpoint, what the store held, and what the browser resolved
 * for the typeface neither lane is served.
 */
export function witnessAngularSuperProductivityBehaviorDigest(
	run: WitnessAngularSuperProductivityRun | WitnessRealAppRun,
	declaredDifferenceLabels: readonly string[] = [],
): string {
	const typed = run as WitnessAngularSuperProductivityRun;
	const journey = typed.applicationJourney as
		| WitnessAngularSuperProductivityJourney
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
			// The membership is checked exactly per lane against the published
			// inventory; only the policy and the accounting travel, exactly as the
			// mocked-seam membership does, because each framework reports its own
			// diagnostics in its own words.
			consoleErrorPolicy: {
				policy: run.consoleErrorInventory?.policy,
				originPlaceholder: run.consoleErrorInventory?.originPlaceholder,
				outsideInventory: run.consoleErrorInventory?.outsideInventory,
				entries: run.consoleErrorInventory?.observed.length,
				total: run.consoleErrorInventory?.total,
			},
			failedRequestPolicy: {
				policy: run.failedRequestInventory?.policy,
				outsideInventory: run.failedRequestInventory?.outsideInventory,
				entries: run.failedRequestInventory?.observed.length,
				total: run.failedRequestInventory?.total,
			},
			// The settled half of the registration, which both lanes must agree on:
			// what was registered, installing, waiting, controlling and cached at
			// each checkpoint. The version identity and the cache CONTENTS name
			// hashed bundles and stay in the run.
			serviceWorkerSettled: {
				script: typed.serviceWorker?.script,
				outputFiles: (typed.serviceWorker?.outputFiles ?? []).map((file) => file.path),
				checkpoints: (typed.serviceWorker?.checkpoints ?? []).map((checkpoint) => ({
					phase: checkpoint.phase,
					state: checkpoint.telemetry.state,
					registered: checkpoint.telemetry.registration.scriptPath !== null,
					installing: checkpoint.telemetry.registration.installing,
					waiting: checkpoint.telemetry.registration.waiting,
					active: checkpoint.telemetry.registration.active,
					controlled: checkpoint.telemetry.controller !== null,
					caches: checkpoint.telemetry.cacheNames.length,
				})),
			},
			mockedSeamPolicy: {
				policy: seams?.policy,
				pathPolicy: seams?.pathPolicy,
				outsideInventory: seams?.outsideInventory,
				successfulNonLoopback: seams?.successfulNonLoopback,
				members: seams?.category.length,
				observed: seams?.observed.length,
				absent: seams?.absent.length,
			},
			renderedStyles: renderedStyleProjection(run.renderedStyles, declaredDifferenceLabels),
			typeface: {
				state: journey?.typeface.state,
				fontFaceDeclared: journey?.typeface.fontFaceDeclared,
				resolvedFontFamily: journey?.typeface.resolvedFontFamily,
				masked: journey?.typeface.masked,
			},
			persistence: {
				store: journey?.persistence.store,
				databaseName: journey?.persistence.databaseName,
				storeName: journey?.persistence.storeName,
				backend: journey?.persistence.backend,
				stubbed: journey?.persistence.stubbed,
				driverInUse: journey?.persistence.driverInUse,
				keysBeforeJourney: journey?.persistence.keysBeforeJourney,
				keysAfterJourney: journey?.persistence.keysAfterJourney,
				localStorageKeysBeforeJourney: journey?.persistence.localStorageKeysBeforeJourney,
				localStorageKeysAfterJourney: journey?.persistence.localStorageKeysAfterJourney,
				survivesOnlineReload: journey?.persistence.survivesOnlineReload,
			},
			// Legs (b) and (c) are behavioural, so both lanes must agree on the
			// settled reorder and the timer flip in full; they travel here rather
			// than staying in the lane-specific byte inventory.
			drag: {
				state: journey?.drag?.state,
				surface: journey?.drag?.surface,
				pointer: journey?.drag?.pointer,
				movedTask: journey?.drag?.movedTask,
				renderedOrderBefore: journey?.drag?.renderedOrderBefore,
				renderedOrderAfter: journey?.drag?.renderedOrderAfter,
				storeOrderAfter: journey?.drag?.storeOrderAfter,
			},
			timeTracking: {
				state: journey?.timeTracking?.state,
				iconBeforeStart: journey?.timeTracking?.iconBeforeStart,
				iconAfterStart: journey?.timeTracking?.iconAfterStart,
				playIndicatorPresent: journey?.timeTracking?.playIndicatorPresent,
				trackedTimeValue: journey?.timeTracking?.trackedTimeValue,
			},
			scroll: typed.scroll,
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessAngularSuperProductivityDigest(
	receipt: WitnessAngularSuperProductivityReceipt,
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
		throw new Error(`Angular Super Productivity console-error inventory differs: ${label}`);
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
		throw new Error(`Angular Super Productivity failed-request inventory differs: ${label}`);
}

/**
 * The per-lane seam membership. Every member is a GET on the one declared
 * origin, every declared member is accounted for as observed or absent, and
 * nothing may sit outside the declaration — including the font-FILE host the
 * application's own service-worker config names but its lazy asset group never
 * reaches for on its own.
 */
function assertMockedSeams(
	inventory: WitnessMockedNonLoopbackSeamInventory | undefined,
	published: WitnessMockedNonLoopbackSeamEntry[],
	label: string,
): void {
	const originated = (entry: WitnessMockedNonLoopbackSeamEntry): boolean =>
		entry.method === 'GET' &&
		entry.path.startsWith(`${WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAM_ORIGIN}/`);
	if (
		inventory === undefined ||
		inventory.policy !== 'exact-app-scoped-mocked-non-loopback-seams' ||
		inventory.pathPolicy !== WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE ||
		!exact(inventory.outsideInventory, []) ||
		inventory.successfulNonLoopback !== 0 ||
		inventory.category.length === 0 ||
		!inventory.category.every(originated) ||
		!exact(inventory.category, published) ||
		!exact(inventory.category, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS) ||
		inventory.observed.length + inventory.absent.length !== inventory.category.length ||
		inventory.observed.some((observation) => observation.requests < 1)
	)
		throw new Error(`Angular Super Productivity mocked seam inventory differs: ${label}`);
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
		evidence.probes.length !== WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES.length ||
		evidence.probes.some((probe, index) => {
			const pinned = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES[index];
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
		throw new Error(`Angular Super Productivity rendered-style measurement differs: ${label}`);
}

/**
 * The published declared differences, checked in both directions across the
 * lane pair: a probe outside the declaration must resolve identically, and a
 * probe inside it must actually differ.
 */
function assertRenderedStyleDifferences(
	baseline: WitnessRenderedStyleMeasurement[],
	migrated: WitnessRenderedStyleMeasurement[],
	declaredDifferences: ReadonlyArray<{ label: string; why: string }>,
): void {
	const declared = new Set(declaredDifferences.map((entry) => entry.label));
	const probeLabels = new Set<string>(
		WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES.map((probe) => probe.label),
	);
	if (
		declared.size !== declaredDifferences.length ||
		declaredDifferences.some((entry) => !probeLabels.has(entry.label) || entry.why.length === 0)
	)
		throw new Error('Angular Super Productivity declared style differences are not probes');
	for (const [index, probe] of baseline.entries()) {
		const other = migrated[index];
		if (other === undefined || other.label !== probe.label)
			throw new Error('Angular Super Productivity rendered-style lanes are not comparable');
		if (declared.has(probe.label) === exact(probe.properties, other.properties))
			throw new Error(
				`Angular Super Productivity rendered-style declared difference differs: ${probe.label}`,
			);
	}
}

function assertTypeface(
	journey: WitnessAngularSuperProductivityJourney | undefined,
	label: string,
): void {
	const typeface = journey?.typeface;
	if (
		typeface === undefined ||
		typeface.state !== 'measured-typeface-degradation' ||
		typeface.cause.length === 0 ||
		typeof typeface.fontFaceDeclared !== 'boolean' ||
		typeface.masked !== false ||
		typeface.resolvedFontFamily.length === 0 ||
		// The measurement has to agree with the lane's own account of itself: a
		// lane that resolved the linked family while reporting no rule reached the
		// page is not the degradation this receipt describes.
		typeface.resolvedFontFamily.includes(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TYPEFACE) !==
			typeface.fontFaceDeclared
	)
		throw new Error(`Angular Super Productivity typeface degradation differs: ${label}`);
}

function assertPersistence(
	journey: WitnessAngularSuperProductivityJourney | undefined,
	label: string,
): void {
	const persistence = journey?.persistence;
	if (
		persistence === undefined ||
		persistence.store !== WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE.store ||
		persistence.databaseName !== WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE.databaseName ||
		persistence.storeName !== WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE.storeName ||
		persistence.backend !== 'none' ||
		persistence.stubbed !== false ||
		persistence.survivesOnlineReload !== true ||
		persistence.driverInUse.length === 0 ||
		!sortedUnique(persistence.keysBeforeJourney) ||
		!sortedUnique(persistence.keysAfterJourney) ||
		!sortedUnique(persistence.localStorageKeysBeforeJourney) ||
		!sortedUnique(persistence.localStorageKeysAfterJourney) ||
		persistence.keysAfterJourney.length === 0 ||
		// The journey writes to the store; it may not take anything out of it.
		persistence.keysBeforeJourney.some((key) => !persistence.keysAfterJourney.includes(key)) ||
		persistence.localStorageKeysBeforeJourney.some(
			(key) => !persistence.localStorageKeysAfterJourney.includes(key),
		) ||
		// The application namespaces every key it writes to localStorage; a run
		// that ended with none of them wrote nothing this receipt can point at.
		!persistence.localStorageKeysAfterJourney.some((key) =>
			key.startsWith(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE.localStorageKeyPrefix),
		)
	)
		throw new Error(`Angular Super Productivity persistence evidence differs: ${label}`);
}

/** A rendered time value carries at least one digit; the exact value is publish-time. */
const TRACKED_TIME_VALUE_HAS_DIGIT = createRegExp(digit);

/**
 * Leg (b): the task-list reorder, checked as a rule rather than against a pinned
 * order. The moved task is named and is in the list, the after-order is a
 * permutation of the before-order that actually changed, and the store the
 * application settled to agrees with the list the page rendered.
 */
function assertDrag(
	journey: WitnessAngularSuperProductivityJourney | undefined,
	label: string,
): void {
	const drag = journey?.drag;
	if (
		drag === undefined ||
		drag.state !== 'measured-task-list-reorder' ||
		drag.surface !== ANGULAR_SUPER_PRODUCTIVITY_APP ||
		!(WITNESS_REAL_APP_DRAG_SURFACES as readonly string[]).includes(drag.surface) ||
		drag.pointer !== 'genuine-dragula-pointer-down-move-up' ||
		drag.movedTask.length === 0 ||
		!Array.isArray(drag.renderedOrderBefore) ||
		!Array.isArray(drag.renderedOrderAfter) ||
		!Array.isArray(drag.storeOrderAfter) ||
		drag.renderedOrderBefore.length === 0 ||
		// The reorder is a permutation: the same multiset in a different order.
		drag.renderedOrderBefore.length !== drag.renderedOrderAfter.length ||
		[...drag.renderedOrderBefore].sort().join('\n') !==
			[...drag.renderedOrderAfter].sort().join('\n') ||
		drag.renderedOrderBefore.join('\n') === drag.renderedOrderAfter.join('\n') ||
		// The task that moved is one the list actually held before the move.
		!drag.renderedOrderBefore.includes(drag.movedTask) ||
		// The store and the page agree on where the move left the list.
		drag.storeOrderAfter.join('\n') !== drag.renderedOrderAfter.join('\n')
	)
		throw new Error(`Angular Super Productivity drag evidence differs: ${label}`);
}

/**
 * Leg (c): starting a task's timer. The anchor is the icon flip — the control
 * shows a different icon after the timer starts than before — plus a play
 * indicator once tracking is on and a rendered time value carrying a digit.
 */
function assertTimeTracking(
	journey: WitnessAngularSuperProductivityJourney | undefined,
	label: string,
): void {
	const tracking = journey?.timeTracking;
	if (
		tracking === undefined ||
		tracking.state !== 'measured-task-time-tracking' ||
		tracking.iconBeforeStart.length === 0 ||
		tracking.iconAfterStart.length === 0 ||
		tracking.iconBeforeStart === tracking.iconAfterStart ||
		tracking.playIndicatorPresent !== true ||
		!TRACKED_TIME_VALUE_HAS_DIGIT.test(tracking.trackedTimeValue)
	)
		throw new Error(`Angular Super Productivity time-tracking evidence differs: ${label}`);
}

/**
 * Every recorded route is a hash route naming one of the application's own
 * declared routes, or a parameterised child of one. The sequence itself belongs
 * to the journey and is required to be identical across the four runs by the
 * behavior digest.
 */
function assertRouteShape(routes: string[], label: string): void {
	const shape = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ROUTE_SHAPE;
	const known = shape.known as readonly string[];
	const parameterised = shape.parameterised as readonly string[];
	if (!Array.isArray(routes) || routes.length === 0)
		throw new Error(`Angular Super Productivity route shape differs: ${label}`);
	for (const route of routes) {
		const hash = route.startsWith('/#/') ? route.slice(1) : route;
		if (!hash.startsWith(shape.prefix))
			throw new Error(`Angular Super Productivity route is not a hash route: ${route}`);
		const [named = ''] = hash.slice(1).split('?');
		const parameterisedParent = parameterised.find((parent) =>
			named.startsWith(`${parent}/`),
		);
		if (!known.includes(named) && parameterisedParent === undefined)
			throw new Error(`Angular Super Productivity route is not a declared route: ${route}`);
	}
}

/**
 * The service-worker record, held to the non-masking discipline.
 *
 * Nothing here is asserted away. The three checkpoints must be present in
 * journey order; the registration must name the script the application asked
 * for at every one of them; the trace may not be empty, because a browser that
 * registered a worker recorded doing so; and every event in it must name either
 * the scope the registration took or the script it ran. The worker files the
 * build shipped are read before and after the run and must be byte-identical,
 * because a served tree a worker rewrote is not the tree the lane was bound to.
 *
 * What is NOT asserted is the settled state itself — which version is active,
 * which caches exist, whether the page is controlled at a given checkpoint.
 * Those are measurements, they travel in the parity digest so the two lanes
 * cannot disagree about them silently, and they are pinned when this proof is
 * published.
 *
 * Exported so a producer can round-trip the shape it builds against the parser
 * that will judge it, without first assembling a whole four-run receipt around
 * it. A shape checked only as part of a receipt is a shape whose own rules are
 * only ever exercised through everything else's.
 */
export function assertWitnessAngularSuperProductivityServiceWorker(
	worker: WitnessAngularSuperProductivityServiceWorker | undefined,
	label: string,
): void {
	const declared = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER;
	const names = (
		events: WitnessServiceWorkerTelemetry['workerEvents'],
	): boolean =>
		events.length !== 0 &&
		events.every((event) =>
			event.kind === 'registration'
				? event.scopePath.length !== 0
				: event.kind === 'version'
					? event.scriptPath.endsWith(declared.script)
					: false,
		);
	if (
		worker === undefined ||
		!worker.script.endsWith(declared.script) ||
		!exact(
			worker.checkpoints.map((checkpoint) => checkpoint.phase),
			declared.checkpointPhases,
		) ||
		worker.checkpoints.some(
			(checkpoint) =>
				checkpoint.telemetry.state !== 'ready' ||
				checkpoint.telemetry.registration.scriptPath === null ||
				!checkpoint.telemetry.registration.scriptPath.endsWith(declared.script) ||
				checkpoint.telemetry.registration.scope === null,
		) ||
		// Both lanes ship the same two worker scripts, read from the served tree.
		!exact(
			worker.outputFiles.map((file) => file.path).sort(),
			[...declared.shippedWorkerFiles].sort(),
		) ||
		worker.outputFiles.some(
			(file) =>
				!sha256Digest(file.beforeSha256) || file.beforeSha256 !== file.afterSha256,
		) ||
		!names(worker.workerEvents)
	)
		throw new Error(`Angular Super Productivity service-worker evidence differs: ${label}`);
}

/**
 * The scroll reading, whichever of the two shapes the run measured. A surface
 * has to be a genuine gesture the driver confirmed moved the viewport; an
 * absence has to be a per-route measurement that never overflowed.
 */
function assertScroll(scroll: WitnessAngularSuperProductivityScroll | undefined, label: string): void {
	if (scroll === undefined)
		throw new Error(`Angular Super Productivity scroll measurement is missing: ${label}`);
	if (scroll.state === 'measured-genuine-viewport-scroll') {
		if (
			scroll.route.length === 0 ||
			scroll.scrollHeight <= scroll.clientHeight ||
			scroll.clientHeight !== scroll.viewport.height ||
			scroll.wheelDeltaY <= 0 ||
			scroll.scrolledFromTop !== true ||
			scroll.scrolled !== true
		)
			throw new Error(`Angular Super Productivity scroll surface differs: ${label}`);
		return;
	}
	if (
		scroll.state !== 'measured-no-overflowing-document' ||
		scroll.claimed !== false ||
		scroll.documentOverflow.length === 0 ||
		!Array.isArray(scroll.routes) ||
		scroll.routes.length === 0 ||
		scroll.routes.some(
			(route) =>
				route.route.length === 0 ||
				route.clientHeight !== scroll.viewport.height ||
				route.scrollHeight > route.clientHeight,
		)
	)
		throw new Error(`Angular Super Productivity scroll-absence measurement differs: ${label}`);
}

export function parseWitnessAngularSuperProductivityReceipt(
	value: unknown,
): WitnessAngularSuperProductivityReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Angular Super Productivity Witness receipt must be an object');
	const receipt = value as WitnessAngularSuperProductivityReceipt;
	const expectedRuns = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	if (
		receipt.schemaVersion !== WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== ANGULAR_SUPER_PRODUCTIVITY_FIXTURE ||
		!exact(receipt.source, ANGULAR_SUPER_PRODUCTIVITY_SOURCE) ||
		!Array.isArray(receipt.canonicalReceipts) ||
		!exact(receipt.canonicalReceipts, ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS) ||
		!exact(receipt.determinism, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DETERMINISM) ||
		!exact(
			receipt.sassRandomBoundary,
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SASS_RANDOM_BOUNDARY,
		) ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('Angular Super Productivity Witness binding differs');
	const declaredDifferences = receipt.renderedStyleParity?.declaredDifferences;
	if (!Array.isArray(declaredDifferences))
		throw new Error('Angular Super Productivity declared style differences are missing');
	const declaredDifferenceLabels = declaredDifferences.map((entry) => entry.label);
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		if (
			!expectedRuns.delete(key) ||
			run.app !== ANGULAR_SUPER_PRODUCTIVITY_APP ||
			run.framework !== 'angular' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			run.witnessRecord.consoleErrors !== run.consoleErrorInventory?.total ||
			run.witnessRecord.failedRequests !== run.failedRequestInventory?.total ||
			run.offlineEvidence.state !== 'not-applicable' ||
			// A worker that registered leaves a trace, and the finalized trace has to
			// be the one this run's own record carries.
			!exact(run.observerFinalization.workerEvents, run.serviceWorker?.workerEvents) ||
			run.servedStatic.byteIdentical !== true ||
			run.interactions.length === 0 ||
			// Drag membership is earned, so a run must record the reorder gesture
			// rather than refuse it — in both the interaction list and the witness
			// record the browser observed. Its settled order is checked by
			// `assertDrag` below.
			!run.interactions.some((interaction) => interaction.kind === 'drag') ||
			!run.witnessRecord.interactions.some((interaction) => interaction.kind === 'drag') ||
			run.semanticDigest !== witnessAngularSuperProductivityRawDigest(run) ||
			run.behaviorDigest !==
				witnessAngularSuperProductivityBehaviorDigest(run, declaredDifferenceLabels)
		)
			throw new Error(`Angular Super Productivity Witness run differs: ${key}`);
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
		assertMockedSeams(run.mockedNonLoopbackSeams, receipt.mockedSeams?.[run.lane] ?? [], key);
		assertRenderedStyles(run.renderedStyles, key);
		assertTypeface(run.applicationJourney, key);
		assertPersistence(run.applicationJourney, key);
		assertDrag(run.applicationJourney, key);
		assertTimeTracking(run.applicationJourney, key);
		assertWitnessAngularSuperProductivityServiceWorker(run.serviceWorker, key);
		assertScroll(run.scroll, key);
		behaviors.add(run.behaviorDigest);
	}
	const baseline = receipt.runs.find((run) => run.lane === 'baseline');
	const migrated = receipt.runs.find((run) => run.lane === 'migrated');
	if (baseline === undefined || migrated === undefined)
		throw new Error('Angular Super Productivity Witness lane pair is incomplete');
	assertRenderedStyleDifferences(
		baseline.renderedStyles.probes,
		migrated.renderedStyles.probes,
		declaredDifferences,
	);
	assertScroll(receipt.scroll, 'receipt');
	if (
		expectedRuns.size !== 0 ||
		behaviors.size !== 1 ||
		// Both emitted documents carry the same stylesheet link, so a lane whose
		// seams differed from the other's would mean the offline-faithful rebuild
		// did not hold.
		!exact(receipt.mockedSeams?.baseline, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS) ||
		!exact(receipt.mockedSeams.baseline, receipt.mockedSeams.migrated) ||
		!exact(receipt.fontSeam, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FONT_SEAM) ||
		!exact(receipt.serviceWorker, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER) ||
		!exact(receipt.migratedLaneChain, ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_CHAIN) ||
		// The chain has to end at the lane this proof actually serves, or the story
		// it tells is about some other build.
		receipt.migratedLaneChain.at(-1)?.record !==
			receipt.canonicalReceipts.find((bound) => bound.lane === 'migrated')?.path ||
		receipt.migratedLaneChain.at(-1)?.contradictedBy !== null ||
		!exact(
			receipt.migrationFindings,
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATION_FINDINGS,
		) ||
		!exact(receipt.typefaceDegradations?.baseline, baseline.applicationJourney.typeface) ||
		!exact(receipt.typefaceDegradations.migrated, migrated.applicationJourney.typeface) ||
		// Both lanes are served the same answered stylesheet, so the degradation is
		// one fact measured twice rather than a difference across the lift.
		!exact(receipt.typefaceDegradations.baseline, receipt.typefaceDegradations.migrated) ||
		receipt.renderedStyleParity?.state !== 'measured-resolved-styles-with-declared-differences' ||
		receipt.renderedStyleParity.probes !==
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES.length ||
		receipt.renderedStyleParity.rule !== WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_DIFFERENCE_RULE ||
		receipt.renderedStyleParity.otherProbesAgree !== true ||
		!exact(receipt.persistence, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE) ||
		!exact(receipt.routeShape, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ROUTE_SHAPE) ||
		!exact(receipt.accommodations, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATIONS) ||
		receipt.accommodations.families.length !== 5 ||
		!exact(
			receipt.accommodationPayload,
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD,
		) ||
		!exact(receipt.dragSurface, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DRAG_SURFACE) ||
		receipt.serviceWorkerParity?.baseline === undefined ||
		receipt.serviceWorkerParity.migrated === undefined ||
		(['baseline', 'migrated'] as const).some((lane) => {
			const parity = receipt.serviceWorkerParity[lane];
			const run = lane === 'baseline' ? baseline : migrated;
			const final = run.serviceWorker.checkpoints.at(-1);
			return (
				final === undefined ||
				parity.registeredScriptPath !== final.telemetry.registration.scriptPath ||
				parity.scope !== final.telemetry.registration.scope ||
				parity.activeAtFinalCheckpoint !== final.telemetry.registration.active ||
				parity.controlledAtFinalCheckpoint !== (final.telemetry.controller !== null) ||
				!exact(parity.cacheNames, final.telemetry.cacheNames)
			);
		}) ||
		receipt.mutation?.intendedFailure !== true ||
		receipt.mutation.failure !== 'witness-semantic-assertion' ||
		receipt.mutation.seam.length === 0 ||
		receipt.mutation.path.length === 0 ||
		!Number.isInteger(receipt.mutation.offset) ||
		receipt.mutation.offset < 0 ||
		receipt.mutation.restoredByteIdentically !== true ||
		receipt.mutation.restoredRun !== 'pass' ||
		receipt.mutation.beforeSha256 !== receipt.mutation.afterRestoreSha256 ||
		receipt.mutation.beforeSha256 === receipt.mutation.mutatedSha256 ||
		!behaviors.has(receipt.mutation.restoredBehaviorDigest) ||
		receipt.readiness?.angularLineage.counted !== false ||
		!Number.isInteger(receipt.readiness.angularLineage.ready) ||
		!Number.isInteger(receipt.readiness.angularLineage.total) ||
		receipt.readiness.angularLineage.ready > receipt.readiness.angularLineage.total ||
		!Number.isInteger(receipt.readiness.overall.ready) ||
		!Number.isInteger(receipt.readiness.overall.total) ||
		receipt.readiness.overall.ready > receipt.readiness.overall.total ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.osWideIsolation !== false ||
		receipt.locality.mockedNonLoopbackSeams !== receipt.mockedSeams.migrated.length ||
		!Array.isArray(receipt.nonclaims) ||
		receipt.nonclaims.length === 0 ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessAngularSuperProductivityDigest(receipt)
	)
		throw new Error('Angular Super Productivity Witness integrity differs');
	return receipt;
}

export function renderWitnessAngularSuperProductivityReceipt(
	receipt: WitnessAngularSuperProductivityReceipt,
): string {
	const lanes = receipt.canonicalReceipts
		.map((bound) => {
			const determinism = receipt.determinism[bound.lane];
			return `${bound.lane} \`${bound.path}\` (${bound.digest.slice(0, 12)}) served from \`${bound.canonicalRoot}\` across ${bound.files} files — ${determinism.state}`;
		})
		.join('; ');
	const seams = (lane: 'baseline' | 'migrated'): string =>
		receipt.mockedSeams[lane].map((seam) => `${seam.method} ${seam.path}`).join(', ');
	const typeface = (lane: 'baseline' | 'migrated'): string =>
		`${lane}: ${receipt.typefaceDegradations[lane].cause}, resolved family \`${receipt.typefaceDegradations[lane].resolvedFontFamily}\``;
	const worker = (lane: 'baseline' | 'migrated'): string => {
		const parity = receipt.serviceWorkerParity[lane];
		return `${lane}: registered \`${parity.registeredScriptPath}\` at scope \`${parity.scope}\`, active \`${parity.activeAtFinalCheckpoint}\`, controlling: ${String(parity.controlledAtFinalCheckpoint)}, ${parity.cacheNames.length} cache(s)`;
	};
	const differences =
		receipt.renderedStyleParity.declaredDifferences.length === 0
			? 'none — every probe resolves identically in both lanes'
			: receipt.renderedStyleParity.declaredDifferences
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
	const scroll =
		receipt.scroll.state === 'measured-genuine-viewport-scroll'
			? `${receipt.scroll.state} on \`${receipt.scroll.route}\` — ${receipt.scroll.scrollHeight}px of document in a ${receipt.scroll.clientHeight}px viewport, moved by a genuine wheel gesture`
			: `${receipt.scroll.state} — ${receipt.scroll.documentOverflow}`;
	const dragLeg = receipt.runs[0]?.applicationJourney.drag;
	const drag =
		dragLeg === undefined
			? receipt.dragSurface.requirement
			: `\`${dragLeg.movedTask}\` moved and the ${dragLeg.renderedOrderAfter.length}-task list settled to a new order its own store agreed with`;
	const timeTracking = receipt.runs[0]?.applicationJourney.timeTracking;
	const timer =
		timeTracking === undefined
			? 'the timer flips the control icon and renders a running value'
			: `the control icon flipped from \`${timeTracking.iconBeforeStart}\` to \`${timeTracking.iconAfterStart}\` and a running value \`${timeTracking.trackedTimeValue}\` rendered`;
	return `# Super Productivity v2.13.15 — direct Witness browser proof

- Result: pass
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Runs: 2 baseline + 2 migrated production-static browser journeys
- Behavioral parity: ${receipt.runs[0]!.behaviorDigest}
- Bound build lanes: ${lanes}
- Determinism, era lane: ${receipt.determinism.baseline.cause}; migrated lane: ${receipt.determinism.migrated.cause}
- Sass \`random()\` across the supersede boundary: \`${receipt.sassRandomBoundary.supersededChunk}\` and \`${receipt.sassRandomBoundary.rebuiltChunk}\` agree until byte ${receipt.sassRandomBoundary.firstDifferingByte}, and no two builds within either round differed
- Migration: Angular 8.2 pre-Ivy ViewEngine to Angular 16.2 — at ${receipt.accommodations.manualMigrationSteps} manual migration steps over ${receipt.accommodations.distinctDecisions} decisions in ${receipt.accommodations.families.length} families, plus ${receipt.accommodations.payloadFiles} payload file redirected at ${receipt.accommodations.electronRedirectModules} modules, itemised in \`${receipt.accommodations.record}\`
- Accommodation payload: \`${receipt.accommodationPayload.path}\` (${receipt.accommodationPayload.bytes} bytes, sha256 ${receipt.accommodationPayload.sha256.slice(0, 12)}) applied as \`${receipt.accommodationPayload.appliedAs}\`
- What the build phase found that a green build could not report:
${findings}
- Migrated lane supersession chain (every record immutable, every supersession by reference):
${chain}
- Mocked non-loopback seams (answered in-context, none left the machine) — baseline: ${seams('baseline')}; migrated: ${seams('migrated')}
- Font seam: ${receipt.fontSeam.state} — ${receipt.fontSeam.cause}; masked: ${String(receipt.fontSeam.masked)}
- Service worker: a real ngsw in both lanes, registered from the application's own root module and measured at ${receipt.serviceWorker.checkpointPhases.length} checkpoints per lane — ${worker('baseline')}; ${worker('migrated')}
- Typeface degradation, measured per lane — ${typeface('baseline')}; ${typeface('migrated')}
- Rendered appearance: ${receipt.renderedStyleParity.probes} probes measured off the live page in both lanes; every probe outside the declared differences resolves identically. Declared differences: ${differences}
- Persistence: ${receipt.persistence.store} under \`${receipt.persistence.databaseName}\`/\`${receipt.persistence.storeName}\`, backend ${receipt.persistence.backend}, stubbed: ${String(receipt.persistence.stubbed)}
- Routing: ${receipt.routeShape.router}; every recorded route is a \`${receipt.routeShape.prefix}\` route naming one of the application's own ${receipt.routeShape.known.length} declared routes
- Drag: ${receipt.dragSurface.state} — the application's own ${receipt.dragSurface.mechanism} reorders the task list, and this vertical drives it: ${drag}
- Time tracking: leg (c) — ${timer}
- Mutation proof: \`${receipt.mutation.seam}\` in \`${receipt.mutation.path}\` at offset ${receipt.mutation.offset} made the journey red, byte-identical restoration made it green again
- Scroll: ${scroll}
- Angular lineage readiness: unchanged at ${receipt.readiness.angularLineage.ready}/${receipt.readiness.angularLineage.total}; this vertical is not counted

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export function witnessAngularSuperProductivityAggregateMember(digestValue: string) {
	return {
		id: 'witness-angular-super-productivity',
		framework: 'angular',
		track: 'production-readiness-direct-witness-angular8-viewengine-to-angular16-browser-builder',
		bundler: 'angular-cli-8.3.4-webpack-4-to-angular-16.2-browser-builder',
		runtime: 'node-12.14.1-to-node-16.20.2',
		result: 'pass',
		receipt: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
		digest: digestValue,
	};
}

/**
 * Re-reads each bound build record and checks the determinism this proof rests
 * on out of the record itself rather than out of the list above.
 *
 * Neither lane declares byte identity, so neither is checked for it. The era
 * entry is a digest correction, and what it has to establish is that it
 * corrects the record this proof names, that it recomputed every one of the
 * files the lane emitted, and that it did so from the retained tree this proof
 * is served from. The migrated entry has to declare the file count, the one
 * differing path and the manifest reading that makes `deterministicModuloClock`
 * mean what the binding says it means.
 */
export function assertAngularSuperProductivityBoundBuildReceipt(
	bound: (typeof ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS)[number],
	parsed: Record<string, unknown>,
): void {
	if (parsed.schemaVersion !== bound.schemaVersion || parsed.digest !== bound.digest)
		throw new Error(
			`Angular Super Productivity bound build receipt identity differs: ${bound.path}`,
		);
	if (bound.lane === 'baseline') {
		const supersedes = parsed.supersedes as Record<string, unknown> | undefined;
		const corrections = parsed.corrections as
			| Array<Record<string, unknown>>
			| undefined;
		const correction = corrections?.[0];
		if (
			supersedes?.path !== bound.corrects.path ||
			supersedes.schemaVersion !== bound.corrects.schemaVersion ||
			supersedes.digest !== bound.corrects.digest ||
			supersedes.sha256 !== bound.corrects.sha256 ||
			corrections?.length !== 1 ||
			correction === undefined ||
			correction.recomputedFrom !== bound.canonicalRoot ||
			correction.valuesTotal !== bound.files ||
			correction.valuesCorrected !== bound.corrects.valuesCorrected ||
			correction.valuesAlreadyCorrect !== bound.corrects.valuesAlreadyCorrect ||
			bound.corrects.valuesCorrected + bound.corrects.valuesAlreadyCorrect !== bound.files
		)
			throw new Error(
				`Angular Super Productivity era lane digest correction differs: ${bound.path}`,
			);
		return;
	}
	const determinism = parsed.determinism as Record<string, unknown> | undefined;
	const pinned = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DETERMINISM.migrated;
	if (
		parsed.canonicalRoot !== bound.canonicalRoot ||
		parsed.repeatedRoot !== bound.repeatedRoot ||
		parsed.artifactsEmitted !== bound.files ||
		!Array.isArray(parsed.inventory) ||
		parsed.inventory.length !== bound.files ||
		determinism?.files !== bound.files ||
		determinism.identical !== pinned.identical ||
		determinism.deterministicModuloClock !== pinned.deterministicModuloClock ||
		determinism.inventorySha256 !== bound.inventorySha256 ||
		!exact(determinism.differingAcrossRuns, pinned.differingPaths) ||
		!exact(determinism.manifestKeysDiffering, pinned.manifestKeysDiffering) ||
		determinism.manifestHashTableIdentical !== pinned.manifestHashTableIdentical ||
		parsed.egressFree !== true
	)
		throw new Error(
			`Angular Super Productivity migrated lane determinism differs: ${bound.path}`,
		);
}

export async function verifyWitnessAngularSuperProductivityEvidence(rootDir = '.') {
	const root = resolve(rootDir);
	const receiptPath = join(root, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH);
	const receipt = parseWitnessAngularSuperProductivityReceipt(
		JSON.parse(await readFile(receiptPath, 'utf8')),
	);
	for (const bound of receipt.canonicalReceipts) {
		const bytes = await readFile(join(root, bound.path));
		if (sha256(bytes) !== bound.sha256)
			throw new Error(
				`Angular Super Productivity bound build receipt bytes drifted: ${bound.path}`,
			);
		assertAngularSuperProductivityBoundBuildReceipt(
			bound,
			JSON.parse(bytes.toString('utf8')) as Record<string, unknown>,
		);
	}
	const payload = await readFile(
		join(root, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD.path),
	);
	if (
		sha256(payload) !== WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD.sha256 ||
		payload.length !== WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD.bytes
	)
		throw new Error('Angular Super Productivity accommodation payload drifted');
	if (
		(await readFile(join(dirname(receiptPath), 'receipt.md'), 'utf8')) !==
		renderWitnessAngularSuperProductivityReceipt(receipt)
	)
		throw new Error('Angular Super Productivity human Witness receipt differs');
	return {
		valid: true as const,
		digest: receipt.integrity.canonicalDigest,
		artifacts: 0,
		receipt,
	};
}
