import { describe, expect, it } from 'vitest';
import {
	validateWitnessQualificationTypingMode,
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

	it('rejects fill-backed qualification typing modes', () => {
		expect(() =>
			validateWitnessQualificationTypingMode({ clear: true, keyEvents: true }),
		).toThrow('rejects fill-backed typing modes');
		expect(() =>
			validateWitnessQualificationTypingMode({ clear: false, keyEvents: false }),
		).toThrow('rejects fill-backed typing modes');
		expect(() =>
			validateWitnessQualificationTypingMode({ clear: false, keyEvents: true }),
		).not.toThrow();
	});
});
