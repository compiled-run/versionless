import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../core/src/receipts/canonicalize.ts';
import {
	WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES,
	WITNESS_ANGULAR_JIRA_CLONE_CONSOLE_ERRORS,
	WITNESS_ANGULAR_JIRA_CLONE_FAILED_REQUESTS,
	WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS,
	WITNESS_ANGULAR_JIRA_CLONE_STYLE_PROBES,
} from '../../core/src/receipts/witness-angular-jira-clone.ts';
import { WITNESS_REAL_APP_DRAG_SURFACES } from '../../core/src/receipts/witness-real-app.ts';
import { main } from '../src/witness/angular-jira-clone-run.ts';
import {
	angularJiraCloneTransport,
	angularJiraCloneWitnessSpec,
	buildMockedNonLoopbackSeamInventory,
	JIRA_CLONE_MUTATION_SEAM,
} from '../src/witness/real-app-run.ts';

const spec = angularJiraCloneWitnessSpec();
const reportingSeam = WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS.migrated.find(
	(seam) => seam.method === 'POST',
)!;

const transportRequest = (overrides: {
	protocol: string;
	host: string;
	pathname: string;
	search?: string;
	method?: string;
	resourceType?: string;
}) => ({
	protocol: overrides.protocol,
	host: overrides.host,
	pathname: overrides.pathname,
	search: overrides.search ?? '',
	method: overrides.method ?? 'GET',
	resourceType: overrides.resourceType ?? 'image',
});

describe('jira-clone Witness journey wiring', () => {
	it('is the Angular application the drag-surface closed list names', () => {
		expect(spec.app).toBe('angular-jira-clone');
		expect(spec.framework).toBe('angular');
		expect(WITNESS_REAL_APP_DRAG_SURFACES).toContain(spec.app);
	});

	it('measures against the stated viewport the scroll-absence claim is about', () => {
		expect(spec.viewport).toEqual({ width: 1280, height: 720 });
	});

	it('declares exactly the inventories the receipt schema enforces', () => {
		expect(spec.consoleErrorInventory).toBe(WITNESS_ANGULAR_JIRA_CLONE_CONSOLE_ERRORS);
		expect(spec.failedRequestInventory).toBe(WITNESS_ANGULAR_JIRA_CLONE_FAILED_REQUESTS);
		expect(spec.cancelledDuplicateFetches).toBe(
			WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES,
		);
		expect(spec.mockedNonLoopbackSeams).toBe(WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS);
	});

	it('is bound to the two committed build lanes and their parity receipt', () => {
		expect(spec.sources).toEqual({
			baseline: '.versionless/cache/angular-jira-clone-baseline/rebuild/dist-1',
			migrated: '.versionless/stage/angular-jira-clone-mj2/dist-a',
		});
		expect(spec.canonicalReceipt).toBe(
			'evidence/runs/angular-jira-clone/mj3c-build-parity.json',
		);
		expect(spec.canonicalDigest).toHaveLength(64);
	});
});

describe('jira-clone rendered-style probes', () => {
	const probes = spec.renderedStyleProbes ?? [];

	it('declares exactly the number of probes the receipt schema requires', () => {
		expect(probes).toHaveLength(WITNESS_ANGULAR_JIRA_CLONE_STYLE_PROBES);
	});

	it('labels every probe distinctly, so a measurement cannot shadow another', () => {
		expect(new Set(probes.map((probe) => probe.label)).size).toBe(probes.length);
	});

	it('asks every probe for at least one resolved property of a real element', () => {
		for (const probe of probes) {
			expect(probe.selector.length).toBeGreaterThan(0);
			expect(probe.properties.length).toBeGreaterThan(0);
			for (const property of probe.properties) expect(property).not.toBe('');
		}
	});

	it('measures the surfaces the aggregate-stylesheet swap would have changed', () => {
		expect(probes.map((probe) => probe.label)).toEqual([
			'issue-card',
			'board-column',
			'column-header',
			'filter-input',
			'navbar',
			'sidebar',
			'document-body',
		]);
	});
});

