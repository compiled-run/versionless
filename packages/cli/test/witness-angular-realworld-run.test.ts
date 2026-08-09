import { describe, expect, it } from 'vitest';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import {
	main,
	publishWitnessAngularRealworldTransaction,
} from '../src/witness/angular-realworld-run.ts';
import {
	ANGULAR_REALWORLD_ARTICLE,
	ANGULAR_REALWORLD_ARTICLE_BODY,
	ANGULAR_REALWORLD_TERMINAL_MARKER,
	angularRealworldTransport,
} from '../src/witness/real-app-run.ts';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import {
	parseWitnessAngularRealworldReceipt,
	witnessAngularRealworldDigest,
} from '../../core/src/receipts/witness-angular-realworld.ts';
import { witnessReactBoilerplateAggregateMember } from '../../core/src/receipts/witness-react-boilerplate.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

const request = (pathname: string) => ({
	protocol: 'https:',
	host: 'api.realworld.io',
	pathname,
	method: 'GET',
	resourceType: 'xhr',
});

async function body(pathname: string): Promise<unknown> {
	const decision = await angularRealworldTransport(request(pathname));
	if (decision.action !== 'fulfill') throw new Error('expected a local fulfillment');
	return JSON.parse(decision.body.toString('utf8')) as unknown;
}

