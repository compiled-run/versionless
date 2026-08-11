import { describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import {
	appendReactLinkfreeAggregateMembers,
	reactLinkfreeAggregateMembers,
} from '../src/fixture/react-linkfree-aggregate-append.ts';
import {
	REACT_LINKFREE_RECEIPT_PATH,
	WITNESS_REACT_LINKFREE_RECEIPT_PATH,
} from '../../core/src/receipts/witness-react-linkfree.ts';
import { WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH } from '../../core/src/receipts/witness-next-killedbygoogle-v3.ts';
import { deriveCorpusTransactionState } from '../../core/src/corpus/conformance.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

const evidenceFiles = [
	WITNESS_REACT_LINKFREE_RECEIPT_PATH,
	`${path.dirname(WITNESS_REACT_LINKFREE_RECEIPT_PATH)}/receipt.md`,
	REACT_LINKFREE_RECEIPT_PATH,
	'evidence/runs/aggregate.json',
];

/**
 * Stages the exact published evidence with the aggregate rolled back to its
 * pre-append membership, so the append transaction itself is still replayed
 * against its real killedbygoogle v3 browser-proof predecessor now that the
 * published aggregate already carries the LinkFree member.
 */
async function stagedRoot(): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'linkfree-aggregate-'));
	for (const relative of evidenceFiles) {
		const destination = path.join(directory, relative);
		await mkdir(path.dirname(destination), { recursive: true });
		await copyFile(path.join(repositoryRoot, relative), destination);
	}
	await rewrite(directory, (members) =>
		members.filter((member) => member.receipt !== WITNESS_REACT_LINKFREE_RECEIPT_PATH),
	);
	expect(await fixtures(directory)).toHaveLength(24);
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

describe('React LinkFree aggregate append', () => {
	it('derives its single member from the published evidence rather than an authored row', async () => {
		const members = await reactLinkfreeAggregateMembers(repositoryRoot);
		expect(members.witness).toMatchObject({
			id: 'witness-react-linkfree-v0-72-0',
			framework: 'react',
			result: 'pass',
			receipt: WITNESS_REACT_LINKFREE_RECEIPT_PATH,
			track: 'production-readiness-direct-witness-create-react-app-5-to-vite8',
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
		expect(parsed.fixtures).toHaveLength(25);
		expect(parsed.fixtures.at(-1)?.receipt).toBe(WITNESS_REACT_LINKFREE_RECEIPT_PATH);
		await expect(appendReactLinkfreeAggregateMembers(repositoryRoot)).resolves.toEqual({
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
				'next-killedbygoogle-v3-browser-proof',
			);
			const result = await appendReactLinkfreeAggregateMembers(directory);
			expect(result).toEqual({
				kind: 'react-linkfree-browser-proof',
				receipts: 25,
				appended: true,
			});
			const appended = await fixtures(directory);
			expect(appended).toHaveLength(25);
			expect(appended.at(-1)?.receipt).toBe(WITNESS_REACT_LINKFREE_RECEIPT_PATH);
			expect(deriveCorpusTransactionState(appended)).toMatchObject({
				kind: 'react-linkfree-browser-proof',
				verticals: 18,
				sourceApplications: 10,
				receipts: 25,
			});
			await expect(appendReactLinkfreeAggregateMembers(directory)).resolves.toEqual({
				kind: 'react-linkfree-browser-proof',
				receipts: 25,
				appended: false,
			});
			expect(await fixtures(directory)).toHaveLength(25);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a predecessor that is not the killedbygoogle v3 browser proof', async () => {
		const directory = await stagedRoot();
		try {
			await rewrite(directory, (members) =>
				members.filter(
					(member) => member.receipt !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
				),
			);
			expect(deriveCorpusTransactionState(await fixtures(directory)).kind).toBe(
				'react-memos-browser-proof',
			);
			await expect(appendReactLinkfreeAggregateMembers(directory)).rejects.toThrow(
				/killedbygoogle v3 browser-proof predecessor/,
			);
			expect(await fixtures(directory)).toHaveLength(23);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a member appended anywhere but the tail', async () => {
		const directory = await stagedRoot();
		try {
			const members = await reactLinkfreeAggregateMembers(directory);
			await rewrite(directory, (current) => [
				...current.slice(0, -1),
				members.witness,
				...current.slice(-1),
			]);
			await expect(appendReactLinkfreeAggregateMembers(directory)).rejects.toThrow(
				/React LinkFree browser proof aggregate receipt order differs/,
			);
			expect(await fixtures(directory)).toHaveLength(25);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a member whose row drifts from the derived one', async () => {
		const directory = await stagedRoot();
		try {
			const members = await reactLinkfreeAggregateMembers(directory);
			await rewrite(directory, (current) => [
				...current,
				{ ...members.witness, framework: 'next' },
			]);
			await expect(appendReactLinkfreeAggregateMembers(directory)).rejects.toThrow(
				/React LinkFree aggregate membership/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
