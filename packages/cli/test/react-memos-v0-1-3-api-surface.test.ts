import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'pathe';
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
	MEMOS_SEED_AMENDMENT,
	MEMOS_SIGNIN_VALIDATOR,
	memosSeedDigest,
	memosSigninValidates,
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
		// The credentials-only amendment is published with the digests it moved.
		expect(record.projection.seedAmendment).toEqual(MEMOS_SEED_AMENDMENT);
		expect(record.projection.seedAmendment.supersededSeedSha256).not.toBe(memosSeedDigest());
		expect(record.projection.seedAmendment.supersededBehaviorDigest).not.toBe(
			MEMOS_PROJECTION_BEHAVIOR_DIGEST,
		);
		expect(record.projection.signinValidator.config).toEqual(MEMOS_SIGNIN_VALIDATOR);
		expect(record.projection.signinValidator.ownerEmailPasses).toBe(true);
		expect(record.projection.signinValidator.ownerPasswordPasses).toBe(true);
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

	it('seeds an owner pair the pinned sign-in form would actually send, and records why it moved', () => {
		const owner = MEMOS_SEED.users[0]!;
		const password = MEMOS_SEED.credentials[0]!.password;
		// The application's own validator is the gate a journey has to clear.
		expect(memosSigninValidates(owner.email)).toBe(true);
		expect(memosSigninValidates(password)).toBe(true);
		expect(owner.email.length).toBeLessThanOrEqual(MEMOS_SIGNIN_VALIDATOR.maxLength);
		expect(password.length).toBeLessThanOrEqual(MEMOS_SIGNIN_VALIDATOR.maxLength);
		// The superseded pair is exactly what that validator refused, which is the
		// whole authority for the amendment.
		expect(memosSigninValidates(MEMOS_SEED_AMENDMENT.supersededOwnerEmail)).toBe(false);
		expect(memosSigninValidates(MEMOS_SEED_AMENDMENT.supersededOwnerPassword)).toBe(false);
		expect(owner.email).not.toBe(MEMOS_SEED_AMENDMENT.supersededOwnerEmail);
		expect(password).not.toBe(MEMOS_SEED_AMENDMENT.supersededOwnerPassword);
		// Credentials only: everything the amendment declares unchanged is unchanged.
		expect(owner.name).toBe(owner.email);
		expect(MEMOS_SEED.profile).toEqual({ mode: 'prod', version: '0.1.3' });
		expect(MEMOS_SEED.memos.map((row) => row.content).join('\n')).not.toContain('@');
		expect(MEMOS_SEED.shortcuts.map((row) => row.title)).toEqual(['Evidence', 'Migration']);
		// Still plainly synthetic and still unresolvable.
		expect(owner.email.endsWith('.invalid')).toBe(true);
		expect(password.startsWith('synthetic-')).toBe(true);
	});

	it.skipIf(!pinnedTreePresent)(
		'transcribes the sign-in validator from the pinned source rather than remembering it',
		async () => {
			const signin = await readFile(join(MEMOS_SOURCE_ROOT, 'src/pages/Signin.tsx'), 'utf8');
			const validator = await readFile(
				join(MEMOS_SOURCE_ROOT, 'src/helpers/validator.ts'),
				'utf8',
			);
			for (const [key, value] of Object.entries(MEMOS_SIGNIN_VALIDATOR))
				expect(signin).toContain(`${key}: ${String(value)},`);
			// Both fields are validated, and both before the request is ever made.
			expect(signin).toContain('validate(email, validateConfig)');
			expect(signin).toContain('validate(password, validateConfig)');
			expect(signin.indexOf('validate(password, validateConfig)')).toBeLessThan(
				signin.indexOf('await api.login(email, password)'),
			);
			// The three rules this projection transcribes are the three the pinned
			// validator actually enforces beyond length.
			expect(validator).toContain('config.noSpace && text.includes(" ")');
			expect(validator).toContain('config.noChinese && chineseReg.test(text)');
			expect(validator).toContain('text.length < config.minLength');
			expect(validator).toContain('text.length > config.maxLength');
		},
	);

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
