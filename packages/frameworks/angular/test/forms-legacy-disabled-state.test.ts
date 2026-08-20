import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL, type AngularTargetCell } from '../src/angular-target-cell.ts';
import {
	CALL_SET_DISABLED_STATE_OPTION,
	CALL_SET_DISABLED_STATE_TOKEN,
	declareLegacyCallSetDisabledState,
	LEGACY_CALL_SET_DISABLED_STATE,
	readControlValueAccessors,
} from '../src/forms-legacy-disabled-state.ts';

/**
 * The u19i shape, transcribed from the application this capability was found
 * on: a value accessor whose `setDisabledState` rebuilds the very `FormGroup`
 * the component's own debounced subscription is watching.
 */
const rebuildingAccessor = `import {Component} from '@angular/core';
import {ControlValueAccessor, FormBuilder, FormGroup, NG_VALUE_ACCESSOR} from '@angular/forms';

@Component({selector: 'app-normalized-message-input', template: ''})
export class NormalizedMessageInputComponent implements ControlValueAccessor {
  form: FormGroup;
  disabled = false;
  constructor(private formBuilder: FormBuilder) {}
  writeValue(value: string): void {}
  registerOnChange(fn: any): void {}
  registerOnTouched(fn: any): void {}
  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.form = this.formBuilder.group({displayedText: [{value: this.textToDisplay(), disabled: this.disabled}]});
  }
  textToDisplay(): string { return ''; }
}
`;

/** The same contract, implemented the way the method is meant to be. */
const togglingAccessor = `import {Component, ElementRef, Renderer2} from '@angular/core';
import {ControlValueAccessor} from '@angular/forms';

@Component({selector: 'app-toggle', template: ''})
export class ToggleComponent implements ControlValueAccessor {
  disabled = false;
  constructor(private renderer: Renderer2, private host: ElementRef) {}
  writeValue(value: string): void {}
  registerOnChange(fn: any): void {}
  registerOnTouched(fn: any): void {}
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.renderer.setProperty(this.host.nativeElement, 'disabled', isDisabled);
  }
}
`;

const rootModule = `import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {AppComponent} from './app.component';
import {TinyTranslatorService} from './model/tiny-translator.service';

@NgModule({
  declarations: [AppComponent],
  imports: [FormsModule, ReactiveFormsModule],
  providers: [
    TinyTranslatorService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
`;

const ANGULAR_14_CELL: AngularTargetCell = Object.freeze({
	...ANGULAR_16_BROWSER_CELL,
	id: 'angular-14-browser-test-cell',
	angularLine: '14.3',
});