describe('jira-clone mocked non-loopback transport', () => {
	it('answers the error-reporting envelope with the empty JSON document it expects', async () => {
		const [, host] = reportingSeam.path.split('//');
		const decision = await angularJiraCloneTransport(
			transportRequest({
				protocol: 'https:',
				host: host!.split('/')[0]!,
				pathname: `/${host!.split('/').slice(1).join('/')}`,
				search: '?sentry_version=7&sentry_key=synthetic-not-a-credential',
				method: 'POST',
				resourceType: 'fetch',
			}),
		);
		expect(decision).toEqual({
			action: 'fulfill',
			status: 200,
			contentType: 'application/json',
			body: Buffer.from('{}'),
		});
	});

	it('answers every other declared seam in-context, so nothing leaves the machine', async () => {
		for (const seam of WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS.migrated) {
			if (seam.method === 'POST') continue;
			const url = new URL(seam.path);
			const decision = await angularJiraCloneTransport(
				transportRequest({
					protocol: `${url.protocol}`,
					host: url.host,
					pathname: url.pathname,
					method: 'GET',
				}),
			);
			expect(decision.action).toBe('fulfill');
			if (decision.action === 'fulfill') {
				expect(decision.status).toBeGreaterThanOrEqual(200);
				expect(decision.status).toBeLessThan(300);
			}
		}
	});

	it('declares every seam query-free, so no account identifier can be recorded', () => {
		for (const lane of ['baseline', 'migrated'] as const)
			for (const seam of WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS[lane]) {
				expect(seam.path).not.toContain('?');
				expect(seam.path).not.toContain('#');
				expect(seam.path.startsWith('https://')).toBe(true);
			}
	});

	it('keeps every cancellable member inside the declared seam inventory', () => {
		// A cancelled non-loopback fetch is admitted only against a corroborating
		// success of the same path, and a path nobody declared could never have
		// produced one — so a member outside the inventory would be a member that
		// can never be admitted.
		for (const lane of ['baseline', 'migrated'] as const)
			for (const member of WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES[lane])
				expect(
					WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS[lane].some(
						(seam) => seam.method === member.method && seam.path === member.path,
					),
				).toBe(true);
	});

	it('declares the seams in the one order the inventory builder emits', () => {
		// The published inventory is compared to the declared list exactly, and
		// the builder emits its members sorted by canonical `{method, path}`.
		// Declaring the same endpoints in any other order is a different pin, and
		// it would fail only once a browser had already run.
		for (const lane of ['baseline', 'migrated'] as const) {
			const declared = WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS[lane].map((seam) => ({
				method: seam.method,
				path: seam.path,
			}));
			const emitted = buildMockedNonLoopbackSeamInventory(
				[],
				'http://127.0.0.1:1',
				WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS[lane],
			).category;
			expect(canonicalize(declared)).toBe(canonicalize(emitted));
		}
	});

	it('answers the two images the seeded issue description embeds', async () => {
		for (const lane of ['baseline', 'migrated'] as const) {
			const images = WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS[lane].filter((seam) =>
				seam.path.endsWith('.gif'),
			);
			expect(images).toHaveLength(2);
			for (const image of images) {
				const url = new URL(image.path);
				expect(url.host).toBe('github.com');
				expect(url.search).toBe('');
				const decision = await angularJiraCloneTransport(
					transportRequest({
						protocol: `${url.protocol}`,
						host: url.host,
						pathname: url.pathname,
						method: 'GET',
					}),
				);
				expect(decision.action).toBe('fulfill');
			}
		}
	});

	it('never lets a request through to a network', async () => {
		const decision = await angularJiraCloneTransport(
			transportRequest({
				protocol: 'https:',
				host: 'undeclared.example.invalid',
				pathname: '/pixel.gif',
			}),
		);
		expect(decision.action).toBe('fulfill');
	});
});

