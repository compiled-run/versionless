import { spawn } from 'node:child_process';
import { access, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { box, runBoxes, type BoxRunFn, type PageRecord } from '@async/witness';
import * as path from 'pathe';
import { getQuery, parseURL } from 'ufo';
import {
	canonicalize,
	finalizeAngularRealworldProductionParity,
	parseAngularRealworldProductionParity,
	sha256,
	type AngularRealworldParityRun,
	type AngularRealworldProductionParityReceipt,
} from '../../../core/src/index.ts';
import { verifyAngularRealWorldV16 } from './angular-realworld-v15-to-v16-ingest.ts';
import { verifyAngularRealWorldAcquisition } from './angular-realworld-v15-ingest.ts';
import { witnessNodeFileSystem } from '../witness/node-filesystem.ts';
import { createPlaywrightWitnessHost } from '../witness/playwright-host.ts';
import { verifyLinkedWitnessProvenance } from '../witness/provenance.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const work = path.join(root, '.versionless/work/angular-realworld-production-parity');
const output = path.join(root, 'evidence/runs/angular-realworld-production-parity');
const receiptPath = path.join(output, 'receipt.json');
const historicalT639TerminalPath = path.join(output, 'terminal.json');
const historicalT641TerminalPath = path.join(output, 't641-terminal.json');
const t643AttemptDirectory = path.join(output, 'attempts');
const t643StartPath = path.join(t643AttemptDirectory, 't643-start.json');
const t643ReceiptPath = path.join(t643AttemptDirectory, 't643-receipt.json');
const t643TerminalPath = path.join(output, 't643-terminal.json');
export const ANGULAR_REALWORLD_T643_ATTEMPT = 'T643' as const;
export const ANGULAR_REALWORLD_T639_TERMINAL_SHA256 =
	'1a526de4c66f0816137e40a024d85602083fbf56c580c37d27e12ac862efc354' as const;
export const ANGULAR_REALWORLD_T641_TERMINAL_SHA256 =
	'a8acbcb7b80349c7127743455d43932b663a7114d611ce92f0bacc91ae4ca38e' as const;
const priorWork = path.join(root, '.versionless/work/angular-realworld-v15-to-v16');
const node = path.join(priorWork, 'runtime/node-v18.20.8-darwin-arm64/bin/node');
const launcher = path.join(priorWork, 'launcher-dist/target-restored/architect-launcher.cjs');
const chromiumExecutable = path.join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const sourceLanes = {
	angular15: path.join(priorWork, 'lanes/legacy'),
	angular16: path.join(priorWork, 'lanes/target'),
} as const;
const acceptedBuilds = {
	angular15: '34bbecf0f342a65b6c813e6d93f07dd93397716915f0673ac9251a175ca77274',
	angular16: 'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185',
} as const;
const overlayFrom = 'https://api.realworld.io/api';
const overlayTo = '/api';

type User = {
	username: string;
	email: string;
	password: string;
	token: string;
	bio: string;
	image: string;
};
type Article = {
	slug: string;
	title: string;
	description: string;
	body: string;
	tagList: string[];
	author: string;
	createdAt: string;
	updatedAt: string;
	favoritedBy: Set<string>;
};
type Comment = { id: number; body: string; author: string; createdAt: string; updatedAt: string };
type State = {
	users: Map<string, User>;
	articles: Map<string, Article>;
	comments: Map<string, Comment[]>;
	follows: Set<string>;
	nextCommentId: number;
	ledger: Array<{ method: string; pathname: string; status: number }>;
};

function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

export async function claimAngularRealworldT643Attempt(directory: string): Promise<string> {
	const attempts = path.join(directory, 'attempts');
	const start = path.join(attempts, 't643-start.json');
	const attemptReceipt = path.join(attempts, 't643-receipt.json');
	const canonicalReceipt = path.join(directory, 'receipt.json');
	const terminal = path.join(directory, 't643-terminal.json');
	await mkdir(attempts, { recursive: true });
	for (const collision of [start, attemptReceipt, canonicalReceipt, terminal])
		if (await exists(collision))
			throw new Error(
				`Angular RealWorld T643 replay or publication collision: ${path.basename(collision)}`,
			);
	await writeFile(
		start,
		`${canonicalize({
			schemaVersion: 'versionless.angular-realworld-production-parity-attempt.v1',
			attempt: ANGULAR_REALWORLD_T643_ATTEMPT,
			state: 'claimed',
			priorTerminals: {
				t639: ANGULAR_REALWORLD_T639_TERMINAL_SHA256,
				t641: ANGULAR_REALWORLD_T641_TERMINAL_SHA256,
			},
		})}\n`,
		{ flag: 'wx' },
	);
	return start;
}

async function assertHistoricalTerminalIdentities(): Promise<void> {
	if (
		sha256(await readFile(historicalT639TerminalPath)) !==
			ANGULAR_REALWORLD_T639_TERMINAL_SHA256 ||
		sha256(await readFile(historicalT641TerminalPath)) !==
			ANGULAR_REALWORLD_T641_TERMINAL_SHA256
	)
		throw new Error('Angular RealWorld preserved terminal identity differs');
}

async function command(commandPath: string, args: readonly string[], cwd: string): Promise<string> {
	return await new Promise((resolve, reject) => {
		const child = spawn(commandPath, [...args], {
			cwd,
			env: {
				...process.env,
				PATH: `${path.dirname(node)}:${process.env.PATH ?? ''}`,
				NODE_PATH: path.join(cwd, 'node_modules'),
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
				CI: '1',
			},
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const chunks: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
		child.once('error', reject);
		child.once('exit', (code) => {
			const log = Buffer.concat(chunks).toString('utf8');
			if (code !== 0)
				reject(new Error(`Angular RealWorld production build failed: ${sha256(log)}`));
			else resolve(log);
		});
	});
}

async function filesBelow(directory: string): Promise<string[]> {
	const result: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) result.push(...(await filesBelow(item)));
		else if (entry.isFile()) result.push(item);
		else throw new Error('Angular RealWorld production tree contains a special entry');
	}
	return result.sort();
}

async function treeDigest(directory: string): Promise<string> {
	const rows = await Promise.all(
		(await filesBelow(directory)).map(
			async (file) => `${path.relative(directory, file)}\0${sha256(await readFile(file))}`,
		),
	);
	return sha256(rows.join('\n'));
}

async function build(source: string): Promise<{ digest: string; directory: string; log: string }> {
	await rm(path.join(source, 'dist'), { recursive: true, force: true });
	const log = await command(node, [launcher, source], source);
	const indexes = (await filesBelow(path.join(source, 'dist'))).filter(
		(file) => path.basename(file) === 'index.html',
	);
	if (indexes.length !== 1)
		throw new Error('Angular RealWorld production index cardinality differs');
	const directory = path.dirname(indexes[0]!);
	return { digest: await treeDigest(directory), directory, log };
}

function occurrenceCount(value: string, target: string): number {
	let count = 0;
	let offset = 0;
	while (true) {
		const found = value.indexOf(target, offset);
		if (found < 0) return count;
		count += 1;
		offset = found + target.length;
	}
}

function slugify(value: string): string {
	let result = '';
	for (const character of value.toLowerCase()) {
		const code = character.charCodeAt(0);
		const alphaNumeric = (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
		if (alphaNumeric) result += character;
		else if (result.length > 0 && !result.endsWith('-')) result += '-';
	}
	return result.endsWith('-') ? result.slice(0, -1) : result;
}

function profile(state: State, username: string, viewer?: string) {
	const user = state.users.get(username);
	if (user === undefined) return undefined;
	return {
		username: user.username,
		bio: user.bio,
		image: user.image,
		following: viewer !== undefined && state.follows.has(`${viewer}:${username}`),
	};
}

function publicUser(user: User) {
	return {
		email: user.email,
		token: user.token,
		username: user.username,
		bio: user.bio,
		image: user.image,
	};
}

function articleView(state: State, article: Article, viewer?: string) {
	return {
		slug: article.slug,
		title: article.title,
		description: article.description,
		body: article.body,
		tagList: article.tagList,
		createdAt: article.createdAt,
		updatedAt: article.updatedAt,
		favorited: viewer !== undefined && article.favoritedBy.has(viewer),
		favoritesCount: article.favoritedBy.size,
		author: profile(state, article.author, viewer),
	};
}

async function requestBody(request: IncomingMessage): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(Buffer.from(chunk));
	if (chunks.length === 0) return {};
	return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function authenticated(state: State, request: IncomingMessage): User | undefined {
	const authorization = request.headers.authorization;
	if (authorization === undefined || !authorization.startsWith('Token ')) return undefined;
	const token = authorization.slice('Token '.length);
	return [...state.users.values()].find((user) => user.token === token);
}

function respond(
	state: State,
	response: ServerResponse,
	method: string,
	pathname: string,
	status: number,
	value: unknown,
): void {
	state.ledger.push({ method, pathname, status });
	const body = value === undefined ? '' : JSON.stringify(value);
	response.writeHead(status, {
		'content-type': value === undefined ? 'text/plain' : 'application/json',
		'content-length': Buffer.byteLength(body),
		'cache-control': 'no-store',
	});
	response.end(body);
}

export function createConduitState(): State {
	return {
		users: new Map(),
		articles: new Map(),
		comments: new Map(),
		follows: new Set(),
		nextCommentId: 1,
		ledger: [],
	};
}

export async function handleConduitApi(
	state: State,
	request: IncomingMessage,
	response: ServerResponse,
): Promise<void> {
	const method = request.method ?? 'GET';
	const parsed = parseURL(request.url ?? '/api');
	const pathname = parsed.pathname || '/api';
	const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
	const api = segments[0] === 'api' ? segments.slice(1) : segments;
	const viewer = authenticated(state, request);
	const body = method === 'GET' || method === 'DELETE' ? {} : await requestBody(request);
	if (api[0] === 'users' && api.length === 1 && method === 'POST') {
		const input = body.user as Record<string, string>;
		const user: User = {
			username: input.username,
			email: input.email,
			password: input.password,
			token: `token-${input.username}`,
			bio: '',
			image: '',
		};
		state.users.set(user.username, user);
		return respond(state, response, method, pathname, 201, { user: publicUser(user) });
	}
	if (api.join('/') === 'users/login' && method === 'POST') {
		const input = body.user as Record<string, string>;
		const user = [...state.users.values()].find(
			(candidate) => candidate.email === input.email && candidate.password === input.password,
		);
		return respond(
			state,
			response,
			method,
			pathname,
			user === undefined ? 422 : 200,
			user === undefined
				? { errors: { credentials: ['invalid'] } }
				: { user: publicUser(user) },
		);
	}
	if (api[0] === 'user' && api.length === 1) {
		if (viewer === undefined)
			return respond(state, response, method, pathname, 401, {
				errors: { user: ['required'] },
			});
		if (method === 'PUT') Object.assign(viewer, body.user as Record<string, string>);
		return respond(state, response, method, pathname, 200, { user: publicUser(viewer) });
	}
	if (api[0] === 'tags' && method === 'GET') {
		const tags = [
			...new Set([...state.articles.values()].flatMap((article) => article.tagList)),
		].sort();
		return respond(state, response, method, pathname, 200, { tags });
	}
	if (api[0] === 'profiles' && api[1] !== undefined) {
		const selected = profile(state, api[1], viewer?.username);
		if (selected === undefined)
			return respond(state, response, method, pathname, 404, {
				errors: { profile: ['missing'] },
			});
		if (api[2] === 'follow' && viewer !== undefined) {
			const key = `${viewer.username}:${api[1]}`;
			if (method === 'POST') state.follows.add(key);
			if (method === 'DELETE') state.follows.delete(key);
		}
		return respond(state, response, method, pathname, 200, {
			profile: profile(state, api[1], viewer?.username),
		});
	}
	if (api[0] === 'articles' && (api.length === 1 || api[1] === 'feed')) {
		if (method === 'POST') {
			if (viewer === undefined)
				return respond(state, response, method, pathname, 401, {
					errors: { user: ['required'] },
				});
			const input = body.article as Record<string, unknown>;
			const title = String(input.title);
			const article: Article = {
				slug: slugify(title),
				title,
				description: String(input.description),
				body: String(input.body),
				tagList: Array.isArray(input.tagList) ? input.tagList.map(String) : [],
				author: viewer.username,
				createdAt: '2026-08-10T00:00:00.000Z',
				updatedAt: '2026-08-10T00:00:00.000Z',
				favoritedBy: new Set(),
			};
			state.articles.set(article.slug, article);
			return respond(state, response, method, pathname, 201, {
				article: articleView(state, article, viewer.username),
			});
		}
		let articles = [...state.articles.values()];
		const query = getQuery(request.url ?? '');
		if (typeof query.author === 'string')
			articles = articles.filter((article) => article.author === query.author);
		if (typeof query.favorited === 'string')
			articles = articles.filter((article) =>
				article.favoritedBy.has(query.favorited as string),
			);
		if (typeof query.tag === 'string')
			articles = articles.filter((article) => article.tagList.includes(query.tag as string));
		if (api[1] === 'feed' && viewer !== undefined)
			articles = articles.filter((article) =>
				state.follows.has(`${viewer.username}:${article.author}`),
			);
		return respond(state, response, method, pathname, 200, {
			articles: articles.map((article) => articleView(state, article, viewer?.username)),
			articlesCount: articles.length,
		});
	}
	if (api[0] === 'articles' && api[1] !== undefined) {
		const slug = api[1];
		const article = state.articles.get(slug);
		if (article === undefined)
			return respond(state, response, method, pathname, 404, {
				errors: { article: ['missing'] },
			});
		if (api[2] === 'favorite' && viewer !== undefined) {
			if (method === 'POST') article.favoritedBy.add(viewer.username);
			if (method === 'DELETE') article.favoritedBy.delete(viewer.username);
			return respond(state, response, method, pathname, 200, {
				article: articleView(state, article, viewer.username),
			});
		}
		if (api[2] === 'comments') {
			const comments = state.comments.get(slug) ?? [];
			if (method === 'GET')
				return respond(state, response, method, pathname, 200, {
					comments: comments.map((comment) => ({
						...comment,
						author: profile(state, comment.author, viewer?.username),
					})),
				});
			if (method === 'POST' && viewer !== undefined) {
				const input = (body.comment ?? {}) as Record<string, string>;
				const comment: Comment = {
					id: state.nextCommentId++,
					body: input.body,
					author: viewer.username,
					createdAt: '2026-08-10T00:00:00.000Z',
					updatedAt: '2026-08-10T00:00:00.000Z',
				};
				comments.push(comment);
				state.comments.set(slug, comments);
				return respond(state, response, method, pathname, 201, {
					comment: {
						...comment,
						author: profile(state, comment.author, viewer.username),
					},
				});
			}
			if (method === 'DELETE' && api[3] !== undefined) {
				state.comments.set(
					slug,
					comments.filter((comment) => comment.id !== Number(api[3])),
				);
				return respond(state, response, method, pathname, 204, undefined);
			}
		}
		if (method === 'GET')
			return respond(state, response, method, pathname, 200, {
				article: articleView(state, article, viewer?.username),
			});
		if (method === 'PUT') {
			const input = body.article as Record<string, unknown>;
			article.title = String(input.title);
			article.description = String(input.description);
			article.body = String(input.body);
			article.tagList = Array.isArray(input.tagList)
				? input.tagList.map(String)
				: article.tagList;
			article.updatedAt = '2026-08-10T00:01:00.000Z';
			const nextSlug = slugify(article.title);
			state.articles.delete(slug);
			article.slug = nextSlug;
			state.articles.set(nextSlug, article);
			const comments = state.comments.get(slug);
			if (comments !== undefined) {
				state.comments.delete(slug);
				state.comments.set(nextSlug, comments);
			}
			return respond(state, response, method, pathname, 200, {
				article: articleView(state, article, viewer?.username),
			});
		}
		if (method === 'DELETE') {
			state.articles.delete(slug);
			state.comments.delete(slug);
			return respond(state, response, method, pathname, 204, undefined);
		}
	}
	respond(state, response, method, pathname, 404, { errors: { route: ['unknown'] } });
}

function contentType(file: string): string {
	const extension = path.extname(file);
	if (extension === '.html') return 'text/html';
	if (extension === '.js') return 'text/javascript';
	if (extension === '.css') return 'text/css';
	if (extension === '.ico') return 'image/x-icon';
	return 'application/octet-stream';
}

async function startServer(directory: string, state: State) {
	const server = createServer(async (request, response) => {
		const pathname = parseURL(request.url ?? '/').pathname || '/';
		try {
			if (pathname === '/api' || pathname.startsWith('/api/'))
				return await handleConduitApi(state, request, response);
			const candidate = pathname === '/' ? 'index.html' : pathname.slice(1);
			const resolved = path.resolve(directory, candidate);
			const relative = path.relative(directory, resolved);
			const safe =
				relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative);
			const selected =
				safe && (await exists(resolved)) && (await stat(resolved)).isFile()
					? resolved
					: path.join(directory, 'index.html');
			const bytes = await readFile(selected);
			response.writeHead(200, {
				'content-type': contentType(selected),
				'content-length': bytes.length,
				'cache-control': 'no-store',
			});
			response.end(bytes);
		} catch (error) {
			response.writeHead(500, { 'content-type': 'text/plain' });
			response.end(error instanceof Error ? error.message : String(error));
		}
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	const address = server.address() as AddressInfo;
	return {
		origin: `http://127.0.0.1:${address.port}`,
		close: async () =>
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error === undefined ? resolve() : reject(error))),
			),
	};
}

