import { createHash } from 'node:crypto';
import { analyze, SymbolFlags } from 'yuku-analyzer';

export const FUXA_IFRAME_COMPONENT_SHA256 =
	'6f3b8cd2ffbe72de14ecca6d59baf3b6f5170d735cab3d9726e1f8c0dd6632a1';
export const FUXA_IFRAME_TEMPLATE_SHA256 =
	'ef25d3411f36e1058ac0f54982b17d50cb671d2975a1c17a334ea48638e8f6b7';
export const FUXA_IFRAME_SPEC_SHA256 =
	'345f96ffd7351c99079c79a55b5e4c9d8cf6fc6e258b6bae310a28d72e28dbd4';
export const FUXA_APP_MODULE_SHA256 =
	'0b698414f692cdc21a81de7b0c3df734db854413d2c71515761f14ed3a4127c6';
export const FUXA_IFRAME_COMPONENT_TARGET_SHA256 =
	'b9c2cf40443e112965affad445790343c3c47adc89fc70f174bf841a9bde86e0';
export const FUXA_APP_MODULE_TARGET_SHA256 =
	'db8b6952d363191d2cf3c053fee4042b3a904855fd791d9f4072fc71c32b4df6';
export const FUXA_IFRAME_SPEC_TARGET_SHA256 =
	'63b0cf032ae6565cbca94d34abe4191f9aee3ca145e6c65613148e628c88ed6e';
export const FUXA_GAUGE_PROGRESS_SHA256 =
	'15963ee2093504de4fdebf1ec15a3be5bd12acf43267f8f853d0f6aa0f20ec12';
export const FUXA_GAUGE_PROGRESS_SPEC_SHA256 =
	'814cb8f638bc3b96160ba9cdfaaafbd1526f0b05c31b3ebc1fd05e14ed8bf96c';
export const FUXA_GAUGE_SEMAPHORE_SHA256 =
	'68be1fadbb2c68e46d7966d1dadf153365337ce3c3aa1ae47dfbd730f9dd5d72';
export const FUXA_GAUGE_SEMAPHORE_SPEC_SHA256 =
	'dbf57b559466ee957e9e119e33d95a8ba4551ee21771144668d9e32166bbe53e';
export const FUXA_GAUGE_PROGRESS_TARGET_SHA256 =
	'aff122436fad9ebd8feb243c2579e90afca1e54de4810918afe7f311c0a66be3';
export const FUXA_GAUGE_PROGRESS_SPEC_TARGET_SHA256 =
	'821e291e7ae016b80412ea25062fbd262778751cedf43acfb01fae42e2a25a30';
export const FUXA_GAUGE_SEMAPHORE_TARGET_SHA256 =
	'd02ffe2f1f9a34c14c37b3880e5626f378aa5827cb812bec7f4ccaffcce50a9a';
export const FUXA_GAUGE_SEMAPHORE_SPEC_TARGET_SHA256 =
	'bb99595e41ecba41845b65272d06b802527c7d6238ba35dc1639f6c7fae064d9';
export const FUXA_GAUGE_MODULE_TARGET_SHA256 =
	'e788bf3a545028949338334026740b3ac53dc822007119687c5b834b3d97eada';
export const FUXA_COHORT_MODULE_TARGET_SHA256 =
	'f73c07c89789af9b45d32e4b7067238952b125baf63b40e0dd1e9f684322c20c';

export type AngularStandaloneSources = Readonly<{
	component: string;
	module: string;
	spec: string;
}>;

export type AngularStandaloneEdit = Readonly<{
	file: string;
	start: number;
	end: number;
	beforeSha256: string;
	afterSha256: string;
}>;

export type AngularGaugeStandaloneSources = Readonly<{
	progressComponent: string;
	progressSpec: string;
	semaphoreComponent: string;
	semaphoreSpec: string;
	module: string;
}>;

export type AngularGaugeStandaloneTransform = Readonly<{
	files: AngularGaugeStandaloneSources;
	sourceHashes: Readonly<Record<keyof AngularGaugeStandaloneSources, string>>;
	targetHashes: Readonly<Record<keyof AngularGaugeStandaloneSources, string>>;
	edits: readonly AngularStandaloneEdit[];
	idempotent: boolean;
	semanticEngine: Readonly<{
		parser: 'yuku-parser@0.7.0';
		analyzer: 'yuku-analyzer@0.7.0';
		diagnostics: 0;
	}>;
}>;

