import { access, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { anyOf, charIn, createRegExp, exactly, oneOrMore } from 'magic-regexp';
import * as path from 'pathe';
import { encodeParam, joinURL } from 'ufo';
import {
	analyzeCorpusConformance,
	deriveCorpusTransactionState,
	type CorpusConformance,
	type CorpusTransactionState,
} from '../../core/src/corpus/conformance.ts';
import { compareUtf16CodeUnits } from '../../core/src/bundlers/vite8-adapter.ts';
import { assertSyntheticEvidence } from '../../core/src/policy/payment-signals.ts';
import { canonicalize, sha256 } from '../../core/src/receipts/canonicalize.ts';
import { verifyReceipt } from '../../core/src/receipts/verify.ts';
import { buildCapabilityCoverage } from '../../core/src/receipts/capability-coverage.ts';
import {
	ANGULAR_REALWORLD_V15_TO_V16_RECEIPT,
	verifyAngularRealworldV15ToV16Evidence,
} from '../../core/src/receipts/angular-realworld-v15-to-v16.ts';
import {
	NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
	verifyNextKilledByGoogleEvidence,
} from '../../core/src/receipts/next-killedbygoogle.ts';
import {
	WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
	verifyWitnessAngularRealworldEvidence,
} from '../../core/src/receipts/witness-angular-realworld.ts';
import {
	WITNESS_REACT_BOILERPLATE_RECEIPT_PATH,
	verifyWitnessReactBoilerplateEvidence,
} from '../../core/src/receipts/witness-react-boilerplate.ts';
import {
	WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
	verifyWitnessNextKilledByGoogleEvidence,
} from '../../core/src/receipts/witness-next-killedbygoogle.ts';
import {
	REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH,
	verifyReactAvataaarsCompatibilityEvidence,
} from '../../core/src/receipts/react-avataaars-compatibility.ts';
import {
	REACT_CALCULATOR_RECEIPT_PATH,
	verifyReactCalculatorEvidence,
} from '../../core/src/receipts/react-calculator.ts';
import {
	REACT_GRAPHIQL_013_RECEIPT_PATH,
	verifyReactGraphiQL013Evidence,
} from '../../core/src/receipts/react-graphiql-013.ts';
import {
	WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
	verifyWitnessReactBoilerplateZeroSwEvidence,
} from '../../core/src/receipts/react-boilerplate-zero-sw.ts';
import {
	REACT_PAPERCUPS_FIXTURE,
	REACT_PAPERCUPS_RECEIPT_PATH,
	verifyWitnessReactPapercupsEvidence,
	WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
} from '../../core/src/receipts/witness-react-papercups.ts';
import {
	REACT_HOSPITALRUN_FIXTURE,
	REACT_HOSPITALRUN_RECEIPT_PATH,
	verifyWitnessReactHospitalrunEvidence,
	WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
} from '../../core/src/receipts/witness-react-hospitalrun.ts';
import {
	ANGULAR_FACTORIOLAB_FIXTURE,
	verifyWitnessAngularFactoriolabEvidence,
	WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
} from '../../core/src/receipts/witness-angular-factoriolab.ts';
import {
	ANGULAR_JIRA_CLONE_FIXTURE,
	verifyWitnessAngularJiraCloneEvidence,
	WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
} from '../../core/src/receipts/witness-angular-jira-clone.ts';
import {
	REACT_MEMOS_FIXTURE,
	verifyWitnessReactMemosEvidence,
	WITNESS_REACT_MEMOS_RECEIPT_PATH,
} from '../../core/src/receipts/witness-react-memos.ts';
import {
	NEXT_KILLEDBYGOOGLE_V3_FIXTURE,
	verifyWitnessNextKilledbygoogleV3Evidence,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
} from '../../core/src/receipts/witness-next-killedbygoogle-v3.ts';
import {
	REACT_LINKFREE_FIXTURE,
	verifyWitnessReactLinkfreeEvidence,
	WITNESS_REACT_LINKFREE_RECEIPT_PATH,
} from '../../core/src/receipts/witness-react-linkfree.ts';
import {
	ANGULAR_TINY_TRANSLATOR_FIXTURE,
	verifyWitnessAngularTinyTranslatorEvidence,
	WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
} from '../../core/src/receipts/witness-angular-tiny-translator.ts';
import {
	ANGULAR_SUPER_PRODUCTIVITY_FIXTURE,
	verifyWitnessAngularSuperProductivityEvidence,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
} from '../../core/src/receipts/witness-angular-super-productivity.ts';
import { verifyScriptSurface } from '../../core/src/enterprise/script-surface.ts';
import {
	parseRuntimeObservationConfig,
	type RuntimeScriptObservation,
	verifyRuntimeScriptObservationEvidence,
} from '../../core/src/enterprise/runtime-script-observation.ts';
import { adapterFreezeRecord } from './freeze.ts';
import { lockPackages, osvRequest } from './ingest.ts';
import { renderTrustReport } from './render.ts';
import {
	CISA_KEV_URL,
	MAX_VULNERABILITY_AGE_MS,
	OSV_BATCH_URL,
	TRUST_SCHEMA,
	assertPortableEvidence,
	asRecord,
	asString,
	parseIngestRecord,
	type EvidenceState,
	type ManifestArtifact,
	type PackageCoordinate,
	type TrustManifest,
	packageVersionWithoutPeerContext,
	validatePackageCoordinate,
} from './schema.ts';

export function reactAvataaarsCompatibilityTrustReceipts(
	transaction: CorpusTransactionState,
): Array<{ path: typeof REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH; digest: null }> {
	return transaction.kind === 'react-avataaars-candidate'
		? [{ path: REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH, digest: null }]
		: [];
}

export function reactCalculatorTrustReceipts(
	transaction: CorpusTransactionState,
): Array<{ path: typeof REACT_CALCULATOR_RECEIPT_PATH; digest: null }> {
	return transaction.kind === 'react-calculator-candidate'
		? [{ path: REACT_CALCULATOR_RECEIPT_PATH, digest: null }]
		: [];
}

export function reactGraphiQL013TrustReceipts(
	transaction: CorpusTransactionState,
): Array<{ path: typeof REACT_GRAPHIQL_013_RECEIPT_PATH; digest: null }> {
	return transaction.kind === 'react-graphiql-013-candidate'
		? [{ path: REACT_GRAPHIQL_013_RECEIPT_PATH, digest: null }]
		: [];
}

/**
 * Exact receipt and matrix-cell counts the Papercups browser-proof transaction
 * pins for itself. They are measured facts of that state — the sixteen
 * zero-service-worker receipts plus the retained build receipt and its direct
 * browser proof, and the sixteen prior matrix cells plus the Papercups cell —
 * and no other transaction state is affected by them.
 */
export const REACT_PAPERCUPS_TRUST_RECEIPTS = 18 as const;
export const REACT_PAPERCUPS_TRUST_MATRIX_CELLS = 17 as const;

/**
 * Exact receipt and matrix-cell counts the HospitalRun browser-proof
 * transaction pins for itself: the eighteen Papercups-state receipts plus the
 * retained build-and-boot receipt and its direct browser proof, and the
 * seventeen prior matrix cells plus the HospitalRun cell. No other transaction
 * state is affected by them.
 */
export const REACT_HOSPITALRUN_TRUST_RECEIPTS = 20 as const;
export const REACT_HOSPITALRUN_TRUST_MATRIX_CELLS = 18 as const;

/**
 * Exact receipt and matrix-cell counts the factoriolab browser-proof
 * transaction pins for itself: the twenty HospitalRun-state receipts plus this
 * lane's single Witness receipt, and the eighteen prior matrix cells plus the
 * factoriolab cell. This lane adds one receipt rather than two because its
 * three build-lane receipts are sealed inside the Witness receipt rather than
 * carried as separate aggregate members. No other transaction state is
 * affected by these counts.
 */
export const ANGULAR_FACTORIOLAB_TRUST_RECEIPTS = 21 as const;
export const ANGULAR_FACTORIOLAB_TRUST_MATRIX_CELLS = 19 as const;

/**
 * Exact receipt and matrix-cell counts the jira-clone browser-proof transaction
 * pins for itself: the twenty-one factoriolab-state receipts plus this lane's
 * single Witness receipt, and the nineteen prior matrix cells plus the
 * jira-clone cell. Like factoriolab this lane adds one receipt rather than two,
 * because its four build-lane receipts are sealed inside the Witness receipt
 * rather than carried as separate aggregate members. No other transaction state
 * is affected by these counts.
 */
export const ANGULAR_JIRA_CLONE_TRUST_RECEIPTS = 22 as const;
export const ANGULAR_JIRA_CLONE_TRUST_MATRIX_CELLS = 20 as const;

/**
 * Exact receipt and matrix-cell counts the memos browser-proof transaction pins
 * for itself: the twenty-two jira-clone-state receipts plus this lane's single
 * Witness receipt, and the twenty prior matrix cells plus the memos cell. The
 * lane adds one receipt rather than two because its build-lane receipt is
 * sealed inside the Witness receipt by the sha256 of its exact bytes rather
 * than carried as a separate aggregate member. No other transaction state is
 * affected by these counts.
 */
export const REACT_MEMOS_TRUST_RECEIPTS = 23 as const;
export const REACT_MEMOS_TRUST_MATRIX_CELLS = 21 as const;

/**
 * Exact receipt and matrix-cell counts the killedbygoogle v3 browser-proof
 * transaction pins for itself: the twenty-three memos-state receipts plus this
 * lane's single Witness receipt, and the twenty-one prior matrix cells plus the
 * killedbygoogle v3 cell. Its two build-lane digests are sealed inside the
 * Witness receipt, so the lane adds one receipt rather than two. No other
 * transaction state is affected by these counts.
 */
export const NEXT_KILLEDBYGOOGLE_V3_TRUST_RECEIPTS = 24 as const;
export const NEXT_KILLEDBYGOOGLE_V3_TRUST_MATRIX_CELLS = 22 as const;

/**
 * Exact receipt and matrix-cell counts the LinkFree browser-proof transaction
 * pins for itself: the twenty-four killedbygoogle-v3-state receipts plus this
 * lane's single Witness receipt, and the twenty-two prior matrix cells plus the
 * LinkFree cell. Its build-lane receipt is sealed inside the Witness receipt by
 * both canonical digest and exact bytes, so the lane adds one receipt rather
 * than two. No other transaction state is affected by these counts.
 */
export const REACT_LINKFREE_TRUST_RECEIPTS = 25 as const;
export const REACT_LINKFREE_TRUST_MATRIX_CELLS = 23 as const;

/**
 * Exact receipt and matrix-cell counts the TinyTranslator browser-proof
 * transaction pins for itself: the twenty-five LinkFree-state receipts plus this
 * lane's single Witness receipt, and the twenty-three prior matrix cells plus
 * the TinyTranslator cell. Like factoriolab and jira-clone this lane adds one
 * receipt rather than two, because its two build-lane receipts are sealed inside
 * the Witness receipt rather than carried as separate aggregate members. No
 * other transaction state is affected by these counts.
 */
export const ANGULAR_TINY_TRANSLATOR_TRUST_RECEIPTS = 26 as const;
export const ANGULAR_TINY_TRANSLATOR_TRUST_MATRIX_CELLS = 24 as const;

/**
 * Exact receipt and matrix-cell counts the super-productivity browser-proof
 * transaction pins for itself: the twenty-six TinyTranslator-state receipts plus
 * this lane's single Witness receipt, and the twenty-four prior matrix cells
 * plus the super-productivity cell. Like factoriolab, jira-clone and
 * tiny-translator this lane adds one receipt rather than two, because its two
 * build-lane receipts are sealed inside the Witness receipt rather than carried
 * as separate aggregate members. This is the last portfolio cell of the matrix,
 * and no other transaction state is affected by these counts.
 */
export const ANGULAR_SUPER_PRODUCTIVITY_TRUST_RECEIPTS = 27 as const;
export const ANGULAR_SUPER_PRODUCTIVITY_TRUST_MATRIX_CELLS = 25 as const;

/**
 * Verifies a retained build receipt through the browser proof that seals it.
 * A sealed build receipt is not a generic migration receipt, so it is verified
 * against the exact byte digest and canonical digest the Witness receipt binds,
 * and every artifact it references is re-hashed. Nothing here is asserted from
 * a literal: the returned digest and artifact count are measured.
 */
async function verifySealedBuildReceipt(
	root: string,
	label: string,
	receiptPath: string,
	sealed: { canonicalDigest: string; sha256: string },
): Promise<{ valid: true; digest: string; artifacts: number }> {
	const bytes = await readFile(path.join(root, receiptPath));
	if (sha256(bytes) !== sealed.sha256) throw new Error(`${label} build receipt bytes drifted`);
	const receipt = asRecord(JSON.parse(bytes.toString('utf8')), `${label} build receipt`);
	const integrity = asRecord(receipt.integrity, `${label} build receipt integrity`);
	if (
		integrity.algorithm !== 'sha256' ||
		integrity.canonicalDigest !== sealed.canonicalDigest
	)
		throw new Error(`${label} build receipt integrity differs`);
	if (!Array.isArray(receipt.artifacts))
		throw new Error(`${label} build receipt artifacts are absent`);
	for (const value of receipt.artifacts) {
		const artifact = asRecord(value, `${label} build artifact`);
		const artifactPath = asString(artifact.path, `${label} build artifact path`);
		if (sha256(await readFile(path.join(root, artifactPath))) !== artifact.sha256)
			throw new Error(`${label} build artifact digest mismatch: ${artifactPath}`);
	}
	return { valid: true, digest: sealed.canonicalDigest, artifacts: receipt.artifacts.length };
}

export async function verifyReactPapercupsCanonicalReceipt(
	rootDir: string,
): Promise<{ valid: true; digest: string; artifacts: number }> {
	const root = path.resolve(rootDir);
	const witness = await verifyWitnessReactPapercupsEvidence(root);
	return verifySealedBuildReceipt(
		root,
		'React Papercups',
		REACT_PAPERCUPS_RECEIPT_PATH,
		witness.receipt.canonicalReceipt,
	);
}

export async function verifyReactHospitalrunCanonicalReceipt(
	rootDir: string,
): Promise<{ valid: true; digest: string; artifacts: number }> {
	const root = path.resolve(rootDir);
	const witness = await verifyWitnessReactHospitalrunEvidence(root);
	return verifySealedBuildReceipt(
		root,
		'React HospitalRun',
		REACT_HOSPITALRUN_RECEIPT_PATH,
		witness.receipt.canonicalReceipt,
	);
}

/**
 * The single receipt-verification dispatch shared by generation and
 * verification, so a receipt can never be verified one way when it is written
 * and another way when it is checked.
 */
export async function verifyTrustReceipt(
	root: string,
	receiptPath: string,
): Promise<{ digest: string; artifacts: number }> {
	if (receiptPath === ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path)
		return verifyAngularRealworldV15ToV16Evidence(root);
	if (receiptPath === WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH)
		return verifyWitnessAngularRealworldEvidence(root);
	if (receiptPath === WITNESS_REACT_BOILERPLATE_RECEIPT_PATH)
		return verifyWitnessReactBoilerplateEvidence(root);
	if (receiptPath === WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH)
		return verifyWitnessNextKilledByGoogleEvidence(root);
	if (receiptPath === WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH)
		return verifyWitnessReactBoilerplateZeroSwEvidence(root);
	if (receiptPath === WITNESS_REACT_PAPERCUPS_RECEIPT_PATH)
		return verifyWitnessReactPapercupsEvidence(root);
	if (receiptPath === REACT_PAPERCUPS_RECEIPT_PATH)
		return verifyReactPapercupsCanonicalReceipt(root);
	if (receiptPath === WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH)
		return verifyWitnessReactHospitalrunEvidence(root);
	if (receiptPath === REACT_HOSPITALRUN_RECEIPT_PATH)
		return verifyReactHospitalrunCanonicalReceipt(root);
	if (receiptPath === WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH)
		return verifyWitnessAngularFactoriolabEvidence(root);
	if (receiptPath === WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH)
		return verifyWitnessAngularJiraCloneEvidence(root);
	if (receiptPath === WITNESS_REACT_MEMOS_RECEIPT_PATH)
		return verifyWitnessReactMemosEvidence(root);
	if (receiptPath === WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH)
		return verifyWitnessNextKilledbygoogleV3Evidence(root);
	if (receiptPath === WITNESS_REACT_LINKFREE_RECEIPT_PATH)
		return verifyWitnessReactLinkfreeEvidence(root);
	if (receiptPath === WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH)
		return verifyWitnessAngularTinyTranslatorEvidence(root);
	if (receiptPath === WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH)
		return verifyWitnessAngularSuperProductivityEvidence(root);
	if (receiptPath === NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH)
		return verifyNextKilledByGoogleEvidence(root, true);
	if (receiptPath === REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH)
		return verifyReactAvataaarsCompatibilityEvidence(root);
	if (receiptPath === REACT_CALCULATOR_RECEIPT_PATH)
		return { ...(await verifyReactCalculatorEvidence(root)), artifacts: 5 };
	if (receiptPath === REACT_GRAPHIQL_013_RECEIPT_PATH)
		return verifyReactGraphiQL013Evidence(root);
	return verifyReceipt(path.join(root, receiptPath));
}

const PRESERVED_RECEIPTS = [
	{
		path: 'evidence/runs/react-boilerplate-v4/t008-run.json',
		digest: '4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758',
	},
	{
		path: 'evidence/runs/angular-phonecat/t014-run.json',
		digest: 'a6798081c0b005c76534b5acd4dc647d77d497b0b649748c685b779451035f51',
	},
] as const;
const MAINTAINED_RECEIPT = {
	path: 'evidence/runs/react-boilerplate-v4-node24/t022-run.json',
	digest: null,
} as const;
const VITE8_RECEIPT = {
	path: 'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
	digest: null,
} as const;
const PHONECAT_ROUTE_RECEIPT = {
	path: 'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
	digest: null,
} as const;
const PHONECAT_COMPOSED_RECEIPT = {
	path: 'evidence/runs/angular-phonecat-composed/t048-run.json',
	digest: null,
} as const;
const DATA_FLOW_RECEIPT = {
	path: 'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
	digest: null,
} as const;
const REACT_COMPOSED_RECEIPT = {
	path: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
	digest: null,
} as const;
const REACT_ZERO_SW_RECEIPT = {
	path: 'evidence/runs/react-boilerplate-v4-zero-sw/t693-run.json',
	digest: null,
} as const;
const WITNESS_REACT_ZERO_SW_RECEIPT = {
	path: WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
	digest: null,
} as const;
const REACT_PAPERCUPS_RECEIPT = {
	path: REACT_PAPERCUPS_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_REACT_PAPERCUPS_RECEIPT = {
	path: WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
	digest: null,
} as const;
const REACT_HOSPITALRUN_RECEIPT = {
	path: REACT_HOSPITALRUN_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_REACT_HOSPITALRUN_RECEIPT = {
	path: WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_ANGULAR_FACTORIOLAB_RECEIPT = {
	path: WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_ANGULAR_JIRA_CLONE_RECEIPT = {
	path: WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_REACT_MEMOS_RECEIPT = {
	path: WITNESS_REACT_MEMOS_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT = {
	path: WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_REACT_LINKFREE_RECEIPT = {
	path: WITNESS_REACT_LINKFREE_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT = {
	path: WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT = {
	path: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
	digest: null,
} as const;
const PHONECAT_VITE_RECEIPT = {
	path: 'evidence/runs/angular-phonecat-vite8/t069-run.json',
	digest: null,
} as const;
const ANGULAR_REALWORLD_RECEIPT = {
	path: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path,
	digest: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.canonicalDigest,
} as const;
const NEXT_KILLED_BY_GOOGLE_RECEIPT = {
	path: NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_ANGULAR_REALWORLD_RECEIPT = {
	path: WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_REACT_BOILERPLATE_RECEIPT = {
	path: WITNESS_REACT_BOILERPLATE_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT = {
	path: WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
	digest: null,
} as const;
export const NPM_LOCK_ACQUISITION_PREFLIGHT = {
	path: 'evidence/dependencies/dashboard-contacts/t190-preflight.json',
	sha256: '262abe9b19a10804808eadd5ae2dfcbc1fd9ac4119f9dc9571cb3df89df1d351',
	canonicalDigest: 'a14e94d4729f50cf6260431d5dea53e0ac72fa77668e9612ea17cc216c9ed044',
} as const;
export const NEXT_TAILWIND_CONSENT_FAILURE = {
	path: 'evidence/dependencies/next-tailwind-starter-blog/t465-consent-failure.json',
	sha256: '6879a532235cbdde39890676b75667ad94051b39ffb0428ea16b82dfcec87628',
	bytes: 449,
} as const;
export const NEXT_TAILWIND_EXCLUSION = {
	json: {
		path: 'evidence/dependencies/next-tailwind-starter-blog/t506-exclusion.json',
		sha256: '96f470c55a42c609a8eac9056e449e6cc74c37f8c323d3aeef80a42586b7bf40',
		bytes: 1_429,
	},
	markdown: {
		path: 'evidence/dependencies/next-tailwind-starter-blog/t506-exclusion.md',
		sha256: 'd3b104f67ca756335be46de5f790fc0018164df24bb1d75b97d23ecfb47b1688',
		bytes: 1_283,
	},
} as const;
const NEXT_TAILWIND_EXCLUSION_DOCUMENT = {
	assetProvenance: [
		{
			asset: 'mail',
			provenance: 'unmatched',
			sha256: '3483b293640c0385558ba049b313b1da004d7301451444908488b53523461e3e',
		},
		{
			asset: 'github',
			provenance: 'unproven',
			sha256: 'a57fdcb12cfe0cebec76c82367df14acac6b9ca50ba05b13610fb31330e14439',
		},
		{
			asset: 'facebook',
			provenance: 'unproven',
			sha256: '4c8e3008986f028482962ef2ef4f89208a20bf27d0f71fc837efac09145c10c6',
		},
		{
			asset: 'youtube',
			provenance: 'unproven',
			sha256: '14456d57347c7677a2e783d9d210624a46053aab3c1a134c36497dea8f0b0a25',
		},
		{
			asset: 'linkedin',
			provenance: 'unproven',
			sha256: '8ed35981a42b05b85662a16a1d5f9cd6424777c9a8fc625b46dce04e549eb62d',
		},
		{
			asset: 'twitter',
			provenance: 'unproven',
			sha256: '1536e443e9759a07eec2202a58fe33d611c9f2df10e6fd9bad40b649bbcb39b7',
		},
	],
	browser: { state: 'not-run' },
	candidate: 'next-tailwind-starter-blog',
	consumedState: { reusable: false, seeding: false },
	counted: false,
	decision: 'excluded',
	nonclaims: [
		'No install, build, browser journey, migration parity, locality, runtime, bundler, routing, rendering, API, pilot, framework, or enterprise support is established.',
		'The exclusion evidence is not certification, legal clearance, signer authenticity, compliance, or an earned SLSA level.',
	],
	provenanceComplete: false,
	readiness: 'unchanged',
	schemaVersion: 'versionless.candidate-exclusion.v1',
	scoreboard: {
		nextPilot: { accepted: 0, required: 1 },
		olderNext: { accepted: 1, required: 4 },
	},
	support: 'not-established',
} as const;
const workspaceReference = createRegExp(
	exactly('workspace:')
		.at.lineStart()
		.and(anyOf('.', oneOrMore(charIn('0123456789._/-').from('A', 'Z').from('a', 'z'))))
		.at.lineEnd(),
);

function isLicenseFilename(name: string): boolean {
	const normalized = name.toLowerCase();
	return (
		normalized === 'license' ||
		normalized === 'licence' ||
		normalized.startsWith('license.') ||
		normalized.startsWith('licence.')
	);
}

export interface GenerateTrustOptions {
	rootDir?: string;
	cacheDir?: string;
	policyPath: string;
	outputDir: string;
	offline: boolean;
	environment?: NodeJS.ProcessEnv;
	observedAt?: string;
}

async function exists(file: string): Promise<boolean> {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
}

async function filesBelow(directory: string): Promise<string[]> {
	if (!(await exists(directory))) return [];
	const output: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) output.push(...(await filesBelow(item)));
		else if (entry.isFile()) output.push(item);
	}
	return output.sort(compareUtf16CodeUnits);
}

export function validateNpmLockAcquisitionPreflight(bytes: Buffer): void {
	let value: unknown;
	try {
		value = JSON.parse(bytes.toString('utf8'));
	} catch {
		throw new Error('T190 npm lock acquisition preflight is invalid JSON');
	}
	const receipt = asRecord(value, 'T190 npm lock acquisition preflight');
	const integrity = asRecord(receipt.integrity, 'T190 preflight integrity');
	const replay = asRecord(receipt.replay, 'T190 preflight replay');
	const acquisition = asRecord(receipt.proposedAcquisition, 'T190 proposed acquisition');
	const consent = asRecord(acquisition.consent, 'T190 proposed consent');
	const network = asRecord(acquisition.network, 'T190 proposed network');
	const transaction = asRecord(acquisition.transaction, 'T190 proposed transaction');
	if (
		receipt.schemaVersion !== 'versionless.npm-lock-acquisition-preflight.v1' ||
		receipt.result !== 'not-ready' ||
		integrity.algorithm !== 'sha256' ||
		integrity.canonicalDigest !== NPM_LOCK_ACQUISITION_PREFLIGHT.canonicalDigest ||
		replay.runs !== 2 ||
		replay.identical !== true ||
		replay.networkAttempts !== 0 ||
		replay.residue !== 'none' ||
		consent.status !== 'proposed-unconsumed' ||
		consent.consumed !== false ||
		network.enabled !== false ||
		network.maximumResponseBytes !== null ||
		network.maximumAggregateBytes !== null ||
		transaction.state !== 'not-created' ||
		transaction.stagingPath !== null ||
		transaction.publicationPath !== null
	)
		throw new Error('T190 npm lock acquisition preflight safety facts differ');
	const canonical = structuredClone(receipt);
	asRecord(canonical.integrity, 'T190 canonical integrity').canonicalDigest = '';
	if (sha256(canonicalize(canonical)) !== NPM_LOCK_ACQUISITION_PREFLIGHT.canonicalDigest)
		throw new Error('T190 npm lock acquisition preflight canonical digest differs');
	if (sha256(bytes) !== NPM_LOCK_ACQUISITION_PREFLIGHT.sha256)
		throw new Error('T190 npm lock acquisition preflight file digest differs');
}

export function validateNextTailwindConsentFailure(bytes: Buffer): void {
	let value: unknown;
	try {
		value = JSON.parse(bytes.toString('utf8'));
	} catch {
		throw new Error('T465 consent failure disclosure is invalid JSON');
	}
	const disclosure = asRecord(value, 'T465 consent failure disclosure');
	if (
		bytes.length !== NEXT_TAILWIND_CONSENT_FAILURE.bytes ||
		sha256(bytes) !== NEXT_TAILWIND_CONSENT_FAILURE.sha256 ||
		disclosure.schemaVersion !== 'versionless.consent-failure.v1' ||
		disclosure.consentId !== 'T465-next-tailwind-yarn3-font-closure' ||
		disclosure.status !== 'consumed-failed' ||
		disclosure.partialBytes !== 'non-evidence' ||
		disclosure.reusable !== false ||
		disclosure.exactSourceLedger !== 'unavailable'
	)
		throw new Error('T465 consent failure disclosure safety facts differ');
}

export function renderNextTailwindExclusionMarkdown(): string {
	const document = NEXT_TAILWIND_EXCLUSION_DOCUMENT;
	return `# Tailwind/Next candidate exclusion\n\n- Candidate: \`${document.candidate}\`\n- Decision: **${document.decision}**\n- Counted: **${document.counted}**\n- Provenance complete: **${document.provenanceComplete}**\n- Browser: **${document.browser.state}**\n- Support: **${document.support}**\n- Readiness: **${document.readiness}**\n- Older Next scoreboard: **${document.scoreboard.olderNext.accepted}/${document.scoreboard.olderNext.required}**\n- Next pilot scoreboard: **${document.scoreboard.nextPilot.accepted}/${document.scoreboard.nextPilot.required}**\n- Consumed acquisition trees: **non-reusable and non-seeding**\n\n## Six unresolved asset identities\n\n${document.assetProvenance.map((asset) => `- \`${asset.asset}\` — \`${asset.sha256}\` — ${asset.provenance}`).join('\n')}\n\n## Boundaries\n\n${document.nonclaims.map((claim) => `- ${claim}`).join('\n')}\n`;
}

export function validateNextTailwindExclusion(json: Buffer, markdown: Buffer): void {
	let value: unknown;
	try {
		value = JSON.parse(json.toString('utf8'));
	} catch {
		throw new Error('T506 exclusion is invalid JSON');
	}
	if (
		json.byteLength !== NEXT_TAILWIND_EXCLUSION.json.bytes ||
		sha256(json) !== NEXT_TAILWIND_EXCLUSION.json.sha256 ||
		json.toString('utf8') !== `${canonicalize(value)}\n` ||
		canonicalize(value) !== canonicalize(NEXT_TAILWIND_EXCLUSION_DOCUMENT) ||
		markdown.byteLength !== NEXT_TAILWIND_EXCLUSION.markdown.bytes ||
		sha256(markdown) !== NEXT_TAILWIND_EXCLUSION.markdown.sha256 ||
		markdown.toString('utf8') !== renderNextTailwindExclusionMarkdown()
	)
		throw new Error('T506 exclusion evidence differs');
}

export function compareTrustResolvedDependencies(
	left: Readonly<{ uri: unknown }>,
	right: Readonly<{ uri: unknown }>,
): number {
	return compareUtf16CodeUnits(String(left.uri), String(right.uri));
}

export async function workspaceManifestPaths(root: string): Promise<string[]> {
	const relativePaths = [
		'package.json',
		'packages/cli/package.json',
		'packages/core/package.json',
		'packages/experiments/package.json',
		'packages/frameworks/angular/package.json',
		'packages/frameworks/angularjs/package.json',
		'packages/frameworks/nextjs/package.json',
		'packages/frameworks/react/package.json',
		'packages/node-guard/package.json',
		'packages/trust/package.json',
	] as const;
	const manifests = relativePaths.map((relativePath) => path.join(root, relativePath));
	for (const manifest of manifests)
		if (!(await exists(manifest)))
			throw new Error(
				`Required workspace manifest missing: ${path.relative(root, manifest)}`,
			);
	return manifests;
}

export function packagePurl(name: string, version: string): string {
	validatePackageCoordinate({ name, version }, 'npm purl coordinate');
	const encodePurlSegment = (value: string) => encodeParam(value).replaceAll('@', '%40');
	const [scope, packageName] = name.slice(1).split('/');
	const encoded = name.startsWith('@')
		? joinURL(`%40${encodePurlSegment(scope ?? '')}`, encodePurlSegment(packageName ?? ''))
		: encodePurlSegment(name);
	return `pkg:npm/${encoded}@${encodePurlSegment(version)}`;
}

async function dependencyGraph(
	root: string,
	lockText: string,
	manifests: Array<{ path: string; value: Record<string, unknown> }>,
): Promise<Record<string, unknown>> {
	const resolved = lockPackages(lockText);
	const workspace = await Promise.all(
		manifests.map(async ({ path: manifestPath, value }) => ({
			type: 'application',
			'bom-ref': `workspace:${path.dirname(path.relative(root, manifestPath)) || '.'}`,
			name:
				typeof value.name === 'string'
					? value.name
					: path.basename(path.dirname(manifestPath)),
			version: typeof value.version === 'string' ? value.version : 'unknown',
			hashes: [{ alg: 'SHA-256', content: sha256(await readFile(manifestPath)) }],
			properties: [
				{ name: 'versionless:source', value: path.relative(root, manifestPath) },
				{ name: 'versionless:state', value: 'verified' },
			],
		})),
	);
	const components = [
		...workspace,
		...resolved.map((item) => ({
			type: 'library',
			'bom-ref': packagePurl(item.name, item.version),
			name: item.name,
			version: item.version,
			purl: packagePurl(item.name, item.version),
			properties: [{ name: 'versionless:source', value: 'pnpm-lock.yaml' }],
		})),
	];
	const rootRef = 'workspace:.';
	return {
		bomFormat: 'CycloneDX',
		specVersion: '1.7',
		version: 1,
		metadata: {
			component: components.find((item) => item['bom-ref'] === rootRef),
			properties: [
				{ name: 'versionless:validation', value: 'local-profile' },
				{ name: 'versionless:validation-claim', value: 'not-independent-or-official' },
				{ name: 'versionless:graph-model', value: 'complete-resolved-inventory-rooted' },
				{ name: 'versionless:topology', value: 'exact-transitive-topology-not-proven' },
			],
		},
		components,
		dependencies: components.map((item) => ({
			ref: item['bom-ref'],
			...(item['bom-ref'] === rootRef
				? {
						dependsOn: components
							.filter((other) => other['bom-ref'] !== rootRef)
							.map((other) => other['bom-ref']),
					}
				: {}),
		})),
	};
}

interface InstalledManifest {
	identity: string;
	manifestPath: string;
	directory: string;
	value: Record<string, unknown>;
}

function portableRelative(root: string, file: string): string {
	const identifier = path.relative(root, file).split(path.sep).join('/');
	if (!identifier || path.isAbsolute(identifier))
		throw new Error('Portable evidence identity missing');
	assertPortableEvidence(identifier, 'portable evidence identity');
	return identifier;
}

async function installedManifestCatalog(root: string): Promise<Map<string, InstalledManifest[]>> {
	const catalog = new Map<string, InstalledManifest[]>();
	const virtualStore = path.join(root, '.versionless/cache/pnpm-virtual-store');
	for (const file of await filesBelow(virtualStore)) {
		if (
			path.basename(file) !== 'package.json' ||
			!file.includes(`${path.sep}node_modules${path.sep}`)
		)
			continue;
		let value: Record<string, unknown>;
		try {
			value = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
		} catch {
			continue;
		}
		if (typeof value.name !== 'string' || typeof value.version !== 'string') continue;
		const key = `${value.name}@${value.version}`;
		const item = {
			identity: portableRelative(root, file),
			manifestPath: await realpath(file),
			directory: path.dirname(file),
			value,
		};
		const existing = catalog.get(key) ?? [];
		if (!existing.some((candidate) => candidate.manifestPath === item.manifestPath))
			existing.push(item);
		catalog.set(
			key,
			existing.sort((a, b) => a.identity.localeCompare(b.identity)),
		);
	}
	return catalog;
}

async function licenseFields(
	candidates: InstalledManifest[],
): Promise<{ spdxExpression: Record<string, unknown>; licenseText: Record<string, unknown> }> {
	if (candidates.length === 0)
		return {
			spdxExpression: {
				state: 'unknown',
				reason: 'Matching installed manifest unavailable.',
			},
			licenseText: {
				state: 'unknown',
				reason: 'Matching installed license text unavailable.',
			},
		};
	const evidence = await Promise.all(
		candidates.map(async (candidate) => {
			const files = (await readdir(candidate.directory)).filter(isLicenseFilename).sort();
			return {
				id: candidate.identity,
				manifestSha256: sha256(await readFile(candidate.manifestPath)),
				spdxExpression:
					typeof candidate.value.license === 'string' ? candidate.value.license : null,
				licenseTexts: await Promise.all(
					files.map(async (name) => ({
						id: name,
						sha256: sha256(await readFile(path.join(candidate.directory, name))),
					})),
				),
			};
		}),
	);
	if (candidates.length > 1)
		return {
			spdxExpression: { state: 'ambiguous', candidates: evidence },
			licenseText: { state: 'ambiguous', candidates: evidence },
		};
	const candidate = candidates[0];
	const candidateEvidence = evidence[0];
	if (!candidate) throw new Error('Installed manifest candidate disappeared');
	if (!candidateEvidence) throw new Error('Installed manifest evidence disappeared');
	const expression = candidate.value.license;
	const texts = candidateEvidence.licenseTexts;
	const hashes = [...new Set(texts.map((item) => item.sha256))];
	return {
		spdxExpression:
			typeof expression === 'string' &&
			expression.trim() === expression &&
			expression.length > 0
				? {
						state: 'verified',
						value: expression,
						candidateId: candidate.identity,
						manifestSha256: candidateEvidence.manifestSha256,
					}
				: {
						state: 'unknown',
						reason: 'Matching installed manifest has no SPDX expression.',
					},
		licenseText:
			hashes.length === 1
				? {
						state: 'verified',
						candidateId: candidate.identity,
						sha256: hashes[0],
						files: texts.map((item) => item.id),
					}
				: hashes.length === 0
					? { state: 'unknown', reason: 'Matching installed license text unavailable.' }
					: { state: 'ambiguous', candidates: texts },
	};
}

function stateCounts(
	entries: Array<Record<string, unknown>>,
	field: string,
): Record<string, number> {
	const counts: Record<string, number> = { verified: 0, unknown: 0, ambiguous: 0 };
	for (const entry of entries) {
		const evidence = asRecord(entry[field], `license ${field}`);
		const state = asString(evidence.state, `license ${field}.state`);
		if (!(state in counts)) throw new Error(`Unsupported license state: ${state}`);
		counts[state] = (counts[state] ?? 0) + 1;
	}
	return counts;
}

export async function licenseInventory(
	root: string,
	packages: PackageCoordinate[],
	manifests: Array<{ path: string; value: Record<string, unknown> }>,
): Promise<Record<string, unknown>> {
	const entries: Array<Record<string, unknown>> = [];
	for (const { path: manifestPath, value } of manifests) {
		const directory = path.dirname(manifestPath);
		const licenseFile = (await readdir(directory)).find(isLicenseFilename);
		const fields = await licenseFields([
			{
				identity: portableRelative(root, manifestPath),
				manifestPath: await realpath(manifestPath),
				directory,
				value,
			},
		]);
		entries.push({
			name: value.name,
			version: value.version,
			source: path.relative(root, manifestPath),
			spdxExpression: fields.spdxExpression,
			licenseText: licenseFile
				? fields.licenseText
				: { state: 'unknown', reason: 'License text is absent.' },
		});
	}
	const catalog = await installedManifestCatalog(root);
	for (const item of packages) {
		const installedVersion = packageVersionWithoutPeerContext(item.version);
		const fields = await licenseFields(catalog.get(`${item.name}@${installedVersion}`) ?? []);
		entries.push({
			name: item.name,
			version: item.version,
			source: 'pnpm-lock.yaml',
			spdxExpression: fields.spdxExpression,
			licenseText: fields.licenseText,
		});
	}
	return {
		schemaVersion: TRUST_SCHEMA,
		coverage: { workspaceManifests: manifests.length, resolvedPackages: packages.length },
		rootLicenseText: { state: 'unknown', reason: 'No root LICENSE file exists.' },
		summary: {
			spdxExpression: stateCounts(entries, 'spdxExpression'),
			licenseText: stateCounts(entries, 'licenseText'),
		},
		entries,
	};
}

function vulnerabilityReport(
	packages: Array<{ name: string; version: string }>,
	osv: Record<string, unknown>,
	kev: Record<string, unknown>,
	observations: Array<{ kind: string; observedAt: string; sha256: string }>,
	generatedAt: string,
): { report: Record<string, unknown>; freshness: EvidenceState } {
	const observedAt = observations
		.map((item) => item.observedAt)
		.sort((a, b) => a.localeCompare(b))[0];
	if (!observedAt) throw new Error('Vulnerability source observations are absent');
	const age = Date.parse(generatedAt) - Date.parse(observedAt);
	const freshness: EvidenceState =
		age >= 0 && age <= MAX_VULNERABILITY_AGE_MS ? 'verified' : 'stale';
	const results = Array.isArray(osv.results) ? osv.results : [];
	if (results.length !== packages.length)
		throw new Error('OSV batch result count does not match request');
	const known = new Set(
		(Array.isArray(kev.vulnerabilities) ? kev.vulnerabilities : []).flatMap((entry) => {
			const record = asRecord(entry, 'KEV entry');
			return typeof record.cveID === 'string' ? [record.cveID] : [];
		}),
	);
	return {
		freshness,
		report: {
			schemaVersion: TRUST_SCHEMA,
			freshness: {
				state: freshness,
				observedAt,
				maximumAgeDays: 7,
				freshUntil: new Date(
					Date.parse(observedAt) + MAX_VULNERABILITY_AGE_MS,
				).toISOString(),
			},
			packages: packages.map((item, index) => {
				const result = asRecord(results[index] ?? {}, `OSV result ${index}`);
				const vulns = Array.isArray(result.vulns) ? result.vulns : [];
				return {
					...item,
					state: freshness,
					vulnerabilities: vulns.map((value) => {
						const vuln = asRecord(value, 'OSV vulnerability');
						const aliases = Array.isArray(vuln.aliases)
							? vuln.aliases.filter(
									(alias): alias is string => typeof alias === 'string',
								)
							: [];
						return {
							id: vuln.id,
							aliases,
							modified: vuln.modified,
							knownExploited:
								aliases.some((alias) => known.has(alias)) ||
								known.has(String(vuln.id)),
							disposition: {
								state: 'unknown',
								reason: 'No disposition owner or SLA is recorded.',
							},
						};
					}),
				};
			}),
			cisaKev: { entries: known.size, source: CISA_KEV_URL },
			osv: { queries: packages.length, source: OSV_BATCH_URL },
			sourceObservations: observations,
		},
	};
}

function matrix(conformance: CorpusConformance): Record<string, unknown> {
	const verticals = new Map(
		conformance.verticals.map((value) => [asString(value.id, 'corpus vertical id'), value]),
	);
	const maintained = asRecord(
		verticals.get('react-boilerplate-v4-node24'),
		'maintained React conformance',
	);
	const vite8 = asRecord(verticals.get('react-boilerplate-v4-vite8'), 'Vite 8 conformance');
	const dataFlow = asRecord(
		verticals.get('react-boilerplate-v4-data-flow'),
		'React data-flow conformance',
	);
	const reactComposed = asRecord(
		verticals.get('react-boilerplate-v4-composed'),
		'React composed conformance',
	);
	const phonecatRoute = asRecord(
		verticals.get('angular-phonecat-route-resolve'),
		'PhoneCat route conformance',
	);
	const phonecatComposed = asRecord(
		verticals.get('angular-phonecat-composed'),
		'PhoneCat composed conformance',
	);
	const phonecatVite = asRecord(
		verticals.get('angular-phonecat-vite8'),
		'PhoneCat Vite conformance',
	);
	const angularRealworld = asRecord(
		verticals.get('angular-realworld-v15-to-v16'),
		'Angular RealWorld conformance',
	);
	const nextKilledByGoogle = verticals.get('next-killedbygoogle-derived-state-to-memo');
	const papercups = verticals.get(REACT_PAPERCUPS_FIXTURE);
	const hospitalrun = verticals.get(REACT_HOSPITALRUN_FIXTURE);
	const factoriolab = verticals.get(ANGULAR_FACTORIOLAB_FIXTURE);
	const jiraClone = verticals.get(ANGULAR_JIRA_CLONE_FIXTURE);
	const memos = verticals.get(REACT_MEMOS_FIXTURE);
	const killedbygoogleV3 = verticals.get(NEXT_KILLEDBYGOOGLE_V3_FIXTURE);
	const linkfree = verticals.get(REACT_LINKFREE_FIXTURE);
	const tinyTranslator = verticals.get(ANGULAR_TINY_TRANSLATOR_FIXTURE);
	const superProductivity = verticals.get(ANGULAR_SUPER_PRODUCTIVITY_FIXTURE);
	return {
		schemaVersion: TRUST_SCHEMA,
		derivedFrom: {
			path: 'corpus-conformance.json',
			sha256: conformance.integrity.canonicalDigest,
		},
		/**
		 * Cells the engine declares unsupported, carried beside the verified
		 * ones. The matrix would otherwise be a list of successes, which is the
		 * shape a reader most easily mistakes for coverage.
		 */
		boundaries: (conformance.coverage as Record<string, unknown>).supportBoundaries,
		cells: [
			{
				id: 'react-boilerplate-v4',
				framework: 'react',
				designatedPilot: false,
				runtime: 'Node 16 EOL compatibility sandbox',
				bundler: 'webpack-4',
				state: 'verified',
				maintainedTarget: 'verified',
				maintainedRuntime: maintained.runtime,
				maintainedBundler: maintained.bundler,
			},
			{
				id: 'react-boilerplate-v4-vite8',
				framework: 'react',
				designatedPilot: false,
				runtime: 'Node 24.15.0 darwin-arm64',
				bundler: 'Vite 8.0.16',
				state: 'verified',
				adapter: vite8.adapter,
				oldVite: vite8.oldVite,
				genericAdapter: vite8.genericAdapter,
				unplugin: vite8.unplugin,
			},
			{
				id: 'react-boilerplate-v4-data-flow',
				framework: 'react',
				designatedPilot: false,
				runtime: dataFlow.runtime,
				bundler: dataFlow.bundler,
				state: 'verified',
				migration: 'connect-to-hooks',
				adapter: dataFlow.adapter,
			},
			{
				id: 'react-boilerplate-v4-composed',
				framework: 'react',
				designatedPilot: false,
				runtime: reactComposed.runtime,
				bundler: reactComposed.bundler,
				state: 'verified',
				migration: 'atomic-composed-connect-to-hooks',
				adapter: reactComposed.adapter,
			},
			{
				id: 'angular-phonecat',
				framework: 'angularjs',
				track: 'angularjs-special-track',
				designatedPilot: false,
				runtime: 'Node 16 legacy / Node 24 target tooling',
				bundler: 'none-static',
				state: 'verified',
				angular2Plus: 'not-applicable',
				angularCliAot: 'not-applicable',
				adjacentMajor: 'not-applicable',
			},
			{
				id: 'angular-phonecat-route-resolve',
				framework: 'angularjs',
				track: phonecatRoute.track,
				designatedPilot: phonecatRoute.designatedPilot,
				runtime: phonecatRoute.runtime,
				bundler: phonecatRoute.bundler,
				state: 'verified',
				routeResolves: phonecatRoute.routeResolves,
				componentBindings: phonecatRoute.componentBindings,
				angular2Plus: phonecatRoute.angular2Plus,
				angularCliAot: phonecatRoute.angularCliAot,
				adjacentMajor: 'not-applicable',
			},
			{
				id: 'angular-phonecat-composed',
				framework: 'angularjs',
				track: phonecatComposed.track,
				designatedPilot: phonecatComposed.designatedPilot,
				runtime: phonecatComposed.runtime,
				bundler: phonecatComposed.bundler,
				state: 'verified',
				composition: phonecatComposed.composition,
				orderIndependent: phonecatComposed.orderIndependent,
				angular2Plus: phonecatComposed.angular2Plus,
				angularCliAot: phonecatComposed.angularCliAot,
				adjacentMajor: 'not-applicable',
			},
			{
				id: 'angular-phonecat-vite8',
				framework: 'angularjs',
				track: phonecatVite.track,
				designatedPilot: phonecatVite.designatedPilot,
				runtime: phonecatVite.runtime,
				bundler: 'Vite 8.0.16',
				state: 'verified',
				adapter: phonecatVite.adapter,
				oldVite: phonecatVite.oldVite,
				genericAdapter: phonecatVite.genericAdapter,
				unplugin: phonecatVite.unplugin,
				serviceWorker: phonecatVite.serviceWorker,
				angular2Plus: phonecatVite.angular2Plus,
				angularCliAot: phonecatVite.angularCliAot,
				adjacentMajor: 'not-applicable',
			},
			{
				id: 'angular-realworld-v15-to-v16',
				framework: 'angular',
				track: angularRealworld.track,
				designatedPilot: false,
				runtime: angularRealworld.runtime,
				bundler: angularRealworld.bundler,
				state: 'verified',
				angular2Plus: angularRealworld.angular2Plus,
				angularCliAot: angularRealworld.angularCliAot,
				adjacentMajor: 'angular-15-to-16-verified',
				locality: angularRealworld.locality,
				productionReadiness: angularRealworld.productionReadiness,
				readinessScoreboard: angularRealworld.readinessScoreboard,
			},
			{
				id: 'takenote',
				framework: 'react',
				designatedPilot: true,
				runtime: 'Node 12/native dependency lane unavailable',
				bundler: 'webpack',
				state: 'not-tested',
				maintainedTarget: 'not-tested',
			},
			{
				id: 'angular2-hn',
				framework: 'angular',
				designatedPilot: true,
				runtime: 'supported Node 12/Yarn or external CI lane unavailable',
				bundler: 'angular-cli',
				state: 'not-tested',
				angular2Plus: 'not-tested',
				angularCliAot: 'not-tested',
				adjacentMajor: 'not-tested',
			},
			{
				id: 'old-vite',
				framework: 'unknown',
				designatedPilot: false,
				runtime: 'unknown',
				bundler: 'vite-old',
				state: 'not-tested',
			},
			...(nextKilledByGoogle
				? [
						{
							id: 'next-killedbygoogle-derived-state-to-memo',
							framework: 'react',
							platform: 'nextjs',
							designatedPilot: false,
							runtime: asRecord(nextKilledByGoogle, 'Killed by Google conformance')
								.runtime,
							bundler: asRecord(nextKilledByGoogle, 'Killed by Google conformance')
								.bundler,
							state: 'verified',
							scope: 'fixture-specific-next12-pages',
							genericNextSupport: 'not-claimed',
						},
					]
				: []),
			...(papercups
				? [
						(() => {
							const cell = asRecord(papercups, 'React Papercups conformance');
							return {
								id: REACT_PAPERCUPS_FIXTURE,
								framework: cell.framework,
								designatedPilot: cell.designatedPilot,
								runtime: cell.runtime,
								bundler: cell.bundler,
								state: 'verified',
								track: cell.track,
								scope: 'fixture-specific-create-react-app-to-vite8',
								genericReactSupport: 'not-claimed',
								browserProof: cell.browserProof,
								serviceWorker: cell.serviceWorker,
								scrollSurface: cell.scrollSurface,
								locality: cell.locality,
								productionReadiness: cell.productionReadiness,
								readinessScoreboard: cell.readinessScoreboard,
							};
						})(),
					]
				: []),
			...(hospitalrun
				? [
						(() => {
							const cell = asRecord(hospitalrun, 'React HospitalRun conformance');
							return {
								id: REACT_HOSPITALRUN_FIXTURE,
								framework: cell.framework,
								designatedPilot: cell.designatedPilot,
								runtime: cell.runtime,
								bundler: cell.bundler,
								state: 'verified',
								track: cell.track,
								scope: 'fixture-specific-create-react-app-to-vite8',
								genericReactSupport: 'not-claimed',
								browserProof: cell.browserProof,
								serviceWorker: cell.serviceWorker,
								serviceWorkerDifference: cell.serviceWorkerDifference,
								serviceWorkerDifferenceMasked: cell.serviceWorkerDifferenceMasked,
								scrollSurface: cell.scrollSurface,
								locality: cell.locality,
								productionReadiness: cell.productionReadiness,
								readinessScoreboard: cell.readinessScoreboard,
							};
						})(),
					]
				: []),
			...(factoriolab
				? [
						(() => {
							const cell = asRecord(factoriolab, 'Angular factoriolab conformance');
							return {
								id: ANGULAR_FACTORIOLAB_FIXTURE,
								framework: cell.framework,
								designatedPilot: cell.designatedPilot,
								runtime: cell.runtime,
								bundler: cell.bundler,
								state: 'verified',
								track: cell.track,
								scope: 'fixture-specific-angular-cli-browser-builder-10-to-16',
								genericAngularSupport: 'not-claimed',
								browserProof: cell.browserProof,
								serviceWorker: cell.serviceWorker,
								serviceWorkerMasked: cell.serviceWorkerMasked,
								scrollSurface: cell.scrollSurface,
								locality: cell.locality,
								productionReadiness: cell.productionReadiness,
								readinessScoreboard: cell.readinessScoreboard,
							};
						})(),
					]
				: []),
			...(jiraClone
				? [
						(() => {
							const cell = asRecord(jiraClone, 'Angular jira-clone conformance');
							return {
								id: ANGULAR_JIRA_CLONE_FIXTURE,
								framework: cell.framework,
								designatedPilot: cell.designatedPilot,
								runtime: cell.runtime,
								bundler: cell.bundler,
								state: 'verified',
								track: cell.track,
								scope: 'fixture-specific-angular-cli-custom-webpack-browser-builder-13-to-16',
								genericAngularSupport: 'not-claimed',
								browserProof: cell.browserProof,
								serviceWorker: cell.serviceWorker,
								serviceWorkerMasked: cell.serviceWorkerMasked,
								scrollSurface: cell.scrollSurface,
								locality: cell.locality,
								productionReadiness: cell.productionReadiness,
								readinessScoreboard: cell.readinessScoreboard,
							};
						})(),
					]
				: []),
			...(memos
				? [
						(() => {
							const cell = asRecord(memos, 'React memos conformance');
							return {
								id: REACT_MEMOS_FIXTURE,
								framework: cell.framework,
								designatedPilot: cell.designatedPilot,
								runtime: cell.runtime,
								bundler: cell.bundler,
								state: 'verified',
								track: cell.track,
								scope: 'fixture-specific-old-vite-origin-2-9-to-vite8',
								genericReactSupport: 'not-claimed',
								browserProof: cell.browserProof,
								migrationClass: cell.migrationClass,
								projection: cell.projection,
								scrollSurface: cell.scrollSurface,
								locality: cell.locality,
								productionReadiness: cell.productionReadiness,
								readinessScoreboard: cell.readinessScoreboard,
							};
						})(),
					]
				: []),
			...(killedbygoogleV3
				? [
						(() => {
							const cell = asRecord(killedbygoogleV3, 'KilledByGoogle v3 conformance');
							return {
								id: NEXT_KILLEDBYGOOGLE_V3_FIXTURE,
								framework: cell.framework,
								designatedPilot: cell.designatedPilot,
								runtime: cell.runtime,
								bundler: cell.bundler,
								state: 'verified',
								track: cell.track,
								scope: 'fixture-specific-next12-static-export-to-vite8-client-build',
								genericNextSupport: 'not-claimed',
								browserProof: cell.browserProof,
								serviceWorker: cell.serviceWorker,
								serviceWorkerMasked: cell.serviceWorkerMasked,
								documentDelivery: cell.documentDelivery,
								scrollSurface: cell.scrollSurface,
								locality: cell.locality,
								productionReadiness: cell.productionReadiness,
								readinessScoreboard: cell.readinessScoreboard,
							};
						})(),
					]
				: []),
			...(linkfree
				? [
						(() => {
							const cell = asRecord(linkfree, 'React LinkFree conformance');
							return {
								id: REACT_LINKFREE_FIXTURE,
								framework: cell.framework,
								designatedPilot: cell.designatedPilot,
								runtime: cell.runtime,
								bundler: cell.bundler,
								state: 'verified',
								track: cell.track,
								scope: 'fixture-specific-create-react-app-5-to-vite8',
								genericReactSupport: 'not-claimed',
								browserProof: cell.browserProof,
								corpusRuling: cell.corpusRuling,
								scrollSurface: cell.scrollSurface,
								locality: cell.locality,
								productionReadiness: cell.productionReadiness,
								readinessScoreboard: cell.readinessScoreboard,
							};
						})(),
					]
				: []),
			...(tinyTranslator
				? [
						(() => {
							const cell = asRecord(tinyTranslator, 'Angular TinyTranslator conformance');
							return {
								id: ANGULAR_TINY_TRANSLATOR_FIXTURE,
								framework: cell.framework,
								designatedPilot: cell.designatedPilot,
								runtime: cell.runtime,
								bundler: cell.bundler,
								state: 'verified',
								track: cell.track,
								scope: 'fixture-specific-angular-cli-1-5-4-webpack-3-to-angular-16.2-browser-builder',
								genericAngularSupport: 'not-claimed',
								browserProof: cell.browserProof,
								serviceWorkerAttempt: cell.serviceWorkerAttempt,
								serviceWorkerAttemptMasked: cell.serviceWorkerAttemptMasked,
								scrollSurface: cell.scrollSurface,
								locality: cell.locality,
								productionReadiness: cell.productionReadiness,
								readinessScoreboard: cell.readinessScoreboard,
							};
						})(),
					]
				: []),
			...(superProductivity
				? [
						(() => {
							const cell = asRecord(
								superProductivity,
								'Angular Super Productivity conformance',
							);
							return {
								id: ANGULAR_SUPER_PRODUCTIVITY_FIXTURE,
								framework: cell.framework,
								designatedPilot: cell.designatedPilot,
								runtime: cell.runtime,
								bundler: cell.bundler,
								state: 'verified',
								track: cell.track,
								scope: 'fixture-specific-angular-cli-8-3-4-webpack-4-to-angular-16.2-browser-builder',
								genericAngularSupport: 'not-claimed',
								browserProof: cell.browserProof,
								serviceWorker: cell.serviceWorker,
								serviceWorkerMasked: cell.serviceWorkerMasked,
								scrollSurface: cell.scrollSurface,
								determinism: cell.determinism,
								declaredDifferences: cell.declaredDifferences,
								locality: cell.locality,
								productionReadiness: cell.productionReadiness,
								readinessScoreboard: cell.readinessScoreboard,
							};
						})(),
					]
				: []),
			...conformance.frameworkLanes.map((lane) => ({
				...lane,
				state: 'not-tested',
				designatedPilot: false,
				productionStack: 'nextjs-preserved-not-tested',
			})),
		],
	};
}

function validatePolicy(value: unknown): Record<string, unknown> {
	const policy = asRecord(value, 'trust policy');
	if (policy.schemaVersion !== 'versionless.trust-policy.v1')
		throw new Error('Unsupported trust policy');
	for (const required of [
		'owner',
		'retention',
		'vulnerabilityDisposition',
		'controls',
		'dataFlows',
	])
		if (!(required in policy)) throw new Error(`Trust policy missing ${required}`);
	return policy;
}

export function validateCycloneDx17(
	value: unknown,
	expected?: {
		workspace: Array<{ name: string; version: string; ref: string; source: string }>;
		packages: PackageCoordinate[];
	},
): void {
	const bom = asRecord(value, 'CycloneDX document');
	if (bom.bomFormat !== 'CycloneDX' || bom.specVersion !== '1.7' || bom.version !== 1)
		throw new Error('CycloneDX 1.7 profile mismatch');
	if (!Array.isArray(bom.components) || !Array.isArray(bom.dependencies))
		throw new Error('CycloneDX components/dependencies missing');
	const refs = new Set<string>();
	const libraries: PackageCoordinate[] = [];
	const applications: Array<{ name: string; version: string; ref: string; source: string }> = [];
	for (const value of bom.components) {
		const component = asRecord(value, 'CycloneDX component');
		const name = asString(component.name, 'CycloneDX component.name');
		const version = asString(component.version, 'CycloneDX component.version');
		validatePackageCoordinate({ name, version }, 'CycloneDX component coordinate');
		const ref = asString(component['bom-ref'], 'CycloneDX component reference');
		if (refs.has(ref))
			throw new Error('CycloneDX component reference is missing or duplicated');
		if (component.type === 'library') {
			const purl = packagePurl(name, version);
			if (component.purl !== purl || ref !== purl)
				throw new Error('CycloneDX npm purl/reference mismatch');
			libraries.push({ name, version });
		} else if (component.type === 'application') {
			if (!workspaceReference.test(ref) || component.purl !== undefined)
				throw new Error('CycloneDX workspace reference is malformed');
			if (!Array.isArray(component.properties))
				throw new Error('CycloneDX workspace properties are missing');
			const properties = new Map(
				component.properties.map((value) => {
					const property = asRecord(value, 'CycloneDX workspace property');
					return [property.name, property.value];
				}),
			);
			if (
				properties.size !== 2 ||
				properties.get('versionless:state') !== 'verified' ||
				typeof properties.get('versionless:source') !== 'string'
			)
				throw new Error('CycloneDX workspace properties are malformed');
			applications.push({
				name,
				version,
				ref,
				source: String(properties.get('versionless:source')),
			});
		} else throw new Error('CycloneDX component type is unsupported');
		refs.add(ref);
	}
	if (bom.dependencies.length !== refs.size) throw new Error('CycloneDX graph omits components');
	for (const value of bom.dependencies) {
		const dependency = asRecord(value, 'CycloneDX dependency');
		if (typeof dependency.ref !== 'string' || !refs.has(dependency.ref))
			throw new Error('CycloneDX dependency has an unknown reference');
		if (
			Array.isArray(dependency.dependsOn) &&
			dependency.dependsOn.some((ref) => !refs.has(ref))
		)
			throw new Error('CycloneDX dependency edge has an unknown target');
	}
	const metadata = asRecord(bom.metadata, 'CycloneDX metadata');
	if (!Array.isArray(metadata.properties)) throw new Error('CycloneDX profile claims missing');
	const properties = new Map(
		metadata.properties.map((value) => {
			const item = asRecord(value, 'CycloneDX metadata property');
			return [item.name, item.value];
		}),
	);
	if (
		properties.get('versionless:validation') !== 'local-profile' ||
		properties.get('versionless:validation-claim') !== 'not-independent-or-official' ||
		properties.get('versionless:graph-model') !== 'complete-resolved-inventory-rooted' ||
		properties.get('versionless:topology') !== 'exact-transitive-topology-not-proven'
	)
		throw new Error('CycloneDX local-profile/topology claim mismatch');
	if (expected) {
		if (bom.components.length !== expected.workspace.length + expected.packages.length)
			throw new Error('CycloneDX inventory count mismatch');
		const actual = canonicalize(
			libraries.sort((a, b) =>
				`${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
			),
		);
		if (actual !== canonicalize(expected.packages))
			throw new Error('CycloneDX resolved inventory does not match pnpm packages');
		const actualWorkspace = applications.sort((a, b) => a.ref.localeCompare(b.ref));
		const expectedWorkspace = [...expected.workspace].sort((a, b) =>
			a.ref.localeCompare(b.ref),
		);
		if (canonicalize(actualWorkspace) !== canonicalize(expectedWorkspace))
			throw new Error('CycloneDX workspace inventory does not match manifests');
	}
}

async function writeJson(file: string, value: unknown): Promise<void> {
	assertSyntheticEvidence(value);
	assertPortableEvidence(value);
	await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function generateTrustPackage(options: GenerateTrustOptions): Promise<TrustManifest> {
	const environment = options.environment ?? process.env;
	if (!options.offline || environment.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('Trust generation requires --offline and VERSIONLESS_NETWORK_MODE=offline');
	const root = path.resolve(options.rootDir ?? '.');
	const cache = path.resolve(root, options.cacheDir ?? '.versionless/cache/trust');
	const output = path.resolve(root, options.outputDir);
	const generatedAt = options.observedAt ?? new Date().toISOString();
	const ingest = parseIngestRecord(
		JSON.parse(await readFile(path.join(cache, 'ingest.json'), 'utf8')),
	);
	const expectedRequestDigest = sha256(osvRequest(ingest.packages));
	if (ingest.sources[0].requestSha256 !== expectedRequestDigest)
		throw new Error('Cached OSV request digest does not match cached package coordinates');
	for (const source of ingest.sources) {
		const expected = source.kind === 'osv-batch' ? OSV_BATCH_URL : CISA_KEV_URL;
		if (source.url !== expected) throw new Error(`Unexpected cached source URL: ${source.url}`);
		const body = await readFile(path.join(cache, source.responsePath), 'utf8');
		if (sha256(body) !== source.sha256)
			throw new Error(`Cached source digest mismatch: ${source.kind}`);
	}
	const lockText = await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8');
	const packages = lockPackages(lockText);
	if (packages.length === 0) throw new Error('Resolved package inventory is empty');
	if (canonicalize(packages) !== canonicalize(ingest.packages))
		throw new Error('Cached OSV request does not cover the current lockfile');
	const manifestPaths = await workspaceManifestPaths(root);
	const manifests = await Promise.all(
		manifestPaths.map(async (manifestPath) => ({
			path: manifestPath,
			value: JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>,
		})),
	);
	if (manifests.length !== 10)
		throw new Error(`Expected ten workspace manifests, found ${manifests.length}`);
	const aggregate = JSON.parse(
		await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
	);
	const acquisitionPreflightBytes = await readFile(
		path.join(root, NPM_LOCK_ACQUISITION_PREFLIGHT.path),
	);
	validateNpmLockAcquisitionPreflight(acquisitionPreflightBytes);
	const nextTailwindFailureBytes = await readFile(
		path.join(root, NEXT_TAILWIND_CONSENT_FAILURE.path),
	);
	validateNextTailwindConsentFailure(nextTailwindFailureBytes);
	const [nextTailwindExclusionJson, nextTailwindExclusionMarkdown] = await Promise.all([
		readFile(path.join(root, NEXT_TAILWIND_EXCLUSION.json.path)),
		readFile(path.join(root, NEXT_TAILWIND_EXCLUSION.markdown.path)),
	]);
	validateNextTailwindExclusion(nextTailwindExclusionJson, nextTailwindExclusionMarkdown);
	assertSyntheticEvidence(aggregate);
	const aggregateRecord = asRecord(aggregate, 'aggregate evidence');
	if (!Array.isArray(aggregateRecord.fixtures))
		throw new Error('Aggregate fixtures must be an array');
	const aggregateFixtures = aggregateRecord.fixtures;
	const transaction = deriveCorpusTransactionState(aggregateFixtures);
	const hasMaintainedReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === MAINTAINED_RECEIPT.path,
		);
	const hasVite8Receipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === VITE8_RECEIPT.path,
		);
	const hasPhonecatRouteReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === PHONECAT_ROUTE_RECEIPT.path,
		);
	const hasPhonecatComposedReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) =>
				asRecord(value, 'aggregate fixture').receipt === PHONECAT_COMPOSED_RECEIPT.path,
		);
	const hasDataFlowReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === DATA_FLOW_RECEIPT.path,
		);
	const hasReactComposedReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === REACT_COMPOSED_RECEIPT.path,
		);
	const hasPhonecatViteReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === PHONECAT_VITE_RECEIPT.path,
		);
	const hasAngularRealworldReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) =>
				asRecord(value, 'aggregate fixture').receipt === ANGULAR_REALWORLD_RECEIPT.path,
		);
	const hasNextKilledByGoogleReceipt = transaction.nextKilledByGoogleIntegrated;
	const hasWitnessAngularRealworldReceipt = transaction.angularRealworldWitnessIntegrated;
	const hasWitnessReactBoilerplateReceipt = transaction.reactBoilerplateWitnessIntegrated;
	const hasWitnessNextKilledByGoogleReceipt = transaction.nextKilledByGoogleWitnessIntegrated;
	const hasAngularSuperProductivityReceipts =
		transaction.kind === 'angular-super-productivity-browser-proof';
	const hasAngularTinyTranslatorReceipts =
		transaction.kind === 'angular-tiny-translator-browser-proof' ||
		hasAngularSuperProductivityReceipts;
	const hasReactLinkfreeReceipts =
		transaction.kind === 'react-linkfree-browser-proof' || hasAngularTinyTranslatorReceipts;
	const hasNextKilledbygoogleV3Receipts =
		transaction.kind === 'next-killedbygoogle-v3-browser-proof' || hasReactLinkfreeReceipts;
	const hasReactMemosReceipts =
		transaction.kind === 'react-memos-browser-proof' || hasNextKilledbygoogleV3Receipts;
	const hasAngularJiraCloneReceipts =
		transaction.kind === 'angular-jira-clone-browser-proof' || hasReactMemosReceipts;
	const hasAngularFactoriolabReceipts =
		transaction.kind === 'angular-factoriolab-browser-proof' || hasAngularJiraCloneReceipts;
	const hasReactHospitalrunReceipts =
		transaction.kind === 'react-hospitalrun-browser-proof' || hasAngularFactoriolabReceipts;
	const hasReactPapercupsReceipts =
		transaction.kind === 'react-papercups-browser-proof' || hasReactHospitalrunReceipts;
	const hasReactZeroSwReceipts =
		transaction.kind === 'react-zero-sw-reconciliation' || hasReactPapercupsReceipts;
	const receipts = [
		...PRESERVED_RECEIPTS,
		...(hasMaintainedReceipt ? [MAINTAINED_RECEIPT] : []),
		...(hasVite8Receipt ? [VITE8_RECEIPT] : []),
		...(hasPhonecatRouteReceipt ? [PHONECAT_ROUTE_RECEIPT] : []),
		...(hasPhonecatComposedReceipt ? [PHONECAT_COMPOSED_RECEIPT] : []),
		...(hasDataFlowReceipt ? [DATA_FLOW_RECEIPT] : []),
		...(hasReactComposedReceipt ? [REACT_COMPOSED_RECEIPT] : []),
		...(hasPhonecatViteReceipt ? [PHONECAT_VITE_RECEIPT] : []),
		...(hasAngularRealworldReceipt ? [ANGULAR_REALWORLD_RECEIPT] : []),
		...(hasNextKilledByGoogleReceipt ? [NEXT_KILLED_BY_GOOGLE_RECEIPT] : []),
		...(hasWitnessAngularRealworldReceipt ? [WITNESS_ANGULAR_REALWORLD_RECEIPT] : []),
		...(hasWitnessReactBoilerplateReceipt ? [WITNESS_REACT_BOILERPLATE_RECEIPT] : []),
		...(hasWitnessNextKilledByGoogleReceipt ? [WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT] : []),
		...(hasReactZeroSwReceipts ? [REACT_ZERO_SW_RECEIPT, WITNESS_REACT_ZERO_SW_RECEIPT] : []),
		...(hasReactPapercupsReceipts
			? [REACT_PAPERCUPS_RECEIPT, WITNESS_REACT_PAPERCUPS_RECEIPT]
			: []),
		...(hasReactHospitalrunReceipts
			? [REACT_HOSPITALRUN_RECEIPT, WITNESS_REACT_HOSPITALRUN_RECEIPT]
			: []),
		...(hasAngularFactoriolabReceipts ? [WITNESS_ANGULAR_FACTORIOLAB_RECEIPT] : []),
		...(hasAngularJiraCloneReceipts ? [WITNESS_ANGULAR_JIRA_CLONE_RECEIPT] : []),
		...(hasReactMemosReceipts ? [WITNESS_REACT_MEMOS_RECEIPT] : []),
		...(hasNextKilledbygoogleV3Receipts ? [WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT] : []),
		...(hasReactLinkfreeReceipts ? [WITNESS_REACT_LINKFREE_RECEIPT] : []),
		...(hasAngularTinyTranslatorReceipts ? [WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT] : []),
		...(hasAngularSuperProductivityReceipts
			? [WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT]
			: []),
		...reactAvataaarsCompatibilityTrustReceipts(transaction),
		...reactCalculatorTrustReceipts(transaction),
		...reactGraphiQL013TrustReceipts(transaction),
	];
	if (receipts.length !== transaction.receipts)
		throw new Error('Aggregate evidence does not preserve the required receipts');
	if (
		hasReactPapercupsReceipts &&
		!hasReactHospitalrunReceipts &&
		receipts.length !== REACT_PAPERCUPS_TRUST_RECEIPTS
	)
		throw new Error('React Papercups browser proof does not preserve exactly 18 receipts');
	if (
		hasReactHospitalrunReceipts &&
		!hasAngularFactoriolabReceipts &&
		receipts.length !== REACT_HOSPITALRUN_TRUST_RECEIPTS
	)
		throw new Error('React HospitalRun browser proof does not preserve exactly 20 receipts');
	if (
		hasAngularFactoriolabReceipts &&
		!hasAngularJiraCloneReceipts &&
		receipts.length !== ANGULAR_FACTORIOLAB_TRUST_RECEIPTS
	)
		throw new Error('Angular factoriolab browser proof does not preserve exactly 21 receipts');
	if (
		hasAngularJiraCloneReceipts &&
		!hasReactMemosReceipts &&
		receipts.length !== ANGULAR_JIRA_CLONE_TRUST_RECEIPTS
	)
		throw new Error('Angular jira-clone browser proof does not preserve exactly 22 receipts');
	if (
		hasReactMemosReceipts &&
		!hasNextKilledbygoogleV3Receipts &&
		receipts.length !== REACT_MEMOS_TRUST_RECEIPTS
	)
		throw new Error('React memos browser proof does not preserve exactly 23 receipts');
	if (
		hasNextKilledbygoogleV3Receipts &&
		!hasReactLinkfreeReceipts &&
		receipts.length !== NEXT_KILLEDBYGOOGLE_V3_TRUST_RECEIPTS
	)
		throw new Error('KilledByGoogle v3 browser proof does not preserve exactly 24 receipts');
	if (
		hasReactLinkfreeReceipts &&
		!hasAngularTinyTranslatorReceipts &&
		receipts.length !== REACT_LINKFREE_TRUST_RECEIPTS
	)
		throw new Error('React LinkFree browser proof does not preserve exactly 25 receipts');
	if (
		hasAngularTinyTranslatorReceipts &&
		!hasAngularSuperProductivityReceipts &&
		receipts.length !== ANGULAR_TINY_TRANSLATOR_TRUST_RECEIPTS
	)
		throw new Error('Angular TinyTranslator browser proof does not preserve exactly 26 receipts');
	if (
		hasAngularSuperProductivityReceipts &&
		receipts.length !== ANGULAR_SUPER_PRODUCTIVITY_TRUST_RECEIPTS
	)
		throw new Error(
			'Angular Super Productivity browser proof does not preserve exactly 27 receipts',
		);
	const verifiedReceipts = [];
	for (const expected of receipts) {
		const verified = await verifyTrustReceipt(root, expected.path);
		const aggregateFixture = aggregateFixtures.find(
			(value) => asRecord(value, 'aggregate fixture').receipt === expected.path,
		);
		const aggregateDigest = aggregateFixture
			? asString(
					asRecord(aggregateFixture, 'aggregate fixture').digest,
					'aggregate fixture digest',
				)
			: '';
		const expectedDigest = expected.digest ?? aggregateDigest;
		if (verified.digest !== expectedDigest)
			throw new Error(`Preserved receipt digest mismatch: ${expected.path}`);
		verifiedReceipts.push({
			path: expected.path,
			digest: verified.digest,
			artifacts: verified.artifacts,
			state: 'verified' as const,
		});
	}
	const buildFiles = (await filesBelow(path.join(root, 'packages'))).filter((file) =>
		file.includes(`${path.sep}dist${path.sep}`),
	);
	if (buildFiles.length === 0)
		throw new Error('No generated Versionless package artifacts found');
	const buildArtifacts = await Promise.all(
		buildFiles.map(async (file) => ({
			path: path.relative(root, file),
			sha256: sha256(await readFile(file)),
		})),
	);
	const policy = validatePolicy(
		JSON.parse(await readFile(path.resolve(root, options.policyPath), 'utf8')),
	);
	assertSyntheticEvidence(policy);
	const graph = await dependencyGraph(root, lockText, manifests);
	validateCycloneDx17(graph, {
		workspace: manifests.map((item) => ({
			name: String(item.value.name),
			version: String(item.value.version),
			ref: `workspace:${path.dirname(path.relative(root, item.path)) || '.'}`,
			source: path.relative(root, item.path),
		})),
		packages,
	});
	if ((graph.components as unknown[]).length !== packages.length + manifests.length)
		throw new Error('CycloneDX graph does not cover every resolved and workspace package');
	const licenses = await licenseInventory(root, packages, manifests);
	const osv = JSON.parse(await readFile(path.join(cache, 'osv.json'), 'utf8')) as Record<
		string,
		unknown
	>;
	const kev = JSON.parse(await readFile(path.join(cache, 'cisa-kev.json'), 'utf8')) as Record<
		string,
		unknown
	>;
	const vulnerability = vulnerabilityReport(
		packages,
		osv,
		kev,
		ingest.sources.map((source) => ({
			kind: source.kind,
			observedAt: source.observedAt,
			sha256: source.sha256,
		})),
		generatedAt,
	);
	vulnerability.report.ingest = {
		schemaVersion: ingest.schemaVersion,
		purpose: ingest.purpose,
		consent: ingest.consent,
		sources: ingest.sources,
	};
	const conformance = await analyzeCorpusConformance({ rootDir: root });
	const scriptSurface = await verifyScriptSurface({ rootDir: root, environment });
	const runtimeObservationConfig = parseRuntimeObservationConfig(
		JSON.parse(
			await readFile(path.join(root, 'trust/runtime-script-observation.json'), 'utf8'),
		),
	);
	const runtimeScriptObservation = (await verifyRuntimeScriptObservationEvidence(
		JSON.parse(
			await readFile(
				path.join(
					root,
					'evidence/runtime-script-observation/current/runtime-script-observation.json',
				),
				'utf8',
			),
		),
		{ rootDir: root, config: runtimeObservationConfig, surface: scriptSurface },
	)) as RuntimeScriptObservation;
	const corpus = matrix(conformance);
	const resolvedDependencies = [
		{ uri: 'pnpm-lock.yaml', digest: { sha256: sha256(lockText) } },
		{
			uri: 'evidence/runs/aggregate.json',
			digest: {
				sha256: sha256(await readFile(path.join(root, 'evidence/runs/aggregate.json'))),
			},
		},
		{
			uri: NPM_LOCK_ACQUISITION_PREFLIGHT.path,
			digest: { sha256: NPM_LOCK_ACQUISITION_PREFLIGHT.sha256 },
		},
		{
			uri: NEXT_TAILWIND_CONSENT_FAILURE.path,
			digest: { sha256: NEXT_TAILWIND_CONSENT_FAILURE.sha256 },
		},
		{
			uri: NEXT_TAILWIND_EXCLUSION.json.path,
			digest: { sha256: NEXT_TAILWIND_EXCLUSION.json.sha256 },
		},
		{
			uri: NEXT_TAILWIND_EXCLUSION.markdown.path,
			digest: { sha256: NEXT_TAILWIND_EXCLUSION.markdown.sha256 },
		},
		...(await Promise.all(
			manifests.map(async (item) => ({
				uri: path.relative(root, item.path),
				digest: { sha256: sha256(await readFile(item.path)) },
			})),
		)),
		...verifiedReceipts.map((item) => ({ uri: item.path, digest: { sha256: item.digest } })),
	].sort(compareTrustResolvedDependencies);
	if (new Set(resolvedDependencies.map((item) => item.uri)).size !== resolvedDependencies.length)
		throw new Error('Trust resolved dependency inventory contains duplicates');
	const provenance = {
		_type: 'https://in-toto.io/Statement/v1',
		subject: buildArtifacts.map((item) => ({
			name: item.path,
			digest: { sha256: item.sha256 },
		})),
		predicateType: 'https://slsa.dev/provenance/v1',
		predicate: {
			buildDefinition: {
				buildType: 'https://versionless.dev/trust/local-v1',
				externalParameters: { policy: options.policyPath, networkMode: 'offline' },
				internalParameters: {
					state: 'not-applicable',
					reason: 'No hidden parameters are asserted.',
				},
				resolvedDependencies,
			},
			runDetails: {
				builder: { id: 'versionless-local-trust-generator', state: 'verified' },
				metadata: {
					invocationId: 'not-applicable',
					startedOn: 'not-applicable',
					finishedOn: 'not-applicable',
				},
				byproducts: buildArtifacts,
			},
		},
		claims: {
			slsaLevel: 'not-claimed',
			signerAuthenticity: 'unknown',
			gitProvenance: 'unknown',
			aggregateFixtures: aggregateFixtures.length,
		},
	};
	const controls = {
		schemaVersion: TRUST_SCHEMA,
		policy,
		securityPolicy: { state: 'unknown', reason: 'SECURITY.md is absent.' },
		gitProvenance: { state: 'unknown', reason: 'Git metadata is absent.' },
		signingIdentity: { state: 'unknown', reason: 'No project signing identity is designated.' },
		locality: {
			state: 'verified',
			scope: 'Versionless-spawned processes and browser routing',
			osWideIsolation: false,
		},
		scriptSurface: {
			state: 'verified',
			scope: 'eighteen exact static deployment entrypoints',
			excludedVerticals: ['angular-realworld-v15-to-v16'],
			exclusionReason: 'T220 static script surface was not separately observed.',
			paymentPageApplicability: 'not-established',
			dynamicScriptInsertion: 'not-tested',
			pciCompliance: 'not-claimed',
		},
		runtimeScriptObservation: {
			state: 'verified',
			scope: 'exact qualified journeys',
			excludedVerticals: ['angular-realworld-v15-to-v16'],
			exclusionReason: 'T220 qualified runtime scripts were not separately observed.',
			globalDynamicInsertionCoverage: 'not-established',
			paymentPageApplicability: 'not-established',
			pciCompliance: 'not-claimed',
		},
	};
	const retention = {
		schemaVersion: TRUST_SCHEMA,
		retention: policy.retention,
		purgeStatus: {
			state: 'not-tested',
			reason: 'No approved retention duration or purge exercise exists.',
		},
	};
	await mkdir(output, { recursive: true });
	const freeze = adapterFreezeRecord();
	const capabilityCoverage = buildCapabilityCoverage();
	const deterministic: Array<[string, unknown]> = [
		['adapter-freeze.json', freeze],
		['dependency-graph.cdx.json', graph],
		['licenses.json', licenses],
		['vulnerabilities.json', vulnerability.report],
		['provenance.json', provenance],
		['matrix.json', corpus],
		['controls.json', controls],
		['retention.json', retention],
		['corpus-conformance.json', conformance],
		['script-surface.json', scriptSurface],
		['runtime-script-observation.json', runtimeScriptObservation],
		['capability-coverage.json', capabilityCoverage],
	];
	for (const [name, value] of deterministic) await writeJson(path.join(output, name), value);
	const artifacts: ManifestArtifact[] = await Promise.all(
		deterministic.map(async ([name]) => ({
			path: name,
			sha256: sha256(await readFile(path.join(output, name))),
		})),
	);
	const coreDigest = sha256(canonicalize({ artifacts, receipts: verifiedReceipts }));
	const trustManifest: TrustManifest = {
		schemaVersion: TRUST_SCHEMA,
		canonicalDigest: '',
		integrity: {
			algorithm: 'sha256',
			authenticity: 'not-established',
			certification: 'not-claimed',
		},
		deterministicCore: { algorithm: 'sha256', digest: coreDigest, artifacts },
		receipts: verifiedReceipts,
		observation: { generatedAt, vulnerabilityFreshness: vulnerability.freshness },
		derivedReport: 'report.md',
	};
	trustManifest.canonicalDigest = sha256(canonicalize(trustManifest));
	await writeJson(path.join(output, 'manifest.json'), trustManifest);
	const report = renderTrustReport({
		manifest: trustManifest,
		freeze,
		licenses,
		vulnerabilities: vulnerability.report,
		matrix: corpus,
		controls,
		conformance,
		scriptSurface,
		runtimeScriptObservation,
		transaction,
		capabilityCoverage,
	});
	await writeFile(path.join(output, 'report.md'), report);
	return trustManifest;
}
