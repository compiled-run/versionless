import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	REACT_PAPERCUPS_RECEIPT_PATH,
	WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
} from '../../core/src/receipts/witness-react-papercups.ts';

/**
 * The canonical aggregate with the Papercups pair rolled back.
 *
 * Publication transactions for the earlier Witness verticals are defined
 * against their exact predecessor state. Now that the published aggregate has
 * advanced to the Papercups browser proof, those transactions are replayed
 * against a staged copy of the exact pre-append membership rather than against
 * a loosened predecessor check.
 */
export async function preAppendAggregate(root: string): Promise<string> {
	const aggregate = JSON.parse(
		await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
	) as { fixtures: Array<Record<string, unknown>> };
	const fixtures = aggregate.fixtures.filter(
		(fixture) =>
			fixture.receipt !== REACT_PAPERCUPS_RECEIPT_PATH &&
			fixture.receipt !== WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
	);
	if (fixtures.length !== 16)
		throw new Error(`Pre-append aggregate must hold sixteen members, found ${fixtures.length}`);
	return `${JSON.stringify({ ...aggregate, fixtures }, null, 2)}\n`;
}
