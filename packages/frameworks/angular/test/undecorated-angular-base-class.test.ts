import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL, type AngularTargetCell } from '../src/angular-target-cell.ts';
import { decorateUndecoratedBaseClasses } from '../src/undecorated-angular-base-class.ts';

const base = `import {Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {Subscription} from 'rxjs';

export abstract class SettingsComponent<T> implements OnInit, OnDestroy {
  @Input()
  public simplifiedMode = true;

  @ViewChild('settingsForm', {static: true})
  form: HTMLFormElement;

  @Output()
  hasAvailableSettings = true;

  private sub: Subscription = null;

  ngOnInit(): void {}

  ngOnDestroy(): void {}
}
`;

const viewEngineCell: AngularTargetCell = Object.freeze({
	...ANGULAR_16_BROWSER_CELL,
	id: 'angular-8-view-engine',
	angularLine: '8.1',
});

describe('undecorated Angular base class', () => {
	it('synthesizes @Directive() on a class using Angular features and extends the existing import', () => {
		const migrated = decorateUndecoratedBaseClasses(
			'frontend/app/abstract.settings.component.ts',
			base,
			ANGULAR_16_BROWSER_CELL,
		);
		expect(migrated.changed).toBe(true);
		expect(migrated.source).toContain(
			"import {Input, OnDestroy, OnInit, Output, ViewChild, Directive} from '@angular/core';",
		);
		expect(migrated.source).toContain(
			'@Directive()\nexport abstract class SettingsComponent<T>',
		);
		expect(migrated.changes).toHaveLength(1);
		const [change] = migrated.changes;
		expect(change?.className).toBe('SettingsComponent');
		expect(change?.importAdded).toBe(false);
		expect(change?.features).toContain('implements OnInit');
		expect(change?.features).toContain('@Input on simplifiedMode');
		expect(migrated.unhandled).toHaveLength(0);
	});

	it('adds an import declaration when the module names @angular/core through no import it can extend', () => {
		const source = `import * as core from '@angular/core';

export abstract class Base implements core.OnInit {
  @core.Input() value = 1;

  ngOnInit(): void {}
}
`;
		const migrated = decorateUndecoratedBaseClasses('a.ts', source, ANGULAR_16_BROWSER_CELL);
		expect(migrated.changed).toBe(true);
		expect(migrated.source.startsWith("import {Directive} from '@angular/core';\n")).toBe(true);
		expect(migrated.changes[0]?.importAdded).toBe(true);
	});

	it('is idempotent: a decorated class is already answered and gets no second decorator', () => {
		const once = decorateUndecoratedBaseClasses('a.ts', base, ANGULAR_16_BROWSER_CELL);
		const twice = decorateUndecoratedBaseClasses('a.ts', once.source, ANGULAR_16_BROWSER_CELL);
		expect(twice.changed).toBe(false);
		expect(twice.source).toBe(once.source);
		expect(twice.changes).toHaveLength(0);
	});

	it('leaves a class that uses no Angular feature exactly as it is', () => {
		const source = `import {Injector} from '@angular/core';

export abstract class Repository {
  constructor(private injector: Injector) {}

  find(id: string): string {
    return id;
  }
}
`;
		const migrated = decorateUndecoratedBaseClasses('a.ts', source, ANGULAR_16_BROWSER_CELL);
		expect(migrated.changed).toBe(false);
		expect(migrated.unhandled).toHaveLength(0);
	});

	it('does not act on a name that resolves to something other than @angular/core', () => {
		const source = `import {Input, OnInit} from './my-decorators';

export abstract class Base implements OnInit {
  @Input() value = 1;

  ngOnInit(): void {}
}
`;
		const migrated = decorateUndecoratedBaseClasses('a.ts', source, ANGULAR_16_BROWSER_CELL);
		expect(migrated.changed).toBe(false);
	});

	it('reports rather than decorates a class that already carries an unreadable decorator', () => {
		const source = `import {Input} from '@angular/core';
import {Mixin} from 'some-library';

@Mixin()
export abstract class Base {
  @Input() value = 1;
}
`;
		const migrated = decorateUndecoratedBaseClasses('a.ts', source, ANGULAR_16_BROWSER_CELL);
		expect(migrated.changed).toBe(false);
		expect(migrated.unhandled.join(' ')).toContain('left exactly as it is');
	});

	it('leaves an already Angular-decorated class alone', () => {
		const source = `import {Component, Input} from '@angular/core';

@Component({selector: 'app-x', template: ''})
export class X {
  @Input() value = 1;
}
`;
		const migrated = decorateUndecoratedBaseClasses('a.ts', source, ANGULAR_16_BROWSER_CELL);
		expect(migrated.changed).toBe(false);
		expect(migrated.unhandled).toHaveLength(0);
	});

	it('stands down on a cell whose compiler still inherits metadata', () => {
		const migrated = decorateUndecoratedBaseClasses('a.ts', base, viewEngineCell);
		expect(migrated.changed).toBe(false);
		expect(migrated.changes).toHaveLength(0);
	});
});
