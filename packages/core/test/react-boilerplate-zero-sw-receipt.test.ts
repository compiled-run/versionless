import { describe, expect, it } from 'vitest';
import {
	REACT_BOILERPLATE_ZERO_SW_SUPERSEDES,
	parseReactBoilerplateZeroSwReceipt,
} from '../src/receipts/react-boilerplate-zero-sw.ts';

describe('React Boilerplate zero-SW receipt boundary', () => {
	it('pins append-only supersession to the current policy only', () => {
		expect(REACT_BOILERPLATE_ZERO_SW_SUPERSEDES.t060.sha256).toBe(
			'ea708cf382e4911057225cc732ee0e7cd294985c0c97690b8147e84d00e26954',
		);
		expect(REACT_BOILERPLATE_ZERO_SW_SUPERSEDES.witness.sha256).toBe(
			'39a12cc6defaad5c5103f69b272a83f1ea80cf9e625c6e6fff7daac50caab103',
		);
	});

	it('rejects an incomplete receipt', () => {
		expect(() => parseReactBoilerplateZeroSwReceipt({})).toThrow();
	});
});
