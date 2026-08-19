/**
 * Structured, countable refusals for the operator flows.
 *
 * A refusal is not a crash. It is a terminal outcome this pipeline is allowed
 * to reach: an input it will not guess at, an admission rule a frozen adapter
 * owns, or a policy nobody declared. Before this module a refusal left the
 * flows as a bare `Error`, which reached an operator as a stack trace and
 * reached a fleet report as nothing at all.
 *
 * Three properties are structural rather than advisory.
 *
 * The `message` is the string the refusal already emitted, reproduced verbatim.
 * A refusal is not an occasion to reword a sealed string, so nothing here
 * rewrites, truncates, or prettifies one.
 *
 * The `origin` says whose decision it was. `frozen-adapter` means the refusal
 * restates an admission rule that lives inside one of the frozen subtrees —
 * widening it is freeze motion. `pipeline` means this flow decided, and the
 * decision can be changed here. A reader who cannot tell the two apart cannot
 * tell which refusals are cheap to open and which are not.
 *
 * The exit code is the countable part: `2` is a refusal, `1` is a defect, `0`
 * is a run that proceeded. A crash, a hang, or a tree that will not install is
 * a defect and must not be scored as a refusal.
 */

/** Whose decision the refusal is. */
export type RefusalOrigin = 'frozen-adapter' | 'pipeline';

/** The operator stages a refusal can be raised in. */
export const PIPELINE_STAGES = [
	'arguments',
	/**
	 * Fetching an application source into a baseline tree, under exact
	 * purpose-bound consent. It is a stage of its own rather than part of
	 * `ingest` because its refusals are about the fetch — an undeclared
	 * consent, an unresolvable pin, an archive that does not reconcile with the
	 * Git tree — and `ingest` refuses about a tree that is already on disk.
	 */
	'acquire',
	'ingest',
	'license-at-pin',
	'era-cell',
	'analyze',
	'plan',
	'apply',
	'lane',
	'install',
	'build',
	'verify',
	'supported-matrix',
	'refusal-census',
	/**
	 * Deriving a witness journey for an application nobody has read. It is a
	 * stage of its own rather than part of `verify` because its refusal is a
	 * different fact: `verify` refuses a check it cannot run, and this refuses
	 * an application whose own suite and served lane yield nothing to replay.
	 */
	'witness-synthesize',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type PipelineRefusal = Readonly<{
	/** A stable machine identifier a fleet report can tally by. */
	code: string;
	/** The emitted string, verbatim. */
	message: string;
	/** The stage that was running when the refusal was raised. */
	stage: PipelineStage;
	origin: RefusalOrigin;
}>;

/** A run that reached a terminal outcome without refusing and without failing. */
export const EXIT_PROCEEDED = 0;

/** A defect: a crash, a hang, or a tree that will not install. Never a refusal. */
export const EXIT_DEFECT = 1;

/** A named refusal. The run is over, the reason is countable, nothing broke. */
export const EXIT_REFUSAL = 2;

/**
 * The error a refusal travels in.
 *
 * It stays an `Error` so that a caller which only knows how to catch errors
 * still sees the same message it saw before, and it carries the structured
 * refusal so that a caller which knows about refusals can count one.
 */
export class PipelineRefusalError extends Error {
	readonly refusal: PipelineRefusal;

	constructor(refusal: PipelineRefusal) {
		super(refusal.message);
		this.name = 'PipelineRefusalError';
		this.refusal = Object.freeze({ ...refusal });
	}
}

/** Raise a named refusal. The message must be the emitted string, verbatim. */
export function refuse(refusal: PipelineRefusal): never {
	throw new PipelineRefusalError(refusal);
}

/** The refusal an error carries, or `null` when the error is a defect. */
export function pipelineRefusalOf(error: unknown): PipelineRefusal | null {
	return error instanceof PipelineRefusalError ? error.refusal : null;
}

const REFUSAL_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A refusal is a named reason this run stopped. It is not a reading of the application: nothing here establishes what would have happened had the refusal not fired.',
	'`origin: frozen-adapter` says the rule lives in a frozen subtree, not that the frozen subtree raised this particular error object. The emitting file and line are recorded so the attribution can be checked.',
	'Exit 2 is a refusal and exit 1 is a defect. A crash, a hang, or a tree that will not install is a defect even when it happens inside a stage that can also refuse.',
]);

/** The JSON body a refused run emits, for `--json` and for `--record`. */
export function refusalRecord(
	flow: string,
	refusal: PipelineRefusal,
): Readonly<Record<string, unknown>> {
	return Object.freeze({
		flow,
		outcome: 'refused',
		exitCode: EXIT_REFUSAL,
		refusal,
		notEstablished: REFUSAL_NOT_ESTABLISHED,
	});
}

/** The refusal as an operator reads it: the code, the origin, then the string. */
export function renderRefusal(refusal: PipelineRefusal): string {
	return [
		`refused: ${refusal.code}`,
		`stage: ${refusal.stage}`,
		`origin: ${refusal.origin}`,
		'',
		refusal.message,
		'',
		...REFUSAL_NOT_ESTABLISHED.map((line) => `not established: ${line}`),
		'',
	].join('\n');
}
