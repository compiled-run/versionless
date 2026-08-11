import { describe, expect, it } from 'vitest';
import { migrateSentryV8Tracing } from '../src/sentry-v8-migration.ts';

/**
 * The shape an Angular CLI entry point written against Sentry 6 or 7 carries:
 * the SDK held as a namespace, the tracing package imported for its
 * `Integrations` object, and the browser tracing integration constructed inside
 * the `Sentry.init` options literal with both of the options v8 removed.
 */
const eraEntryPoint = `import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import * as Sentry from '@sentry/angular';
import { Integrations } from '@sentry/tracing';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

const initSentry = () => {
  Sentry.init({
    dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
    autoSessionTracking: true,
    integrations: [
      new Integrations.BrowserTracing({
        tracingOrigins: ['localhost', 'https://example.test/'],
        routingInstrumentation: Sentry.routingInstrumentation
      })
    ],

    tracesSampleRate: 1.0
  });
};

if (environment.production) {
  enableProdMode();
  initSentry();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
`;

const migratedEntryPoint = `import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import * as Sentry from '@sentry/angular';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

const initSentry = () => {
  Sentry.init({
    dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
    autoSessionTracking: true,
    integrations: [
      Sentry.browserTracingIntegration()
    ],

    tracesSampleRate: 1.0,
    tracePropagationTargets: ['localhost', 'https://example.test/']
  });
};

if (environment.production) {
  enableProdMode();
  initSentry();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
`;

describe('Sentry v8 browser tracing migration', () => {
	it('lifts an era entry point onto the v8 SDK, moving tracingOrigins up to init', () => {
		const migration = migrateSentryV8Tracing('src/main.ts', eraEntryPoint);
		expect(migration.changed).toBe(true);
		expect(migration.source).toBe(migratedEntryPoint);
		expect(migration.unhandled).toEqual([]);
		expect(migration.changes).toEqual([
			{
				kind: 'sentry-browser-tracing-integration',
				line: 13,
				from: 'new Integrations.BrowserTracing(…)',
				to: 'Sentry.browserTracingIntegration()',
			},
			{
				kind: 'sentry-trace-propagation-targets',
				line: 14,
				from: "tracingOrigins: ['localhost', 'https://example.test/']",
				to: "init option tracePropagationTargets: ['localhost', 'https://example.test/']",
			},
		]);
	});

	it('is idempotent: migrating the migrated entry point changes nothing further', () => {
		const first = migrateSentryV8Tracing('src/main.ts', eraEntryPoint);
		const second = migrateSentryV8Tracing('src/main.ts', first.source);
		expect(second.changed).toBe(false);
		expect(second.source).toBe(first.source);
	});

	it('follows an aliased namespace binding of the SDK', () => {
		const migration = migrateSentryV8Tracing(
			'src/main.ts',
			`import * as Telemetry from '@sentry/angular';
import { Integrations } from '@sentry/tracing';

Telemetry.init({
  dsn: 'x',
  integrations: [new Integrations.BrowserTracing({ routingInstrumentation: Telemetry.routingInstrumentation })]
});
`,
		);
		expect(migration.source).toBe(
			`import * as Telemetry from '@sentry/angular';

Telemetry.init({
  dsn: 'x',
  integrations: [Telemetry.browserTracingIntegration()]
});
`,
		);
		expect(migration.unhandled).toEqual([]);
	});

	it('follows the class imported by name and adds the factory to a named SDK import', () => {
		const migration = migrateSentryV8Tracing(
			'src/main.ts',
			`import { init } from '@sentry/angular';
import { BrowserTracing } from '@sentry/tracing';

init({
  dsn: 'x',
  integrations: [new BrowserTracing({ tracingOrigins: ['localhost'] })]
});
`,
		);
		expect(migration.source).toBe(
			`import { init, browserTracingIntegration } from '@sentry/angular';

init({
  dsn: 'x',
  integrations: [browserTracingIntegration()],
  tracePropagationTargets: ['localhost']
});
`,
		);
	});

	it('reuses a factory the module already imports rather than importing it twice', () => {
		const migration = migrateSentryV8Tracing(
			'src/main.ts',
			`import { init, browserTracingIntegration as tracing } from '@sentry/angular';
import { BrowserTracing } from '@sentry/tracing';

init({ dsn: 'x', integrations: [new BrowserTracing()] });
`,
		);
		expect(migration.source).toBe(
			`import { init, browserTracingIntegration as tracing } from '@sentry/angular';

init({ dsn: 'x', integrations: [tracing()] });
`,
		);
	});

	it('carries every option v8 kept through the factory verbatim', () => {
		const migration = migrateSentryV8Tracing(
			'src/main.ts',
			`import * as Sentry from '@sentry/angular';
import { Integrations } from '@sentry/tracing';

Sentry.init({
  dsn: 'x',
  integrations: [
    new Integrations.BrowserTracing({
      idleTimeout: 5000,
      tracingOrigins: ['localhost'],
      routingInstrumentation: Sentry.routingInstrumentation,
      traceFetch: false
    })
  ]
});
`,
		);
		expect(migration.source).toContain('idleTimeout: 5000');
		expect(migration.source).toContain('traceFetch: false');
		expect(migration.source).not.toContain('tracingOrigins');
		expect(migration.source).not.toContain('routingInstrumentation');
		expect(migration.source).toContain("tracePropagationTargets: ['localhost']");
	});
});

