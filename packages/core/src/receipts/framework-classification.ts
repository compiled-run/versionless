import { charIn, createRegExp } from 'magic-regexp';
import { canonicalize, sha256 } from './canonicalize.ts';

export const FRAMEWORK_CLASSIFICATION_SCHEMA = 'versionless.framework-classification.v1' as const;

export const NOT_TESTED_EXECUTION = {
	provenance: 'not-tested',
	migration: 'not-tested',
	build: 'not-tested',
	browser: 'not-tested',
	locality: 'not-tested',
	compilerBundlerRuntime: 'not-tested',
	tier: 'not-tested',
	pilot: 'not-tested',
	support: 'not-tested',
} as const;

export type FrameworkKind = 'react' | 'nextjs';
export type NotTestedExecution = typeof NOT_TESTED_EXECUTION;

export interface FrameworkClassificationReceipt {
	schemaVersion: typeof FRAMEWORK_CLASSIFICATION_SCHEMA;
	descriptor: {
		id: string;
		sha256: string;
		synthetic: true;
	};
	classification: {
		framework: FrameworkKind;
		adapter: 'generic-react' | 'nextjs';
		inventory: Record<string, unknown>;
	};
	execution: NotTestedExecution;
	locality: {
		mode: 'offline';
		networkAttempts: 0;
		candidateExecution: 'not-requested';
	};
	claims: {
		authenticity: 'not-established';
		certification: 'not-claimed';
		compliance: 'not-claimed';
		osWideIsolation: 'not-established';
	};
	limitations: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
}

const sha256Pattern = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Framework classification ${label} must be an object`);
	return value as Record<string, unknown>;
}

function exactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
	label: string,
): void {
	const actual = Object.keys(value).sort();
	const wanted = [...expected].sort();
	if (canonicalize(actual) !== canonicalize(wanted))
		throw new Error(`Framework classification ${label} fields are invalid`);
}

export function frameworkClassificationDigest(receipt: FrameworkClassificationReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

export function createFrameworkClassificationReceipt(input: {
	descriptor: unknown;
	id: string;
	framework: FrameworkKind;
	adapter: 'generic-react' | 'nextjs';
	inventory: Record<string, unknown>;
}): FrameworkClassificationReceipt {
	const receipt: FrameworkClassificationReceipt = {
		schemaVersion: FRAMEWORK_CLASSIFICATION_SCHEMA,
		descriptor: {
			id: input.id,
			sha256: sha256(canonicalize(input.descriptor)),
			synthetic: true,
		},
		classification: {
			framework: input.framework,
			adapter: input.adapter,
			inventory: input.inventory,
		},
		execution: { ...NOT_TESTED_EXECUTION },
		locality: {
			mode: 'offline',
			networkAttempts: 0,
			candidateExecution: 'not-requested',
		},
		claims: {
			authenticity: 'not-established',
			certification: 'not-claimed',
			compliance: 'not-claimed',
			osWideIsolation: 'not-established',
		},
		limitations: [
			'Classification records explicit synthetic descriptor facts only.',
			'No real candidate, migration, build, browser journey, runtime, or support was tested.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = frameworkClassificationDigest(receipt);
	return receipt;
}

export function parseFrameworkClassificationReceipt(
	value: unknown,
): FrameworkClassificationReceipt {
	const root = record(value, 'root');
	exactKeys(
		root,
		[
			'schemaVersion',
			'descriptor',
			'classification',
			'execution',
			'locality',
			'claims',
			'limitations',
			'integrity',
		],
		'root',
	);
	if (root.schemaVersion !== FRAMEWORK_CLASSIFICATION_SCHEMA)
		throw new Error('Unsupported framework classification schema');
	const descriptor = record(root.descriptor, 'descriptor');
	exactKeys(descriptor, ['id', 'sha256', 'synthetic'], 'descriptor');
	if (
		typeof descriptor.id !== 'string' ||
		descriptor.id.length === 0 ||
		typeof descriptor.sha256 !== 'string' ||
		!sha256Pattern.test(descriptor.sha256) ||
		descriptor.synthetic !== true
	)
		throw new Error('Framework classification descriptor is invalid');
	const classification = record(root.classification, 'classification');
	exactKeys(classification, ['framework', 'adapter', 'inventory'], 'classification');
	if (
		(classification.framework !== 'react' && classification.framework !== 'nextjs') ||
		(classification.adapter !== 'generic-react' && classification.adapter !== 'nextjs') ||
		(classification.framework === 'react' && classification.adapter !== 'generic-react') ||
		(classification.framework === 'nextjs' && classification.adapter !== 'nextjs')
	)
		throw new Error('Framework classification framework/adapter mismatch');
	record(classification.inventory, 'inventory');
	const execution = record(root.execution, 'execution');
	exactKeys(execution, Object.keys(NOT_TESTED_EXECUTION), 'execution');
	if (canonicalize(execution) !== canonicalize(NOT_TESTED_EXECUTION))
		throw new Error('Framework classification execution evidence must remain not-tested');
	const locality = record(root.locality, 'locality');
	exactKeys(locality, ['mode', 'networkAttempts', 'candidateExecution'], 'locality');
	if (
		locality.mode !== 'offline' ||
		locality.networkAttempts !== 0 ||
		locality.candidateExecution !== 'not-requested'
	)
		throw new Error('Framework classification locality must remain offline and unexecuted');
	const claims = record(root.claims, 'claims');
	exactKeys(claims, ['authenticity', 'certification', 'compliance', 'osWideIsolation'], 'claims');
	if (
		claims.authenticity !== 'not-established' ||
		claims.certification !== 'not-claimed' ||
		claims.compliance !== 'not-claimed' ||
		claims.osWideIsolation !== 'not-established'
	)
		throw new Error('Framework classification claims are strengthened');
	if (
		!Array.isArray(root.limitations) ||
		root.limitations.length < 2 ||
		root.limitations.some((item) => typeof item !== 'string' || item.length === 0)
	)
		throw new Error('Framework classification limitations are invalid');
	const integrity = record(root.integrity, 'integrity');
	exactKeys(integrity, ['algorithm', 'canonicalDigest'], 'integrity');
	const receipt = root as unknown as FrameworkClassificationReceipt;
	if (
		integrity.algorithm !== 'sha256' ||
		typeof integrity.canonicalDigest !== 'string' ||
		!sha256Pattern.test(integrity.canonicalDigest) ||
		frameworkClassificationDigest(receipt) !== integrity.canonicalDigest
	)
		throw new Error('Framework classification canonical digest mismatch');
	return receipt;
}