export type AngularStandaloneTransform = Readonly<{
	files: AngularStandaloneSources;
	sourceHashes: Readonly<Record<keyof AngularStandaloneSources, string>>;
	targetHashes: Readonly<Record<keyof AngularStandaloneSources, string>>;
	edits: readonly AngularStandaloneEdit[];
	idempotent: boolean;
	semanticEngine: Readonly<{
		parser: 'yuku-parser@0.7.0';
		analyzer: 'yuku-analyzer@0.7.0';
		diagnostics: 0;
	}>;
}>;

const filePaths = {
	component: 'client/src/app/iframe/iframe.component.ts',
	module: 'client/src/app/app.module.ts',
	spec: 'client/src/app/iframe/iframe.component.spec.ts',
} as const;

const componentBefore = "@Component({\n    selector: 'app-iframe',";
const componentAfter = "@Component({\n    standalone: true,\n    selector: 'app-iframe',";
const moduleDeclaration = '        IframeComponent,\n';
const moduleImports = '    imports: [\n';
const moduleImportsAfter = '    imports: [\n        IframeComponent,\n';
const specBefore = '      declarations: [ IframeComponent ]';
const specAfter = '      imports: [ IframeComponent ]';
const progressComponentPath =
	'client/src/app/gauges/controls/gauge-progress/gauge-progress.component.ts';
const progressSpecPath =
	'client/src/app/gauges/controls/gauge-progress/gauge-progress.component.spec.ts';
const semaphoreComponentPath =
	'client/src/app/gauges/controls/gauge-semaphore/gauge-semaphore.component.ts';
const semaphoreSpecPath =
	'client/src/app/gauges/controls/gauge-semaphore/gauge-semaphore.component.spec.ts';
const progressDecoratorBefore = "@Component({\n    selector: 'gauge-progress',";
const progressDecoratorAfter =
	"@Component({\n    standalone: true,\n    selector: 'gauge-progress',";
const semaphoreDecoratorBefore = "@Component({\n    selector: 'gauge-semaphore',";
const semaphoreDecoratorAfter =
	"@Component({\n    standalone: true,\n    selector: 'gauge-semaphore',";
const progressDeclaration = '        GaugeProgressComponent,\n';
const semaphoreDeclaration = '        GaugeSemaphoreComponent,\n';
const gaugeImportsAfter =
	'    imports: [\n        GaugeProgressComponent,\n        GaugeSemaphoreComponent,\n';
const progressSpecBefore = '      declarations: [ GaugeProgressComponent ]';
const progressSpecAfter = '      imports: [ GaugeProgressComponent ]';
const semaphoreSpecBefore = '      declarations: [ GaugeSemaphoreComponent ]';
const semaphoreSpecAfter = '      imports: [ GaugeSemaphoreComponent ]';
const cohortIframeImportsAfter = `${gaugeImportsAfter}        IframeComponent,\n`;

