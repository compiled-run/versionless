import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import {
	PHONE_ROUTE_RESOLVE_SOURCE_SHA256,
	PHONE_ROUTE_RESOLVE_TARGET_SHA256,
	transformPhoneRouteResolve,
} from '../src/phone-route-resolve.ts';
import { transformPhoneDetailLexicalThis } from '../src/phone-detail-lexical-this.ts';

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

describe('PhoneCat route resolve transform', () => {
	test('moves both data loads into resolves with one-way bindings and lifecycle image setup', async () => {
		const input = await sources();
		const result = transformPhoneRouteResolve(input);
		expect(result.files.flatMap((file) => file.edits)).toHaveLength(4);
		expect(result.code.appConfig).toContain('$resolve.phones');
		expect(result.code.appConfig).toContain('$resolve.phone');
		expect(result.code.appConfig).toContain('Phone.query().$promise');
		expect(result.code.phoneList).toContain("phones: '<'");
		expect(result.code.phoneDetail).toContain("phone: '<'");
		expect(result.code.phoneDetail).toContain('this.$onInit = () => {');
		expect(result.code.phoneDetail).not.toContain('Phone.get(');
		expect(transformPhoneRouteResolve(input).code).toEqual(result.code);
		const second = transformPhoneRouteResolve(result.code);
		expect(second.idempotent).toBe(true);
		expect(second.files.every((file) => file.edits.length === 0)).toBe(true);
		expect(second.code).toEqual(result.code);
	});

	test('accepts only the exact lexical-this intermediate and preserves final hashes', async () => {
		const input = await sources();
		const pristine = transformPhoneRouteResolve(input);
		const lexical = transformPhoneDetailLexicalThis(input.phoneDetail);
		const composed = transformPhoneRouteResolve({ ...input, phoneDetail: lexical.code });
		expect(composed.code).toEqual(pristine.code);
		expect(
			Object.fromEntries(composed.files.map((file) => [file.key, file.targetSha256])),
		).toEqual(PHONE_ROUTE_RESOLVE_TARGET_SHA256);
		expect(composed.preconditions).toContain('exact lexical-this PhoneDetail intermediate');
	});

	test('refuses changed hashes and ambiguous source shapes', async () => {
		const input = await sources();
		expect(() =>
			transformPhoneRouteResolve({ ...input, appConfig: `${input.appConfig}\n` }),
		).toThrow('SHA-256 mismatch');
		const ambiguous = input.appConfig.replace(
			"          template: '<phone-list></phone-list>'",
			"          template: '<phone-list></phone-list>'\n          template: '<phone-list></phone-list>'",
		);
		expect(() =>
			transformPhoneRouteResolve(
				{ ...input, appConfig: ambiguous },
				{ expectedSha256: { appConfig: PHONE_ROUTE_RESOLVE_SOURCE_SHA256.appConfig } },
			),
		).toThrow();
	});
});
