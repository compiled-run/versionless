import { analyze } from 'yuku-analyzer';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const FUXA_COMMIT = '8b323c177615c0d152a54e5ef0a6f98dae7b8ff0' as const;
export const FUXA_RECT_BINDING = `(click)="setMode('rect')"` as const;

type Files = Readonly<Record<string, string>>;
export type FuxaMigrationStep = Readonly<{
	from: 14 | 15;
	to: 15 | 16;
	files: Files;
	spans: readonly Readonly<{ path: string; before: string; after: string }>[];
	digest: string;
	yukuDiagnostics: 0;
}>;

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`FUXA ${label} must be an object`);
	return value as Record<string, unknown>;
}

function yukuGuard(files: Files): void {
	const source = files['src/app/editor/editor.component.ts'];
	if (!source) throw new Error('FUXA exact editor source is absent');
	const module = analyze(source, { lang: 'ts' });
	if (module.diagnostics.length)
		throw new Error(`FUXA Yuku diagnostics: ${JSON.stringify(module.diagnostics)}`);
	const template = files['src/app/editor/editor.component.html'];
	if (!template?.includes(FUXA_RECT_BINDING))
		throw new Error('FUXA rectangle mutation seam differs');
}

const frozen = {
	15: {
		angular: '15.2.3',
		cli: '15.2.6',
		eslint: '15.2.1',
		typescript: '4.8.4',
		zone: '0.12.0',
		typesNode: '18.15.11',
	},
	16: {
		angular: '16.2.11',
		cli: '16.2.8',
		eslint: '16.3.1',
		typescript: '5.1.6',
		zone: '0.13.3',
		typesNode: '18.15.11',
	},
} as const;

function frozenVersion(name: string, to: 15 | 16): string | undefined {
	const target = frozen[to];
	if (name === 'typescript') return target.typescript;
	if (name === 'zone.js') return target.zone;
	if (name === '@types/node') return target.typesNode;
	if (name === '@angular/cli' || name === '@angular-devkit/build-angular') return target.cli;
	if (name.startsWith('@angular-eslint/')) return target.eslint;
	if (name.startsWith('@angular/')) return target.angular;
	return undefined;
}

function transform(files: Files, from: 14 | 15, to: 15 | 16): FuxaMigrationStep {
	yukuGuard(files);
	const manifest = object(JSON.parse(files['package.json'] ?? ''), 'package manifest');
	const spans: Array<{ path: string; before: string; after: string }> = [];
	for (const field of ['dependencies', 'devDependencies']) {
		const dependencies = object(manifest[field], field);
		for (const name of Object.keys(dependencies)) {
			const before = dependencies[name];
			const after = frozenVersion(name, to) ?? before;
			if (before !== after) {
				dependencies[name] = after;
				spans.push({
					path: 'package.json',
					before: `${name}:${String(before)}`,
					after: `${name}:${String(after)}`,
				});
			}
		}
	}
	const next: Record<string, string> = {
		...files,
		'package.json': `${JSON.stringify(manifest, null, 2)}\n`,
	};
	if (to === 16) {
		const angular = files['angular.json'];
		if (!angular?.includes('@angular-devkit/build-angular:browser'))
			throw new Error('FUXA Angular browser builder seam differs');
		next['angular.json'] = angular.replace(
			'@angular-devkit/build-angular:browser',
			'@angular-devkit/build-angular:browser-esbuild',
		);
		spans.push({
			path: 'angular.json',
			before: '@angular-devkit/build-angular:browser',
			after: '@angular-devkit/build-angular:browser-esbuild',
		});
	}
	if (spans.length > 256 || new Set(spans.map((span) => span.path)).size > 64)
		throw new Error('FUXA migration exceeds the bounded edit budget');
	return {
		from,
		to,
		files: next,
		spans,
		digest: sha256(canonicalize(spans)),
		yukuDiagnostics: 0,
	};
}

export function transformFuxaAngular14To15(files: Files): FuxaMigrationStep {
	return transform(files, 14, 15);
}

export function transformFuxaAngular15To16(files: Files): FuxaMigrationStep {
	return transform(files, 15, 16);
}

export function mutateFuxaRectangleBinding(template: string): string {
	if (
		!template.includes(FUXA_RECT_BINDING) ||
		template.indexOf(FUXA_RECT_BINDING) !== template.lastIndexOf(FUXA_RECT_BINDING)
	)
		throw new Error('FUXA rectangle binding mutation seam is absent or ambiguous');
	return template.replace(FUXA_RECT_BINDING, `(click)="setMode('ellipse')"`);
}
