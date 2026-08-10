import { describe, expect, test } from 'vitest';
import { sqlpadPlacementPath } from '../src/fixture/react-sqlpad-v5-5-0-run.ts';

describe('SQLPad v5.5.0 production runner', () => {
	test('maps scoped npm-v1 placements inside the selected lane', () => {
		expect(sqlpadPlacementPath('/work/lane', 'client:react')).toBe(
			'/work/lane/client/node_modules/react',
		);
		expect(sqlpadPlacementPath('/work/lane', 'server:sequelize>lodash')).toBe(
			'/work/lane/server/node_modules/sequelize/node_modules/lodash',
		);
		for (const value of [
			'react',
			'other:react',
			'client:..',
			'client:/react',
			'client:react\\x',
		])
			expect(() => sqlpadPlacementPath('/work/lane', value)).toThrow();
	});
});