describe('Sentry v8 migration refusals', () => {
	it('leaves an Integrations imported from somewhere else alone', () => {
		const source = `import * as Sentry from '@sentry/angular';
import { Integrations } from 'some-other-library';
import { BrowserTracing } from '@sentry/tracing';

Sentry.init({ dsn: 'x', integrations: [new Integrations.BrowserTracing(), new BrowserTracing()] });
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.source).toContain('new Integrations.BrowserTracing()');
		expect(migration.source).toContain('Sentry.browserTracingIntegration()');
		expect(migration.source).not.toContain('@sentry/tracing');
		expect(migration.source).toContain("import { Integrations } from 'some-other-library';");
	});

	it('refuses to relocate tracingOrigins when no init call encloses the construction', () => {
		const source = `import * as Sentry from '@sentry/angular';
import { Integrations } from '@sentry/tracing';

const tracing = new Integrations.BrowserTracing({ tracingOrigins: ['localhost'] });
Sentry.init({ dsn: 'x', integrations: [tracing] });
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled.join(' ')).toContain('no @sentry/angular init options literal');
	});

	it('refuses when the init call already declares tracePropagationTargets', () => {
		const source = `import * as Sentry from '@sentry/angular';
import { Integrations } from '@sentry/tracing';

Sentry.init({
  dsn: 'x',
  tracePropagationTargets: ['https://api.example.test/'],
  integrations: [new Integrations.BrowserTracing({ tracingOrigins: ['localhost'] })]
});
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled.join(' ')).toContain('already declares tracePropagationTargets');
	});

	it('refuses an init call it cannot bind to the same Sentry module', () => {
		const source = `import * as Sentry from '@sentry/angular';
import { Integrations } from '@sentry/tracing';
import * as Other from 'other-telemetry';

Other.init({
  dsn: 'x',
  integrations: [new Integrations.BrowserTracing({ tracingOrigins: ['localhost'] })]
});
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('no @sentry/angular init options literal');
	});

	it('refuses a routingInstrumentation it cannot prove is the SDK own', () => {
		const source = `import * as Sentry from '@sentry/angular';
import { Integrations } from '@sentry/tracing';
import { customRouting } from './custom-routing';

Sentry.init({
  dsn: 'x',
  integrations: [new Integrations.BrowserTracing({ routingInstrumentation: customRouting })]
});
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled.join(' ')).toContain(
			'routingInstrumentation this capability cannot',
		);
	});

	it('refuses an options literal whose contents it cannot establish', () => {
		const source = `import * as Sentry from '@sentry/angular';
import { Integrations } from '@sentry/tracing';

Sentry.init({
  dsn: 'x',
  integrations: [new Integrations.BrowserTracing({ ...era, tracingOrigins: ['localhost'] })]
});
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('other than a plain object literal');
	});

	it('refuses every construction when no SDK import can name the v8 factory', () => {
		const source = `import { Integrations } from '@sentry/tracing';

export const integration = new Integrations.BrowserTracing();
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled.join(' ')).toContain(
			'no browserTracingIntegration could be established',
		);
	});

	it('refuses rather than shadowing a name the module already binds to the factory', () => {
		const source = `import { init } from '@sentry/angular';
import { BrowserTracing } from '@sentry/tracing';

function browserTracingIntegration() {}
init({ dsn: 'x', integrations: [new BrowserTracing()] });
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain(
			'no browserTracingIntegration could be established',
		);
	});

	it('refuses both constructions when two of them contest one tracePropagationTargets', () => {
		const source = `import * as Sentry from '@sentry/angular';
import { Integrations } from '@sentry/tracing';

Sentry.init({
  dsn: 'x',
  integrations: [
    new Integrations.BrowserTracing({ tracingOrigins: ['a'] }),
    new Integrations.BrowserTracing({ tracingOrigins: ['b'] })
  ]
});
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled.join(' ')).toContain('cannot carry both');
	});

	it('reports a namespace import of the removed tracing package instead of rewriting it', () => {
		const source = `import * as Sentry from '@sentry/angular';
import * as Tracing from '@sentry/tracing';

Sentry.init({ dsn: 'x', integrations: [new Tracing.Integrations.BrowserTracing()] });
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('namespace or default binding');
	});

	it('keeps an import of the removed package that still binds an export with no successor', () => {
		const source = `import * as Sentry from '@sentry/angular';
import { Integrations, addExtensionMethods } from '@sentry/tracing';

addExtensionMethods();
Sentry.init({ dsn: 'x', integrations: [new Integrations.BrowserTracing()] });
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.source).toContain(
			"import { addExtensionMethods } from '@sentry/tracing';",
		);
		expect(migration.source).toContain('Sentry.browserTracingIntegration()');
		expect(migration.unhandled.join(' ')).toContain('a package v8 removed with no successor');
	});

	it('leaves a module that never imports the removed package byte-identical', () => {
		const source = `import * as Sentry from '@sentry/angular';

Sentry.init({ dsn: 'x', integrations: [Sentry.browserTracingIntegration()] });
`;
		const migration = migrateSentryV8Tracing('src/main.ts', source);
		expect(migration.source).toBe(source);
		expect(migration.changed).toBe(false);
		expect(migration.changes).toEqual([]);
	});

	it('fails loudly on a module it cannot parse rather than counting it unchanged', () => {
		expect(() =>
			migrateSentryV8Tracing(
				'src/broken.ts',
				"import { Integrations } from '@sentry/tracing';\nconst = ;",
			),
		).toThrow('does not parse');
	});
});
