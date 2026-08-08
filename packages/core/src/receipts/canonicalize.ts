import { createHash } from 'node:crypto';

export function canonicalize(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
	if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
		.join(',')}}`;
}

export function sha256(value: string | NodeJS.ArrayBufferView): string {
	return createHash('sha256').update(value).digest('hex');
}

export function receiptDigest(receipt: MigrationReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

import type { MigrationReceipt } from './schema.ts';
