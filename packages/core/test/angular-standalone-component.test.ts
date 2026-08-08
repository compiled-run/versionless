import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { findArchiveFile, indexTarGzip } from '../src/corpus/tier-f-provenance.ts';
import {
	FUXA_APP_MODULE_SHA256,
	FUXA_APP_MODULE_TARGET_SHA256,
	FUXA_IFRAME_COMPONENT_SHA256,
	FUXA_IFRAME_COMPONENT_TARGET_SHA256,
	FUXA_IFRAME_SPEC_SHA256,
	FUXA_IFRAME_SPEC_TARGET_SHA256,
	FUXA_COHORT_MODULE_TARGET_SHA256,
	FUXA_GAUGE_PROGRESS_SPEC_TARGET_SHA256,
	FUXA_GAUGE_PROGRESS_TARGET_SHA256,
	FUXA_GAUGE_SEMAPHORE_SPEC_TARGET_SHA256,
	FUXA_GAUGE_SEMAPHORE_TARGET_SHA256,
	transformFuxaGaugeStandalone,
	transformFuxaIframeStandalone,
	type AngularGaugeStandaloneSources,
	type AngularStandaloneSources,
} from '../src/migrations/angular-standalone-component.ts';
import { sha256 } from '../src/receipts/canonicalize.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const archivePath = path.join(
	root,
	'.versionless/cache/tier-f/angular-fuxa/4913aabfec74fc990664a5d60760d8f3438ee067b682f833f5869cd2c9c3c372/source.tar.gz',
);

async function sources(): Promise<AngularStandaloneSources> {
	const bytes = await readFile(archivePath);
	const archive = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: sha256(bytes) },
		'8b323c177615c0d152a54e5ef0a6f98dae7b8ff0',
	);
	const text = (file: string) => findArchiveFile(archive, file).bytes.toString('utf8');
	return {
		component: text('client/src/app/iframe/iframe.component.ts'),
		module: text('client/src/app/app.module.ts'),
		spec: text('client/src/app/iframe/iframe.component.spec.ts'),
	};
}

async function gaugeSources(): Promise<AngularGaugeStandaloneSources> {
	const bytes = await readFile(archivePath);
	const archive = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: sha256(bytes) },
		'8b323c177615c0d152a54e5ef0a6f98dae7b8ff0',
	);
	const text = (file: string) => findArchiveFile(archive, file).bytes.toString('utf8');
	return {
		progressComponent: text(
			'client/src/app/gauges/controls/gauge-progress/gauge-progress.component.ts',
		),
		progressSpec: text(
			'client/src/app/gauges/controls/gauge-progress/gauge-progress.component.spec.ts',
		),
		semaphoreComponent: text(
			'client/src/app/gauges/controls/gauge-semaphore/gauge-semaphore.component.ts',
		),
		semaphoreSpec: text(
			'client/src/app/gauges/controls/gauge-semaphore/gauge-semaphore.component.spec.ts',
		),
		module: text('client/src/app/app.module.ts'),
	};
}

describe('exact FUXA IframeComponent standalone transform', () => {
	it('applies exactly four spans across three files with zero Yuku diagnostics', async () => {
		const input = await sources();
		const result = transformFuxaIframeStandalone(input);
		expect(result.sourceHashes).toEqual({
			component: FUXA_IFRAME_COMPONENT_SHA256,
			module: FUXA_APP_MODULE_SHA256,
			spec: FUXA_IFRAME_SPEC_SHA256,
		});
		expect(result.targetHashes).toEqual({
			component: FUXA_IFRAME_COMPONENT_TARGET_SHA256,
			module: FUXA_APP_MODULE_TARGET_SHA256,
			spec: FUXA_IFRAME_SPEC_TARGET_SHA256,
		});
		expect(result.edits).toHaveLength(4);
		expect(new Set(result.edits.map((edit) => edit.file))).toEqual(
			new Set([
				'client/src/app/iframe/iframe.component.ts',
				'client/src/app/app.module.ts',
				'client/src/app/iframe/iframe.component.spec.ts',
			]),
		);
		expect(result.semanticEngine.diagnostics).toBe(0);
		expect(result.files.component).toContain(
			"@Component({\n    standalone: true,\n    selector: 'app-iframe',",
		);
		expect(result.files.module).not.toContain(
			'    declarations: [\n        HomeComponent,\n        EditorComponent,\n        HeaderComponent,\n        SidenavComponent,\n        IframeComponent,',
		);
		expect(result.files.module).toContain(
			'    imports: [\n        IframeComponent,\n        BrowserModule,',
		);
		expect(result.files.spec).toContain('      imports: [ IframeComponent ]');
	});

	it('is byte-idempotent only for the exact expected migrated triple', async () => {
		const first = transformFuxaIframeStandalone(await sources());
		const second = transformFuxaIframeStandalone(first.files);
		expect(second.files).toEqual(first.files);
		expect(second.edits).toEqual([]);
		expect(second.idempotent).toBe(true);
		const mutated = { ...first.files, spec: `${first.files.spec} ` };
		expect(() => transformFuxaIframeStandalone(mutated)).toThrow(
			'migrated FUXA standalone SHA-256 mismatch',
		);
	});

	it('refuses source hash, exact-shape, ambiguity, and Yuku diagnostic mutations', async () => {
		const input = await sources();
		for (const mutation of [
			{
				...input,
				component: input.component.replace(
					"selector: 'app-iframe'",
					"selector: 'app-frame'",
				),
			},
			{
				...input,
				module: input.module.replace(
					'        IframeComponent,\n',
					'        IframeComponent,\n        IframeComponent,\n',
				),
			},
			{ ...input, spec: input.spec.replace('declarations:', 'providers:') },
		])
			expect(() => transformFuxaIframeStandalone(mutation)).toThrow('Refused:');
		const invalid = {
			...input,
			component: input.component.replace(
				'export class IframeComponent',
				'export class IframeComponent {',
			),
		};
		expect(() => transformFuxaIframeStandalone(invalid)).toThrow('Yuku diagnostics');
	});
});

