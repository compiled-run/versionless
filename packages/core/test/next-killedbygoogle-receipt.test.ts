import { access } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import {
	NEXT_KILLED_BY_GOOGLE_DIAGNOSTIC_SHA256,
	NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
	nextKilledByGoogleAggregateMember,
	sha256,
	validateNextKilledByGoogleInventoryEvidence,
	validateNextKilledByGoogleNftEvidence,
	verifyNextKilledByGoogleEvidence,
} from '../src/index.ts';

function validNftEvidence(): Record<string, unknown> {
	const paths = [
		'next-server.js.nft.json',
		'server/pages/_app.js.nft.json',
		'server/pages/_document.js.nft.json',
		'server/pages/_error.js.nft.json',
		'server/pages/index.js.nft.json',
	];
	return {
		rawEqualManifestCount: 5,
		varyingManifestCount: 0,
		manifests: paths.map((manifestPath) => ({
			path: manifestPath,
			rawEqual: true,
			version: 1,
			memberCount: 1,
			membersUnique: true,
			targetsContained: true,
			realTargetsContained: true,
			bindingsEqual: true,
			firstProjectionSha256: 'a'.repeat(64),
			secondProjectionSha256: 'a'.repeat(64),
			traceMembershipOccurrences: 0,
			bindings: [
				{
					member:
						manifestPath === 'next-server.js.nft.json'
							? '../node_modules/pkg/runtime.js'
							: '../../../node_modules/pkg/runtime.js',
					laneRelativeTarget: 'node_modules/pkg/runtime.js',
					realLaneRelativeTarget: 'node_modules/pkg/runtime.js',
					physicalRoot: 'canonical-lane',
					targetType: 'file',
					targetSha256: 'b'.repeat(64),
				},
			],
		})),
	};
}

function validInventories(): Record<string, unknown> {
	const rows = (buildId: string) => [
		{ path: 'BUILD_ID', byteLength: 21, sha256: sha256(buildId) },
		...Array.from({ length: 39 }, (_, index) => ({
			path: `file-${index}.json`,
			byteLength: index,
			sha256: 'c'.repeat(64),
		})),
		...['_buildManifest.js', '_middlewareManifest.js', '_ssgManifest.js'].map(
			(name, index) => ({
				path: `static/${buildId}/${name}`,
				byteLength: index,
				sha256: 'd'.repeat(64),
			}),
		),
	];
	return {
		baseline: {
			first: rows('Y3iiLpLIAmh2dHxhtc64a'),
			second: rows('h3bCr1BuFpZHOlD0Z6VAF'),
		},
		migrated: {
			first: rows('lXXRWHLz9WP1hDVNYojCO'),
			second: rows('Bfr0QJOBkGNlpByi3PMVG'),
		},
	};
}

function validBuildEvidence(): Record<string, unknown> {
	return {
		baseline: {
			rawEqual: false,
			normalizedEqual: true,
			firstBuildId: 'Y3iiLpLIAmh2dHxhtc64a',
			secondBuildId: 'h3bCr1BuFpZHOlD0Z6VAF',
		},
		migrated: {
			rawEqual: false,
			normalizedEqual: true,
			firstBuildId: 'lXXRWHLz9WP1hDVNYojCO',
			secondBuildId: 'Bfr0QJOBkGNlpByi3PMVG',
		},
	};
}

