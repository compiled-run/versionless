import { describe, expect, it } from 'vitest';
import {
	ANGULAR_SUPER_PRODUCTIVITY_APP,
	ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS,
	ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_CHAIN,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_CONSOLE_ERRORS,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FAILED_REQUESTS,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_HOST_TAG_CORRECTION,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_JOURNEY,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_KEY_ORDER_CORRECTION,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_LANE_SEAMS,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MEASURED_STYLE_DIFFERENCES,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_REGRESSION,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ROUTE_SHAPE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TYPEFACE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TYPEFACE_DEGRADATION_CAUSE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TYPEFACE_PROBE,
} from '../../core/src/receipts/witness-angular-super-productivity.ts';
import { angularSuperProductivityWitnessSpec } from '../src/witness/real-app-run.ts';

const spec = angularSuperProductivityWitnessSpec();
const journey = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_JOURNEY;

describe('the Super Productivity journey wiring', () => {
	it('is the Angular vertical the receipt schema names, on the roots it binds', () => {
		expect(spec.app).toBe(ANGULAR_SUPER_PRODUCTIVITY_APP);
		expect(spec.framework).toBe('angular');
		const bound = Object.fromEntries(
			ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS.map((receipt) => [
				receipt.lane,
				receipt.canonicalRoot,
			]),
		);
		// The lane roots the spec serves must END with the canonical output root
		// the schema pins for that lane; serving a sibling would be serving one
		// build rather than the lane the bound record describes.
		expect(spec.sources.baseline.endsWith(bound.baseline!)).toBe(true);
		expect(spec.sources.migrated.endsWith(bound.migrated!)).toBe(true);
	});

	it('binds the migrated build record by the sha256 of its exact bytes', () => {
		const migrated = ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS.find(
			(receipt) => receipt.lane === 'migrated',
		);
		expect(spec.canonicalBinding).toBe('file-sha256');
		expect(spec.canonicalReceipt).toBe(migrated!.path);
		expect(spec.canonicalDigest).toBe(migrated!.sha256);
		// The record it binds has to be the end of the migrated lane's supersession
		// chain, or the proof would be served from a build the chain says was
		// contradicted.
		expect(spec.canonicalReceipt).toBe(
			ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_CHAIN.at(-1)!.record,
		);
		expect(ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_CHAIN.at(-1)!.contradictedBy).toBeNull();
	});

	it('deep-links the declared work-view route rather than the bare document', () => {
		// Measured: the bare document records its navigation as `#/`, which the
		// router resolves through its `**` route. The schema refuses a recorded
		// route the application does not declare, and `/` is not one of the nine.
		expect(spec.initialRoute).toBe(journey.initialRoute);
		expect(journey.initialRoute).toBe('/#/work-view');
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ROUTE_SHAPE.known).toContain('/work-view');
		expect(journey.initialRoute.startsWith(`/${WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ROUTE_SHAPE.prefix}`)).toBe(
			true,
		);
		// The deep-linked document and the reload leg (e) performs: two, exactly.
		expect(journey.navigations).toBe(2);
	});

	it('measures against a stated viewport, because it claims scroll absence', () => {
		expect(spec.viewport).toEqual({ width: 1280, height: 900 });
		expect(spec.viewport).toEqual(journey.viewport);
	});

	it('declares the exact probe list the schema checks, in the schema order', () => {
		expect(spec.renderedStyleProbes).toBe(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES);
		// The typeface reading is anchored on a probe that is actually measured,
		// and on one the two lanes agree about — the reasoning is beside the
		// constant, and this is the half of it a test can hold.
		const labels = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES.map((probe) => probe.label);
		expect(labels).toContain(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TYPEFACE_PROBE);
		expect(
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MEASURED_STYLE_DIFFERENCES.map(
				(difference) => difference.label,
			),
		).not.toContain(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TYPEFACE_PROBE);
		// Every measured difference names a probe that exists, and actually differs.
		for (const difference of WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MEASURED_STYLE_DIFFERENCES) {
			expect(labels).toContain(difference.label);
			expect(difference.baseline).not.toBe(difference.migrated);
			expect(difference.why.length).toBeGreaterThan(0);
		}
	});

	it('declares the one font seam, identically in both lanes', () => {
		expect(spec.mockedNonLoopbackSeams).toBe(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_LANE_SEAMS);
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_LANE_SEAMS.baseline).toBe(
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS,
		);
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_LANE_SEAMS.migrated).toEqual(
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_LANE_SEAMS.baseline,
		);
	});
});

describe('the console and failed-request inventories', () => {
	it('pins the empty inventory the era lane measured, in BOTH lanes', () => {
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_CONSOLE_ERRORS).toEqual({
			baseline: [],
			migrated: [],
		});
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FAILED_REQUESTS).toEqual({
			baseline: [],
			migrated: [],
		});
		expect(spec.consoleErrorInventory).toBe(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_CONSOLE_ERRORS);
		expect(spec.failedRequestInventory).toBe(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FAILED_REQUESTS);
	});

	it('keeps the measured migrated-lane regression OUT of the inventory', () => {
		// This is the whole point of the empty migrated inventory. The calibration
		// pass measured a `TypeError` out of the work view's split component on
		// every document load of the migrated lane, twice on the console and once
		// as a page error, and zero occurrences of it in the era lane. Admitting
		// those two messages here would turn an accounting mechanism into an
		// allowance and retire the only thing that reports the regression.
		const regression = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_REGRESSION;
		expect(regression.admittedIntoInventory).toBe(false);
		expect(regression.masked).toBe(false);
		expect(regression.baselineOccurrences).toBe(0);
		expect(regression.consoleErrorsPerLoad).toBeGreaterThan(0);
		expect(regression.pageErrorsPerLoad).toBeGreaterThan(0);
		for (const entry of WITNESS_ANGULAR_SUPER_PRODUCTIVITY_CONSOLE_ERRORS.migrated)
			expect(entry.message).not.toContain('classList');
	});
});

