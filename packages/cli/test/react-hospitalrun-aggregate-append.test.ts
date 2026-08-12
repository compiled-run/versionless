import { describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import {
	appendReactHospitalrunAggregateMembers,
	reactHospitalrunAggregateMembers,
} from '../src/fixture/react-hospitalrun-aggregate-append.ts';
import {
	REACT_HOSPITALRUN_RECEIPT_PATH,
	WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
} from '../../core/src/receipts/witness-react-hospitalrun.ts';
import { WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH } from '../../core/src/receipts/witness-angular-factoriolab.ts';
import { WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH } from '../../core/src/receipts/witness-angular-jira-clone.ts';
import { WITNESS_REACT_MEMOS_RECEIPT_PATH } from '../../core/src/receipts/witness-react-memos.ts';
import { WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH } from '../../core/src/receipts/witness-next-killedbygoogle-v3.ts';
import { WITNESS_REACT_LINKFREE_RECEIPT_PATH } from '../../core/src/receipts/witness-react-linkfree.ts';
import { WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH } from '../../core/src/receipts/witness-angular-tiny-translator.ts';
import { deriveCorpusTransactionState } from '../../core/src/corpus/conformance.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

const evidenceFiles = [
	REACT_HOSPITALRUN_RECEIPT_PATH,
	WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
	`${path.dirname(WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH)}/receipt.md`,
	'evidence/runs/aggregate.json',
];

/**
 * Stages the exact published evidence with the aggregate rolled back to its
 * pre-append membership, so the append transaction itself is still replayed
 * against its real Papercups browser-proof predecessor now that the published
 * aggregate already carries the HospitalRun pair with the factoriolab,
 * jira-clone, memos, killedbygoogle v3 and LinkFree members appended on top of
 * it.
 */
async function stagedRoot(): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'hospitalrun-aggregate-'));
	for (const relative of evidenceFiles) {
		const destination = path.join(directory, relative);
		await mkdir(path.dirname(destination), { recursive: true });
		await copyFile(path.join(repositoryRoot, relative), destination);
	}
	await rewrite(directory, (members) =>
		members.filter(
			(member) =>
				member.receipt !== REACT_HOSPITALRUN_RECEIPT_PATH &&
				member.receipt !== WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH &&
				member.receipt !== WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH &&
				member.receipt !== WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH &&
				member.receipt !== WITNESS_REACT_MEMOS_RECEIPT_PATH &&
				member.receipt !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH &&
				member.receipt !== WITNESS_REACT_LINKFREE_RECEIPT_PATH &&
				member.receipt !== WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
		),
	);
	expect(await fixtures(directory)).toHaveLength(18);
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

describe('React HospitalRun aggregate append', () => {
	it('derives both members from the published evidence rather than authored rows', async () => {
		const members = await reactHospitalrunAggregateMembers(repositoryRoot);
		expect(members.migration).toMatchObject({
			id: 'react-hospitalrun',
			framework: 'react',
			result: 'pass',
			receipt: REACT_HOSPITALRUN_RECEIPT_PATH,
			track: 'create-react-app-3.4.4-to-vite8-build-and-boot',
		});
		expect(members.witness).toMatchObject({
			id: 'witness-react-hospitalrun',
			framework: 'react',
			result: 'pass',
			receipt: WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
		});
		expect(members.migration.digest).toMatch(/^[0-9a-f]{64}$/);
		expect(members.witness.digest).toMatch(/^[0-9a-f]{64}$/);
		expect(members.witness.digest).not.toBe(members.migration.digest);
	});

	it('reports the published aggregate as already appended without rewriting it', async () => {
		const published = await readFile(
			path.join(repositoryRoot, 'evidence/runs/aggregate.json'),
			'utf8',
		);
		const parsed = JSON.parse(published) as { fixtures: Array<Record<string, unknown>> };
		expect(parsed.fixtures).toHaveLength(26);
		expect(parsed.fixtures.slice(-8).map((member) => member.receipt)).toEqual([
			REACT_HOSPITALRUN_RECEIPT_PATH,
			WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
			WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
			WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
			WITNESS_REACT_MEMOS_RECEIPT_PATH,
			WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
			WITNESS_REACT_LINKFREE_RECEIPT_PATH,
			WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
		]);
		await expect(appendReactHospitalrunAggregateMembers(repositoryRoot)).resolves.toEqual({
			kind: 'angular-tiny-translator-browser-proof',
			receipts: 26,
			appended: false,
		});
		expect(
			await readFile(path.join(repositoryRoot, 'evidence/runs/aggregate.json'), 'utf8'),
		).toBe(published);
	});

	it('appends the exact pair and re-derives the browser-proof state', async () => {
		const directory = await stagedRoot();
		try {
			expect(deriveCorpusTransactionState(await fixtures(directory)).kind).toBe(
				'react-papercups-browser-proof',
			);
			const result = await appendReactHospitalrunAggregateMembers(directory);
			expect(result).toEqual({
				kind: 'react-hospitalrun-browser-proof',
				receipts: 20,
				appended: true,
			});
			const appended = await fixtures(directory);
			expect(appended).toHaveLength(20);
			expect(appended.slice(-2).map((member) => member.receipt)).toEqual([
				REACT_HOSPITALRUN_RECEIPT_PATH,
				WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
			]);
			expect(deriveCorpusTransactionState(appended)).toMatchObject({
				kind: 'react-hospitalrun-browser-proof',
				verticals: 13,
				sourceApplications: 6,
				receipts: 20,
			});
			await expect(appendReactHospitalrunAggregateMembers(directory)).resolves.toEqual({
				kind: 'react-hospitalrun-browser-proof',
				receipts: 20,
				appended: false,
			});
			expect(await fixtures(directory)).toHaveLength(20);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a predecessor that is not the Papercups browser proof', async () => {
		const directory = await stagedRoot();
		try {
			await rewrite(directory, (members) => members.slice(0, -2));
			expect(deriveCorpusTransactionState(await fixtures(directory)).kind).toBe(
				'react-zero-sw-reconciliation',
			);
			await expect(appendReactHospitalrunAggregateMembers(directory)).rejects.toThrow(
				/Papercups browser-proof predecessor/,
			);
			expect(await fixtures(directory)).toHaveLength(16);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a half-appended aggregate', async () => {
		const directory = await stagedRoot();
		try {
			const members = await reactHospitalrunAggregateMembers(directory);
			await rewrite(directory, (current) => [...current, members.migration]);
			await expect(appendReactHospitalrunAggregateMembers(directory)).rejects.toThrow(
				/partially appended/,
			);
			expect(await fixtures(directory)).toHaveLength(19);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
