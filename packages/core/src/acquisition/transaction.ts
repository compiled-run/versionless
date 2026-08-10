import { createHash } from 'node:crypto';
import { joinURL, parseURL, withQuery } from 'ufo';
import { canonicalize, sha256 } from '../receipts/canonicalize.ts';

export type AcquisitionHost = 'api.github.com' | 'codeload.github.com' | 'registry.npmjs.org';

export type ExactRequestDescriptor = Readonly<{
	host: AcquisitionHost;
	path: readonly string[];
	query?: Readonly<Record<string, string>>;
	purpose: string;
	responseKind: 'json' | 'archive' | 'artifact';
	intentionalDuplicateIndex?: 1 | 2;
}>;

export type AcquisitionObservation = Readonly<{
	method: 'GET';
	url: string;
	purpose: string;
	attempt: number;
	status: number | null;
	headersObserved: boolean;
	bodyBytes: number;
	acceptedResponse: boolean;
}>;

export type DurableResponseRecord = Readonly<{
	ordinal: number;
	method: 'GET';
	url: string;
	purpose: string;
	status: 200;
	headersObserved: true;
	bodyBytes: number;
	sha256: string;
	sha512: string;
	bodyFile: string;
	intentionalDuplicateIndex?: 1 | 2;
}>;

export type AcquisitionState = {
	acceptedResponses: number;
	aggregateBytes: number;
	observations: AcquisitionObservation[];
	ledger: DurableResponseRecord[];
};

export class AcquisitionFailure extends Error {
	readonly stage: string;
	readonly property: string;
	readonly expected: unknown;
	readonly observed: unknown;

	constructor(
		stage: string,
		property: string,
		expected: unknown,
		observed: unknown,
		message: string,
	) {
		super(message);
		this.stage = stage;
		this.property = property;
		this.expected = expected;
		this.observed = observed;
	}
}

const hostRoots: Readonly<Record<AcquisitionHost, string>> = {
	'api.github.com': 'https://api.github.com',
	'codeload.github.com': 'https://codeload.github.com',
	'registry.npmjs.org': 'https://registry.npmjs.org',
};

export function exactRequestUrl(descriptor: ExactRequestDescriptor): string {
	if (
		descriptor.path.length === 0 ||
		descriptor.path.some(
			(segment) =>
				segment.length === 0 ||
				segment === '.' ||
				segment === '..' ||
				segment.includes('/') ||
				segment.includes('\\'),
		)
	)
		throw new AcquisitionFailure(
			'transport',
			'descriptor-path',
			'non-empty encoded path segments',
			'invalid',
			'Acquisition descriptor path is invalid',
		);
	const joined = joinURL(hostRoots[descriptor.host], ...descriptor.path);
	const url = descriptor.query ? withQuery(joined, descriptor.query) : joined;
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== descriptor.host ||
		parsed.auth ||
		parsed.hash
	)
		throw new AcquisitionFailure(
			'transport',
			'canonical-url-readback',
			{ protocol: 'https:', host: descriptor.host },
			{ protocol: parsed.protocol, host: parsed.host },
			'Acquisition URL canonical readback differs',
		);
	return url;
}

export function responseRecord(
	descriptor: ExactRequestDescriptor,
	ordinal: number,
	body: Buffer,
): DurableResponseRecord {
	return {
		ordinal,
		method: 'GET',
		url: exactRequestUrl(descriptor),
		purpose: descriptor.purpose,
		status: 200,
		headersObserved: true,
		bodyBytes: body.byteLength,
		sha256: sha256(body),
		sha512: createHash('sha512').update(body).digest('hex'),
		bodyFile: `${String(ordinal).padStart(4, '0')}.body`,
		...(descriptor.intentionalDuplicateIndex === undefined
			? {}
			: { intentionalDuplicateIndex: descriptor.intentionalDuplicateIndex }),
	};
}

export const canonicalResponseRecord = (record: DurableResponseRecord): string =>
	canonicalize(record);
