import { describe, expect, it } from 'vitest';
import {
	finalizeMigration,
	verifyMigration,
	type MigrationReceipt,
} from '../src/fixture/angular-realworld-v15-to-v16-run.ts';
import {
	PARENT_COMMIT,
	TARGET_PACKAGE_SHA256,
	TARGET_COMMIT,
} from '../src/fixture/angular-realworld-v15-to-v16-ingest.ts';

describe('Angular RealWorld v15 to v16 receipt', () => {
	it('seals exact four-pass parity and rejects tampering', () => {
		const launcher = {
			compilerVersion: 'Version 5.1.6' as const,
			typesNodeVersion: '18.15.11' as const,
			nodeVersion: 'v18.20.8' as const,
			sourceSha256: 'a'.repeat(64),
			outputSha256: 'b'.repeat(64),
			output: 'launcher-dist/target/architect-launcher.cjs',
		};
		const install = {
			exitCode: 0 as const,
			offline: true as const,
			ignoreScripts: true as const,
			lockUnchanged: true as const,
			logSha256: 'c'.repeat(64),
			npmVersion: '10.8.2' as const,
		};
		const journey = (lane: 'legacy' | 'target', pass: 1 | 2) => ({
			lane,
			pass,
			result: 'pass' as const,
			tagsRequests: 1 as const,
			articlesRequests: 1 as const,
			externalStylesheets: 3 as const,
			storageInitiallyEmpty: true as const,
			pageErrors: [] as const,
			rejectedRequests: 0 as const,
			successfulNonLoopback: 0 as const,
			observations: ['conduit'],
		});
		const journeys = [
			journey('legacy', 1),
			journey('legacy', 2),
			journey('target', 1),
			journey('target', 2),
		];
		const receipt = finalizeMigration({
			schemaVersion: 'versionless.angular-realworld-v15-to-v16.v1',
			result: 'pass',
			status: 'pass',
			source: {
				parentCommit: PARENT_COMMIT,
				targetCommit: TARGET_COMMIT,
				parentVerified: true,
			},
			migration: {
				changedFiles: ['package-lock.json', 'package.json'],
				applicationFilesChanged: 0,
			},
			legacy: {
				install: {
					...install,
					legacyPeerDeps: false,
					compatibilityReason: 'not-required',
				},
				build: {
					exitCode: 0,
					aot: true,
					mechanism: 'architect-target-override',
					optimization: {
						scripts: true,
						styles: { minify: true, inlineCritical: true },
						fonts: { inline: false },
					},
					distTreeSha256:
						'34bbecf0f342a65b6c813e6d93f07dd93397716915f0673ac9251a175ca77274',
					launcher: { ...launcher, compilerVersion: 'Version 4.8.4' },
				},
				distDigest: '34bbecf0f342a65b6c813e6d93f07dd93397716915f0673ac9251a175ca77274',
			},
			target: {
				install: {
					...install,
					legacyPeerDeps: true,
					compatibilityReason: 'immutable-upstream-rx-angular-15-peer-metadata',
				},
				build: {
					exitCode: 0,
					aot: true,
					mechanism: 'architect-target-override',
					optimization: {
						scripts: true,
						styles: { minify: true, inlineCritical: true },
						fonts: { inline: false },
					},
					distTreeSha256:
						'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185',
					launcher,
				},
				distDigest: 'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185',
			},
			parity: {
				identical: true,
				journeys,
			},
			journeys,
			mutation: {
				seam: 'target-api-origin',
				file: 'src/app/core/interceptors/api.interceptor.ts',
				originalHash: '5afdac9c0ed22ea38ebba4e957455563ba92d9704a3027b952b239793bbbf1f4',
				from: 'https://api.realworld.io/api',
				to: 'https://invalid.versionless.test/api',
				reason: 'unexpected-nonloopback-api-binding',
				rejectedUrls: [
					'https://invalid.versionless.test/api/articles?limit=10&offset=0',
					'https://invalid.versionless.test/api/tags',
				],
				successfulNonLoopback: 0,
				restoration: {
					sourceHash: '5afdac9c0ed22ea38ebba4e957455563ba92d9704a3027b952b239793bbbf1f4',
					packageHash: TARGET_PACKAGE_SHA256,
					distDigest: 'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185',
					status: 'pass',
				},
			},
			nonclaims: ['One immutable experiment only.'],
		});
		expect(verifyMigration(receipt)).toEqual(receipt);
		const tampered = {
			...structuredClone(receipt),
			result: 'failed',
		} as unknown as MigrationReceipt;
		expect(() => verifyMigration(tampered)).toThrow('differs');
	});
});
