#!/usr/bin/env node
import { verifyReceipt } from '../../core/src/receipts/verify.ts';
import { analyzeCorpusConformance } from '../../core/src/corpus/conformance.ts';
import { verifyScriptSurface } from '../../core/src/enterprise/script-surface.ts';
import { verifyRuntimeScriptObservation } from './enterprise/runtime-script-observation-run.ts';
import { generateTrustPackage } from '../../trust/src/generate.ts';
import { ingestTrustInputs } from '../../trust/src/ingest.ts';
import { verifyTrustPackage } from '../../trust/src/verify.ts';
import { ingestAngularPhonecat } from './fixture/angular-phonecat-ingest.ts';
import { verifyAngularPhonecat } from './fixture/angular-phonecat-run.ts';
import { verifyAngularPhonecatComposed } from './fixture/angular-phonecat-composed-run.ts';
import { verifyAngularPhonecatVite8 } from './fixture/angular-phonecat-vite8-run.ts';
import { verifyAngularPhonecatRouteResolve } from './fixture/angular-phonecat-route-resolve-run.ts';
import { ingestFixture } from './fixture/ingest.ts';
import { ingestReactBoilerplateNode24 } from './fixture/react-boilerplate-v4-node24-ingest.ts';
import { verifyReactBoilerplateNode24 } from './fixture/react-boilerplate-v4-node24-run.ts';
import { verifyReactBoilerplateVite8 } from './fixture/react-boilerplate-v4-vite8-run.ts';
import { verifyReactBoilerplateDataFlow } from './fixture/react-boilerplate-v4-data-flow-run.ts';
import { verifyReactBoilerplateComposed } from './fixture/react-boilerplate-v4-composed-run.ts';
import { ingestReactRealworld } from './fixture/react-realworld-cra1-vite8-ingest.ts';
import { verifyReactFixture } from './fixture/run.ts';
import { runFrameworkClassification } from './framework-classify.ts';
import { runNextjsProvenanceClassification } from './nextjs-provenance-classify.ts';
import { runNext13ProvenanceClassification } from './next13-provenance-classify.ts';
import { main as runAngularFuxaDependencyIngest } from './fixture/angular-fuxa-dependency-ingest.ts';
import { main as runAngularFuxaStandalone } from './fixture/angular-fuxa-standalone-run.ts';
import { main as runAngularFuxaStandaloneCohort } from './fixture/angular-fuxa-standalone-cohort-run.ts';
import { main as runAngularFuxaTemplateCompiler } from './fixture/angular-fuxa-template-compiler-run.ts';
import { main as runVite8SharedAdapterCohort } from './fixture/vite8-shared-adapter-cohort-run.ts';
import { runDirectDomInventory } from './analysis/direct-dom-inventory.ts';
import { runWitnessRealApps, verifyWitnessRealApps } from './witness/real-app-run.ts';
import {
	runWitnessAngularRealworld,
	verifyWitnessAngularRealworld,
} from './witness/angular-realworld-run.ts';
import { verifyLinkedWitnessProvenance } from './witness/provenance.ts';

