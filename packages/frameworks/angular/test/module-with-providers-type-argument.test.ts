import { describe, expect, it } from 'vitest';
import { addModuleWithProvidersTypeArgument } from '../src/module-with-providers-type-argument.ts';

const header =
	"import {ModuleWithProviders, NgModule} from '@angular/core';\nimport {RouterModule} from '@angular/router';\nconst routes = [];\n";

describe('module with providers type argument', () => {
	it('reads the argument from the receiver of the static call the variable is initialised by', () => {
		const migration = addModuleWithProvidersTypeArgument(
			'src/app.routing.ts',
			`${header}export const routing: ModuleWithProviders = RouterModule.forRoot(routes);\n`,
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain('ModuleWithProviders<RouterModule>');
		expect(migration.changes[0]?.argument).toBe('RouterModule');
		expect(migration.changes[0]?.readFrom).toBe('static-call-receiver');
		expect(migration.unhandled).toEqual([]);
	});

	it('reads the argument from the class a static method with the annotation is declared on', () => {
		const migration = addModuleWithProvidersTypeArgument(
			'src/feature.module.ts',
			`${header}@NgModule({})\nexport class FeatureModule {\n  static forRoot(): ModuleWithProviders {\n    return {ngModule: FeatureModule};\n  }\n}\n`,
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain('ModuleWithProviders<FeatureModule>');
		expect(migration.changes[0]?.readFrom).toBe('enclosing-class');
	});

	it('follows the binding, so an aliased import of the type is still a site', () => {
		const migration = addModuleWithProvidersTypeArgument(
			'src/app.routing.ts',
			"import {ModuleWithProviders as MWP} from '@angular/core';\nimport {RouterModule} from '@angular/router';\nconst routes = [];\nexport const routing: MWP = RouterModule.forRoot(routes);\n",
		);
		expect(migration.source).toContain('MWP<RouterModule>');
	});

	it('leaves an annotation that already carries an argument alone', () => {
		const source = `${header}export const routing: ModuleWithProviders<RouterModule> = RouterModule.forRoot(routes);\n`;
		const migration = addModuleWithProvidersTypeArgument('src/app.routing.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});

	it('refuses a position that does not state the module', () => {
		const migration = addModuleWithProvidersTypeArgument(
			'src/thing.ts',
			`${header}export function take(value: ModuleWithProviders) {\n  return value;\n}\n`,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('Nothing in the source says which module it is');
	});

	it('refuses an initialiser whose receiver is not a bound identifier', () => {
		const migration = addModuleWithProvidersTypeArgument(
			'src/app.routing.ts',
			`${header}export const routing: ModuleWithProviders = makeModule().forRoot(routes);\n`,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toHaveLength(1);
	});

	it('reports nothing for a ModuleWithProviders that is not @angular/core’s', () => {
		const migration = addModuleWithProvidersTypeArgument(
			'src/app.routing.ts',
			"import {ModuleWithProviders} from './local-types';\nimport {RouterModule} from '@angular/router';\nconst routes = [];\nexport const routing: ModuleWithProviders = RouterModule.forRoot(routes);\n",
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});
});
