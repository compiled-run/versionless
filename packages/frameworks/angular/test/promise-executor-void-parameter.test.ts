import { describe, expect, it } from 'vitest';
import { parameteriseVoidPromiseExecutors } from '../src/promise-executor-void-parameter.ts';

const service = [
	'export class GoogleApiService {',
	'  logout() {',
	'    if (IS_ELECTRON) {',
	'      return new Promise((resolve) => {',
	'        resolve();',
	'      });',
	'    } else {',
	'      return new Promise((resolve) => {',
	'        resolve();',
	'      });',
	'    }',
	'  }',
	'}',
	'',
].join('\n');

describe('parameteriseVoidPromiseExecutors', () => {
	it('writes the type argument the compiler names, at every proven executor', () => {
		const result = parameteriseVoidPromiseExecutors('google-api.service.ts', service);
		expect(result.unhandled).toEqual([]);
		expect(result.changes).toEqual([
			{
				kind: 'promise-executor-void-parameter',
				line: 4,
				parameter: 'resolve',
				callSites: 1,
			},
			{
				kind: 'promise-executor-void-parameter',
				line: 8,
				parameter: 'resolve',
				callSites: 1,
			},
		]);
		expect(result.source.match(/new Promise<void>\(/gu)).toHaveLength(2);
		expect(result.source).not.toContain('new Promise((resolve)');
	});

	it('touches the constructor and nothing else — not the executor, not the call', () => {
		const result = parameteriseVoidPromiseExecutors('google-api.service.ts', service);
		expect(result.source).toBe(service.replaceAll('new Promise(', 'new Promise<void>('));
	});

	it('refuses an executor that settles the promise with a value', () => {
		const source = [
			'const ready = new Promise((resolve) => {',
			'  if (done) resolve();',
			'  else resolve(value);',
			'});',
			'',
		].join('\n');
		const result = parameteriseVoidPromiseExecutors('ready.ts', source);
		expect(result.changed).toBe(false);
		expect(result.unhandled).toHaveLength(1);
		expect(result.unhandled[0]).toContain('is called at line 3 with 1 argument(s)');
		expect(result.unhandled[0]).toContain('void is the wrong type argument');
	});

	it('refuses a resolve that escapes the executor', () => {
		const source = [
			'const ready = new Promise((resolve) => {',
			'  if (done) resolve();',
			'  else other.then(resolve);',
			'});',
			'',
		].join('\n');
		const result = parameteriseVoidPromiseExecutors('ready.ts', source);
		expect(result.changed).toBe(false);
		expect(result.unhandled).toHaveLength(1);
		expect(result.unhandled[0]).toContain('other than as the callee of a call');
	});

	it('refuses when the module binds its own Promise', () => {
		const source = [
			"import Promise from 'bluebird';",
			'const ready = new Promise((resolve) => {',
			'  resolve();',
			'});',
			'',
		].join('\n');
		const result = parameteriseVoidPromiseExecutors('ready.ts', source);
		expect(result.changed).toBe(false);
		expect(result.unhandled).toHaveLength(1);
		expect(result.unhandled[0]).toContain('root scope binds the name Promise');
	});

	it('says nothing about an executor that already carries a type argument', () => {
		const source = 'const ready = new Promise<void>((resolve) => resolve());\n';
		const result = parameteriseVoidPromiseExecutors('ready.ts', source);
		expect(result.changed).toBe(false);
		expect(result.unhandled).toEqual([]);
	});

	it('says nothing about an executor that never settles with nothing', () => {
		const source = 'const ready = new Promise((resolve) => resolve(1));\n';
		const result = parameteriseVoidPromiseExecutors('ready.ts', source);
		expect(result.changed).toBe(false);
		expect(result.unhandled).toEqual([]);
	});

	it('resolves the parameter by binding, not by name', () => {
		const source = [
			'function outer(resolve) {',
			'  resolve(1);',
			'  return new Promise((resolve) => {',
			'    resolve();',
			'  });',
			'}',
			'',
		].join('\n');
		const result = parameteriseVoidPromiseExecutors('outer.ts', source);
		expect(result.unhandled).toEqual([]);
		expect(result.changes).toHaveLength(1);
		expect(result.source).toContain('new Promise<void>((resolve)');
		expect(result.source).toContain('  resolve(1);');
	});
});
