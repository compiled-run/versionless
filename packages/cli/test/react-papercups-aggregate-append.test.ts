import { describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import {
	appendReactPapercupsAggregateMembers,
	reactPapercupsAggregateMembers,
} from '../src/fixture/react-papercups-aggregate-append.ts';
import {
	REACT_PAPERCUPS_CANONICAL_DIGEST,
	REACT_PAPERCUPS_RECEIPT_PATH,
	WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
} from '../../core/src/receipts/witness-react-papercups.ts';
import { deriveCorpusTransactionState } from '../../core/src/corpus/conformance.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

const evidenceFiles = [
	REACT_PAPERCUPS_RECEIPT_PATH,
	WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
	`${path.dirname(WITNESS_REACT_PAPERCUPS_RECEIPT_PATH)}/receipt.md`,
	'evidence/runs/aggregate.json',
];

async function stagedRoot(): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'papercups-aggregate-'));
	for (const relative of evidenceFiles) {
		const destination = path.join(directory, relative);
		await mkdir(path.dirname(destination), { recursive: true });
		await copyFile(path.join(repositoryRoot, relative), destination);
	}
	return directory;
}

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

describe('React Papercups aggregate append', () => {
	it('derives both members from the published evidence rather than authored rows', async () => {
		const members = await reactPapercupsAggregateMembers(repositoryRoot);
		expect(members.migration).toMatchObject({
			id: 'react-papercups-v1-0-0',
			framework: 'react',
			result: 'pass',
			receipt: REACT_PAPERCUPS_RECEIPT_PATH,
			digest: REACT_PAPERCUPS_CANONICAL_DIGEST,
		});
		expect(members.witness).toMatchObject({
			id: 'witness-react-papercups',
			framework: 'react',
			result: 'pass',
			receipt: WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
		});
		expect(members.witness.digest).toMatch(/^[0-9a-f]{64}$/);
		expect(members.witness.digest).not.toBe(members.migration.digest);
	});

	it('appends the exact pair and re-derives the browser-proof state', async () => {
		const directory = await stagedRoot();
		try {
			expect(deriveCorpusTransactionState(await fixtures(directory)).kind).toBe(
				'react-zero-sw-reconciliation',
			);
			const result = await appendReactPapercupsAggregateMembers(directory);
			expect(result).toEqual({
				kind: 'react-papercups-browser-proof',
				receipts: 18,
				appended: true,
			});
			const appended = await fixtures(directory);
			expect(appended).toHaveLength(18);
			expect(appended.slice(-2).map((member) => member.receipt)).toEqual([
				REACT_PAPERCUPS_RECEIPT_PATH,
				WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
			]);
			expect(deriveCorpusTransactionState(appended)).toMatchObject({
				kind: 'react-papercups-browser-proof',
				verticals: 12,
				sourceApplications: 5,
				receipts: 18,
			});
			await expect(appendReactPapercupsAggregateMembers(directory)).resolves.toEqual({
				kind: 'react-papercups-browser-proof',
				receipts: 18,
				appended: false,
			});
			expect(await fixtures(directory)).toHaveLength(18);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a predecessor that is not the zero-service-worker state', async () => {
		const directory = await stagedRoot();
		try {
			await rewrite(directory, (members) => members.slice(0, -2));
			expect(deriveCorpusTransactionState(await fixtures(directory)).kind).toBe(
				'next-candidate',
			);
			await expect(appendReactPapercupsAggregateMembers(directory)).rejects.toThrow(
				/zero-service-worker predecessor/,
			);
			expect(await fixtures(directory)).toHaveLength(14);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a half-appended aggregate', async () => {
		const directory = await stagedRoot();
		try {
			const members = await reactPapercupsAggregateMembers(directory);
			await rewrite(directory, (current) => [...current, members.migration]);
			await expect(appendReactPapercupsAggregateMembers(directory)).rejects.toThrow(
				/partially appended/,
			);
			expect(await fixtures(directory)).toHaveLength(17);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
