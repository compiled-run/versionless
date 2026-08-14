/**
 * The measurement behind the operator flows' central claim.
 *
 * The flows in `packages/cli/src/operator` are composition over the frozen
 * public APIs rather than a second migration pipeline. That is a claim about
 * bytes, so it is measured rather than asserted: handed the same inputs, the
 * framework-neutral `plan` flow and the fixture-driven driver must produce one
 * changeset per lineage, not two similar ones.
 *
 * This driver is fixture-scoped. The application knowledge it carries — which
 * two applications the overlap is measured on, and which readings the Angular
 * driver supplies — is read from the drivers themselves rather than restated,
 * so the two paths cannot drift apart through this file.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';
import { ADAPTER_FREEZE_COMPOSITE } from '../../../trust/src/freeze.ts';
import { composeAngularPlan, composeReactPlan } from '../operator/plan.ts';
import {
	APPLICATION_SOURCE_DIRECTORIES,
	APPLIED_TREE,
	ERA_CLOSURE_TREE,
	PREVIOUS_BUILD_LOG,
	SOURCE_TREE,
	composeMigration,
	readDeepImportReadings,
	readEraClosureTypePackages,
	readMissingMemberDiagnostics,
} from './angular-pigallery2-migration-run.ts';
import { cypressRwaWorkArea } from './react-cypress-rwa-migration-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const UNIT = 'lrapr-t009/u2-operator-cli-flows';

export const EVIDENCE_DIRECTORY = path.join(repositoryRoot, 'evidence/runs/operator-flows');
export const RECORD_FILE = 'byte-identity.json';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export type IdentityRecord = Readonly<{
	schemaVersion: string;
	unit: string;
	purpose: string;
	adapterFreezeComposite: string;
	angular: Record<string, unknown>;
	react: Record<string, unknown>;
	notEstablished: readonly string[];
}>;

/** Compose both lineages twice — once each way — and compare the results. */
export async function buildIdentityRecord(): Promise<IdentityRecord> {
	const [templateDirectory] = APPLICATION_SOURCE_DIRECTORIES;
	const operator = await composeAngularPlan({
		appRoot: SOURCE_TREE,
		sourceDirectories: APPLICATION_SOURCE_DIRECTORIES,
		templateDirectories: [templateDirectory as string],
		styleSheetDirectories: [templateDirectory as string],
		readings: {
			missingMemberDiagnostics: await readMissingMemberDiagnostics(PREVIOUS_BUILD_LOG),
			deepImportReadings: await readDeepImportReadings(APPLIED_TREE),
			eraClosureTypePackages: await readEraClosureTypePackages(ERA_CLOSURE_TREE),
		},
	});
	const driver = await composeMigration(SOURCE_TREE);
	const operatorDigest = sha256(canonicalize(operator.migration));
	const driverDigest = sha256(canonicalize(driver));
	const composed = await composeReactPlan({ appRoot: cypressRwaWorkArea.target });
	const operatorDocument = composed.files[0]?.source ?? '';
	const driverDocument = await readFile(
		path.join(cypressRwaWorkArea.target, 'index.html'),
		'utf8',
	);
	return Object.freeze({
		schemaVersion: 'versionless.operator-flow-byte-identity.v1',
		unit: UNIT,
		purpose:
			'The operator flows compose the frozen public APIs rather than re-implementing them. This record measures that claim on the overlap between the operator path and the fixture-driven path, one application per lineage.',
		adapterFreezeComposite: ADAPTER_FREEZE_COMPOSITE,
		angular: {
			application: 'pigallery2 1.7.0 (Angular holdout corpus, at its pinned revision)',
			operatorPath: 'packages/cli/src/operator/plan.ts composeAngularPlan',
			driverPath:
				'packages/cli/src/fixture/angular-pigallery2-migration-run.ts composeMigration',
			comparison:
				'sha256(canonicalize(AngularMigration)) — every file, every digest, every declared difference and every unhandled finding',
			inputsHeldEqual: [
				`sourceDirectories = the driver's own APPLICATION_SOURCE_DIRECTORIES (${APPLICATION_SOURCE_DIRECTORIES.join(', ')})`,
				`templates and stylesheets = ${String(templateDirectory)}`,
				"missingMemberDiagnostics = the driver's reading of the previous migrated build log",
				"deepImportReadings = the driver's reading of the applied lane's installed closure",
				"eraClosureTypePackages = the driver's reading of the era lane's installed closure",
			],
			operatorDigest,
			driverDigest,
			identical: operatorDigest === driverDigest,
			applicationFilesScanned: driver.applicationFilesScanned,
			applicationFilesChanged: driver.applicationFilesChanged,
			workspaceFilesChanged: driver.workspaceFilesChanged,
			removedFiles: driver.removedFiles.length,
		},
		react: {
			application: 'cypress-realworld-app (React holdout, migrated lane)',
			operatorPath: 'packages/cli/src/operator/plan.ts composeReactPlan',
			driverPath:
				'packages/cli/src/fixture/react-cypress-rwa-migration-run.ts writeCypressRwaEntryDocument',
			comparison:
				"sha256 of the Vite entry document the create-react-app adapter derives from the application's own public/index.html",
			inputsHeldEqual: [
				"template = the application's own public/index.html",
				'entryModule = /src/index.tsx, detected by the flow rather than named by it',
				"environment = NODE_ENV, PUBLIC_URL and the application's own REACT_APP_ keys",
			],
			operatorDigest: sha256(operatorDocument),
			driverDigest: sha256(driverDocument),
			identical: operatorDocument === driverDocument,
			bytes: operatorDocument.length,
		},
		notEstablished: Object.freeze([
			'A byte-identical changeset is not a build. Nothing here establishes that either application installs, compiles or emits anything.',
			'The identity is measured on one application per lineage, over the overlap between the two paths. It is not a claim about every application either path could be pointed at.',
			'The React overlap is the entry document, because that is the only file the create-react-app hop writes. The rest of that hop is a build-time composition and has no changeset to compare.',
		]),
	});
}

export async function main(): Promise<void> {
	const record = await buildIdentityRecord();
	if (record.angular.identical !== true || record.react.identical !== true)
		throw new Error('Operator and fixture paths composed different changesets');
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(
		path.join(EVIDENCE_DIRECTORY, RECORD_FILE),
		`${JSON.stringify(record, null, '\t')}\n`,
	);
	process.stdout.write(
		`angular ${String(record.angular.operatorDigest).slice(0, 12)} and react ${String(
			record.react.operatorDigest,
		).slice(0, 12)} identical across both paths\n`,
	);
}

if (process.argv[1]?.endsWith('operator-flow-byte-identity-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