describe('jira-clone mutation seam', () => {
	it('is a string the journey asserts rather than an unread constant', () => {
		expect(JIRA_CLONE_MUTATION_SEAM).toBe('Selected for Development');
	});

	it('is the display name of the column the drag moves the issue into', () => {
		// The drop list's id is `Selected`; this is what the application renders
		// for it, and the reopened issue modal is where the journey reads it.
		expect(JIRA_CLONE_MUTATION_SEAM.startsWith('Selected')).toBe(true);
	});
});

describe('jira-clone published Witness receipts', () => {
	const publishedDirectory = resolve(import.meta.dirname, '../../../evidence/runs/witness-angular-jira-clone');

	it('publishes both canonical receipts', async () => {
		for (const name of ['receipt.json', 'receipt.md'])
			expect((await stat(join(publishedDirectory, name))).isFile()).toBe(true);
	});

	it('never reproduces the application’s Sentry DSN, analytics id or measurement id', async () => {
		// The query-free path policy is what makes this structural rather than a
		// filter: the identifiers live in the query of the requests the
		// application issues, and no inventory in this receipt records a query.
		// This is the assertion that says the construction actually held.
		for (const name of ['receipt.json', 'receipt.md']) {
			const text = await readFile(join(publishedDirectory, name), 'utf8');
			expect(text).not.toMatch(/https:\/\/[0-9a-f]{16,}@[\w.]*sentry\.io/i);
			expect(text).not.toMatch(/\bUA-\d{4,}-\d+\b/);
			expect(text).not.toMatch(/\bG-[A-Z0-9]{8,}\b/);
			expect(text).not.toContain('sentry_key');
			expect(text).not.toContain('measurement_id');
		}
		// Every recorded path, wherever it sits in the record. A `?` in one of
		// these is the only way an identifier could reach the file, and the
		// seeded issue titles the board renders do contain question marks — so
		// the assertion is about paths rather than about the bytes at large.
		const recorded: string[] = [];
		const walk = (value: unknown): void => {
			if (Array.isArray(value)) for (const item of value) walk(item);
			else if (value !== null && typeof value === 'object')
				for (const [key, item] of Object.entries(value)) {
					if (key === 'path' && typeof item === 'string') recorded.push(item);
					else walk(item);
				}
		};
		walk(JSON.parse(await readFile(join(publishedDirectory, 'receipt.json'), 'utf8')));
		expect(recorded.length).toBeGreaterThan(0);
		for (const path of recorded) {
			expect(path).not.toContain('?');
			expect(path).not.toContain('#');
		}
	});

	it('publishes four runs that agree on one behavioral parity digest', async () => {
		const receipt = JSON.parse(
			await readFile(join(publishedDirectory, 'receipt.json'), 'utf8'),
		) as { runs: { lane: string; pass: number; behaviorDigest: string; routes: string[] }[] };
		expect(receipt.runs).toHaveLength(4);
		expect(new Set(receipt.runs.map((run) => run.behaviorDigest)).size).toBe(1);
		expect(receipt.runs.map((run) => `${run.lane}-${run.pass}`)).toEqual([
			'baseline-1',
			'baseline-2',
			'migrated-1',
			'migrated-2',
		]);
		for (const run of receipt.runs)
			expect(new Set(run.routes)).toEqual(new Set(['/project/board']));
	});
});

describe('jira-clone direct Witness command', () => {
	it('rejects incomplete modes without launching a browser', async () => {
		await expect(main([])).rejects.toThrow('--run-twice');
		await expect(main(['--publish', 'evidence/runs/witness-angular-jira-clone'])).rejects.toThrow(
			'--run-twice',
		);
	});

	it('refuses to publish anywhere but the canonical evidence directory', async () => {
		await expect(main(['--run-twice', '--publish', 'evidence/runs/elsewhere'])).rejects.toThrow(
			'publish path differs',
		);
	});
});
