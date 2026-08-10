import { describe, expect, test } from 'vitest';
import {
	FUXA_RECT_BINDING,
	mutateFuxaRectangleBinding,
	transformFuxaAngular14To15,
	transformFuxaAngular15To16,
} from '../src/fuxa-angular14-to16.ts';

const files = {
	'package.json': JSON.stringify({
		dependencies: { '@angular/core': '^14.2.12' },
		devDependencies: {
			'@angular/cli': '^14.2.10',
			'@angular-devkit/build-angular': '^14.2.10',
			typescript: '~4.6.4',
		},
	}),
	'angular.json': '{"builder":"@angular-devkit/build-angular:browser"}',
	'src/app/editor/editor.component.ts': 'export class EditorComponent {}',
	'src/app/editor/editor.component.html': `<svg><use ${FUXA_RECT_BINDING}></use></svg>`,
};

describe('FUXA Angular 14 to 16 adapter', () => {
	test('applies sequential bounded Yuku-guarded dependency and browser-esbuild changes', () => {
		const v15 = transformFuxaAngular14To15(files);
		const v16 = transformFuxaAngular15To16(v15.files);
		expect(v15).toMatchObject({ from: 14, to: 15, yukuDiagnostics: 0 });
		expect(v16).toMatchObject({ from: 15, to: 16, yukuDiagnostics: 0 });
		expect(v16.files['angular.json']).toContain('browser-esbuild');
		expect(JSON.parse(v15.files['package.json']!)).toMatchObject({
			dependencies: { '@angular/core': '15.2.3' },
			devDependencies: {
				'@angular/cli': '15.2.6',
				'@angular-devkit/build-angular': '15.2.6',
				typescript: '4.8.4',
			},
		});
		expect(JSON.parse(v16.files['package.json']!)).toMatchObject({
			dependencies: { '@angular/core': '16.2.11' },
			devDependencies: {
				'@angular/cli': '16.2.8',
				'@angular-devkit/build-angular': '16.2.8',
				typescript: '5.1.6',
			},
		});
	});

	test('has an exact reversible rectangle mutation seam', () => {
		const template = files['src/app/editor/editor.component.html'];
		const mutated = mutateFuxaRectangleBinding(template);
		expect(mutated).not.toBe(template);
		expect(mutated.replace(`(click)="setMode('ellipse')"`, FUXA_RECT_BINDING)).toBe(template);
		expect(() => mutateFuxaRectangleBinding('no binding')).toThrow('absent or ambiguous');
	});
});
