/**
 * Where the witness stage gets its browser.
 *
 * Before this module the generic pipeline launched Chromium from
 * `.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/…`:
 * a gitignored, fixture-named, arch-pinned directory that exists only on a host
 * that had already run one particular fixture corpus. A fresh clone has no such
 * directory, so the witness stage died with a launch failure and the run was
 * scored a defect — a defect in the machinery, reported as if it were a reading
 * of the application.
 *
 * The browser is a property of the host, not of a fixture. It is resolved here
 * from the host's own Playwright provisioning — the `PLAYWRIGHT_BROWSERS_PATH`
 * convention that `chromium.executablePath()` already implements — or from a
 * path the operator declared. When neither yields an executable that exists,
 * this refuses by name rather than falling back to a fixture cache: a silent
 * fallback is exactly the misfire this module was written to remove.
 */

import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

/** The environment variable an operator can declare a browser through. */
export const WITNESS_BROWSER_PATH_ENV = 'VERSIONLESS_WITNESS_BROWSER_PATH';

/** How a resolved browser was found, so a record can say which host supplied it. */
export type WitnessBrowserSource = 'declared' | 'playwright-provisioned';

export type WitnessBrowserResolution = Readonly<{
	executable: string;
	source: WitnessBrowserSource;
}>;

/**
 * The error a missing browser travels in.
 *
 * It stays an `Error` so a caller that only catches errors sees the same
 * message, and it carries the paths that were looked at so the operator stage
 * can name them in a countable refusal without recomputing them.
 */
export class WitnessBrowserNotProvisionedError extends Error {
	readonly lookedIn: readonly string[];

	constructor(message: string, lookedIn: readonly string[]) {
		super(message);
		this.name = 'WitnessBrowserNotProvisionedError';
		this.lookedIn = Object.freeze([...lookedIn]);
	}
}

/** The error a caller can recognize without importing the class. */
export function witnessBrowserNotProvisioned(
	error: unknown,
): WitnessBrowserNotProvisionedError | null {
	return error instanceof WitnessBrowserNotProvisionedError ? error : null;
}

/**
 * The candidates, in the order they are tried, for the given environment.
 *
 * A declared path is tried alone: an operator who names a browser and is given
 * a different one has been guessed at, which is the thing this repository does
 * not do. Otherwise the single candidate is whatever Playwright itself says it
 * provisioned, which already honours `PLAYWRIGHT_BROWSERS_PATH`.
 */
export function witnessBrowserCandidates(
	environment: NodeJS.ProcessEnv = process.env,
): readonly string[] {
	const declared = environment[WITNESS_BROWSER_PATH_ENV];
	if (declared !== undefined && declared.trim() !== '') return Object.freeze([declared.trim()]);
	try {
		return Object.freeze([chromium.executablePath()]);
	} catch {
		return Object.freeze([]);
	}
}

/** The message a missing browser emits, verbatim, naming what to do about it. */
export function witnessBrowserNotProvisionedMessage(lookedIn: readonly string[]): string {
	return [
		'witness: no Chromium executable is provisioned on this host.',
		lookedIn.length === 0
			? 'Playwright reported no browser path and no browser was declared.'
			: `Looked for: ${lookedIn.join(', ')}.`,
		`Provision one with \`pnpm exec playwright install chromium\` (honouring PLAYWRIGHT_BROWSERS_PATH if set), or declare an existing executable through ${WITNESS_BROWSER_PATH_ENV}.`,
		'This stage refuses rather than launching a browser from a fixture cache: a fixture-provisioned browser is not this host, and a run that borrowed one would be reporting on a tree it did not have.',
	].join(' ');
}

/**
 * Resolve the browser this host provisioned, or refuse by name.
 *
 * Called lazily — never at module load — so that importing the witness runner
 * on a host with no browser is not itself a failure.
 */
export function witnessChromiumExecutable(
	environment: NodeJS.ProcessEnv = process.env,
): WitnessBrowserResolution {
	const declared = environment[WITNESS_BROWSER_PATH_ENV];
	const source: WitnessBrowserSource =
		declared !== undefined && declared.trim() !== '' ? 'declared' : 'playwright-provisioned';
	const candidates = witnessBrowserCandidates(environment);
	for (const candidate of candidates)
		if (existsSync(candidate)) return Object.freeze({ executable: candidate, source });
	throw new WitnessBrowserNotProvisionedError(
		witnessBrowserNotProvisionedMessage(candidates),
		candidates,
	);
}

/** The executable alone, for the launch options that only take a path. */
export function witnessChromiumExecutablePath(
	environment: NodeJS.ProcessEnv = process.env,
): string {
	return witnessChromiumExecutable(environment).executable;
}
