import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	ANGULAR_REALWORLD_V15_TO_V16_RECEIPT,
	ANGULAR_REALWORLD_V15_TO_V16_SUPPORT_ARTIFACTS,
	parseAngularRealworldV15ToV16Receipt,
	verifyAngularRealworldV15ToV16Evidence,
} from '../src/receipts/angular-realworld-v15-to-v16.ts';
import { verifyMigration } from '../../cli/src/fixture/angular-realworld-v15-to-v16-run.ts';

const root = path.resolve(import.meta.dirname, '../../..');

describe('Angular RealWorld v15-to-v16 heterogeneous receipt', () => {
	it('agrees with the accepted runner verifier and binds exactly twenty support artifacts', async () => {
		const value = JSON.parse(
			await readFile(path.join(root, ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path), 'utf8'),
		);
		const runner = verifyMigration(value);
		const core = await verifyAngularRealworldV15ToV16Evidence(root);
		expect(core.digest).toBe(runner.integrity.canonicalDigest);
		expect(core.artifacts).toBe(20);
		expect(ANGULAR_REALWORLD_V15_TO_V16_SUPPORT_ARTIFACTS).toHaveLength(20);
	});

	it('rejects receipt semantic tampering even when the object remains valid JSON', async () => {
		const value = JSON.parse(
			await readFile(path.join(root, ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path), 'utf8'),
		) as Record<string, unknown>;
		const tampered = structuredClone(value);
		(tampered.mutation as Record<string, unknown>).successfulNonLoopback = 1;
		expect(() => parseAngularRealworldV15ToV16Receipt(tampered)).toThrow('differs');
	});
});
