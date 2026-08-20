import { describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import {
	appendAngularSuperProductivityAggregateMembers,
	angularSuperProductivityAggregateMembers,
} from '../src/fixture/angular-super-productivity-aggregate-append.ts';
import { WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH } from '../../core/src/receipts/witness-angular-super-productivity.ts';
import { WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH } from '../../core/src/receipts/witness-angular-tiny-translator.ts';
import { deriveCorpusTransactionState } from '../../core/src/corpus/conformance.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

/**
 * Every file `verifyWitnessAngularSuperProductivityEvidence` re-reads, plus the
 * canonical aggregate. The two build-lane receipts are sealed inside the Witness
 * receipt and their bytes are re-hashed at verify time, so they are copied too.
 */
const evidenceFiles = [
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
	`${path.dirname(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH)}/receipt.md`,
	'evidence/runs/angular-super-productivity-v2-13-15/u21-era-baseline-digest-correction.json',
	'evidence/runs/angular-super-productivity-v2-13-15/u20c2g-dist25-rebind-lane.json',
	'fixtures/angular-super-productivity-v2-13-15/accommodations/electron.service.ts',
	'evidence/runs/aggregate.json',
];

async function fixtures(directory: string): Promise<Array<Record<string, unknown>>> {
	const aggregate = JSON.parse(
		await readFile(path.join(directory, 'evidence/runs/aggregate.json'), 'utf8'),
	) as { fixtures: Array<Record<string, unknown>> };
	return aggregate.fixtures;
}

async function rewrite(
	directory: string,
	transform: (value: Array<Record<string, unknown>>) => Array<Record<string, unknown>>,
): Promise<void> {
	const file = path.join(directory, 'evidence/runs/aggregate.json');
	const aggregate = JSON.parse(await readFile(file, 'utf8')) as {
		fixtures: Array<Record<string, unknown>>;
	};
	await writeFile(
		file,
		`${JSON.stringify({ ...aggregate, fixtures: transform(aggregate.fixtures) }, null, 2)}\n`,
	);
}

/**
 * Stages the exact published evidence with the aggregate rolled back to its
 * pre-append membership, so the append transaction is replayed against its real
 * TinyTranslator browser-proof predecessor now that the published aggregate
 * already carries the super-productivity member.
 */
async function stagedRoot(): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'super-productivity-aggregate-'));
	for (const relative of evidenceFiles) {
		const destination = path.join(directory, relative);
		await mkdir(path.dirname(destination), { recursive: true });
		await copyFile(path.join(repositoryRoot, relative), destination);
	}
	await rewrite(directory, (members) =>
		members.filter(
			(member) => member.receipt !== WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
		),
	);
	expect(deriveCorpusTransactionState(await fixtures(directory)).kind).toBe(
		'angular-tiny-translator-browser-proof',
	);
	return directory;
}

describe('Angular Super Productivity aggregate append', () => {
	it('derives its single member from the published evidence rather than an authored row', async () => {
		const members = await angularSuperProductivityAggregateMembers(repositoryRoot);
		expect(members.witness).toMatchObject({
			id: 'witness-angular-super-productivity',
			framework: 'angular',
			result: 'pass',
			receipt: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
		});
		expect(members.witness.digest).toMatch(/^[0-9a-f]{64}$/);
		expect(Object.keys(members)).toEqual(['witness']);
	});

	it('reports the published aggregate as already appended without rewriting it', async () => {
		const published = await readFile(
			path.join(repositoryRoot, 'evidence/runs/aggregate.json'),
			'utf8',
		);
		const parsed = JSON.parse(published) as { fixtures: Array<Record<string, unknown>> };
		expect(parsed.fixtures).toHaveLength(27);
		expect(parsed.fixtures.at(-1)?.receipt).toBe(
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
		);
		await expect(
			appendAngularSuperProductivityAggregateMembers(repositoryRoot),
		).resolves.toEqual({
			kind: 'angular-super-productivity-browser-proof',
			receipts: 27,
			appended: false,
		});
		expect(
			await readFile(path.join(repositoryRoot, 'evidence/runs/aggregate.json'), 'utf8'),
		).toBe(published);
	});

	it('appends the exact member on the TinyTranslator predecessor and re-derives the state', async () => {
		const directory = await stagedRoot();
		try {
			const result = await appendAngularSuperProductivityAggregateMembers(directory);
			expect(result).toEqual({
				kind: 'angular-super-productivity-browser-proof',
				receipts: 27,
				appended: true,
			});
			const appended = await fixtures(directory);
			expect(appended).toHaveLength(27);
			expect(appended.at(-1)?.receipt).toBe(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH);
			expect(deriveCorpusTransactionState(appended)).toMatchObject({
				kind: 'angular-super-productivity-browser-proof',
				verticals: 20,
				sourceApplications: 12,
				receipts: 27,
			});
			// Idempotent: a second append reports already-appended and leaves the
			// membership untouched.
			await expect(
				appendAngularSuperProductivityAggregateMembers(directory),
			).resolves.toEqual({
				kind: 'angular-super-productivity-browser-proof',
				receipts: 27,
				appended: false,
			});
			expect(await fixtures(directory)).toHaveLength(27);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a predecessor that is not the TinyTranslator browser proof', async () => {
		const directory = await stagedRoot();
		try {
			await rewrite(directory, (members) =>
				members.filter(
					(member) => member.receipt !== WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
				),
			);
			expect(deriveCorpusTransactionState(await fixtures(directory)).kind).toBe(
				'react-linkfree-browser-proof',
			);
			await expect(appendAngularSuperProductivityAggregateMembers(directory)).rejects.toThrow(
				/TinyTranslator browser-proof predecessor/,
			);
			expect(await fixtures(directory)).toHaveLength(25);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a member whose row drifts from the derived one', async () => {
		const directory = await stagedRoot();
		try {
			const members = await angularSuperProductivityAggregateMembers(directory);
			await rewrite(directory, (current) => [
				...current,
				{ ...members.witness, framework: 'react' },
			]);
			await expect(appendAngularSuperProductivityAggregateMembers(directory)).rejects.toThrow(
				/Angular Super Productivity aggregate membership/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
