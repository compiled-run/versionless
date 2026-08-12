import { describe, expect, it } from 'vitest';
import {
	succeedRemovedEntryPointSymbols,
	DOCUMENTED_SYMBOL_SUCCESSORS,
	type RootSurfaceReading,
} from '../src/removed-entry-point-symbol-successor.ts';

/** The root surface rxjs@7.8.2 publishes, as the driver reads it. */
const rxjs: RootSurfaceReading = Object.freeze({
	package: 'rxjs',
	version: '7.8.2',
	specifier: 'rxjs/internal-compatibility',
	specifierResolves: false,
	rootExports: Object.freeze(['Observable', 'combineLatest', 'from', 'of', 'throwError']),
	complete: true,
});

const service = [
	"import {combineLatest, Observable, throwError} from 'rxjs';",
	"import {fromPromise} from 'rxjs/internal-compatibility';",
	"import {catchError, first} from 'rxjs/operators';",
	'',
	'export class JiraApiService {',
	'  send(promise) {',
	'    return fromPromise(promise).pipe(catchError((err) => throwError(err)), first());',
	'  }',
	'}',
	'',
].join('\n');

describe('succeedRemovedEntryPointSymbols', () => {
	it('writes the successor the installed root publishes, at the import and the call', () => {
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			service,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[rxjs],
		);
		expect(result.unhandled).toEqual([]);
		expect(result.changes).toEqual([
			{
				kind: 'removed-entry-point-symbol-successor',
				line: 2,
				specifier: 'rxjs/internal-compatibility',
				root: 'rxjs',
				from: 'fromPromise',
				to: 'from',
				callSites: 1,
			},
		]);
		expect(result.source).toContain("import {from} from 'rxjs';");
		expect(result.source).toContain('return from(promise).pipe(');
		expect(result.source).not.toContain('internal-compatibility');
		expect(result.source).not.toContain('fromPromise');
	});

	it('leaves the other rxjs declarations exactly as they are', () => {
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			service,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[rxjs],
		);
		expect(result.source).toContain("import {combineLatest, Observable, throwError} from 'rxjs';");
		expect(result.source).toContain("import {catchError, first} from 'rxjs/operators';");
	});

	it('refuses when the installed root does not publish the successor', () => {
		const without: RootSurfaceReading = {
			...rxjs,
			rootExports: Object.freeze(['Observable', 'of']),
		};
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			service,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[without],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain('does not publish from');
	});

	it('refuses when the root still publishes the name the claim replaces', () => {
		const still: RootSurfaceReading = {
			...rxjs,
			rootExports: Object.freeze([...rxjs.rootExports, 'fromPromise']),
		};
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			service,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[still],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain('publishes fromPromise, so the name did not go away');
	});

	it('refuses when the tree still answers the removed specifier', () => {
		const resolves: RootSurfaceReading = { ...rxjs, specifierResolves: true };
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			service,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[resolves],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain('still answers rxjs/internal-compatibility');
	});

	it('refuses an incomplete root reading', () => {
		const partial: RootSurfaceReading = { ...rxjs, complete: false };
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			service,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[partial],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain('is incomplete');
	});

	it('refuses a call at an arity the claim was not written for', () => {
		const twoArguments = service.replace('fromPromise(promise)', 'fromPromise(promise, scheduler)');
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			twoArguments,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[rxjs],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain('with 2 argument(s)');
	});

	it('refuses a symbol used as a value rather than called', () => {
		const passed = service.replace('fromPromise(promise)', 'wrap(fromPromise)(promise)');
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			passed,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[rxjs],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain('other than as the callee of a call');
	});

	it('refuses a whole declaration when one of its names has no successor', () => {
		const two = service.replace(
			"import {fromPromise} from 'rxjs/internal-compatibility';",
			"import {fromPromise, subscribeToResult} from 'rxjs/internal-compatibility';",
		);
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			two,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[rxjs],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain('no successor is written down for subscribeToResult');
	});

	it('refuses a namespace binding, whose members cannot be resolved by name', () => {
		const namespace = service.replace(
			"import {fromPromise} from 'rxjs/internal-compatibility';",
			"import * as compatibility from 'rxjs/internal-compatibility';",
		);
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			namespace,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[rxjs],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain('default or namespace binding');
	});

	it('refuses when the successor name is already bound in the module', () => {
		const bound = service.replace(
			'export class JiraApiService {',
			'const from = 1;\nexport class JiraApiService {',
		);
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			bound,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[rxjs],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain("already bound in this module's root scope");
	});

	it('refuses when no reading was taken for the package at all', () => {
		const result = succeedRemovedEntryPointSymbols(
			'jira-api.service.ts',
			service,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			[],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled.join(' ')).toContain('no root surface was read');
	});
});

describe('DOCUMENTED_SYMBOL_SUCCESSORS', () => {
	it('states each claim as a package, a removed specifier and a call shape', () => {
		for (const claim of DOCUMENTED_SYMBOL_SUCCESSORS) {
			expect(claim.specifier.startsWith(`${claim.package}/`)).toBe(true);
			expect(claim.from).not.toBe(claim.to);
			expect(claim.arity).toBeGreaterThanOrEqual(0);
			expect(claim.since).not.toBe('');
		}
	});
});