function pageRecord(value: unknown): PageRecord {
	const page = (value as { boxes?: Array<{ pages?: PageRecord[] }> }).boxes?.[0]?.pages?.[0];
	if (page === undefined) throw new Error('Angular RealWorld stateful Witness page is absent');
	return page;
}

async function runUser(options: {
	lane: 'angular15' | 'angular16';
	pass: 1 | 2;
	user: 'author' | 'reader';
	origin: string;
	receiptDirectory: string;
	expectCommentFailure?: boolean;
}): Promise<{
	page: PageRecord;
	locality: { successfulNonLoopback: 0; mockedNonLoopback: number };
	error: string | null;
}> {
	const suffix = `${options.lane}-${options.pass}`;
	const username = `versionless-${options.user}-${suffix}`;
	const email = `${username}@example.invalid`;
	const password = 'local-only-password';
	const articleTitle =
		options.user === 'author'
			? `Versionless Stateful Parity ${suffix}`
			: `Reader Draft ${suffix}`;
	const updatedTitle = `${articleTitle} Updated`;
	const host = createPlaywrightWitnessHost({
		chromiumExecutable,
		transport: async (request) => {
			if (request.host.startsWith('127.0.0.1:')) return { action: 'continue' };
			if (request.resourceType === 'stylesheet')
				return {
					action: 'fulfill',
					status: 204,
					contentType: 'text/css',
					body: Buffer.alloc(0),
				};
			throw new Error(`Angular RealWorld refused nonloopback ${request.resourceType}`);
		},
	});
	const journey: BoxRunFn = async (context) => {
		const page = await context.browser.visit(`${options.origin}/register`);
		await page.trackEvents('click', 'input', 'keydown');
		await page.type('input[placeholder="Username"]', username);
		await page.type('input[placeholder="Email"]', email);
		await page.type('input[placeholder="Password"]', password);
		await page.click('button[type="submit"]');
		await context.expect.page.bodyText(page, { contains: username });
		await page.reload();
		await context.expect.page.bodyText(page, { contains: username });
		await page.click('a[href="/settings"]');
		await page.click('button.btn-outline-danger');
		await context.expect.page.bodyText(page, { contains: 'Sign in' });
		await page.click('a[href="/login"]');
		await page.type('input[placeholder="Email"]', email);
		await page.type('input[placeholder="Password"]', password);
		await page.click('button[type="submit"]');
		await context.expect.page.bodyText(page, { contains: username });
		if (options.user === 'reader') {
			await page.click('.feed-toggle li:nth-child(2) a');
			await context.expect.page.bodyText(page, {
				contains: `Versionless Stateful Parity ${suffix} Updated`,
			});
			await page.click('.article-preview a.preview-link');
			await page.click('app-favorite-button button');
			await context.expect.page.bodyText(page, { contains: 'Unfavorite Article' });
			await page.click('app-follow-button button');
			await context.expect.page.bodyText(page, { contains: 'Unfollow' });
			await page.type('textarea[placeholder="Write a comment..."]', 'Reader local comment');
			await page.click('form.comment-form button[type="submit"]');
			await context.expect.page.bodyText(page, { contains: 'Reader local comment' });
			await page.click('app-article-comment .ion-trash-a');
			await page.reload();
			await context.expect.page.bodyText(page, { notContains: 'Reader local comment' });
		}
		await page.click('a[href="/editor"]');
		await page.type('input[placeholder="Article Title"]', articleTitle);
		await page.type('input[placeholder="What\'s this article about?"]', 'Offline state parity');
		await page.type(
			'textarea[placeholder="Write your article (in markdown)"]',
			'Synthetic local body',
		);
		await page.type('input[placeholder="Enter tags"]', 'versionless-local');
		await page.press('input[placeholder="Enter tags"]', 'Enter');
		await page.click('button.btn-primary[type="button"]');
		await context.expect.page.bodyText(page, { contains: articleTitle });
		await page.type('textarea[placeholder="Write a comment..."]', 'Author local comment');
		await page.click('form.comment-form button[type="submit"]');
		await context.expect.page.bodyText(page, { contains: 'Author local comment' });
		if (options.expectCommentFailure) return;
		await page.click('app-article-comment .ion-trash-a');
		await page.click('a[href^="/editor/"]');
		await page.press('input[placeholder="Article Title"]', 'a', {
			modifiers: process.platform === 'darwin' ? ['Meta'] : ['Control'],
		});
		await page.press('input[placeholder="Article Title"]', 'Backspace');
		await page.type('input[placeholder="Article Title"]', updatedTitle);
		await page.click('button.btn-primary[type="button"]');
		await context.expect.page.bodyText(page, { contains: updatedTitle });
		await page.reload();
		await context.expect.page.bodyText(page, { contains: updatedTitle });
		await page.click('a[href="/"]');
		await page.click('.sidebar .tag-pill');
		await context.expect.page.bodyText(page, { contains: updatedTitle });
		await page.click(`a[href="/profile/${username}"]`);
		await context.expect.page.bodyText(page, { contains: updatedTitle });
		await page.click('.article-preview a.preview-link');
		await page.click('button.btn-outline-danger');
		await context.expect.page.bodyText(page, { notContains: updatedTitle });
		await context.receipt.capture('stateful-production-journey-complete');
	};
	const definition = box(`angular-realworld-stateful-${options.user}-${suffix}`, journey);
	const result = await runBoxes({
		root,
		boxes: [
			{
				file: path.join(root, `angular-realworld-stateful-${options.user}.box.ts`),
				relativeFile: `angular-realworld-stateful-${options.user}.box.ts`,
				exportName: 'default',
				box: definition,
			},
		],
		receiptDir: options.receiptDirectory,
		assertionTimeoutMs: options.expectCommentFailure ? 1_000 : 10_000,
		fileSystem: witnessNodeFileSystem,
		browser: host.browser,
		headless: true,
	});
	const raw = JSON.parse(await readFile(result.receiptPath, 'utf8')) as unknown;
	return {
		page: pageRecord(raw),
		locality: host.locality(),
		error: result.boxes[0]?.error?.message ?? null,
	};
}

