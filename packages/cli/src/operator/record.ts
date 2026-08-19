/**
 * The three helpers every operator flow needs and none of them owns.
 *
 * They lived in `flows.ts` while `migrate` was the only flow that composed
 * more than one stage. `run` composes nine, and it may not import `flows.ts`
 * without a cycle — `flows.ts` is the command surface that dispatches to it —
 * so the shared parts sit here, where both can read them and neither owns them.
 *
 * Nothing here decides anything about a migration. A path is rendered for a
 * reader, a record is written where it was asked for, and the lane composition
 * for a lineage is selected by the same rule it was selected by before.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { composeReactLane, laneNotComposed, type LaneComposition } from './lane.ts';

/** A path as a reader should see it: relative to the working directory. */
export function displayPath(value: string): string {
	const relative = path.relative(process.cwd(), path.resolve(value));
	return relative === '' ? '.' : relative;
}

/** Write a record where `--record` asked for one, and nowhere otherwise. */
export async function writeRecord(file: string | undefined, value: unknown): Promise<void> {
	if (file === undefined) return;
	await mkdir(path.dirname(path.resolve(file)), { recursive: true });
	await writeFile(path.resolve(file), `${JSON.stringify(value, null, '\t')}\n`);
}

/**
 * Which lane composition a tree gets, if any.
 *
 * Only the create-react-app lineage gets a generated build configuration,
 * because that is the lineage whose lane otherwise carries the origin
 * toolchain's declaration and no configuration at all. Every other tree is
 * reported as not composed, with the reason, rather than silently receiving
 * nothing.
 */
export async function composeLane(
	appRoot: string,
	out: string,
	lineage: string,
	builder: string,
): Promise<LaneComposition> {
	if (lineage === 'react' && builder === 'react-scripts')
		return composeReactLane({ appRoot, laneDir: out });
	if (lineage === 'react')
		return laneNotComposed(
			lineage,
			`this tree declares the builder ${builder} rather than react-scripts, so the Vite-origin adapter reads the application's own configuration at plan time. The lane keeps that configuration rather than having this flow generate a second one.`,
		);
	if (lineage === 'angular')
		return laneNotComposed(
			lineage,
			"the generated lane build configuration is the create-react-app composition. The Angular changeset rewrites the workspace's own build declarations through the frozen adapter, so this flow composes no additional configuration for it.",
		);
	return laneNotComposed(
		lineage,
		`no lane build configuration is published for the ${lineage} lineage.`,
	);
}