const [command, ...rawArgs] = process.argv.slice(2);
const args = rawArgs.filter((arg) => arg !== '--');
const valueAfter = (flag: string): string | undefined => {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
};
try {
	if (command === 'fixture:ingest') {
		const fixture = valueAfter('--fixture');
		const ingest =
			fixture === 'angular-phonecat'
				? ingestAngularPhonecat
				: fixture === 'react-realworld-cra1-vite8'
					? ingestReactRealworld
					: fixture === 'react-boilerplate-v4-node24'
						? ingestReactBoilerplateNode24
						: ingestFixture;
		if (
			![
				'react-boilerplate-v4',
				'react-boilerplate-v4-node24',
				'react-realworld-cra1-vite8',
				'angular-phonecat',
			].includes(fixture ?? '')
		)
			throw new Error('Unsupported fixture');
		const result = await ingest({
			allowNetwork: args.includes('--allow-network'),
			consentId: valueAfter('--consent-id'),
		});
		console.log(
			JSON.stringify({
				result: 'ingested',
				fixture: result.manifest.id,
				consentId: result.consent.consentId,
			}),
		);
	} else if (command === 'fixture:verify') {
		const fixture = valueAfter('--fixture');
		if (
			![
				'react-boilerplate-v4',
				'react-boilerplate-v4-node24',
				'react-boilerplate-v4-vite8',
				'react-boilerplate-v4-data-flow',
				'react-boilerplate-v4-composed',
				'angular-phonecat',
				'angular-phonecat-composed',
				'angular-phonecat-vite8',
				'angular-phonecat-route-resolve',
			].includes(fixture ?? '') ||
			!args.includes('--offline')
		)
			throw new Error('Fixture verification requires a supported fixture and --offline');
		const receiptPath = valueAfter('--receipt');
		if (!receiptPath) throw new Error('--receipt is required');
		const receipt =
			fixture === 'angular-phonecat'
				? await verifyAngularPhonecat({ receiptPath })
				: fixture === 'angular-phonecat-composed'
					? await verifyAngularPhonecatComposed({ receiptPath })
					: fixture === 'angular-phonecat-vite8'
						? await verifyAngularPhonecatVite8({ receiptPath })
						: fixture === 'angular-phonecat-route-resolve'
							? await verifyAngularPhonecatRouteResolve({ receiptPath })
							: fixture === 'react-boilerplate-v4-node24'
								? await verifyReactBoilerplateNode24({ receiptPath })
								: fixture === 'react-boilerplate-v4-vite8'
									? await verifyReactBoilerplateVite8({ receiptPath })
									: fixture === 'react-boilerplate-v4-data-flow'
										? await verifyReactBoilerplateDataFlow({ receiptPath })
										: fixture === 'react-boilerplate-v4-composed'
											? await verifyReactBoilerplateComposed({ receiptPath })
											: await verifyReactFixture({ receiptPath });
		console.log(JSON.stringify({ result: 'pass', digest: receipt.integrity.canonicalDigest }));
	} else if (command === 'framework:classify') {
		const descriptorPath = valueAfter('--descriptor');
		if (!descriptorPath) throw new Error('framework:classify requires --descriptor');
		console.log(
			JSON.stringify(
				await runFrameworkClassification({
					descriptorPath,
					offline: args.includes('--offline'),
				}),
			),
		);
	} else if (command === 'nextjs:provenance-classify') {
		const fixture = valueAfter('--fixture');
		const outputPath = valueAfter('--output');
		if (!fixture || !outputPath || !args.includes('--offline'))
			throw new Error(
				'nextjs:provenance-classify requires --offline, --fixture, and --output',
			);
		const receipt = await runNextjsProvenanceClassification({
			fixtureId: fixture,
			outputPath,
			offline: true,
		});
		console.log(
			JSON.stringify({
				result: 'pass',
				fixture: receipt.closure.fixtureId,
				digest: receipt.integrity.canonicalDigest,
				networkAttempts: receipt.locality.networkAttempts,
				candidateExecution: receipt.locality.candidateExecution,
			}),
		);
	} else if (command === 'next13:provenance-classify') {
		const fixture = valueAfter('--fixture');
		const outputPath = valueAfter('--output');
		if (!fixture || !outputPath || !args.includes('--offline'))
			throw new Error(
				'next13:provenance-classify requires --offline, --fixture, and --output',
			);
		const receipt = await runNext13ProvenanceClassification({
			fixtureId: fixture,
			outputPath,
			offline: true,
		});
		console.log(
			JSON.stringify({
				result: 'pass',
				fixture: receipt.closure.fixtureId,
				digest: receipt.integrity.canonicalDigest,
				networkAttempts: receipt.locality.networkAttempts,
				candidateExecution: receipt.locality.candidateExecution,
			}),
		);
	} else if (command === 'dependency:ingest' || command === 'dependency:verify') {
		const fixture = valueAfter('--fixture');
		if (fixture !== 'angular-fuxa')
			throw new Error('Dependency closure requires --fixture angular-fuxa');
		const dependencyArgs = [...args];
		if (command === 'dependency:verify' && !dependencyArgs.includes('--verify-only'))
			dependencyArgs.push('--verify-only');
		await runAngularFuxaDependencyIngest(dependencyArgs);
	} else if (command === 'angular-fuxa:standalone') {
		await runAngularFuxaStandalone(args);
	} else if (command === 'angular-fuxa:standalone-cohort') {
		await runAngularFuxaStandaloneCohort(args);
	} else if (command === 'angular-fuxa:template-compiler') {
		await runAngularFuxaTemplateCompiler(args);
	} else if (command === 'vite8:shared-adapter-cohort') {
		await runVite8SharedAdapterCohort(args);
	} else if (command === 'receipt:verify') {
		const flags = args.filter((arg) => arg.startsWith('--'));
		const paths = args.filter((arg) => !arg.startsWith('--'));
		if (flags.some((flag) => flag !== '--pre-integration' && flag !== '--offline'))
			throw new Error('receipt:verify received an unknown flag');
		if (flags.filter((flag) => flag === '--pre-integration').length > 1)
			throw new Error('receipt:verify received duplicate --pre-integration flags');
		if (paths.length > 1)
			throw new Error(
				'receipt:verify requires exactly one receipt path when a path is supplied',
			);
		const preIntegration = flags.includes('--pre-integration');
		if (preIntegration && paths.length !== 1)
			throw new Error('receipt:verify --pre-integration requires exactly one receipt path');
		const file = paths[0] ?? 'evidence/runs/react-boilerplate-v4-composed/t060-run.json';
		if (
			preIntegration &&
			(process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
				process.env.NPM_CONFIG_OFFLINE !== 'true')
		)
			throw new Error('receipt:verify --pre-integration requires dual offline controls');
		console.log(
			JSON.stringify(await verifyReceipt(file, { requireAggregate: !preIntegration })),
		);
	} else if (command === 'corpus:verify') {
		if (process.env.VERSIONLESS_NETWORK_MODE !== 'offline' && !args.includes('--offline'))
			throw new Error('corpus:verify requires VERSIONLESS_NETWORK_MODE=offline');
		const result = await analyzeCorpusConformance();
		console.log(
			JSON.stringify({
				result: 'pass',
				digest: result.integrity.canonicalDigest,
				verticals: result.summary.verticals,
				sourceApplications: result.summary.sourceApplications,
			}),
		);
	} else if (command === 'script-surface:verify') {
		const result = await verifyScriptSurface();
		console.log(
			JSON.stringify({
				result: 'pass',
				verticals: result.summary.verticals,
				sourceApplications: result.summary.sourceApplications,
				lanes: result.summary.lanes,
				externalScriptsIntroduced: result.summary.externalScriptsIntroduced,
			}),
		);
	} else if (command === 'runtime-script-observation:verify') {
		const configPath = valueAfter('--config');
		const outputDir = valueAfter('--output');
		if (!configPath || !outputDir || !args.includes('--offline'))
			throw new Error(
				'runtime-script-observation:verify requires --offline, --config, and --output',
			);
		const result = await verifyRuntimeScriptObservation({
			configPath,
			outputDir,
			offline: true,
		});
		console.log(JSON.stringify({ result: 'pass', ...result.summary }));
	} else if (command === 'direct-dom:inventory') {
		const root = valueAfter('--root');
		const id = valueAfter('--id');
		const output = valueAfter('--output');
		if (!root || !id || !output || !args.includes('--offline'))
			throw new Error('direct-dom:inventory requires --offline, --root, --id, and --output');
		const inventory = runDirectDomInventory({ root, id, output, offline: true });
		console.log(
			JSON.stringify({
				result: 'pass',
				id: inventory.id,
				files: inventory.semanticEngine.files,
				sites: inventory.counts.total,
				digest: inventory.integrity.canonicalDigest,
				networkAttempts: inventory.locality.networkAttempts,
			}),
		);
	} else if (command === 'witness:real-app') {
		if (args.includes('--verify-provenance-only')) {
			console.log(JSON.stringify(await verifyLinkedWitnessProvenance()));
		} else {
			const publish = valueAfter('--publish');
			const verify = valueAfter('--verify');
			if (publish && args.includes('--run-twice')) {
				const receipt = await runWitnessRealApps(publish);
				console.log(
					JSON.stringify({
						result: receipt.result,
						digest: receipt.integrity.canonicalDigest,
					}),
				);
			} else if (verify) {
				const receipt = await verifyWitnessRealApps(verify);
				console.log(
					JSON.stringify({
						result: receipt.result,
						digest: receipt.integrity.canonicalDigest,
					}),
				);
			} else {
				throw new Error(
					'witness:real-app requires --verify-provenance-only, --run-twice --publish, or --verify',
				);
			}
		}
	} else if (command === 'witness:angular-realworld') {
		const publish = valueAfter('--publish');
		const verify = valueAfter('--verify');
		if (publish && args.includes('--run-twice')) {
			const receipt = await runWitnessAngularRealworld(publish);
			console.log(
				JSON.stringify({
					result: receipt.result,
					digest: receipt.integrity.canonicalDigest,
				}),
			);
		} else if (verify) {
			const receipt = await verifyWitnessAngularRealworld(verify);
			console.log(
				JSON.stringify({
					result: receipt.result,
					digest: receipt.integrity.canonicalDigest,
				}),
			);
		} else {
			throw new Error('witness:angular-realworld requires --run-twice --publish or --verify');
		}
	} else if (command === 'trust:ingest') {
		const result = await ingestTrustInputs({
			allowNetwork: args.includes('--allow-network'),
			consentId: valueAfter('--consent-id'),
		});
		console.log(
			JSON.stringify({
				result: 'ingested',
				purpose: result.purpose,
				consentId: result.consent.consentId,
				packages: result.packages.length,
			}),
		);
	} else if (command === 'trust:generate') {
		const policyPath = valueAfter('--policy');
		const outputDir = valueAfter('--output');
		if (!policyPath || !outputDir)
			throw new Error('trust:generate requires --policy and --output');
		console.log(
			JSON.stringify(
				await generateTrustPackage({
					offline: args.includes('--offline'),
					policyPath,
					outputDir,
				}),
			),
		);
	} else if (command === 'trust:verify') {
		const outputDir = args.find((arg) => !arg.startsWith('--'));
		console.log(
			JSON.stringify(
				await verifyTrustPackage({
					outputDir: outputDir ?? 'evidence/trust/current',
					compareDir: valueAfter('--compare'),
					environment: args.includes('--offline')
						? { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline' }
						: process.env,
				}),
			),
		);
	} else throw new Error(`Unknown command: ${command}`);
} catch (error) {
	console.error(error instanceof Error ? error.stack : String(error));
	process.exitCode = 1;
}
