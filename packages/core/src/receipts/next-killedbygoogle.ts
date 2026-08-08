import { readFile } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import * as path from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import { verifyReceipt } from './verify.ts';

export const NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH =
	'evidence/runs/next-killedbygoogle-derived-state-to-memo/receipt.json';
export const NEXT_KILLED_BY_GOOGLE_DIAGNOSTIC_PATH =
	'evidence/runs/next-killedbygoogle-derived-state-to-memo/build-variance-diagnostic.json';
export const NEXT_KILLED_BY_GOOGLE_DIAGNOSTIC_SHA256 =
	'8a476406eecc0c81b3eff88c642ba85792f71285e8bf04222b98c5e0e3c4a41e';

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Killed by Google ${label} must be an object`);
	return value as Record<string, unknown>;
}

const lowerHexSha256 = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);
const nextBuildId = createRegExp(
	charIn('0123456789').from('A', 'Z').from('a', 'z').times(21).at.lineStart().at.lineEnd(),
);
const generatedBuildManifestNames = [
	'_buildManifest.js',
	'_middlewareManifest.js',
	'_ssgManifest.js',
] as const;
const expectedNextBuildIds = {
	baseline: {
		first: 'Y3iiLpLIAmh2dHxhtc64a',
		second: 'h3bCr1BuFpZHOlD0Z6VAF',
	},
	migrated: {
		first: 'lXXRWHLz9WP1hDVNYojCO',
		second: 'Bfr0QJOBkGNlpByi3PMVG',
	},
} as const;

function portableContained(value: unknown, label: string): string {
	if (typeof value !== 'string' || !value || value.includes('\\') || path.isAbsolute(value))
		throw new Error(`Killed by Google ${label} is not a portable relative path`);
	const normalized = path.normalize(value);
	if (normalized === '..' || normalized.startsWith('../') || normalized !== value)
		throw new Error(`Killed by Google ${label} escapes its portable root`);
	return value;
}

function lowercaseDigest(value: unknown, label: string): string {
	if (typeof value !== 'string' || !lowerHexSha256.test(value))
		throw new Error(`Killed by Google ${label} is not a lowercase SHA-256`);
	return value;
}

export function validateNextKilledByGoogleNftEvidence(value: unknown) {
	const nft = record(value, 'NFT equivalence');
	const rowsValue = nft.manifests;
	if (!Array.isArray(rowsValue)) throw new Error('Killed by Google NFT rows are absent');
	const expectedPaths = [
		'next-server.js.nft.json',
		'server/pages/_app.js.nft.json',
		'server/pages/_document.js.nft.json',
		'server/pages/_error.js.nft.json',
		'server/pages/index.js.nft.json',
	];
	const rows = rowsValue.map((value) => record(value, 'NFT row'));
	if (
		rows.length !== 5 ||
		canonicalize(rows.map((row) => row.path)) !== canonicalize(expectedPaths) ||
		new Set(rows.map((row) => row.path)).size !== 5
	)
		throw new Error('Killed by Google NFT path set differs');
	for (const row of rows) {
		const manifestPath = portableContained(row.path, 'NFT manifest path');
		if (
			typeof row.rawEqual !== 'boolean' ||
			row.version !== 1 ||
			row.membersUnique !== true ||
			row.targetsContained !== true ||
			row.realTargetsContained !== true ||
			row.bindingsEqual !== true ||
			row.traceMembershipOccurrences !== 0 ||
			!Number.isInteger(row.memberCount) ||
			!Array.isArray(row.bindings) ||
			row.bindings.length !== row.memberCount
		)
			throw new Error(`Killed by Google NFT row shape differs: ${manifestPath}`);
		const firstProjection = lowercaseDigest(row.firstProjectionSha256, 'first NFT projection');
		const secondProjection = lowercaseDigest(
			row.secondProjectionSha256,
			'second NFT projection',
		);
		if (firstProjection !== secondProjection)
			throw new Error(`Killed by Google NFT projections differ: ${manifestPath}`);
		for (const value of row.bindings) {
			const binding = record(value, 'NFT binding');
			if (
				typeof binding.member !== 'string' ||
				binding.member.includes('\\') ||
				path.isAbsolute(binding.member)
			)
				throw new Error('Killed by Google NFT member is not relative');
			const canonicalTarget = path.resolve(
				'/portable-lane/.next',
				path.dirname(manifestPath),
				binding.member,
			);
			const expectedLaneRelative = path.relative('/portable-lane', canonicalTarget);
			portableContained(binding.laneRelativeTarget, 'NFT canonical target');
			if (
				expectedLaneRelative === '..' ||
				expectedLaneRelative.startsWith('../') ||
				expectedLaneRelative !== binding.laneRelativeTarget ||
				portableContained(binding.realLaneRelativeTarget, 'NFT canonical real target') !==
					binding.realLaneRelativeTarget ||
				!['canonical-lane', 'snapshot-storage'].includes(String(binding.physicalRoot)) ||
				!['file', 'symbolic-link'].includes(String(binding.targetType))
			)
				throw new Error('Killed by Google NFT binding path or type differs');
			lowercaseDigest(binding.targetSha256, 'NFT target digest');
		}
	}
	const rawEqual = rows.filter((row) => row.rawEqual === true).length;
	const varying = rows.filter((row) => row.rawEqual === false).length;
	if (
		nft.rawEqualManifestCount !== rawEqual ||
		nft.varyingManifestCount !== varying ||
		rawEqual + varying !== 5
	)
		throw new Error('Killed by Google NFT row-derived counts differ');
	return rows;
}

export function validateNextKilledByGoogleInventoryEvidence(
	value: unknown,
	buildEvidence: unknown,
) {
	const inventories = record(value, 'production inventories');
	const builds = record(buildEvidence, 'build evidence');
	return (['baseline', 'migrated'] as const).map((lane) => {
		const pair = record(inventories[lane], `${lane} inventory pair`);
		const build = record(builds[lane], `${lane} build evidence`);
		const expectedIds = expectedNextBuildIds[lane];
		if (
			build.rawEqual !== false ||
			build.normalizedEqual !== true ||
			build.firstBuildId !== expectedIds.first ||
			build.secondBuildId !== expectedIds.second ||
			!nextBuildId.test(expectedIds.first) ||
			!nextBuildId.test(expectedIds.second) ||
			build.firstBuildId === build.secondBuildId
		)
			throw new Error(`Killed by Google ${lane} build identity differs`);
		if (!Array.isArray(pair.first) || !Array.isArray(pair.second))
			throw new Error(`Killed by Google ${lane} inventories are absent`);
		const validateRows = (rows: unknown[], pass: 'first' | 'second') => {
			const expectedId = expectedIds[pass];
			let generatedPaths = 0;
			const rawPaths: string[] = [];
			const projectedPaths = rows.map((value) => {
				const row = record(value, `${lane} ${pass} inventory row`);
				const rowPath = portableContained(row.path, 'inventory path');
				if (!Number.isInteger(row.byteLength) || Number(row.byteLength) < 0)
					throw new Error('Killed by Google inventory byte length differs');
				const digest = lowercaseDigest(row.sha256, 'inventory digest');
				rawPaths.push(rowPath);
				if (rowPath === 'BUILD_ID') {
					if (row.byteLength !== 21 || digest !== sha256(expectedId))
						throw new Error(
							`Killed by Google ${lane} ${pass} BUILD_ID binding differs`,
						);
					return rowPath;
				}
				const directory = path.dirname(rowPath);
				const fileName = path.basename(rowPath);
				const generatedDirectory = path.join('static', expectedId);
				const exactGenerated =
					directory === generatedDirectory &&
					generatedBuildManifestNames.includes(
						fileName as (typeof generatedBuildManifestNames)[number],
					);
				if (exactGenerated) {
					generatedPaths += 1;
					return path.join('static', '<BUILD_ID>', fileName);
				}
				const generatedShape =
					path.dirname(directory) === 'static' &&
					generatedBuildManifestNames.includes(
						fileName as (typeof generatedBuildManifestNames)[number],
					);
				if (rowPath.includes(expectedId) || generatedShape)
					throw new Error(`Killed by Google ${lane} ${pass} generated path differs`);
				return rowPath;
			});
			projectedPaths.sort();
			if (
				rawPaths.length !== 43 ||
				new Set(rawPaths).size !== 43 ||
				projectedPaths.length !== 43 ||
				new Set(projectedPaths).size !== 43 ||
				generatedPaths !== 3
			)
				throw new Error(`Killed by Google ${lane} ${pass} inventory count differs`);
			return projectedPaths;
		};
		const first = validateRows(pair.first, 'first');
		const second = validateRows(pair.second, 'second');
		if (canonicalize(first) !== canonicalize(second))
			throw new Error(`Killed by Google ${lane} inventory identity differs`);
		return [first, second] as const;
	});
}

export async function verifyNextKilledByGoogleEvidence(rootDir = '.', requireAggregate = true) {
	const root = path.resolve(rootDir);
	const receiptPath = path.join(root, NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH);
	const verified = await verifyReceipt(receiptPath, {
		repositoryRoot: root,
		requireAggregate,
	});
	const receipt = record(JSON.parse(await readFile(receiptPath, 'utf8')), 'receipt');
	const verification = record(receipt.verification, 'verification');
	const locality = record(verification.locality, 'locality');
	const limitations = receipt.limitations;
	const consent = receipt.consent;
	const source = record(receipt.source, 'source');
	const tooling = record(receipt.tooling, 'tooling');
	const migration = record(receipt.migration, 'migration');
	const expectedLimitations = [
		'One immutable Next 12 Pages Router/webpack/SVGR production experiment; no generic React or Next.js support, Next-version upgrade, maintained Node 16 support, pilot, or production readiness.',
		'All 22 provenance-classified unknown or excluded local assets were blocked; visual parity for those assets is not claimed.',
		'No Vite replacement, compliance, certification, authenticity, signer identity, SLSA level, or OS-wide isolation claim.',
		'The retained v11 trace diagnostic remains a typed mismatch; trace is excluded only from production-input equivalence because exact Next 12 source and actual membership prove it is not a runtime input. Diagnostic reproducibility is not claimed.',
	];
	if (
		receipt.schemaVersion !== 'versionless.receipt.v1' ||
		receipt.runId !== 'T236-next-killedbygoogle-derived-state-to-memo' ||
		receipt.fixture !== 'next-killedbygoogle-derived-state-to-memo' ||
		receipt.result !== 'pass' ||
		canonicalize(source) !==
			canonicalize({
				repository: 'https://github.com/codyogden/killedbygoogle',
				revision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
				tree: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763',
				archiveSha256: 'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d',
				license: 'MIT',
				licenseSha256: '10547fb81e311e470cdcda5a273bac2a76f50ded6b33ce4362bcb05e1176d5e0',
			}) ||
		canonicalize(tooling) !==
			canonicalize({
				node: '16.20.2',
				yarn: '1.22.22',
				next: '12.0.10',
				react: '17.0.2',
				typescript: '4.5.5',
				playwright: '1.58.2-host-harness',
			}) ||
		canonicalize(migration) !==
			canonicalize({
				file: 'components/App.tsx',
				transform: 'next12-derived-state-to-useMemo',
				edits: 3,
				changedFiles: ['components/App.tsx'],
				sourceSha256: 'b3a48d2095754c46f64594c7d0cd49c2c65cc45a3baeaf992d6525617d27fe25',
				targetSha256: 'a0895dcc3a95eff023cbbaa167ba514f656f346332c3e98df079a3eedaed5bcc',
			}) ||
		verification.productionOutputConformance !== 'pass' ||
		verification.nftManifestCount !== 5 ||
		verification.productionTraceExcluded !== true ||
		verification.traceNormalized !== false ||
		verification.traceDeleted !== false ||
		verification.browserParity !== true ||
		verification.mutationRestoration !== 'pass' ||
		verification.successfulNonLoopback !== 0 ||
		locality.mode !== 'offline' ||
		locality.osWideIsolation !== false ||
		locality.successfulNonLoopback !== 0 ||
		!Array.isArray(consent) ||
		consent.length !== 1 ||
		canonicalize(consent) !==
			canonicalize([
				{
					id: 'T236-next-killedbygoogle-yarn-v1-closure',
					purpose:
						'Acquire and audit the immutable 710-artifact Yarn v1 dependency closure.',
					mode: 'consented',
				},
			]) ||
		!Array.isArray(limitations) ||
		canonicalize(limitations) !== canonicalize(expectedLimitations)
	)
		throw new Error('Killed by Google receipt verification fields differ');
	const artifacts = receipt.artifacts;
	if (!Array.isArray(artifacts)) throw new Error('Killed by Google artifacts are absent');
	const expected = new Map(
		artifacts.map((value) => {
			const artifact = record(value, 'artifact');
			return [String(artifact.path), String(artifact.sha256)];
		}),
	);
	const expectedArtifactPaths = [
		'evidence/dependencies/next-killedbygoogle/dependency-receipt.json',
		NEXT_KILLED_BY_GOOGLE_DIAGNOSTIC_PATH,
		'evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/production-output.json',
		'evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/nft-equivalence.json',
		...[
			'preparation.json',
			'transform.json',
			'baseline-build.json',
			'migrated-build.json',
			'journey.json',
			'locality.json',
			'mutation-restoration.json',
			'controls.json',
			'receipt.md',
		].map(
			(name) => `evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/${name}`,
		),
	];
	if (
		expected.size !== expectedArtifactPaths.length ||
		canonicalize(artifacts.map((value) => String(record(value, 'artifact').path))) !==
			canonicalize(expectedArtifactPaths)
	)
		throw new Error('Killed by Google artifact identity differs');
	for (const relative of [
		NEXT_KILLED_BY_GOOGLE_DIAGNOSTIC_PATH,
		'evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/production-output.json',
		'evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/nft-equivalence.json',
	]) {
		const digest = sha256(await readFile(path.join(root, relative)));
		if (expected.get(relative) !== digest)
			throw new Error(`Killed by Google support artifact differs: ${relative}`);
	}
	const productionOutput = record(
		JSON.parse(
			await readFile(
				path.join(
					root,
					'evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/production-output.json',
				),
				'utf8',
			),
		),
		'production output',
	);
	const productionTrace = record(productionOutput.trace, 'production trace');
	const manifests = record(productionOutput.manifests, 'production manifests');
	const inventories = record(productionOutput.inventories, 'production inventories');
	const productionDeterministic = record(
		productionOutput.deterministicCore,
		'production deterministic core',
	);
	const combinedDeterministic = record(
		productionDeterministic.combined,
		'combined deterministic core',
	);
	const nft = record(
		JSON.parse(
			await readFile(
				path.join(
					root,
					'evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/nft-equivalence.json',
				),
				'utf8',
			),
		),
		'NFT equivalence',
	);
	const nextServerCacheKey = record(nft.nextServerCacheKey, 'next-server cacheKey');
	validateNextKilledByGoogleNftEvidence(nft);
	const journey = record(
		JSON.parse(
			await readFile(
				path.join(
					root,
					'evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/journey.json',
				),
				'utf8',
			),
		),
		'journey artifact',
	);
	const expectedGooglePlus = {
		name: 'Google+',
		type: 'service',
		link: 'https://en.wikipedia.org/wiki/Google%2B',
		description: 'Google+ was an Internet-based social network.',
	};
	const journeyRows = [
		...(Array.isArray(journey.baseline) ? journey.baseline : []),
		...(Array.isArray(journey.migrated) ? journey.migrated : []),
		journey.restored,
	].map((value) => record(value, 'journey row'));
	if (
		!Array.isArray(journey.baseline) ||
		journey.baseline.length !== 2 ||
		!Array.isArray(journey.migrated) ||
		journey.migrated.length !== 2 ||
		journey.normalizedEquivalent !== true ||
		journeyRows.length !== 5 ||
		journeyRows.some(
			(row) =>
				row.initialRows !== 263 ||
				row.initialProducts !== 263 ||
				row.searchTerm !== 'Google+' ||
				row.searchRows !== 1 ||
				canonicalize(row.googlePlus) !== canonicalize(expectedGooglePlus) ||
				row.filterLabel !== 'Apps (50)' ||
				row.appRows !== 50 ||
				row.successfulNonLoopback !== 0 ||
				!Array.isArray(row.pageErrors) ||
				row.pageErrors.length !== 0,
		)
	)
		throw new Error('Killed by Google immutable browser journey differs');
	const mutation = record(
		JSON.parse(
			await readFile(
				path.join(
					root,
					'evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/mutation-restoration.json',
				),
				'utf8',
			),
		),
		'mutation artifact',
	);
	if (
		canonicalize(mutation.reason) !==
			canonicalize({ code: 'google-plus-product-count', expected: 1, actual: 263 }) ||
		mutation.restoration !== 'byte-exact-green'
	)
		throw new Error('Killed by Google typed mutation or restoration differs');
	const receiptDeterministic = record(
		verification.deterministicCore,
		'receipt deterministic core',
	);
	const inventoryPairs = validateNextKilledByGoogleInventoryEvidence(inventories, {
		baseline: JSON.parse(
			await readFile(
				path.join(
					root,
					'evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/baseline-build.json',
				),
				'utf8',
			),
		),
		migrated: JSON.parse(
			await readFile(
				path.join(
					root,
					'evidence/runs/next-killedbygoogle-derived-state-to-memo/artifacts/migrated-build.json',
				),
				'utf8',
			),
		),
	});
	for (const lane of ['baseline', 'migrated']) {
		const projections = record(productionDeterministic[lane], `${lane} deterministic core`);
		const first = lowercaseDigest(projections.first, `${lane} first deterministic core`);
		const second = lowercaseDigest(projections.second, `${lane} second deterministic core`);
		if (projections.equal !== true || first !== second)
			throw new Error(`Killed by Google ${lane} deterministic cores differ`);
	}
	const combinedFirst = lowercaseDigest(
		combinedDeterministic.first,
		'combined first deterministic core',
	);
	const combinedSecond = lowercaseDigest(
		combinedDeterministic.second,
		'combined second deterministic core',
	);
	if (
		productionOutput.schemaVersion !== 'versionless.next12-production-output-conformance.v1' ||
		productionOutput.result !== 'pass' ||
		productionOutput.inventoryFiles !== 43 ||
		productionOutput.nftManifestCount !== 5 ||
		productionOutput.allRuntimeInputsEquivalent !== true ||
		inventoryPairs.some(
			([first, second]) =>
				first.length !== 43 ||
				second.length !== 43 ||
				new Set(first).size !== 43 ||
				new Set(second).size !== 43 ||
				canonicalize(first) !== canonicalize(second),
		) ||
		combinedFirst !== combinedSecond ||
		combinedDeterministic.equal !== true ||
		receiptDeterministic.first !== combinedFirst ||
		receiptDeterministic.second !== combinedSecond ||
		productionTrace.parsed !== false ||
		productionTrace.normalized !== false ||
		productionTrace.deleted !== false ||
		productionTrace.productionInput !== false ||
		productionTrace.requiredServerReferences !== 0 ||
		productionTrace.nftMembershipReferences !== 0 ||
		!['prerender', 'requiredServer', 'routes'].every(
			(name) => record(manifests[name], `${name} manifest`).stableEqual === true,
		) ||
		nft.schemaVersion !== 'versionless.next12-nft-equivalence.v1' ||
		nft.result !== 'pass' ||
		nft.manifestCount !== 5 ||
		nft.allVersions !== 1 ||
		nft.allMembersUnique !== true ||
		nft.allTargetsContained !== true ||
		nft.allRealTargetsContained !== true ||
		nft.allBindingsEqual !== true ||
		nft.traceMembershipOccurrences !== 0 ||
		nextServerCacheKey.present !== true ||
		nextServerCacheKey.type !== 'string' ||
		nextServerCacheKey.equal !== true ||
		nextServerCacheKey.runtimeInput !== false ||
		nextServerCacheKey.valueRetained !== false ||
		nextServerCacheKey.valueHashRetained !== false
	)
		throw new Error('Killed by Google production evidence differs');
	if (
		sha256(await readFile(path.join(root, NEXT_KILLED_BY_GOOGLE_DIAGNOSTIC_PATH))) !==
		NEXT_KILLED_BY_GOOGLE_DIAGNOSTIC_SHA256
	)
		throw new Error('Killed by Google retained diagnostic differs');
	if (artifacts.length !== 13 || verified.artifacts !== 13)
		throw new Error('Killed by Google support artifact count differs');
	return { receipt, digest: verified.digest, artifacts: artifacts.length };
}

export function nextKilledByGoogleAggregateMember(digest: string) {
	return {
		id: 'next-killedbygoogle-derived-state-to-memo',
		framework: 'react',
		track: 'next12-pages-derived-state-to-use-memo',
		bundler: 'next-12-webpack-5',
		runtime: 'node-16.20.2',
		result: 'pass',
		receipt: NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
		digest,
	};
}
