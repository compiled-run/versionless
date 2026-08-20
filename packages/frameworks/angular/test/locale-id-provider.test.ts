import { describe, expect, it } from 'vitest';
import {
	ANGULAR_13_BROWSER_CELL,
	ANGULAR_16_BROWSER_CELL,
	type AngularTargetCell,
} from '../src/angular-target-cell.ts';
import {
	ERA_LOCALE_FLAG,
	ERA_LOCALE_FLAG_REMOVED_AFTER_MAJOR,
	eraLocaleReadingOfRemovedFlag,
	isWritableLocaleValue,
	localeIdProviderSource,
	provideEraLocaleId,
	readEraLocaleFlagValue,
	type EraLocaleReading,
} from '../src/locale-id-provider.ts';
import { REMOVED_ANGULAR_CLI_FLAGS } from '../src/workspace-script-flags.ts';

/**
 * The measured pigallery2 root module, reduced to the shape the capability
 * reads: `LOCALE_ID` already imported from `@angular/core` as the `deps` of the
 * application's own `TRANSLATIONS` provider, a providers array, and a
 * bootstrapped component.
 */
const pigallery2 = `import {Injectable, LOCALE_ID, NgModule, TRANSLATIONS, TRANSLATIONS_FORMAT} from '@angular/core';
import {AppComponent} from './app.component';
import {UrlSerializer} from '@angular/router';

export function translationsFactory(locale: string) {
  locale = locale || 'en';
  if (locale === 'en') { return ''; }
  return require(\`raw-loader!../translate/messages.\${locale}.xlf\`);
}

@NgModule({
  declarations: [AppComponent],
  imports: [],
  providers: [
    {provide: UrlSerializer, useClass: CustomUrlSerializer},
    NetworkService,
    {
      provide: TRANSLATIONS,
      useFactory: translationsFactory,
      deps: [LOCALE_ID]
    },
    {provide: TRANSLATIONS_FORMAT, useValue: 'xlf'}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
`;

/** The reading the era build's own argv supplies, as u5b captures the span. */
const enReading = eraLocaleReadingOfRemovedFlag({
	script: 'build',
	from: '--i18n-locale en',
}) as EraLocaleReading;

const viewEngineCell: AngularTargetCell = Object.freeze({
	...ANGULAR_16_BROWSER_CELL,
	id: 'angular-8-view-engine',
	angularLine: '8.1',
});

