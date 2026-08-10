import { describe, expect, it } from 'vitest';
import { qualifyPermissiveLicense } from '../src/rights/license.ts';

const mitBody = `MIT Expat License
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE.`;

const apacheBody = `Apache License
Version 2.0, January 2004
TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
Grant of Copyright License. Grant of Patent License. Redistribution.
Submission of Contributions. Trademarks. Disclaimer of Warranty.
Limitation of Liability. END OF TERMS AND CONDITIONS`;

describe('content-semantic permissive license qualification', () => {
	it('accepts canonical MIT Expat content without brittle title matching', () => {
		expect(qualifyPermissiveLicense(mitBody)).toEqual({
			family: 'MIT',
			method: 'content-semantic',
			corroboration: 'title',
			legalCertification: false,
		});
	});

	it('accepts MIT through normalized SPDX corroboration when the title is absent', () => {
		expect(
			qualifyPermissiveLicense(mitBody.replace('MIT Expat License\n', ''), ' MIT '),
		).toMatchObject({ family: 'MIT', corroboration: 'spdx' });
	});

	it('accepts canonical Apache 2 variants', () => {
		expect(qualifyPermissiveLicense(apacheBody)).toMatchObject({
			family: 'Apache-2.0',
			corroboration: 'title',
		});
		expect(qualifyPermissiveLicense(apacheBody, 'Apache-2.0')).toMatchObject({
			family: 'Apache-2.0',
			corroboration: 'spdx',
		});
	});

	it('rejects partial, spoofed, conflicting, and mixed text', () => {
		expect(qualifyPermissiveLicense('MIT License Permission is hereby granted')).toBeNull();
		expect(qualifyPermissiveLicense('This is not the MIT License', 'MIT')).toBeNull();
		expect(qualifyPermissiveLicense(mitBody, 'Apache-2.0')).toBeNull();
		expect(qualifyPermissiveLicense(`${mitBody}\n${apacheBody}`)).toBeNull();
	});
});
