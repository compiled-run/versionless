import { describe, expect, it } from 'vitest';
import {
	validateWitnessTransportDecision,
	type WitnessTransportDecision,
} from '../src/witness/playwright-host.ts';

describe('Witness real-app host boundary', () => {
	it('accepts only the bounded transport decision shape', () => {
		const decision: WitnessTransportDecision = {
			action: 'fulfill',
			status: 200,
			contentType: 'application/json',
			body: Buffer.from('{}'),
		};
		expect(validateWitnessTransportDecision(decision)).toEqual(decision);
		expect(validateWitnessTransportDecision({ action: 'continue' })).toEqual({
			action: 'continue',
		});
	});

	it('rejects an oversized synthetic transport body', () => {
		expect(() =>
			validateWitnessTransportDecision({
				action: 'fulfill',
				status: 200,
				contentType: 'application/octet-stream',
				body: Buffer.alloc(1_048_577),
			}),
		).toThrow('fixed boundary');
	});
});
