import { describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import {
	angularFactoriolabAggregateMembers,
	appendAngularFactoriolabAggregateMembers,
} from '../src/fixture/angular-factoriolab-aggregate-append.ts';
import {
	ANGULAR_FACTORIOLAB_CANONICAL_RECEIPTS,
	WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
} from '../../core/src/receipts/witness-angular-factoriolab.ts';
import { WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH } from '../../core/src/receipts/witness-angular-jira-clone.ts';
import { WITNESS_REACT_MEMOS_RECEIPT_PATH } from '../../core/src/receipts/witness-react-memos.ts';
import { WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH } from '../../core/src/receipts/witness-next-killedbygoogle-v3.ts';
import { WITNESS_REACT_LINKFREE_RECEIPT_PATH } from '../../core/src/receipts/witness-react-linkfree.ts';
import { WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH } from '../../core/src/receipts/witness-angular-tiny-translator.ts';
import { WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH } from '../../core/src/receipts/witness-angular-super-productivity.ts';
import { deriveCorpusTransactionState } from '../../core/src/corpus/conformance.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

const evidenceFiles = [
	WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
	`${path.dirname(WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH)}/receipt.md`,
	...ANGULAR_FACTORIOLAB_CANONICAL_RECEIPTS.map((bound) => bound.path),
	'evidence/runs/aggregate.json',
];

/**
 * Stages the exact published evidence with the aggregate rolled back to its
 * pre-append membership, so the append transaction itself is still replayed
 * against its real HospitalRun browser-proof predecessor now that the published
 * aggregate already carries the factoriolab member with the jira-clone, memos,
 * killedbygoogle v3 and LinkFree members appended on top of it.
 */
async function stagedRoot(): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'factoriolab-aggregate-'));
	for (const relative of evidenceFiles) {
		const destination = path.join(directory, relative);
		await mkdir(path.dirname(destination), { recursive: true });
		await copyFile(path.join(repositoryRoot, relative), destination);
	}
	await rewrite(directory, (members) =>
		members.filter(
			(member) =>
				member.receipt !== WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH &&
				member.receipt !== WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH &&
				member.receipt !== WITNESS_REACT_MEMOS_RECEIPT_PATH &&
				member.receipt !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH &&
				member.receipt !== WITNESS_REACT_LINKFREE_RECEIPT_PATH &&
				member.receipt !== WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH &&
				member.receipt !== WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
		),
	);
	expect(await fixtures(directory)).toHaveLength(20);
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

describe('Angular factoriolab aggregate append', () => {
	it('derives its single member from the published evidence rather than an authored row', async () => {
		const members = await angularFactoriolabAggregateMembers(repositoryRoot);
		expect(members.witness).toMatchObject({
			id: 'witness-angular-factoriolab',
			framework: 'angular',
			result: 'pass',
			receipt: WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
			track: 'production-readiness-direct-witness-angular10-to-angular16-browser-builder',
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
		expect(parsed.fixtures.slice(-7).map((member) => member.receipt)).toEqual([
			WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
			WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
			WITNESS_REACT_MEMOS_RECEIPT_PATH,
			WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
			WITNESS_REACT_LINKFREE_RECEIPT_PATH,
			WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
		]);
		await expect(appendAngularFactoriolabAggregateMembers(repositoryRoot)).resolves.toEqual({
			kind: 'angular-super-productivity-browser-proof',
			receipts: 27,
			appended: false,
		});
		expect(
			await readFile(path.join(repositoryRoot, 'evidence/runs/aggregate.json'), 'utf8'),
		).toBe(published);
	});

	it('appends the exact member and re-derives the browser-proof state', async () => {
		const directory = await stagedRoot();
		try {
			expect(deriveCorpusTransactionState(await fixtures(directory)).kind).toBe(
				'react-hospitalrun-browser-proof',
			);
			const result = await appendAngularFactoriolabAggregateMembers(directory);
			expect(result).toEqual({
				kind: 'angular-factoriolab-browser-proof',
				receipts: 21,
				appended: true,
			});
			const appended = await fixtures(directory);
			expect(appended).toHaveLength(21);
			expect(appended.at(-1)?.receipt).toBe(WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH);
			expect(deriveCorpusTransactionState(appended)).toMatchObject({
				kind: 'angular-factoriolab-browser-proof',
				verticals: 14,
				sourceApplications: 7,
				receipts: 21,
			});
			await expect(appendAngularFactoriolabAggregateMembers(directory)).resolves.toEqual({
				kind: 'angular-factoriolab-browser-proof',
				receipts: 21,
				appended: false,
			});
			expect(await fixtures(directory)).toHaveLength(21);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a predecessor that is not the HospitalRun browser proof', async () => {
		const directory = await stagedRoot();
		try {
			await rewrite(directory, (members) => members.slice(0, -2));
			expect(deriveCorpusTransactionState(await fixtures(directory)).kind).toBe(
				'react-papercups-browser-proof',
			);
			await expect(appendAngularFactoriolabAggregateMembers(directory)).rejects.toThrow(
				/HospitalRun browser-proof predecessor/,
			);
			expect(await fixtures(directory)).toHaveLength(18);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a member appended anywhere but the tail', async () => {
		const directory = await stagedRoot();
		try {
			const members = await angularFactoriolabAggregateMembers(directory);
			await rewrite(directory, (current) => [
				...current.slice(0, -1),
				members.witness,
				...current.slice(-1),
			]);
			await expect(appendAngularFactoriolabAggregateMembers(directory)).rejects.toThrow(
				/Angular factoriolab browser proof aggregate receipt order differs/,
			);
			expect(await fixtures(directory)).toHaveLength(21);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a member whose row drifts from the derived one', async () => {
		const directory = await stagedRoot();
		try {
			const members = await angularFactoriolabAggregateMembers(directory);
			await rewrite(directory, (current) => [
				...current,
				{ ...members.witness, framework: 'react' },
			]);
			await expect(appendAngularFactoriolabAggregateMembers(directory)).rejects.toThrow(
				/factoriolab aggregate membership/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
