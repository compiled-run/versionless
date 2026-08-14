/**
 * Re-emit the machine-readable capability-coverage record from its derivation.
 *
 * The published record is a rendering of {@link buildCapabilityCoverage} and
 * nothing else: this driver writes it with the same serialization the trust
 * generator uses, so the two cannot drift while a capability is being added.
 */

import { writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { buildCapabilityCoverage } from '../../../core/src/receipts/capability-coverage.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export async function main(): Promise<void> {
	const file = path.join(repositoryRoot, 'evidence/trust/current/capability-coverage.json');
	await writeFile(file, `${JSON.stringify(buildCapabilityCoverage(), null, 2)}\n`);
	process.stdout.write(`wrote ${path.relative(repositoryRoot, file)}\n`);
}

if (process.argv[1]?.endsWith('angular-eshop-webspa-coverage-emit.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
