import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	REACT_PAPERCUPS_RECEIPT_PATH,
	WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
} from '../../core/src/receipts/witness-react-papercups.ts';
import {
	REACT_HOSPITALRUN_RECEIPT_PATH,
	WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
} from '../../core/src/receipts/witness-react-hospitalrun.ts';

/**
 * The exact receipt paths appended after the zero-service-worker
 * reconciliation, rolled back so the earlier publication transactions still
 * replay against their real predecessor.
 */
const POST_ZERO_SW_RECEIPT_PATHS = new Set<unknown>([
	REACT_PAPERCUPS_RECEIPT_PATH,
	WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
	REACT_HOSPITALRUN_RECEIPT_PATH,
	WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
]);

/**
 * The canonical aggregate with the Papercups and HospitalRun pairs rolled back.
 *
 * Publication transactions for the earlier Witness verticals are defined
 * against their exact predecessor state. Now that the published aggregate has
 * advanced to the HospitalRun browser proof, those transactions are replayed
 * against a staged copy of the exact pre-append membership rather than against
 * a loosened predecessor check.
 */
export async function preAppendAggregate(root: string): Promise<string> {
	const aggregate = JSON.parse(
		await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
	) as { fixtures: Array<Record<string, unknown>> };
	const fixtures = aggregate.fixtures.filter(
		(fixture) => !POST_ZERO_SW_RECEIPT_PATHS.has(fixture.receipt),
	);
	if (fixtures.length !== 16)
		throw new Error(`Pre-append aggregate must hold sixteen members, found ${fixtures.length}`);
	return `${JSON.stringify({ ...aggregate, fixtures }, null, 2)}\n`;
}