function observation(
	lane: 'angular15' | 'angular16',
	pass: 1 | 2,
	user: 'author' | 'reader',
	result: Awaited<ReturnType<typeof runUser>>,
	outputFiles: 0,
): AngularRealworldParityRun {
	if (result.error !== null)
		throw new Error(`Angular RealWorld stateful Witness failed: ${result.error}`);
	const page = result.page;
	const consoleErrors = page.consoleMessages.filter((message) => message.level === 'error');
	const requestUrls = page.networkRequests.map((request) => request.url);
	if (
		result.locality.successfulNonLoopback !== 0 ||
		page.pageErrors.length !== 0 ||
		consoleErrors.length !== 0 ||
		page.failedRequests.length !== 0 ||
		requestUrls.some((url) => {
			const parsed = parseURL(url);
			return parsed.host?.startsWith('127.0.0.1:') !== true && parsed.protocol !== 'data:';
		})
	)
		throw new Error('Angular RealWorld stateful Witness locality/runtime differs');
	const behavior = {
		interactions: page.interactions.map((interaction) => interaction.kind),
		navigationPaths: page.navigations.map((navigation) => parseURL(navigation.url).pathname),
		methods: [...new Set(page.networkRequests.map((request) => request.method))].sort(),
	};
	return {
		lane,
		pass,
		user,
		result: 'pass',
		directWitnessModule: 'link:../witness',
		actions: {
			registration: true,
			login: true,
			sessionReload: true,
			articleCreate: true,
			articleRead: true,
			articleUpdate: true,
			articleDelete: true,
			tagsFilter: true,
			profile: true,
			favorite: true,
			follow: true,
			commentCreate: true,
			commentDelete: true,
		},
		behaviorDigest: sha256(canonicalize(behavior)),
		requestMethods: behavior.methods,
		pageErrors: [],
		consoleErrors: [],
		failedRequests: [],
		nonloopback: 0,
		serviceWorkers: { outputFiles, registrations: 0, controllers: 0, requests: 0 },
	};
}

