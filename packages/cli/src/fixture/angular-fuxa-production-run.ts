import { access, readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { TECHNICAL_EVALUATION_BOUNDARY, canonicalize, sha256 } from '../../../core/src/index.ts';

export const FUXA_PRODUCTION_RUN_SCHEMA =
	'versionless.angular-fuxa-production-run-plan.v1' as const;
const root = path.resolve(import.meta.dirname, '../../../..');
const dependencyReceiptPath = path.join(
	root,
	'evidence/dependencies/angular-fuxa/t621/dependency-receipt.json',
);

export type FuxaProductionLane = Readonly<{
	name: 'angular14-node16' | 'angular16-node18';
	node: '16.20.2' | '18.20.8';
	angular: '14' | '16';
	builder: 'browser' | 'browser-esbuild';
	configuration: 'demo';
	aot: true;
	install: Readonly<{ offline: true; ignoreScripts: true; runs: 2 }>;
	journeys: readonly ['rectangle-drag-move-undo-redo', 'local-save-reload-persistence'];
	journeyRuns: 2;
}>;

export function fuxaProductionRunPlan(): Readonly<{
	schemaVersion: typeof FUXA_PRODUCTION_RUN_SCHEMA;
	boundary: typeof TECHNICAL_EVALUATION_BOUNDARY;
	lanes: readonly FuxaProductionLane[];
	migration: Readonly<{
		sequential: readonly [14, 15, 16];
		maxFiles: 64;
		maxSpans: 256;
		yukuRequired: true;
	}>;
	mutation: Readonly<{
		from: string;
		to: string;
		intendedFailure: string;
		restoration: 'byte-identical';
	}>;
}> {
	const common = {
		configuration: 'demo' as const,
		aot: true as const,
		install: { offline: true as const, ignoreScripts: true as const, runs: 2 as const },
		journeys: ['rectangle-drag-move-undo-redo', 'local-save-reload-persistence'] as const,
		journeyRuns: 2 as const,
	};
	return {
		schemaVersion: FUXA_PRODUCTION_RUN_SCHEMA,
		boundary: TECHNICAL_EVALUATION_BOUNDARY,
		lanes: [
			{
				name: 'angular14-node16',
				node: '16.20.2',
				angular: '14',
				builder: 'browser',
				...common,
			},
			{
				name: 'angular16-node18',
				node: '18.20.8',
				angular: '16',
				builder: 'browser-esbuild',
				...common,
			},
		],
		migration: { sequential: [14, 15, 16], maxFiles: 64, maxSpans: 256, yukuRequired: true },
		mutation: {
			from: '[attr.type]="item.type"',
			to: '[attr.type]="\'circle\'"',
			intendedFailure: 'rectangle semantic assertion',
			restoration: 'byte-identical',
		},
	};
}

function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

export async function verifyFuxaProductionRunPreconditions(): Promise<
	Readonly<{ dependencyDigest: string; planDigest: string }>
> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('FUXA production run requires dual offline controls');
	if (!(await exists(dependencyReceiptPath)))
		throw new Error('FUXA T621 dependency receipt is absent');
	const receipt = JSON.parse(await readFile(dependencyReceiptPath, 'utf8')) as Record<
		string,
		unknown
	>;
	if (canonicalize(receipt.boundary) !== canonicalize(TECHNICAL_EVALUATION_BOUNDARY))
		throw new Error('FUXA dependency receipt legal/nonclaim boundary differs');
	return {
		dependencyDigest: sha256(canonicalize(receipt)),
		planDigest: sha256(canonicalize(fuxaProductionRunPlan())),
	};
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1 || args[0] !== '--verify-preconditions')
		throw new Error(
			'FUXA production run accepts only --verify-preconditions before closure publication',
		);
	process.stdout.write(`${canonicalize(await verifyFuxaProductionRunPreconditions())}\n`);
}

if (process.argv[1]?.endsWith('angular-fuxa-production-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
