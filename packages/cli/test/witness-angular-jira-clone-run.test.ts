import { describe, expect, it } from 'vitest';
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
