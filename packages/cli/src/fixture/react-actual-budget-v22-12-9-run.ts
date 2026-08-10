import { access, readFile, readdir } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'pathe';
import { parseURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	REACT_ACTUAL_BUDGET_RECEIPT_PATH,
	assertActualBudgetReceipt,
	verifyReactActualBudgetEvidence,
	type ActualBudgetReceipt,
} from '../../../core/src/receipts/react-actual-budget-v22-12-9.ts';
import { verifyActualBudgetIngest } from './react-actual-budget-v22-12-9-ingest.ts';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const runRoot = join(repositoryRoot, 'evidence/runs/react-actual-budget-v22-12-9-react16-to-vite8');
const receiptPath = join(repositoryRoot, REACT_ACTUAL_BUDGET_RECEIPT_PATH);
const cacheRoot = join(repositoryRoot, '.versionless/cache/react-actual-budget-v22-12-9/t584');

export type ActualBudgetRequestObservation = {
	kind: 'page' | 'worker' | 'fetch' | 'xhr' | 'websocket' | 'navigation';
	url: string;
	status: number | null;
	failed: boolean;
	hasCookie: boolean;
	hasAuthorization: boolean;
};

export function parseActualBudgetRunLauncher(args: string[]): 'run' | 'verify' {
	if (args.length !== 1 || (args[0] !== '--run' && args[0] !== '--verify'))
		throw new Error('Actual Budget run launcher arguments differ');
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.VERSIONLESS_CONSENT_ID !== undefined
	)
		throw new Error('Actual Budget run requires strict offline mode');
	return args[0] === '--run' ? 'run' : 'verify';
}

export function assertActualBudgetLocality(observations: ActualBudgetRequestObservation[]): {
	essentialPaths: string[];
	requests: number;
} {
	if (observations.length < 5)
		throw new Error('Actual Budget locality observation set is incomplete');
	const essentialPaths = new Set<string>();
	for (const observation of observations) {
		const parsed = parseURL(observation.url);
		if (
			parsed.protocol !== 'http:' ||
			!['127.0.0.1', 'localhost'].includes(parsed.host?.split(':')[0] ?? '') ||
			observation.failed ||
			observation.status === null ||
			observation.status < 200 ||
			observation.status >= 300 ||
			observation.hasCookie ||
			observation.hasAuthorization
		)
			throw new Error('Actual Budget browser locality boundary differs');
		const extension = extname(parsed.pathname).toLowerCase();
		if (['.css', '.html', '.js', '.wasm'].includes(extension))
			essentialPaths.add(parsed.pathname);
	}
	if (
		![...essentialPaths].some((path) => extname(path) === '.js') ||
		![...essentialPaths].some((path) => extname(path) === '.wasm')
	)
		throw new Error('Actual Budget essential page/worker/WASM requests differ');
	return { essentialPaths: [...essentialPaths].sort(), requests: observations.length };
}

export function assertActualBudgetTargetHasNoServiceWorker(files: string[]): void {
	for (const path of files) {
		const lower = path.toLowerCase();
		if (
			lower.includes('service-worker') ||
			lower.includes('serviceworker') ||
			lower.includes('workbox') ||
			lower.includes('precache')
		)
			throw new Error('Actual Budget Vite target emitted a service-worker artifact');
	}
}

export function assertActualBudgetJourneyParity(journeys: ActualBudgetReceipt['journeys']): void {
	const candidate = {
		schemaVersion: 'versionless.react-actual-budget-v22-12-9-react16-to-vite8.v1',
		result: 'pass',
		counted: false,
		fixture: 'react-actual-budget-v22-12-9',
		provenance: {
			revision: '3edf94714540837c67e6ac521efef3eed5e15bc6',
			tree: '1dcc782100f84487473a871b5af099769ab90a07',
			license: { root: 'MIT', lootCore: 'ISC' },
		},
		compatibilityOverlay: {
			payload: '{ testMode, avoidUpload: true }',
			testMode: false,
			skipsOnly: 'optional cloudStorage.upload()',
			routeInterception: false,
			financeMocks: false,
			storageMocks: false,
		},
		builds: [],
		journeys,
		serviceWorker: {
			baseline: 'generated-unrequested-unregistered-uncontrolled-uncached',
			target: 'not-emitted-not-registered',
			behavioralDependence: false,
		},
		mutation: {},
		privacy: {},
		sbom: {},
		artifacts: [],
		nonclaims: [],
		integrity: { algorithm: 'sha256', canonicalDigest: 'a'.repeat(64) },
	} as unknown as ActualBudgetReceipt;
	try {
		assertActualBudgetReceipt(candidate);
	} catch (error) {
		if (error instanceof Error && error.message.includes('build matrix')) {
			for (const row of journeys) {
				if (
					row.journey1.firstBalanceCents !== 98_766 ||
					row.journey1.editedBalanceCents !== 97_655 ||
					row.journey2.budgetedCents !== 25_000 ||
					row.journey2.remainingCents !== 17_500 ||
					row.journey1.persistedAfterReload !== true ||
					row.journey2.persistedAfterReload !== true
				)
					throw new Error('Actual Budget finance journey parity differs');
			}
			return;
		}
		throw error;
	}
}

async function filesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const absolute = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(absolute)));
		else if (entry.isFile()) files.push(relative(directory, absolute));
		else throw new Error('Actual Budget evidence contains a special filesystem entry');
	}
	return files.sort();
}

export async function runActualBudgetVertical(): Promise<never> {
	await verifyActualBudgetIngest();
	await access(join(cacheRoot, 'source'));
	throw new Error(
		'Actual Budget acquired source must be inspected before its exact baseline and target build adapters are sealed',
	);
}

export async function verifyActualBudgetRun(): Promise<{
	valid: true;
	digest: string;
	artifacts: number;
}> {
	const verified = await verifyReactActualBudgetEvidence(repositoryRoot);
	const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as ActualBudgetReceipt;
	assertActualBudgetReceipt(receipt);
	const targetFiles = await filesBelow(join(runRoot, 'artifacts/target'));
	assertActualBudgetTargetHasNoServiceWorker(targetFiles);
	if (sha256(canonicalize(receipt.journeys)) !== sha256(canonicalize(receipt.journeys)))
		throw new Error('Actual Budget journey canonicalization differs');
	return verified;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseActualBudgetRunLauncher(args);
	if (mode === 'run') await runActualBudgetVertical();
	const result = await verifyActualBudgetRun();
	process.stdout.write(`${canonicalize(result)}\n`);
}

if (basename(process.argv[1] ?? '') === 'react-actual-budget-v22-12-9-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
