import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
	buildMemosApiSurfaceRecord,
	extractMemosAxiosCalls,
	MEMOS_API_SURFACE,
	MEMOS_SEED_FIXTURE,
	MEMOS_SOURCE_ROOT,
	readMemosApiSurfaceEvidence,
	verifyMemosApiSurface,
} from '../src/fixture/react-memos-v0-1-3-api-surface.ts';
import {
	createMemosProjection,
	MEMOS_PINNED_REVISION,
	MEMOS_PROJECTED_ENDPOINTS,
	MEMOS_PROJECTION_BEHAVIOR_DIGEST,
	MEMOS_SEED,
	memosSeedDigest,
} from '../src/witness/memos-projection.ts';

const pinnedTreePresent = existsSync(MEMOS_SOURCE_ROOT);

describe('Memos pinned API surface enumeration', () => {
	it('reads a helper file as a flat list of one axios call per exported function', () => {
		const sample = [
			'import axios from "axios";',
			'axios.defaults.withCredentials = true;',
			'export function getSystemStatus() {',
			'  return axios.get<ResponseObject<SystemStatus>>("/api/status");',
			'}',
			'export function getArchivedMemoList() {',
			'  return axios.get<ResponseObject<Memo[]>>("/api/memo?rowStatus=ARCHIVED");',
			'}',
			'export function patchMemo(memoPatch: MemoPatch) {',
			'  return axios.patch<ResponseObject<Memo>>(`/api/memo/${memoPatch.id}`, memoPatch);',
			'}',
		].join('\n');
		expect(extractMemosAxiosCalls(sample)).toEqual([
			{ helper: 'getSystemStatus', method: 'GET', path: '/api/status', query: null },
			{
				helper: 'getArchivedMemoList',
				method: 'GET',
				path: '/api/memo',
				query: '?rowStatus=ARCHIVED',
			},
			{ helper: 'patchMemo', method: 'PATCH', path: '/api/memo/:id', query: null },
		]);
	});

	it('publishes an enumeration that covers every projected endpoint and names what is withheld', async () => {
		const record = await readMemosApiSurfaceEvidence();
		expect(record.revision).toBe(MEMOS_PINNED_REVISION);
		expect(record.extraction.agreesWithDeclaration).toBe(true);
		expect(record.extraction.callsExtracted).toBe(MEMOS_API_SURFACE.length);
		expect(record.endpoints).toHaveLength(MEMOS_API_SURFACE.length);
		const projected = new Set(
			record.endpoints.map((entry) => entry.endpoint).filter((entry) => entry !== null),
		);
		expect([...projected].sort()).toEqual([...MEMOS_PROJECTED_ENDPOINTS].sort());
		const withheld = record.endpoints.filter((entry) => entry.endpoint === null);
		expect(withheld.map((entry) => `${entry.method} ${entry.path}`)).toEqual([
			'POST /api/resource',
		]);
		expect(record.withheldEndpoints[0]?.reason.length).toBeGreaterThan(0);
		expect(record.projection.behaviorDigest).toBe(MEMOS_PROJECTION_BEHAVIOR_DIGEST);
		expect(record.projection.seedSha256).toBe(memosSeedDigest());
		// This unit publishes the projection only.
		expect(record.scope).toContain('no journeys');
	});

	it('every enumerated endpoint the record calls projected is answered by the projection', async () => {
		const record = await readMemosApiSurfaceEvidence();
		const projection = createMemosProjection();
		await projection.api({
			method: 'POST',
			pathname: '/api/auth/login',
			search: '',
			body: Buffer.from(
				JSON.stringify({
					email: MEMOS_SEED.users[0]!.email,
					password: MEMOS_SEED.credentials[0]!.password,
				}),
			),
		});
		for (const entry of record.endpoints) {
			const response = await projection.api({
				method: entry.method,
				pathname: entry.path.replace(':id', '1'),
				search: entry.query ?? '',
				body: Buffer.alloc(0),
			});
			expect(response).not.toBeNull();
			// A projected route may reject THIS body, but it is never refused as
			// unknown or withheld; a withheld route is always refused as withheld.
			if (entry.endpoint === null) expect(response?.status).toBe(501);
			else expect(response?.status).not.toBe(404);
			if (entry.endpoint !== null) expect(response?.status).not.toBe(501);
		}
		const ledger = projection.ledger().slice(1);
		expect(ledger).toHaveLength(record.endpoints.length);
		expect(
			ledger
				.filter((item) => item.decision === 'refused-unknown')
				.map((item) => item.pathname),
		).toEqual([]);
	});

	it('commits the projection seed as fixture data that cannot drift from the projection', async () => {
		const committed = JSON.parse(await readFile(MEMOS_SEED_FIXTURE, 'utf8')) as Record<
			string,
			unknown
		> & { sha256: string };
		const { sha256: digest, ...seed } = committed;
		expect(digest).toBe(memosSeedDigest());
		expect(seed).toEqual(JSON.parse(JSON.stringify(MEMOS_SEED)));
		// The seed is labelled synthetic and carries no address that can resolve.
		expect(MEMOS_SEED.label).toBe('synthetic-fixture-evidence-data');
		expect(MEMOS_SEED.users.every((user) => user.email.endsWith('.invalid'))).toBe(true);
		expect(
			MEMOS_SEED.credentials.every((entry) => entry.password.startsWith('synthetic-')),
		).toBe(true);
	});

	it.skipIf(!pinnedTreePresent)('agrees with the pinned tree it claims to describe', async () => {
		const verification = await verifyMemosApiSurface();
		expect(verification.declaredNotExtracted).toEqual([]);
		expect(verification.extractedNotDeclared).toEqual([]);
		expect(verification.unverifiedConsumers).toEqual([]);
		expect(verification.agrees).toBe(true);
		const published = await readMemosApiSurfaceEvidence();
		expect(published.sourceSha256).toBe(verification.sourceSha256);
		expect(await buildMemosApiSurfaceRecord()).toEqual(published);
	});
});
