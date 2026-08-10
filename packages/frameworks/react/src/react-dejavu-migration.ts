import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const DEJAVU_TARGET = {
	react: '18.3.1',
	reactDom: '18.3.1',
	node: '24.15.0',
	vite: '8.0.16',
	bundler: 'vite',
} as const;

export type DejavuMigrationInput = {
	packageJson: Record<string, unknown>;
	routes: string[];
	requestSemantics: string[];
};

export type DejavuMigrationPlan = {
	target: typeof DEJAVU_TARGET;
	preservedRoutes: string[];
	preservedRequestSemantics: string[];
	removedRuntimeSurfaces: ['analytics', 'telemetry', 'service-worker', 'remote-origins'];
	transformDigest: string;
};

export function planReactDejavuMigration(input: DejavuMigrationInput): DejavuMigrationPlan {
	if (!input.packageJson.dependencies || !input.packageJson.scripts)
		throw new Error('Dejavu migration requires the authentic product manifest');
	if (input.routes.length < 3 || new Set(input.routes).size !== input.routes.length)
		throw new Error('Dejavu migration route inventory is incomplete or ambiguous');
	if (
		input.requestSemantics.length < 6 ||
		new Set(input.requestSemantics).size !== input.requestSemantics.length
	)
		throw new Error('Dejavu Elasticsearch request inventory is incomplete or ambiguous');
	const preservedRoutes = [...input.routes];
	const preservedRequestSemantics = [...input.requestSemantics];
	const basis = {
		target: DEJAVU_TARGET,
		preservedRoutes,
		preservedRequestSemantics,
		removedRuntimeSurfaces: ['analytics', 'telemetry', 'service-worker', 'remote-origins'],
	};
	return {
		...basis,
		removedRuntimeSurfaces:
			basis.removedRuntimeSurfaces as DejavuMigrationPlan['removedRuntimeSurfaces'],
		transformDigest: sha256(canonicalize(basis)),
	};
}

export function assertDejavuMigrationParity(
	plan: DejavuMigrationPlan,
	observed: { routes: string[]; requestSemantics: string[]; outputFiles: string[] },
): void {
	if (canonicalize(observed.routes) !== canonicalize(plan.preservedRoutes))
		throw new Error('Dejavu target route parity differs');
	if (canonicalize(observed.requestSemantics) !== canonicalize(plan.preservedRequestSemantics))
		throw new Error('Dejavu target request parity differs');
	if (
		observed.outputFiles.some(
			(path) =>
				path.endsWith('service-worker.js') ||
				path.endsWith('sw.js') ||
				path.includes('webpack'),
		)
	)
		throw new Error('Dejavu target contains forbidden Webpack or service-worker output');
}
