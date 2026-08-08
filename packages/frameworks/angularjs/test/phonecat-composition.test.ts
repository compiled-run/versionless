import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import { transformPhoneDetailLexicalThis } from '../src/phone-detail-lexical-this.ts';
import { transformPhoneRouteResolve } from '../src/phone-route-resolve.ts';

const root = path.resolve(import.meta.dirname, '../../../..');

async function sources() {
	const source = path.join(root, '.versionless/cache/angular-phonecat/source');
	return {
		appConfig: await readFile(path.join(source, 'app/app.config.js'), 'utf8'),
		phoneList: await readFile(
			path.join(source, 'app/phone-list/phone-list.component.js'),
			'utf8',
		),
		phoneDetail: await readFile(
			path.join(source, 'app/phone-detail/phone-detail.component.js'),
			'utf8',
		),
	};
}

describe('PhoneCat transform composition', () => {
	test('is order-independent across the two exact known intermediate shapes', async () => {
		const input = await sources();
		const lexicalFirst = transformPhoneDetailLexicalThis(input.phoneDetail);
		const lexicalThenRoute = transformPhoneRouteResolve({
			...input,
			phoneDetail: lexicalFirst.code,
		});

		const routeFirst = transformPhoneRouteResolve(input);
		const routeThenLexical = transformPhoneDetailLexicalThis(routeFirst.code.phoneDetail);
		const routeThenLexicalFiles = {
			...routeFirst.code,
			phoneDetail: routeThenLexical.code,
		};

		expect(lexicalFirst.idempotent).toBe(false);
		expect(lexicalThenRoute.preconditions).toContain(
			'exact lexical-this PhoneDetail intermediate',
		);
		expect(routeFirst.idempotent).toBe(false);
		expect(routeThenLexical.idempotent).toBe(true);
		expect(routeThenLexicalFiles).toEqual(lexicalThenRoute.code);
		expect(lexicalThenRoute.files.map((file) => file.path)).toEqual([
			'app/app.config.js',
			'app/phone-list/phone-list.component.js',
			'app/phone-detail/phone-detail.component.js',
		]);
	});
});
