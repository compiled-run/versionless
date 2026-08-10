import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import { join } from 'pathe';
import { describe, expect, test } from 'vitest';
import {
	ANGULAR_REALWORLD_T643_ATTEMPT,
	claimAngularRealworldT643Attempt,
	createConduitState,
	handleConduitApi,
} from '../src/fixture/angular-realworld-production-parity-run.ts';

async function apiServer() {
	const state = createConduitState();
	const server = createServer(
		(request, response) => void handleConduitApi(state, request, response),
	);
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	const address = server.address() as AddressInfo;
	return {
		state,
		origin: `http://127.0.0.1:${address.port}/api`,
		close: async () =>
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error === undefined ? resolve() : reject(error))),
			),
	};
}

describe('Angular RealWorld source-backed loopback API', () => {
	test('claims only the compile-time T643 attempt and refuses replay or positive collision', async () => {
		expect(ANGULAR_REALWORLD_T643_ATTEMPT).toBe('T643');
		const root = await mkdtemp(join(os.tmpdir(), 'versionless-t643-claim-'));
		try {
			const concurrent = await Promise.allSettled([
				claimAngularRealworldT643Attempt(root),
				claimAngularRealworldT643Attempt(root),
			]);
			expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
			expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
			await expect(claimAngularRealworldT643Attempt(root)).rejects.toThrow(
				'replay or publication collision',
			);

			const collision = join(root, 'positive-collision');
			await mkdir(collision, { recursive: true });
			await writeFile(join(collision, 'receipt.json'), 'occupied');
			await expect(claimAngularRealworldT643Attempt(collision)).rejects.toThrow(
				'replay or publication collision',
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test('persists registration, session, article, favorite, follow, and comment state', async () => {
		const server = await apiServer();
		try {
			const json = async (pathname: string, init?: RequestInit) => {
				const response = await fetch(`${server.origin}${pathname}`, {
					...init,
					headers: { 'content-type': 'application/json', ...init?.headers },
				});
				if (response.status === 204) {
					const text = await response.text();
					expect(text).toBe('');
					return { status: response.status, body: undefined };
				}
				return { status: response.status, body: await response.json() };
			};
			const author = await json('/users', {
				method: 'POST',
				body: JSON.stringify({
					user: {
						username: 'versionless-author',
						email: 'author@example.invalid',
						password: 'local-only',
					},
				}),
			});
			expect(author.status).toBe(201);
			const token = (author.body as { user: { token: string } }).user.token;
			const authenticated = { authorization: `Token ${token}` };
			expect((await json('/user', { headers: authenticated })).status).toBe(200);
			const created = await json('/articles', {
				method: 'POST',
				headers: authenticated,
				body: JSON.stringify({
					article: {
						title: 'Local State',
						description: 'offline',
						body: 'body',
						tagList: ['versionless-local'],
					},
				}),
			});
			const slug = (created.body as { article: { slug: string } }).article.slug;
			expect(
				(
					await json(`/articles/${slug}/favorite`, {
						method: 'POST',
						headers: authenticated,
					})
				).status,
			).toBe(200);
			expect(
				(
					await json('/profiles/versionless-author/follow', {
						method: 'POST',
						headers: authenticated,
					})
				).status,
			).toBe(200);
			const comment = await json(`/articles/${slug}/comments`, {
				method: 'POST',
				headers: authenticated,
				body: JSON.stringify({ comment: { body: 'local comment' } }),
			});
			const id = (comment.body as { comment: { id: number } }).comment.id;
			const deleted = await json(`/articles/${slug}/comments/${id}`, {
				method: 'DELETE',
				headers: authenticated,
			});
			expect(deleted).toEqual({ status: 204, body: undefined });
			expect(server.state.articles.size).toBe(1);
			expect(server.state.ledger.every((entry) => entry.pathname.startsWith('/api/'))).toBe(
				true,
			);
		} finally {
			await server.close();
		}
	});
});