describe('exact FUXA gauge standalone cohort composition', () => {
	it('applies seven gauge spans and preserves inheritance, static methods, and imports', async () => {
		const input = await gaugeSources();
		const result = transformFuxaGaugeStandalone(input);
		expect(result.edits).toHaveLength(7);
		expect(result.targetHashes).toEqual({
			progressComponent: FUXA_GAUGE_PROGRESS_TARGET_SHA256,
			progressSpec: FUXA_GAUGE_PROGRESS_SPEC_TARGET_SHA256,
			semaphoreComponent: FUXA_GAUGE_SEMAPHORE_TARGET_SHA256,
			semaphoreSpec: FUXA_GAUGE_SEMAPHORE_SPEC_TARGET_SHA256,
			module: 'e788bf3a545028949338334026740b3ac53dc822007119687c5b834b3d97eada',
		});
		for (const preserved of [
			'extends GaugeBaseComponent',
			'static getSignals',
			'static processValue',
			"import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';",
		]) {
			expect(result.files.progressComponent).toContain(preserved);
			expect(result.files.semaphoreComponent).toContain(preserved);
		}
		expect(result.files.progressComponent).toContain(
			"standalone: true,\n    selector: 'gauge-progress'",
		);
		expect(result.files.semaphoreComponent).toContain(
			"standalone: true,\n    selector: 'gauge-semaphore'",
		);
	});

	it('converges from distinct iframe-first and gauges-first traces to seven files and eleven spans', async () => {
		const iframeInput = await sources();
		const gaugeInput = await gaugeSources();
		const iframeFirst = transformFuxaIframeStandalone(iframeInput);
		const gaugesAfterIframe = transformFuxaGaugeStandalone({
			...gaugeInput,
			module: iframeFirst.files.module,
		});
		const gaugesFirst = transformFuxaGaugeStandalone(gaugeInput);
		const iframeAfterGauges = transformFuxaIframeStandalone({
			...iframeInput,
			module: gaugesFirst.files.module,
		});
		expect(gaugesAfterIframe.files.module).toBe(iframeAfterGauges.files.module);
		expect(sha256(gaugesAfterIframe.files.module)).toBe(FUXA_COHORT_MODULE_TARGET_SHA256);
		expect([...iframeFirst.edits, ...gaugesAfterIframe.edits]).toHaveLength(11);
		expect([...gaugesFirst.edits, ...iframeAfterGauges.edits]).toHaveLength(11);
		expect([...iframeFirst.edits, ...gaugesAfterIframe.edits]).not.toEqual([
			...gaugesFirst.edits,
			...iframeAfterGauges.edits,
		]);
		expect(transformFuxaGaugeStandalone({ ...gaugesAfterIframe.files }).idempotent).toBe(true);
		expect(
			transformFuxaIframeStandalone({
				component: iframeFirst.files.component,
				spec: iframeFirst.files.spec,
				module: gaugesAfterIframe.files.module,
			}).idempotent,
		).toBe(true);
	});

	it('refuses gauge source, inheritance, static-method, selector, and TestBed mutations', async () => {
		const input = await gaugeSources();
		for (const mutation of [
			{
				...input,
				progressComponent: input.progressComponent.replace(
					'extends GaugeBaseComponent',
					'',
				),
			},
			{
				...input,
				progressComponent: input.progressComponent.replace(
					'static getSignals',
					'getSignals',
				),
			},
			{
				...input,
				semaphoreComponent: input.semaphoreComponent.replace(
					"selector: 'gauge-semaphore'",
					"selector: 'semaphore'",
				),
			},
			{ ...input, semaphoreSpec: input.semaphoreSpec.replace('declarations:', 'providers:') },
		])
			expect(() => transformFuxaGaugeStandalone(mutation)).toThrow('Refused:');
	});
});