async function serviceWorkerOutputFiles(directory: string): Promise<number> {
	return (await filesBelow(directory)).filter((file) => {
		const name = path.basename(file).toLowerCase();
		return name === 'ngsw-worker.js' || name === 'service-worker.js' || name === 'sw.js';
	}).length;
}

async function executeLane(
	lane: 'angular15' | 'angular16',
	directory: string,
): Promise<AngularRealworldParityRun[]> {
	const outputFiles = await serviceWorkerOutputFiles(directory);
	if (outputFiles !== 0)
		throw new Error('Angular RealWorld production output contains a service worker');
	const runs: AngularRealworldParityRun[] = [];
	for (const pass of [1, 2] as const) {
		const state = createConduitState();
		const server = await startServer(directory, state);
		try {
			for (const user of ['author', 'reader'] as const) {
				const result = await runUser({
					lane,
					pass,
					user,
					origin: server.origin,
					receiptDirectory: path.join(work, 'witness', lane, `pass-${pass}`, user),
				});
				runs.push(observation(lane, pass, user, result, 0));
			}
		} finally {
			await server.close();
		}
	}
	return runs;
}

async function mutateAndRestore(targetSource: string, overlayDigest: string) {
	const commentsFile = path.join(targetSource, 'src/app/core/services/comments.service.ts');
	const before = await readFile(commentsFile);
	const sourceHash = sha256(before);
	const source = before.toString('utf8');
	if (occurrenceCount(source, '/comments') !== 3)
		throw new Error('Angular RealWorld exact comment endpoint representation differs');
	await writeFile(commentsFile, source.split('/comments').join('/commentz'));
	const mutated = await build(targetSource);
	const state = createConduitState();
	const server = await startServer(mutated.directory, state);
	let result: Awaited<ReturnType<typeof runUser>>;
	try {
		result = await runUser({
			lane: 'angular16',
			pass: 1,
			user: 'author',
			origin: server.origin,
			receiptDirectory: path.join(work, 'witness/mutation'),
			expectCommentFailure: true,
		});
	} finally {
		await server.close();
	}
	if (
		result.error === null ||
		!result.error.includes('Author local comment') ||
		!result.page.interactions.some((interaction) => interaction.kind === 'click')
	)
		throw new Error(
			'Angular RealWorld comment mutation did not fail only its visible assertion',
		);
	await writeFile(commentsFile, before);
	if (sha256(await readFile(commentsFile)) !== sourceHash)
		throw new Error('Angular RealWorld comment source restoration differs');
	const restored = await build(targetSource);
	if (restored.digest !== overlayDigest)
		throw new Error('Angular RealWorld comment build restoration differs');
	return { restoredBuildDigest: restored.digest };
}