describe('the two journey legs', () => {
	it('opts into the IndexedDB key reader, because leg (e) is a store reading', () => {
		expect(spec.indexedDb).toBe('read-keys');
		expect(journey.keysBeforeJourney.length).toBeGreaterThan(0);
	});

	it('reads the store the application own persistence layer configures', () => {
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE.databaseName).toBe('SUP');
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE.storeName).toBe('SUP_STORE');
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE.driverPreference).toContain(
			journey.driverInUse,
		);
	});

	it('pins a key census that grows and never shrinks across the create', () => {
		const before = [...journey.keysBeforeJourney];
		const after = [...journey.keysAfterJourney];
		expect(before).toEqual([...before].sort());
		expect(after).toEqual([...after].sort());
		expect(new Set(after).size).toBe(after.length);
		// The journey writes to the store; it may not take anything out of it,
		// which the receipt schema checks in that direction too.
		for (const key of before) expect(after).toContain(key);
		expect(after.length).toBeGreaterThan(before.length);
		// Every key the create added is one of the application's own namespaced
		// documents rather than something the harness put there.
		for (const key of after)
			expect(key.startsWith(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE.localStorageKeyPrefix)).toBe(
				true,
			);
	});

	it('pins the localStorage census the schema requires a namespaced member of', () => {
		expect([...journey.localStorageKeysBeforeJourney]).toEqual([]);
		expect([...journey.localStorageKeysAfterJourney]).toEqual(['SUP_LAST_ACTIVE']);
		expect(
			journey.localStorageKeysAfterJourney.some((key) =>
				key.startsWith(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE.localStorageKeyPrefix),
			),
		).toBe(true);
	});

	it('asserts the created task inside the task list rather than anywhere in the document', () => {
		// `[isAddToBacklog]="false"` is what makes this the interesting assertion:
		// a task that landed in the backlog would still match `task`, and would not
		// match `task-list task` in today's list.
		expect(journey.taskListTask.startsWith(`${journey.taskList} `)).toBe(true);
		expect(journey.taskTitle.startsWith(`${journey.taskListTask} `)).toBe(true);
		expect(journey.taskTitleText.length).toBeGreaterThan(0);
		expect(journey.taskLists).toBe(2);
	});
});

describe('the service worker and the typeface', () => {
	it('expects a worker that succeeds, at three checkpoints in journey order', () => {
		const worker = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER;
		expect(worker.disabledHere).toBe(false);
		expect(worker.introducedByMigration).toBe(false);
		expect([...worker.checkpointPhases]).toEqual([
			'before-interactions',
			'after-interactions',
			'after-online-reload',
		]);
		// The context is never told to block the registration: this is the first
		// vertical in the corpus whose expected shape is a worker that runs.
		expect(spec.serviceWorkers).toBeUndefined();
	});

	it('records that the reload is what first puts a cross-origin member in a cache', () => {
		// The application's own `ngsw-config.json` declares the font hosts as a
		// LAZY external-asset group, so the first load caches nothing from it and
		// the load after the reload caches the stylesheet the document links.
		expect(journey.externalAssetCachedAfterReload).toBe(
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS[0]!.path +
				'?family=Roboto:300,400,400i,500,700&display=swap',
		);
	});

	it('states the degradation in terms of what is declared and what never arrives', () => {
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TYPEFACE_DEGRADATION_CAUSE).toContain(
			'@font-face',
		);
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TYPEFACE).toBe('Roboto');
	});
});

describe('the drag surface and the deliberate absences', () => {
	it('names the task-list reorder as the surface leg (b) drives, with no file input or download', () => {
		// The application has the corpus's strongest drag surface after jira-clone,
		// and this vertical now drives it: the journey names WHICH surface the leg
		// targets — the dragula-bound task list — while the order it settles to is
		// measured by the calibration driver and pinned at publish.
		expect(journey.drag).toBe('task-list-reorder');
		expect(spec.fileInputs).toBeUndefined();
		expect(spec.downloads).toBeUndefined();
	});

	it('carries the work-view host-tag correction as a measurement, not a note', () => {
		const correction = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_HOST_TAG_CORRECTION;
		expect(correction.corrected).toBe('work-view-page');
		expect(correction.correction).toBe('work-view');
		expect(correction.measuredCorrectedCount).toBe(0);
		expect(correction.measuredCorrectionCount).toBe(1);
		expect(correction.published).toBe(false);
		// The journey asks for the corrected tag, which is the only place the
		// correction actually has to hold.
		expect(journey.hostTag).toBe(correction.correction);
	});

	it('carries the reader-ordering correction the same way', () => {
		const correction = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_KEY_ORDER_CORRECTION;
		expect(correction.correction).toBe('utf16-code-unit');
		// The three keys the collator and code-unit order disagree about are all in
		// the census this journey pins, which is how the contradiction surfaced.
		for (const key of correction.disagreedOn)
			expect([...journey.keysAfterJourney]).toContain(key);
	});
});