function hash(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function count(source: string, needle: string): number {
	let total = 0;
	let offset = 0;
	while (true) {
		const found = source.indexOf(needle, offset);
		if (found < 0) return total;
		total += 1;
		offset = found + needle.length;
	}
}

function analyzeFile(source: string, key: keyof AngularStandaloneSources): void {
	const module = analyze(source, { lang: 'ts', path: filePaths[key] });
	if (module.diagnostics.length)
		throw new Error(`Refused: ${key} Yuku diagnostics: ${JSON.stringify(module.diagnostics)}`);
	const iframe = module.rootScope.find('IframeComponent');
	if (!iframe) throw new Error(`Refused: ${key} IframeComponent symbol is absent`);
	if (key !== 'component' && !iframe.has(SymbolFlags.Import))
		throw new Error(`Refused: ${key} IframeComponent is not the imported binding`);
	if (key === 'module' && iframe.references.length !== 1)
		throw new Error('Refused: AppModule IframeComponent reference count differs');
	if (key === 'spec' && iframe.references.length !== 4)
		throw new Error('Refused: TestBed IframeComponent reference count differs');
}

function analyzeGaugeFile(
	source: string,
	pathName: string,
	symbolName: 'GaugeProgressComponent' | 'GaugeSemaphoreComponent',
	references: number,
): void {
	const module = analyze(source, { lang: 'ts', path: pathName });
	if (module.diagnostics.length)
		throw new Error(
			`Refused: ${pathName} Yuku diagnostics: ${JSON.stringify(module.diagnostics)}`,
		);
	const symbol = module.rootScope.find(symbolName);
	if (!symbol) throw new Error(`Refused: ${pathName} ${symbolName} symbol is absent`);
	if (pathName.endsWith('.spec.ts') || pathName === filePaths.module) {
		if (!symbol.has(SymbolFlags.Import))
			throw new Error(`Refused: ${pathName} ${symbolName} is not imported`);
		if (symbol.references.length !== references)
			throw new Error(`Refused: ${pathName} ${symbolName} reference count differs`);
	}
}

function replaceExact(
	file: AngularStandaloneEdit['file'],
	source: string,
	before: string,
	after: string,
): { code: string; edit: AngularStandaloneEdit } {
	const start = source.indexOf(before);
	if (start < 0 || source.indexOf(before, start + 1) >= 0)
		throw new Error(`Refused: exact ${file} transform span is missing or ambiguous`);
	return {
		code: `${source.slice(0, start)}${after}${source.slice(start + before.length)}`,
		edit: {
			file,
			start,
			end: start + before.length,
			beforeSha256: hash(before),
			afterSha256: hash(after),
		},
	};
}

function sourceHashes(
	sources: AngularStandaloneSources,
): Record<keyof AngularStandaloneSources, string> {
	return {
		component: hash(sources.component),
		module: hash(sources.module),
		spec: hash(sources.spec),
	};
}

function alreadyMigrated(sources: AngularStandaloneSources): boolean {
	return (
		count(sources.component, componentAfter) === 1 &&
		count(sources.component, componentBefore) === 0 &&
		count(sources.module, moduleDeclaration) === 1 &&
		(count(sources.module, moduleImportsAfter) === 1 ||
			count(sources.module, cohortIframeImportsAfter) === 1) &&
		count(sources.spec, specAfter) === 1 &&
		count(sources.spec, specBefore) === 0
	);
}

export function transformFuxaIframeStandalone(
	sources: AngularStandaloneSources,
): AngularStandaloneTransform {
	for (const key of ['component', 'module', 'spec'] as const) analyzeFile(sources[key], key);
	if (alreadyMigrated(sources)) {
		const hashes = sourceHashes(sources);
		if (
			hashes.component !== FUXA_IFRAME_COMPONENT_TARGET_SHA256 ||
			(hashes.module !== FUXA_APP_MODULE_TARGET_SHA256 &&
				hashes.module !== FUXA_COHORT_MODULE_TARGET_SHA256) ||
			hashes.spec !== FUXA_IFRAME_SPEC_TARGET_SHA256
		)
			throw new Error('Refused: migrated FUXA standalone SHA-256 mismatch');
		return {
			files: sources,
			sourceHashes: hashes,
			targetHashes: hashes,
			edits: [],
			idempotent: true,
			semanticEngine: {
				parser: 'yuku-parser@0.7.0',
				analyzer: 'yuku-analyzer@0.7.0',
				diagnostics: 0,
			},
		};
	}
	const hashes = sourceHashes(sources);
	if (
		hashes.component !== FUXA_IFRAME_COMPONENT_SHA256 ||
		(hashes.module !== FUXA_APP_MODULE_SHA256 &&
			hashes.module !== FUXA_GAUGE_MODULE_TARGET_SHA256) ||
		hashes.spec !== FUXA_IFRAME_SPEC_SHA256
	)
		throw new Error('Refused: FUXA standalone source SHA-256 mismatch');
	if (
		count(sources.component, componentBefore) !== 1 ||
		count(sources.component, 'standalone:') !== 0
	)
		throw new Error('Refused: IframeComponent decorator shape differs');
	if (
		count(sources.module, "import { IframeComponent } from './iframe/iframe.component';") !==
			1 ||
		count(sources.module, moduleDeclaration) !== 1 ||
		count(sources.module, moduleImports) !== 1 ||
		count(sources.module, moduleImportsAfter) !== 0
	)
		throw new Error('Refused: AppModule IframeComponent shape differs');
	if (count(sources.spec, specBefore) !== 1 || count(sources.spec, specAfter) !== 0)
		throw new Error('Refused: TestBed IframeComponent shape differs');

	const component = replaceExact(
		filePaths.component,
		sources.component,
		componentBefore,
		componentAfter,
	);
	const declaration = replaceExact(filePaths.module, sources.module, moduleDeclaration, '');
	const iframeImportBefore =
		hashes.module === FUXA_GAUGE_MODULE_TARGET_SHA256 ? gaugeImportsAfter : moduleImports;
	const iframeImportAfter =
		hashes.module === FUXA_GAUGE_MODULE_TARGET_SHA256
			? cohortIframeImportsAfter
			: moduleImportsAfter;
	const imports = replaceExact(
		filePaths.module,
		declaration.code,
		iframeImportBefore,
		iframeImportAfter,
	);
	const spec = replaceExact(filePaths.spec, sources.spec, specBefore, specAfter);
	const files = { component: component.code, module: imports.code, spec: spec.code };
	for (const key of ['component', 'module', 'spec'] as const) analyzeFile(files[key], key);
	if (!alreadyMigrated(files)) throw new Error('Refused: transformed standalone shape differs');
	return {
		files,
		sourceHashes: hashes,
		targetHashes: sourceHashes(files),
		edits: [component.edit, declaration.edit, imports.edit, spec.edit],
		idempotent: false,
		semanticEngine: {
			parser: 'yuku-parser@0.7.0',
			analyzer: 'yuku-analyzer@0.7.0',
			diagnostics: 0,
		},
	};
}

function gaugeHashes(
	sources: AngularGaugeStandaloneSources,
): Record<keyof AngularGaugeStandaloneSources, string> {
	return {
		progressComponent: hash(sources.progressComponent),
		progressSpec: hash(sources.progressSpec),
		semaphoreComponent: hash(sources.semaphoreComponent),
		semaphoreSpec: hash(sources.semaphoreSpec),
		module: hash(sources.module),
	};
}

function gaugesMigrated(sources: AngularGaugeStandaloneSources): boolean {
	return (
		count(sources.progressComponent, progressDecoratorAfter) === 1 &&
		count(sources.progressSpec, progressSpecAfter) === 1 &&
		count(sources.semaphoreComponent, semaphoreDecoratorAfter) === 1 &&
		count(sources.semaphoreSpec, semaphoreSpecAfter) === 1 &&
		count(sources.module, progressDeclaration) === 1 &&
		count(sources.module, semaphoreDeclaration) === 1 &&
		(count(sources.module, gaugeImportsAfter) === 1 ||
			count(sources.module, cohortIframeImportsAfter) === 1)
	);
}

function analyzeGaugeSources(sources: AngularGaugeStandaloneSources): void {
	analyzeGaugeFile(sources.progressComponent, progressComponentPath, 'GaugeProgressComponent', 0);
	analyzeGaugeFile(sources.progressSpec, progressSpecPath, 'GaugeProgressComponent', 4);
	analyzeGaugeFile(
		sources.semaphoreComponent,
		semaphoreComponentPath,
		'GaugeSemaphoreComponent',
		0,
	);
	analyzeGaugeFile(sources.semaphoreSpec, semaphoreSpecPath, 'GaugeSemaphoreComponent', 4);
	analyzeGaugeFile(sources.module, filePaths.module, 'GaugeProgressComponent', 1);
	analyzeGaugeFile(sources.module, filePaths.module, 'GaugeSemaphoreComponent', 1);
}

export function transformFuxaGaugeStandalone(
	sources: AngularGaugeStandaloneSources,
): AngularGaugeStandaloneTransform {
	analyzeGaugeSources(sources);
	const hashes = gaugeHashes(sources);
	if (gaugesMigrated(sources)) {
		if (
			hashes.progressComponent !== FUXA_GAUGE_PROGRESS_TARGET_SHA256 ||
			hashes.progressSpec !== FUXA_GAUGE_PROGRESS_SPEC_TARGET_SHA256 ||
			hashes.semaphoreComponent !== FUXA_GAUGE_SEMAPHORE_TARGET_SHA256 ||
			hashes.semaphoreSpec !== FUXA_GAUGE_SEMAPHORE_SPEC_TARGET_SHA256 ||
			(hashes.module !== FUXA_GAUGE_MODULE_TARGET_SHA256 &&
				hashes.module !== FUXA_COHORT_MODULE_TARGET_SHA256)
		)
			throw new Error('Refused: migrated FUXA gauge cohort SHA-256 mismatch');
		return {
			files: sources,
			sourceHashes: hashes,
			targetHashes: hashes,
			edits: [],
			idempotent: true,
			semanticEngine: {
				parser: 'yuku-parser@0.7.0',
				analyzer: 'yuku-analyzer@0.7.0',
				diagnostics: 0,
			},
		};
	}
	if (
		hashes.progressComponent !== FUXA_GAUGE_PROGRESS_SHA256 ||
		hashes.progressSpec !== FUXA_GAUGE_PROGRESS_SPEC_SHA256 ||
		hashes.semaphoreComponent !== FUXA_GAUGE_SEMAPHORE_SHA256 ||
		hashes.semaphoreSpec !== FUXA_GAUGE_SEMAPHORE_SPEC_SHA256 ||
		(hashes.module !== FUXA_APP_MODULE_SHA256 &&
			hashes.module !== FUXA_APP_MODULE_TARGET_SHA256)
	)
		throw new Error('Refused: FUXA gauge cohort source SHA-256 mismatch');
	if (
		count(sources.progressComponent, progressDecoratorBefore) !== 1 ||
		count(sources.progressComponent, 'standalone:') !== 0 ||
		count(sources.semaphoreComponent, semaphoreDecoratorBefore) !== 1 ||
		count(sources.semaphoreComponent, 'standalone:') !== 0 ||
		count(sources.progressSpec, progressSpecBefore) !== 1 ||
		count(sources.semaphoreSpec, semaphoreSpecBefore) !== 1 ||
		count(sources.module, progressDeclaration) !== 1 ||
		count(sources.module, semaphoreDeclaration) !== 1 ||
		count(sources.module, gaugeImportsAfter) !== 0
	)
		throw new Error('Refused: FUXA gauge cohort exact shape differs');
	const progress = replaceExact(
		progressComponentPath,
		sources.progressComponent,
		progressDecoratorBefore,
		progressDecoratorAfter,
	);
	const semaphore = replaceExact(
		semaphoreComponentPath,
		sources.semaphoreComponent,
		semaphoreDecoratorBefore,
		semaphoreDecoratorAfter,
	);
	const progressRemoval = replaceExact(filePaths.module, sources.module, progressDeclaration, '');
	const semaphoreRemoval = replaceExact(
		filePaths.module,
		progressRemoval.code,
		semaphoreDeclaration,
		'',
	);
	const imports = replaceExact(
		filePaths.module,
		semaphoreRemoval.code,
		moduleImports,
		gaugeImportsAfter,
	);
	const progressSpec = replaceExact(
		progressSpecPath,
		sources.progressSpec,
		progressSpecBefore,
		progressSpecAfter,
	);
	const semaphoreSpec = replaceExact(
		semaphoreSpecPath,
		sources.semaphoreSpec,
		semaphoreSpecBefore,
		semaphoreSpecAfter,
	);
	const files = {
		progressComponent: progress.code,
		progressSpec: progressSpec.code,
		semaphoreComponent: semaphore.code,
		semaphoreSpec: semaphoreSpec.code,
		module: imports.code,
	};
	analyzeGaugeSources(files);
	if (!gaugesMigrated(files)) throw new Error('Refused: transformed gauge cohort shape differs');
	return {
		files,
		sourceHashes: hashes,
		targetHashes: gaugeHashes(files),
		edits: [
			progress.edit,
			semaphore.edit,
			progressRemoval.edit,
			semaphoreRemoval.edit,
			imports.edit,
			progressSpec.edit,
			semaphoreSpec.edit,
		],
		idempotent: false,
		semanticEngine: {
			parser: 'yuku-parser@0.7.0',
			analyzer: 'yuku-analyzer@0.7.0',
			diagnostics: 0,
		},
	};
}