export async function runAngularRealworldProductionParity(): Promise<AngularRealworldProductionParityReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular RealWorld production parity requires dual offline controls');
	await mkdir(output, { recursive: true });
	await assertHistoricalTerminalIdentities();
	await claimAngularRealworldT643Attempt(output);
	await rm(work, { recursive: true, force: true });
	try {
		const [v15First, v16First, v15Second, v16Second] = await Promise.all([
			verifyAngularRealWorldAcquisition(),
			verifyAngularRealWorldV16(),
			verifyAngularRealWorldAcquisition(),
			verifyAngularRealWorldV16(),
		]);
		if (
			v15First.integrity.canonicalDigest !== v15Second.integrity.canonicalDigest ||
			v16First.integrity.canonicalDigest !== v16Second.integrity.canonicalDigest
		)
			throw new Error('Angular RealWorld closure replay differs');
		await verifyLinkedWitnessProvenance(root);
		if ((await command(node, ['--version'], root)).trim() !== 'v18.20.8')
			throw new Error('Angular RealWorld retained runtime identity differs');
		const prepared = {} as Record<
			'angular15' | 'angular16',
			{ source: string; overlay: { digest: string; directory: string } }
		>;
		for (const lane of ['angular15', 'angular16'] as const) {
			const source = path.join(work, 'lanes', lane);
			await cp(sourceLanes[lane], source, { recursive: true });
			const untouched = await build(source);
			if (untouched.digest !== acceptedBuilds[lane])
				throw new Error(`Angular RealWorld ${lane} untouched build identity differs`);
			const interceptor = path.join(source, 'src/app/core/interceptors/api.interceptor.ts');
			const before = await readFile(interceptor, 'utf8');
			if (occurrenceCount(before, overlayFrom) !== 1)
				throw new Error(`Angular RealWorld ${lane} API origin representation differs`);
			await writeFile(interceptor, before.replace(overlayFrom, overlayTo));
			const overlay = await build(source);
			const retained = path.join(work, 'dist', lane);
			await cp(overlay.directory, retained, { recursive: true });
			prepared[lane] = { source, overlay: { digest: overlay.digest, directory: retained } };
		}
		const runs = [
			...(await executeLane('angular15', prepared.angular15.overlay.directory)),
			...(await executeLane('angular16', prepared.angular16.overlay.directory)),
		];
		const mutation = await mutateAndRestore(
			prepared.angular16.source,
			prepared.angular16.overlay.digest,
		);
		const receipt = finalizeAngularRealworldProductionParity({
			schemaVersion: 'versionless.angular-realworld-production-parity.v1',
			result: 'pass',
			counted: false,
			source: {
				parentCommit: 'e28c8969aab9a27ece9873118b1ab7251f9ccb0c',
				childCommit: '0d28f5c63b9cd678a3f1f724f68d6e41363bdd5a',
				v15ClosureDigest:
					'4662a5453117b8acf46997880dd9a331ce86e9d8bf9a82dbde1f51694ab92f65',
				v16ClosureDigest:
					'0361276affa5c44353401a306226ed19c73628a8aa51260fe6926194119d612c',
			},
			builds: {
				runtime: 'Node 18.20.8',
				productionAot: true,
				angular15Untouched: acceptedBuilds.angular15,
				angular16Untouched: acceptedBuilds.angular16,
				overlayFrom,
				overlayTo,
				overlayOccurrences: { angular15: 1, angular16: 1 },
				angular15Overlay: prepared.angular15.overlay.digest,
				angular16Overlay: prepared.angular16.overlay.digest,
			},
			runs,
			mutation: {
				lane: 'angular16',
				file: 'src/app/core/services/comments.service.ts',
				from: '/comments',
				to: '/commentz',
				intendedFailure: 'visible-created-comment-assertion',
				unrelatedAssertionsPassed: true,
				sourceRestoredByteIdentically: true,
				buildRestoredByteIdentically: true,
				restoredBuildDigest: mutation.restoredBuildDigest,
			},
			locality: {
				mode: 'offline',
				successfulNonloopback: 0,
				serviceWorkerOutputFiles: 0,
				serviceWorkerRegistrations: 0,
				serviceWorkerControllers: 0,
				serviceWorkerRequests: 0,
			},
			nonclaims: [
				'This deepens one already-counted Angular lineage and does not add a distinct application, pilot, certification, authenticity, OS-wide isolation, or compliance claim.',
			],
		});
		parseAngularRealworldProductionParity(receipt);
		await assertHistoricalTerminalIdentities();
		await writeFile(
			t643ReceiptPath,
			`${canonicalize({
				schemaVersion: 'versionless.angular-realworld-production-parity-attempt-receipt.v1',
				attempt: ANGULAR_REALWORLD_T643_ATTEMPT,
				result: 'pass',
				canonicalDigest: receipt.integrity.canonicalDigest,
				receipt,
			})}\n`,
			{ flag: 'wx' },
		);
		await writeFile(receiptPath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
		await assertHistoricalTerminalIdentities();
		return receipt;
	} catch (error) {
		await assertHistoricalTerminalIdentities();
		try {
			await writeFile(
				t643TerminalPath,
				`${canonicalize({
					schemaVersion:
						'versionless.angular-realworld-production-parity-t643-terminal.v1',
					attempt: ANGULAR_REALWORLD_T643_ATTEMPT,
					result: 'failed',
					reason: error instanceof Error ? error.message : String(error),
				})}\n`,
				{ flag: 'wx' },
			);
		} catch (publicationError) {
			throw new AggregateError(
				[error, publicationError],
				'Angular RealWorld T643 failure and terminal publication collision',
			);
		}
		throw error;
	}
}

export async function main(): Promise<void> {
	if (!process.argv.slice(2).includes('--run'))
		throw new Error('Angular RealWorld production parity requires --run');
	process.stdout.write(`${canonicalize(await runAngularRealworldProductionParity())}\n`);
}

if (process.argv[1]?.endsWith('angular-realworld-production-parity-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