describe('Killed by Google receipt', () => {
	test('binds the retained diagnostic and aggregate identity', () => {
		expect(NEXT_KILLED_BY_GOOGLE_DIAGNOSTIC_SHA256).toBe(
			'8a476406eecc0c81b3eff88c642ba85792f71285e8bf04222b98c5e0e3c4a41e',
		);
		expect(nextKilledByGoogleAggregateMember('a'.repeat(64))).toMatchObject({
			id: 'next-killedbygoogle-derived-state-to-memo',
			receipt: NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
			result: 'pass',
		});
	});

	test('verifies retained preintegration evidence when present', async () => {
		const present = await access(NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH).then(
			() => true,
			() => false,
		);
		if (present)
			await expect(verifyNextKilledByGoogleEvidence('.', false)).resolves.toMatchObject({});
		else expect(present).toBe(false);
	});

	test('rejects every unsafe persisted NFT path, digest, flag, count, projection, and type', () => {
		const mutations: Array<(value: Record<string, any>) => void> = [
			(value) => (value.manifests[0].path = '/absolute.nft.json'),
			(value) => (value.manifests[0].bindings[0].member = '/absolute.js'),
			(value) => (value.manifests[0].bindings[0].laneRelativeTarget = '../escape.js'),
			(value) => (value.manifests[0].bindings[0].realLaneRelativeTarget = '../escape.js'),
			(value) => (value.manifests[0].bindings[0].targetSha256 = 'B'.repeat(64)),
			(value) => (value.manifests[0].rawEqual = 'true'),
			(value) => (value.rawEqualManifestCount = 4),
			(value) => delete value.manifests[0].firstProjectionSha256,
			(value) => (value.manifests[0].secondProjectionSha256 = 'd'.repeat(64)),
			(value) => (value.manifests[0].bindings[0].targetType = 'directory'),
			(value) => (value.manifests[0].bindings[0].physicalRoot = 'unknown'),
		];
		expect(validateNextKilledByGoogleNftEvidence(validNftEvidence())).toHaveLength(5);
		for (const mutate of mutations) {
			const value = validNftEvidence();
			mutate(value);
			expect(() => validateNextKilledByGoogleNftEvidence(value)).toThrow();
		}
	});

	test('projects only exact build-ID generated paths and rejects every other inventory change', () => {
		expect(
			validateNextKilledByGoogleInventoryEvidence(validInventories(), validBuildEvidence()),
		).toHaveLength(2);
		for (const mutate of [
			(value: Record<string, any>) => (value.baseline.first[1].path = '/absolute.json'),
			(value: Record<string, any>) => (value.baseline.first[1].path = '../escape.json'),
			(value: Record<string, any>) => (value.baseline.first[1].sha256 = 'C'.repeat(64)),
			(value: Record<string, any>) => (value.baseline.first[1].sha256 = 'not-a-digest'),
			(value: Record<string, any>) => (value.baseline.first[1].byteLength = -1),
			(value: Record<string, any>) => value.baseline.first.pop(),
			(value: Record<string, any>) =>
				value.baseline.first.push({
					path: 'extra.json',
					byteLength: 1,
					sha256: 'e'.repeat(64),
				}),
			(value: Record<string, any>) =>
				(value.baseline.first[2].path = value.baseline.first[1].path),
			(value: Record<string, any>) =>
				(value.baseline.first[1].path = 'static/<BUILD_ID>/_buildManifest.js'),
			(value: Record<string, any>) =>
				(value.baseline.first[40].path =
					'static/Y3iiLpLIAmh2dHxhtc64a/_alternateManifest.js'),
			(value: Record<string, any>) =>
				(value.baseline.first[1].path = 'server/Y3iiLpLIAmh2dHxhtc64a/file.js'),
			(value: Record<string, any>) =>
				(value.baseline.first[40].path = 'static/AAAAAAAAAAAAAAAAAAAAA/_buildManifest.js'),
			(value: Record<string, any>) => (value.baseline.second[1].path = 'changed.json'),
			(value: Record<string, any>) => (value.baseline.first[0].byteLength = 20),
			(value: Record<string, any>) => (value.baseline.first[0].sha256 = 'f'.repeat(64)),
		]) {
			const value = validInventories();
			mutate(value);
			expect(() =>
				validateNextKilledByGoogleInventoryEvidence(value, validBuildEvidence()),
			).toThrow();
		}
		for (const mutate of [
			(value: Record<string, any>) => (value.baseline.firstBuildId = 'AAAAAAAAAAAAAAAAAAAAA'),
			(value: Record<string, any>) => (value.baseline.firstBuildId = 'malformed'),
			(value: Record<string, any>) => (value.baseline.rawEqual = true),
			(value: Record<string, any>) => (value.baseline.normalizedEqual = false),
			(value: Record<string, any>) =>
				(value.baseline.secondBuildId = value.baseline.firstBuildId),
		]) {
			const builds = validBuildEvidence();
			mutate(builds);
			expect(() =>
				validateNextKilledByGoogleInventoryEvidence(validInventories(), builds),
			).toThrow();
		}
	});
});
