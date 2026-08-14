/**
 * The `verify` flow: the offline verifications an operator is otherwise
 * expected to run one at a time, in one summary.
 *
 * Nothing is re-implemented here. Each check calls the same function the
 * single-purpose command calls, and a failure is reported as a failure rather
 * than thrown away — the point of a summary is that a reader sees the check
 * that failed beside the ones that passed. A check this flow could not run at
 * all is reported `unknown`, which is neither a pass nor a failure.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { analyzeCorpusConformance } from '../../../core/src/corpus/conformance.ts';
import { verifyReceipt } from '../../../core/src/receipts/verify.ts';
import {
	ADAPTER_FREEZE_SUBTREES,
	adapterFreezeRecord,
	verifyAdapterFreezeRecord,
} from '../../../trust/src/freeze.ts';
import { verifyTrustPackage } from '../../../trust/src/verify.ts';

const run = promisify(execFile);

export type CheckState = 'pass' | 'fail' | 'unknown';

export type OperatorCheck = Readonly<{
	name: string;
	state: CheckState;
	detail: string;
}>;

export type OperatorVerification = Readonly<{
	result: 'pass' | 'fail' | 'incomplete';
	checks: readonly OperatorCheck[];
	notEstablished: readonly string[];
}>;

const VERIFY_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'These checks establish reproducibility and hash integrity. They are not certification, legal compliance, signer authenticity, or an SLSA level.',
	'A pass here says the published evidence re-derives from its own inputs. It says nothing about an application this repository never ingested.',
]);

/** The default receipt `receipt:verify` checks when handed no path. */
export const DEFAULT_RECEIPT = 'evidence/runs/react-boilerplate-v4-composed/t060-run.json';

const message = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

/**
 * Recompute the frozen adapter subtree object ids from the checkout itself, and
 * compare them to the ones the freeze record declares. This is the check that
 * would catch an adapter edited underneath a migration run.
 */
export async function recomputeFreeze(rootDir: string): Promise<OperatorCheck> {
	try {
		verifyAdapterFreezeRecord(adapterFreezeRecord());
	} catch (error) {
		return { name: 'freeze:composite', state: 'fail', detail: message(error) };
	}
	const drift: string[] = [];
	for (const subtree of ADAPTER_FREEZE_SUBTREES) {
		let observed: string;
		try {
			observed = (
				await run('git', ['rev-parse', `HEAD:${subtree.path}`], { cwd: rootDir })
			).stdout.trim();
		} catch (error) {
			return {
				name: 'freeze:subtrees',
				state: 'unknown',
				detail: `the checkout could not be read for ${subtree.path}: ${message(error)}`,
			};
		}
		if (observed !== subtree.treeOid)
			drift.push(`${subtree.path}: declared ${subtree.treeOid}, checkout ${observed}`);
	}
	return drift.length === 0
		? {
				name: 'freeze:subtrees',
				state: 'pass',
				detail: `${String(ADAPTER_FREEZE_SUBTREES.length)} frozen subtrees match the checkout, composite recomputed from its own subtree list`,
			}
		: { name: 'freeze:subtrees', state: 'fail', detail: drift.join('; ') };
}

export type VerifyOptions = Readonly<{
	rootDir?: string;
	trustDir?: string;
	receipts?: readonly string[];
	environment?: NodeJS.ProcessEnv;
}>;

export async function runOperatorVerification(
	options: VerifyOptions = {},
): Promise<OperatorVerification> {
	const rootDir = options.rootDir ?? '.';
	const environment = {
		...(options.environment ?? process.env),
		VERSIONLESS_NETWORK_MODE: 'offline',
	};
	const checks: OperatorCheck[] = [await recomputeFreeze(rootDir)];
	try {
		const trust = await verifyTrustPackage({
			outputDir: options.trustDir ?? 'evidence/trust/current',
			rootDir: options.rootDir,
			environment,
		});
		checks.push({
			name: 'trust:verify',
			state: trust.valid ? 'pass' : 'fail',
			detail: `digest ${trust.digest}, ${String(trust.artifacts)} artifacts`,
		});
	} catch (error) {
		checks.push({ name: 'trust:verify', state: 'fail', detail: message(error) });
	}
	try {
		const conformance = await analyzeCorpusConformance({ rootDir: options.rootDir });
		checks.push({
			name: 'corpus:verify',
			state: 'pass',
			detail: `digest ${conformance.integrity.canonicalDigest}, ${String(conformance.summary.verticals)} verticals over ${String(conformance.summary.sourceApplications)} source applications`,
		});
	} catch (error) {
		checks.push({ name: 'corpus:verify', state: 'fail', detail: message(error) });
	}
	for (const receipt of options.receipts ?? [DEFAULT_RECEIPT]) {
		try {
			const verified = await verifyReceipt(receipt, { requireAggregate: true });
			checks.push({
				name: `receipt:verify ${receipt}`,
				state: verified.valid ? 'pass' : 'fail',
				detail: JSON.stringify(verified),
			});
		} catch (error) {
			checks.push({
				name: `receipt:verify ${receipt}`,
				state: 'fail',
				detail: message(error),
			});
		}
	}
	const result = checks.some((check) => check.state === 'fail')
		? 'fail'
		: checks.some((check) => check.state === 'unknown')
			? 'incomplete'
			: 'pass';
	return Object.freeze({
		result,
		checks: Object.freeze(checks),
		notEstablished: VERIFY_NOT_ESTABLISHED,
	});
}
