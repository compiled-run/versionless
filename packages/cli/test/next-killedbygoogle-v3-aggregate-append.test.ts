import { describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import {
	appendNextKilledbygoogleV3AggregateMembers,
	nextKilledbygoogleV3AggregateMembers,
} from '../src/fixture/next-killedbygoogle-v3-aggregate-append.ts';
import {
	NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
} from '../../core/src/receipts/witness-next-killedbygoogle-v3.ts';
import { WITNESS_REACT_MEMOS_RECEIPT_PATH } from '../../core/src/receipts/witness-react-memos.ts';
import { WITNESS_REACT_LINKFREE_RECEIPT_PATH } from '../../core/src/receipts/witness-react-linkfree.ts';
import { deriveCorpusTransactionState } from '../../core/src/corpus/conformance.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

const evidenceFiles = [
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
	`${path.dirname(WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH)}/receipt.md`,
	NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.path,
	'evidence/runs/aggregate.json',
];

/**
 * Stages the exact published evidence with the aggregate rolled back to its
 * pre-append membership, so the append transaction itself is still replayed
 * against its real memos browser-proof predecessor now that the published
 * aggregate already carries the killedbygoogle v3 member with the LinkFree
 * member appended on top of it.
 */
async function stagedRoot(): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'killedbygoogle-v3-aggregate-'));
	for (const relative of evidenceFiles) {
		const destination = path.join(directory, relative);
		await mkdir(path.dirname(destination), { recursive: true });
		await copyFile(path.join(repositoryRoot, relative), destination);
	}
	await rewrite(directory, (members) =>
		members.filter(
			(member) =>
				member.receipt !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH &&
				member.receipt !== WITNESS_REACT_LINKFREE_RECEIPT_PATH,
		),
	);
	expect(await fixtures(directory)).toHaveLength(23);
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

describe('KilledByGoogle v3 aggregate append', () => {
	it('derives its single member from the published evidence rather than an authored row', async () => {
		const members = await nextKilledbygoogleV3AggregateMembers(repositoryRoot);
		expect(members.witness).toMatchObject({
			id: 'witness-next-killedbygoogle-v3-0-0',
			framework: 'next',
			result: 'pass',
			receipt: WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
			track: 'production-readiness-direct-witness-next12-static-export-to-vite8-client-build',
		});
		expect(members.witness.digest).toMatch(/^[0-9a-f]{64}$/);
		expect(Object.keys(members)).toEqual(['witness']);
		// Both build lanes enter through the Witness receipt's own seal, so the
		// aggregate carries one row and not three.
		expect(NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.eraLaneDigest).toMatch(/^[0-9a-f]{64}$/);
		expect(NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.targetLaneDigest).toMatch(/^[0-9a-f]{64}$/);
	});

	it('reports the published aggregate as already appended without rewriting it', async () => {
		const published = await readFile(
			path.join(repositoryRoot, 'evidence/runs/aggregate.json'),
			'utf8',
		);
		const parsed = JSON.parse(published) as { fixtures: Array<Record<string, unknown>> };
		expect(parsed.fixtures).toHaveLength(25);
		expect(parsed.fixtures.slice(-2).map((member) => member.receipt)).toEqual([
			WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
			WITNESS_REACT_LINKFREE_RECEIPT_PATH,
		]);
		await expect(appendNextKilledbygoogleV3AggregateMembers(repositoryRoot)).resolves.toEqual({
			kind: 'react-linkfree-browser-proof',
			receipts: 25,
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
				'react-memos-browser-proof',
			);
			const result = await appendNextKilledbygoogleV3AggregateMembers(directory);
			expect(result).toEqual({
				kind: 'next-killedbygoogle-v3-browser-proof',
				receipts: 24,
				appended: true,
			});
			const appended = await fixtures(directory);
			expect(appended).toHaveLength(24);
			expect(appended.at(-1)?.receipt).toBe(WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH);
			expect(deriveCorpusTransactionState(appended)).toMatchObject({
				kind: 'next-killedbygoogle-v3-browser-proof',
				verticals: 17,
				sourceApplications: 9,
				receipts: 24,
			});
			await expect(appendNextKilledbygoogleV3AggregateMembers(directory)).resolves.toEqual({
				kind: 'next-killedbygoogle-v3-browser-proof',
				receipts: 24,
				appended: false,
			});
			expect(await fixtures(directory)).toHaveLength(24);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a predecessor that is not the memos browser proof', async () => {
		const directory = await stagedRoot();
		try {
			await rewrite(directory, (members) =>
				members.filter((member) => member.receipt !== WITNESS_REACT_MEMOS_RECEIPT_PATH),
			);
			expect(deriveCorpusTransactionState(await fixtures(directory)).kind).toBe(
				'angular-jira-clone-browser-proof',
			);
			await expect(appendNextKilledbygoogleV3AggregateMembers(directory)).rejects.toThrow(
				/memos browser-proof predecessor/,
			);
			expect(await fixtures(directory)).toHaveLength(22);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a member appended anywhere but the tail', async () => {
		const directory = await stagedRoot();
		try {
			const members = await nextKilledbygoogleV3AggregateMembers(directory);
			await rewrite(directory, (current) => [
				...current.slice(0, -1),
				members.witness,
				...current.slice(-1),
			]);
			await expect(appendNextKilledbygoogleV3AggregateMembers(directory)).rejects.toThrow(
				/KilledByGoogle v3 browser proof aggregate receipt order differs/,
			);
			expect(await fixtures(directory)).toHaveLength(24);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a member whose row drifts from the derived one', async () => {
		const directory = await stagedRoot();
		try {
			const members = await nextKilledbygoogleV3AggregateMembers(directory);
			await rewrite(directory, (current) => [
				...current,
				{ ...members.witness, framework: 'react' },
			]);
			await expect(appendNextKilledbygoogleV3AggregateMembers(directory)).rejects.toThrow(
				/KilledByGoogle v3 aggregate membership/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