describe('standalone Angular RealWorld Witness command', () => {
	it('rejects incomplete command modes without running another application', async () => {
		await expect(main([])).rejects.toThrow('--run-twice');
		await expect(
			main(['--publish', 'evidence/runs/witness-angular-realworld']),
		).rejects.toThrow('--run-twice');
	});

	it('dispatches exact list, detail and comments envelopes in specific-first order', async () => {
		const expectedList = {
			articlesCount: 1,
			articles: [ANGULAR_REALWORLD_ARTICLE],
		};
		expect(await body('/api/articles')).toEqual(expectedList);
		expect(
			await body(parseURL('/api/articles?limit=10&offset=0&tag=migration').pathname),
		).toEqual(expectedList);
		expect(await body('/api/articles/versionless-angular')).toEqual({
			article: ANGULAR_REALWORLD_ARTICLE,
		});
		expect(await body('/api/articles/versionless-angular/comments')).toEqual({ comments: [] });
	});

	it('keeps the one synthetic article deeply immutable', () => {
		expect(Object.isFrozen(ANGULAR_REALWORLD_ARTICLE)).toBe(true);
		expect(Object.isFrozen(ANGULAR_REALWORLD_ARTICLE.author)).toBe(true);
		expect(Object.isFrozen(ANGULAR_REALWORLD_ARTICLE.tagList)).toBe(true);
	});

	it('binds the exact meaningful Markdown body and terminal marker', async () => {
		expect(sha256(ANGULAR_REALWORLD_ARTICLE_BODY)).toBe(
			'de5c2c89907559da8f33618bbf1837a888b9c3307d25542baf7a90e2915a541d',
		);
		expect(ANGULAR_REALWORLD_ARTICLE_BODY).toContain('## Baseline identity');
		expect(ANGULAR_REALWORLD_ARTICLE_BODY).toContain('## Mutation and restoration');
		expect(ANGULAR_REALWORLD_ARTICLE_BODY.endsWith(ANGULAR_REALWORLD_TERMINAL_MARKER)).toBe(
			true,
		);
		const detail = (await body('/api/articles/versionless-angular')) as {
			article: typeof ANGULAR_REALWORLD_ARTICLE;
		};
		expect(detail.article.body).toBe(ANGULAR_REALWORLD_ARTICLE_BODY);
	});

	it('preserves slug, title and author continuity across list and detail', async () => {
		const list = (await body('/api/articles')) as {
			articles: Array<typeof ANGULAR_REALWORLD_ARTICLE>;
		};
		const detail = (await body('/api/articles/versionless-angular')) as {
			article: typeof ANGULAR_REALWORLD_ARTICLE;
		};
		expect({
			slug: list.articles[0]!.slug,
			title: list.articles[0]!.title,
			author: list.articles[0]!.author,
		}).toEqual({
			slug: detail.article.slug,
			title: detail.article.title,
			author: detail.article.author,
		});
	});

	it('refuses every unknown article subpath', async () => {
		await expect(
			angularRealworldTransport(request('/api/articles/not-the-pinned-article')),
		).rejects.toThrow('refuses unknown path');
		await expect(
			angularRealworldTransport(request('/api/articles/versionless-angular/favorite')),
		).rejects.toThrow('refuses unknown path');
	});

	it('publishes receipt and aggregate idempotently and updates both bindings', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-angular-witness-'));
		try {
			const output = path.join(directory, 'evidence/runs/witness-angular-realworld');
			const aggregatePath = path.join(directory, 'evidence/runs/aggregate.json');
			await mkdir(path.dirname(aggregatePath), { recursive: true });
			const aggregate = JSON.parse(
				await readFile(path.join(repositoryRoot, 'evidence/runs/aggregate.json'), 'utf8'),
			) as { fixtures: Array<Record<string, unknown>> };
			const current = structuredClone(aggregate);
			aggregate.fixtures = aggregate.fixtures.filter(
				(item) =>
					item.id !== 'witness-angular-realworld' &&
					item.id !== 'witness-react-boilerplate',
			);
			expect(aggregate.fixtures).toHaveLength(11);
			await writeFile(aggregatePath, `${JSON.stringify(aggregate, null, 2)}\n`);
			const receipt = parseWitnessAngularRealworldReceipt(
				JSON.parse(
					await readFile(
						path.join(
							repositoryRoot,
							'evidence/runs/witness-angular-realworld/receipt.json',
						),
						'utf8',
					),
				),
			);
			const publish = async (value: typeof receipt, verifyPublished?: () => Promise<void>) =>
				await publishWitnessAngularRealworldTransaction({
					output,
					aggregatePath,
					receipt: value,
					transactionStageRoot: path.join(directory, '.versionless/stage/publication'),
					verifyPublished,
				});
			await publish(receipt);
			const firstAggregate = await readFile(aggregatePath);
			const firstReceipt = await readFile(path.join(output, 'receipt.json'));
			await publish(receipt);
			expect(await readFile(aggregatePath)).toEqual(firstAggregate);
			expect(await readFile(path.join(output, 'receipt.json'))).toEqual(firstReceipt);

			const updated = structuredClone(receipt);
			updated.provenance = { transactionReplay: 'changed-raw-forensic-binding' };
			updated.integrity.canonicalDigest = witnessAngularRealworldDigest(updated);
			await publish(updated);
			expect(await readFile(path.join(output, 'receipt.json'), 'utf8')).toContain(
				updated.integrity.canonicalDigest,
			);
			expect(await readFile(aggregatePath, 'utf8')).toContain(
				updated.integrity.canonicalDigest,
			);

			await writeFile(aggregatePath, `${JSON.stringify(current, null, 2)}\n`);
			const expectedReact = current.fixtures.find(
				(item) => item.id === 'witness-react-boilerplate',
			);
			if (!expectedReact) throw new Error('React Witness member missing');
			expect(expectedReact).toEqual(
				witnessReactBoilerplateAggregateMember(String(expectedReact.digest)),
			);
			await publish(receipt);
			const refreshed = JSON.parse(await readFile(aggregatePath, 'utf8')) as {
				fixtures: Array<Record<string, unknown>>;
			};
			expect(refreshed.fixtures).toHaveLength(13);
			expect(refreshed.fixtures.at(-1)).toEqual(expectedReact);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('restores receipt pair and aggregate byte-identically after a post-swap failure', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-angular-rollback-'));
		try {
			const output = path.join(directory, 'evidence/runs/witness-angular-realworld');
			const aggregatePath = path.join(directory, 'evidence/runs/aggregate.json');
			await mkdir(path.dirname(output), { recursive: true });
			await mkdir(output, { recursive: true });
			for (const name of ['receipt.json', 'receipt.md'])
				await writeFile(
					path.join(output, name),
					await readFile(
						path.join(repositoryRoot, 'evidence/runs/witness-angular-realworld', name),
					),
				);
			await writeFile(
				aggregatePath,
				await readFile(path.join(repositoryRoot, 'evidence/runs/aggregate.json')),
			);
			const originalAggregate = await readFile(aggregatePath);
			const originalJson = await readFile(path.join(output, 'receipt.json'));
			const originalMarkdown = await readFile(path.join(output, 'receipt.md'));
			const receipt = parseWitnessAngularRealworldReceipt(
				JSON.parse(originalJson.toString()),
			);
			receipt.provenance = { rollback: 'candidate' };
			receipt.integrity.canonicalDigest = witnessAngularRealworldDigest(receipt);
			const transactionStageRoot = path.join(directory, '.versionless/stage/publication');
			await expect(
				publishWitnessAngularRealworldTransaction({
					output,
					aggregatePath,
					receipt,
					transactionStageRoot,
					verifyPublished: async () => {
						throw new Error('injected post-swap failure');
					},
				}),
			).rejects.toThrow('injected post-swap failure');
			expect(await readFile(aggregatePath)).toEqual(originalAggregate);
			expect(await readFile(path.join(output, 'receipt.json'))).toEqual(originalJson);
			expect(await readFile(path.join(output, 'receipt.md'))).toEqual(originalMarkdown);
			await expect(access(transactionStageRoot)).rejects.toThrow();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
