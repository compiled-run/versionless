import { describe, expect, test } from 'vitest';
import {
	finalizeAngularRealworldProductionParity,
	parseAngularRealworldProductionParity,
	type AngularRealworldParityRun,
} from '../src/receipts/angular-realworld-production-parity.ts';

function run(
	lane: 'angular15' | 'angular16',
	pass: 1 | 2,
	user: 'author' | 'reader',
): AngularRealworldParityRun {
	return {
		lane,
		pass,
		user,
		result: 'pass',
		directWitnessModule: 'link:../witness',
		actions: {
			registration: true,
			login: true,
			sessionReload: true,
			articleCreate: true,
			articleRead: true,
			articleUpdate: true,
			articleDelete: true,
			tagsFilter: true,
			profile: true,
			favorite: true,
			follow: true,
			commentCreate: true,
			commentDelete: true,
		},
		behaviorDigest: 'a'.repeat(64),
		requestMethods: ['DELETE', 'GET', 'POST', 'PUT'],
		pageErrors: [],
		consoleErrors: [],
		failedRequests: [],
		nonloopback: 0,
		serviceWorkers: { outputFiles: 0, registrations: 0, controllers: 0, requests: 0 },
	};
}

describe('Angular RealWorld stateful production parity receipt', () => {
	test('accepts only the exact uncounted eight-run offline stateful proof', () => {
		const runs = (['angular15', 'angular16'] as const).flatMap((lane) =>
			([1, 2] as const).flatMap((pass) =>
				(['author', 'reader'] as const).map((user) => run(lane, pass, user)),
			),
		);
		const receipt = finalizeAngularRealworldProductionParity({
			schemaVersion: 'versionless.angular-realworld-production-parity.v1',
			result: 'pass',
			counted: false,
			source: {
				parentCommit: 'e28c8969aab9a27ece9873118b1ab7251f9ccb0c',
				childCommit: '0d28f5c63b9cd678a3f1f724f68d6e41363bdd5a',
				v15ClosureDigest:
					'4662a5453117b8acf46997880dd9a331ce86e9d8bf9a82dbde1f51694ab92f65',
				v16ClosureDigest:
					'0361276affa5c44353401a306226ed19c73628a8aa51260fe6926194119d612c',
			},
			builds: {
				runtime: 'Node 18.20.8',
				productionAot: true,
				angular15Untouched:
					'34bbecf0f342a65b6c813e6d93f07dd93397716915f0673ac9251a175ca77274',
				angular16Untouched:
					'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185',
				overlayFrom: 'https://api.realworld.io/api',
				overlayTo: '/api',
				overlayOccurrences: { angular15: 1, angular16: 1 },
				angular15Overlay: 'b'.repeat(64),
				angular16Overlay: 'c'.repeat(64),
			},
			runs,
			mutation: {
				lane: 'angular16',
				file: 'src/app/core/services/comments.service.ts',
				from: '/comments',
				to: '/commentz',
				intendedFailure: 'visible-created-comment-assertion',
				unrelatedAssertionsPassed: true,
				sourceRestoredByteIdentically: true,
				buildRestoredByteIdentically: true,
				restoredBuildDigest: 'c'.repeat(64),
			},
			locality: {
				mode: 'offline',
				successfulNonloopback: 0,
				serviceWorkerOutputFiles: 0,
				serviceWorkerRegistrations: 0,
				serviceWorkerControllers: 0,
				serviceWorkerRequests: 0,
			},
			nonclaims: ['uncounted'],
		});
		expect(parseAngularRealworldProductionParity(receipt)).toEqual(receipt);
		const tampered = structuredClone(receipt);
		(tampered.runs[0]!.actions as unknown as Record<string, boolean>).commentDelete = false;
		expect(() => parseAngularRealworldProductionParity(tampered)).toThrow('differs');
	});
});