describe('locale id provider', () => {
	it('reads the value out of the era flag span rather than choosing one', () => {
		expect(readEraLocaleFlagValue('--i18n-locale en')).toBe('en');
		expect(readEraLocaleFlagValue('--i18n-locale=hu')).toBe('hu');
		expect(readEraLocaleFlagValue('  --i18n-locale   pt-BR  ')).toBe('pt-BR');
		expect(readEraLocaleFlagValue('--i18n-locale')).toBeNull();
		expect(readEraLocaleFlagValue('--i18n-locale=')).toBeNull();
		expect(readEraLocaleFlagValue('--i18n-format=xlf')).toBeNull();
		expect(readEraLocaleFlagValue('--i18n-locale-ish en')).toBeNull();
		expect(eraLocaleReadingOfRemovedFlag({ script: 'build', from: '--prod' })).toBeNull();
		expect(enReading.locale).toBe('en');
		expect(enReading.readFrom).toContain('--i18n-locale en');
	});

	it('agrees with the removed-flag table about which CLI major dropped the flag', () => {
		const row = REMOVED_ANGULAR_CLI_FLAGS.find((flag) => flag.flag === ERA_LOCALE_FLAG);
		expect(row).toBeDefined();
		expect(row?.removedAfterMajor).toBe(ERA_LOCALE_FLAG_REMOVED_AFTER_MAJOR);
		expect(row?.successor).toBeNull();
		expect(row?.carriesValue).toBe(true);
	});

	it('writes the measured pigallery2 provider, extending no import because one is there', () => {
		const migration = provideEraLocaleId(
			'frontend/app/app.module.ts',
			pigallery2,
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(true);
		expect(migration.unhandled).toEqual([]);
		expect(migration.source).toContain("{provide: LOCALE_ID, useValue: 'en'},");
		// The application's own TRANSLATIONS provider and its deps are untouched.
		expect(migration.source).toContain('deps: [LOCALE_ID]');
		expect(migration.source).toContain(
			"import {Injectable, LOCALE_ID, NgModule, TRANSLATIONS, TRANSLATIONS_FORMAT} from '@angular/core';",
		);
		const change = migration.changes[0];
		expect(change?.kind).toBe('locale-id-provider');
		expect(change?.locale).toBe('en');
		expect(change?.moduleClass).toBe('AppModule');
		expect(change?.provider).toBe("{provide: LOCALE_ID, useValue: 'en'}");
		expect(change?.importExtended).toBe(false);
		expect(change?.providersPropertyAdded).toBe(false);
		expect(change?.readFrom).toBe(enReading.readFrom);
	});

	it('writes the provider first, so a provider the module already reaches still wins', () => {
		const migration = provideEraLocaleId(
			'frontend/app/app.module.ts',
			pigallery2,
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		const providers = migration.source.slice(migration.source.indexOf('providers: ['));
		expect(providers.indexOf("{provide: LOCALE_ID, useValue: 'en'}")).toBeLessThan(
			providers.indexOf('{provide: UrlSerializer'),
		);
		expect(migration.source).toContain(
			"  providers: [\n    {provide: LOCALE_ID, useValue: 'en'},\n    {provide: UrlSerializer",
		);
	});

	it('stands down with no reading supplied, and reports nothing unhandled for it', () => {
		const migration = provideEraLocaleId(
			'frontend/app/app.module.ts',
			pigallery2,
			null,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(pigallery2);
		expect(migration.changes).toEqual([]);
		expect(migration.unhandled).toEqual([]);
	});

	it('stands down on a cell whose CLI still parses the flag', () => {
		const migration = provideEraLocaleId(
			'frontend/app/app.module.ts',
			pigallery2,
			enReading,
			viewEngineCell,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});

	it('leaves a module that already provides LOCALE_ID exactly as it is', () => {
		const provided = pigallery2.replace(
			'    NetworkService,',
			"    NetworkService,\n    {provide: LOCALE_ID, useValue: 'hu'},",
		);
		const migration = provideEraLocaleId(
			'frontend/app/app.module.ts',
			provided,
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(provided);
		expect(migration.changes).toEqual([]);
		expect(migration.unhandled).toEqual([]);
	});

	it('detects an existing provider by any expression, not by the value it supplies', () => {
		const factory = pigallery2.replace(
			'    NetworkService,',
			'    NetworkService,\n    {provide: LOCALE_ID, useFactory: pickLocale, deps: [SettingsService]},',
		);
		expect(
			provideEraLocaleId(
				'frontend/app/app.module.ts',
				factory,
				enReading,
				ANGULAR_13_BROWSER_CELL,
			).changed,
		).toBe(false);
		const constant = pigallery2.replace('  providers: [', '  providers: [\n    ...COMMON,');
		const migration = provideEraLocaleId(
			'frontend/app/app.module.ts',
			`const COMMON = [{provide: LOCALE_ID, useValue: 'fr'}];\n${constant}`,
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});

	it('does not read `deps: [LOCALE_ID]` as a provider of it', () => {
		// The defect the capability answers is exactly a module that reads the
		// token and never supplies it.
		const migration = provideEraLocaleId(
			'frontend/app/app.module.ts',
			pigallery2,
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(true);
	});

	it('extends the existing @angular/core import when the token is not imported yet', () => {
		const source = pigallery2
			.replace(
				'import {Injectable, LOCALE_ID, NgModule, TRANSLATIONS, TRANSLATIONS_FORMAT}',
				'import {Injectable, NgModule, TRANSLATIONS, TRANSLATIONS_FORMAT}',
			)
			.replace('deps: [LOCALE_ID]', 'deps: []');
		const migration = provideEraLocaleId(
			'frontend/app/app.module.ts',
			source,
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(true);
		expect(migration.changes[0]?.importExtended).toBe(true);
		expect(migration.source).toContain(
			"import {Injectable, NgModule, TRANSLATIONS, TRANSLATIONS_FORMAT, LOCALE_ID} from '@angular/core';",
		);
		expect(migration.source.match(/from '@angular\/core'/gu)).toHaveLength(1);
	});

	it('honours the local name an aliased import binds the token under', () => {
		const source = pigallery2
			.replace('LOCALE_ID, NgModule', 'LOCALE_ID as NG_LOCALE, NgModule')
			.replace('deps: [LOCALE_ID]', 'deps: [NG_LOCALE]');
		const migration = provideEraLocaleId(
			'frontend/app/app.module.ts',
			source,
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.source).toContain("{provide: NG_LOCALE, useValue: 'en'},");
		expect(migration.changes[0]?.importExtended).toBe(false);
	});

	it('writes a providers array into a module literal that carries none', () => {
		const source = `import {NgModule} from '@angular/core';
import {AppComponent} from './app.component';

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent]
})
export class AppModule {
}
`;
		const migration = provideEraLocaleId(
			'src/app/app.module.ts',
			source,
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(true);
		expect(migration.changes[0]?.providersPropertyAdded).toBe(true);
		expect(migration.changes[0]?.importExtended).toBe(true);
		expect(migration.source).toContain(
			"  bootstrap: [AppComponent],\n  providers: [{provide: LOCALE_ID, useValue: 'en'}]",
		);
		expect(migration.source).toContain("import {NgModule, LOCALE_ID} from '@angular/core';");
	});

	it('carries a non-en locale through verbatim, because the value is data', () => {
		for (const locale of ['hu', 'pt-BR', 'zh-Hans-CN', 'sr-Cyrl']) {
			const reading = eraLocaleReadingOfRemovedFlag({
				script: 'build',
				from: `--i18n-locale=${locale}`,
			}) as EraLocaleReading;
			const migration = provideEraLocaleId(
				'frontend/app/app.module.ts',
				pigallery2,
				reading,
				ANGULAR_13_BROWSER_CELL,
			);
			expect(migration.changes[0]?.locale).toBe(locale);
			expect(migration.source).toContain(`{provide: LOCALE_ID, useValue: '${locale}'},`);
		}
	});

	it('refuses a supplied value that cannot be written into a string literal as itself', () => {
		expect(isWritableLocaleValue('en')).toBe(true);
		expect(isWritableLocaleValue('')).toBe(false);
		expect(isWritableLocaleValue("en'; drop")).toBe(false);
		expect(isWritableLocaleValue('en\\')).toBe(false);
		expect(isWritableLocaleValue('en US')).toBe(false);
		const migration = provideEraLocaleId(
			'frontend/app/app.module.ts',
			pigallery2,
			Object.freeze({ locale: "en');//", readFrom: 'a hand-supplied reading' }),
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toHaveLength(1);
		expect(migration.unhandled[0]).toContain('a hand-supplied reading');
	});

	it('is not a site for a feature module, which configures no root injector', () => {
		const source = `import {NgModule} from '@angular/core';

@NgModule({
  declarations: [],
  providers: []
})
export class FeatureModule {
}
`;
		const migration = provideEraLocaleId(
			'src/app/feature.module.ts',
			source,
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});

	it('writes nothing where two literals in one file both bootstrap', () => {
		const source = `import {NgModule} from '@angular/core';
import {AppComponent} from './app.component';

@NgModule({declarations: [AppComponent], providers: [], bootstrap: [AppComponent]})
export class AppModule {
}

@NgModule({declarations: [AppComponent], providers: [], bootstrap: [AppComponent]})
export class OtherModule {
}
`;
		const migration = provideEraLocaleId(
			'src/app/app.module.ts',
			source,
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toHaveLength(1);
		expect(migration.unhandled[0]).toContain('configures the root injector');
	});

	it('leaves a module with no @angular/core import alone', () => {
		const migration = provideEraLocaleId(
			'src/app/plain.ts',
			'export const value = 1;\n',
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});

	it('spells the provider through a namespace import rather than adding a second declaration', () => {
		const source = `import * as ng from '@angular/core';
import {AppComponent} from './app.component';

@ng.NgModule({
  declarations: [AppComponent],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
`;
		const migration = provideEraLocaleId(
			'src/app/app.module.ts',
			source,
			enReading,
			ANGULAR_13_BROWSER_CELL,
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain("providers: [{provide: ng.LOCALE_ID, useValue: 'en'}]");
		expect(migration.source.match(/from '@angular\/core'/gu)).toHaveLength(1);
	});

	it('spells one provider, and spells it the way the measured migration did', () => {
		expect(localeIdProviderSource('LOCALE_ID', 'en')).toBe(
			"{provide: LOCALE_ID, useValue: 'en'}",
		);
	});
});