describe('forms legacy disabled-state compatibility', () => {
	it('reads the u19i accessor as legacy and names the statement that makes it one', () => {
		const readings = readControlValueAccessors(
			'src/app/normalized-message-input/normalized-message-input.component.ts',
			rebuildingAccessor,
		);
		expect(readings).toHaveLength(1);
		const reading = readings[0]!;
		expect(reading.className).toBe('NormalizedMessageInputComponent');
		expect(reading.declaresSetDisabledState).toBe(true);
		expect(reading.legacy).toBe(true);
		expect(reading.effects).toHaveLength(1);
		expect(reading.effects[0]?.statement).toContain('this.form = this.formBuilder.group(');
		expect(reading.effects[0]?.why).toContain('this.form');
	});

	it('reads a toggle-only accessor as not legacy, flag and element plumbing alike', () => {
		const readings = readControlValueAccessors(
			'src/app/toggle/toggle.component.ts',
			togglingAccessor,
		);
		expect(readings).toHaveLength(1);
		expect(readings[0]?.declaresSetDisabledState).toBe(true);
		expect(readings[0]?.effects).toEqual([]);
		expect(readings[0]?.legacy).toBe(false);
	});

	it('provides the era call-site behaviour in the bootstrapping module for the u19i shape', () => {
		const declaration = declareLegacyCallSetDisabledState({
			modules: [
				{ path: 'src/app/app.module.ts', source: rootModule },
				{
					path: 'src/app/normalized-message-input/normalized-message-input.component.ts',
					source: rebuildingAccessor,
				},
			],
			cell: ANGULAR_16_BROWSER_CELL,
		});
		expect(declaration.declared).toBe(true);
		expect(declaration.unhandled).toEqual([]);
		expect(declaration.change?.path).toBe('src/app/app.module.ts');
		expect(declaration.change?.token).toBe(CALL_SET_DISABLED_STATE_TOKEN);
		expect(declaration.change?.configuredModules).toEqual([
			'FormsModule',
			'ReactiveFormsModule',
		]);
		const source = declaration.rootModule?.source ?? '';
		expect(source).toContain(
			`  imports: [FormsModule.withConfig({${CALL_SET_DISABLED_STATE_OPTION}: ` +
				`'${LEGACY_CALL_SET_DISABLED_STATE}'}), ReactiveFormsModule.withConfig({` +
				`${CALL_SET_DISABLED_STATE_OPTION}: '${LEGACY_CALL_SET_DISABLED_STATE}'})],`,
		);
		expect(source).toContain(
			"import {FormsModule, ReactiveFormsModule} from '@angular/forms';",
		);
		expect(source).toContain('  bootstrap: [AppComponent]');
		expect(declaration.declaredDifferences[0]).toContain('NormalizedMessageInputComponent');
	});

	it('refuses when every accessor only toggles its disabled state', () => {
		const declaration = declareLegacyCallSetDisabledState({
			modules: [
				{ path: 'src/app/app.module.ts', source: rootModule },
				{ path: 'src/app/toggle/toggle.component.ts', source: togglingAccessor },
			],
			cell: ANGULAR_16_BROWSER_CELL,
		});
		expect(declaration.declared).toBe(false);
		expect(declaration.rootModule).toBeNull();
		expect(declaration.change).toBeNull();
		expect(declaration.accessors).toHaveLength(1);
		expect(declaration.unhandled[0]).toContain('none declares a');
	});

	it('refuses on a line that does not publish the token', () => {
		const declaration = declareLegacyCallSetDisabledState({
			modules: [
				{ path: 'src/app/app.module.ts', source: rootModule },
				{
					path: 'src/app/normalized-message-input/normalized-message-input.component.ts',
					source: rebuildingAccessor,
				},
			],
			cell: ANGULAR_14_CELL,
		});
		expect(declaration.declared).toBe(false);
		expect(declaration.unhandled[0]).toContain('Angular 14.3');
	});

	it('refuses when no module bootstraps the application', () => {
		const declaration = declareLegacyCallSetDisabledState({
			modules: [
				{
					path: 'src/app/normalized-message-input/normalized-message-input.component.ts',
					source: rebuildingAccessor,
				},
			],
			cell: ANGULAR_16_BROWSER_CELL,
		});
		expect(declaration.declared).toBe(false);
		expect(declaration.unhandled[0]).toContain('`bootstrap` property');
	});

	it('refuses when the bootstrapping literal imports no configurable forms module', () => {
		const declaration = declareLegacyCallSetDisabledState({
			modules: [
				{
					path: 'src/app/app.module.ts',
					source: rootModule.replace(
						'imports: [FormsModule, ReactiveFormsModule],',
						'imports: [],',
					),
				},
				{
					path: 'src/app/normalized-message-input/normalized-message-input.component.ts',
					source: rebuildingAccessor,
				},
			],
			cell: ANGULAR_16_BROWSER_CELL,
		});
		expect(declaration.declared).toBe(false);
		expect(declaration.unhandled[0]).toContain('not on its published export surface');
	});

	it('reads no accessor out of a class implementing a same-named interface of its own', () => {
		const readings = readControlValueAccessors(
			'src/app/local.ts',
			`import {ControlValueAccessor} from './own-contract';\n` +
				`export class Local implements ControlValueAccessor {\n` +
				`  setDisabledState(isDisabled: boolean): void { this.rebuild(); }\n` +
				`  rebuild(): void {}\n}\n`,
		);
		expect(readings).toEqual([]);
	});
});
