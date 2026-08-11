import type { TrustManifest } from './schema.ts';
import type {
	CorpusConformance,
	CorpusTransactionState,
} from '../../core/src/corpus/conformance.ts';
import type { ScriptSurface } from '../../core/src/enterprise/script-surface.ts';
import type { RuntimeScriptObservation } from '../../core/src/enterprise/runtime-script-observation.ts';

interface RenderInputs {
	manifest: TrustManifest;
	freeze: Record<string, unknown>;
	licenses: Record<string, unknown>;
	vulnerabilities: Record<string, unknown>;
	matrix: Record<string, unknown>;
	controls: Record<string, unknown>;
	conformance: CorpusConformance;
	scriptSurface: ScriptSurface;
	runtimeScriptObservation: RuntimeScriptObservation;
	transaction: CorpusTransactionState;
}

/**
 * Reads one lineage readiness score straight out of the emitted conformance.
 *
 * The Markdown must never restate a numerator; it renders whatever the corpus
 * derived, so a prose score cannot drift away from the counted evidence.
 */
/**
 * Renders the holdout ledger the corpus derived.
 *
 * A holdout is an application the frozen adapters were applied to in order to
 * falsify them, and this one failed. The report states the failure, its
 * recorded reason, and the fingerprint it ran against, and states in the same
 * breath that it is counted in no numerator — so a reader cannot mistake the
 * unchanged lineage scores for an absence of contrary evidence.
 */
function holdoutLines(conformance: CorpusConformance): string {
	const readiness = (conformance.coverage as Record<string, unknown>).productionReadiness as
		| Record<string, unknown>
		| undefined;
	const holdouts = readiness?.holdouts;
	if (!Array.isArray(holdouts) || holdouts.length === 0)
		throw new Error('Corpus conformance omits the holdout ledger');
	return holdouts
		.map((value) => {
			const holdout = value as Record<string, unknown>;
			return `- Holdout \`${String(holdout.id)}\` (${String(holdout.application)}, ${String(holdout.lineage)} lineage): **attempted; outcome ${String(holdout.outcome)}**. Baseline lane ${String(holdout.baselineLane)}, migrated lane ${String(holdout.migratedLane)} identically across ${String(holdout.attempts)} attempts against frozen adapter composite \`${String(holdout.frozenAdapterFingerprint)}\` with ${String(holdout.adapterBytesChanged)} adapter bytes changed. Recorded missing capability for the follow-on tranche: **${String(holdout.reason)}**. It is **counted in no lineage numerator** and published rather than dropped: [${String(holdout.receipt)}](../../../${String(holdout.receipt)}) \`${String(holdout.digest)}\`.`;
		})
		.join('\n');
}

function lineageScore(conformance: CorpusConformance, lineage: string): string {
	const readiness = (conformance.coverage as Record<string, unknown>).productionReadiness as
		| Record<string, unknown>
		| undefined;
	const score = readiness?.[lineage] as { ready: number; total: number } | undefined;
	if (!score) throw new Error(`Corpus conformance omits ${lineage} readiness`);
	return `${score.ready}/${score.total}`;
}

export function renderTrustReport(inputs: RenderInputs): string {
	const freshness = inputs.manifest.observation.vulnerabilityFreshness;
	const holdouts = holdoutLines(inputs.conformance);
	const reactLineage = lineageScore(inputs.conformance, 'reactLineage');
	const angularLineage = lineageScore(inputs.conformance, 'angularLineage');
	const freeze = inputs.freeze.freeze as { commit: string; composite: string };
	const freezeCapabilities = inputs.freeze.capabilities as {
		experimental: { entries: Array<{ lineage: string; capability: string }> };
		crossProven: { entries: Array<{ lineage: string; capability: string }> };
	};
	const summary = inputs.licenses.summary as Record<string, Record<string, number>>;
	const expressions = summary.spdxExpression ?? {};
	const texts = summary.licenseText ?? {};
	const maintainedReactVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/react-boilerplate-v4-node24/t022-run.json',
	);
	const vite8ReactVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
	);
	const dataFlowVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
	);
	const phonecatRouteVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
	);
	const phonecatComposedVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/angular-phonecat-composed/t048-run.json',
	);
	const phonecatViteVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/angular-phonecat-vite8/t069-run.json',
	);
	const angularRealworldVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/angular-realworld-v15-to-v16/receipt.json',
	);
	const angularRealworldWitnessVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/witness-angular-realworld/receipt.json',
	);
	const reactBoilerplateWitnessVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/witness-react-boilerplate/receipt.json',
	);
	const reactBoilerplateZeroSwVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/witness-react-boilerplate-zero-sw/receipt.json',
	);
	const reactPapercupsWitnessVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/witness-react-papercups/receipt.json',
	);
	const reactHospitalrunWitnessVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/witness-react-hospitalrun/receipt.json',
	);
	const angularFactoriolabWitnessVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/witness-angular-factoriolab/receipt.json',
	);
	const angularJiraCloneWitnessVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/witness-angular-jira-clone/receipt.json',
	);
	const nextKilledByGoogleWitnessVerified = inputs.manifest.receipts.some(
		(item) => item.path === 'evidence/runs/witness-next-killedbygoogle/receipt.json',
	);
	const nextKilledByGoogleVerified = inputs.transaction.nextKilledByGoogleIntegrated;
	return `# Versionless project trust package

- Canonical SHA-256: \`${inputs.manifest.canonicalDigest}\`
- Deterministic core: \`${inputs.manifest.deterministicCore.digest}\`
- Generated observation: \`${inputs.manifest.observation.generatedAt}\`
- Vulnerability input freshness: **${freshness}** (seven-day maximum age)
- Integrity: **hash-only; authenticity is not established**
- Assurance: **this package is evidence, not certification, legal assurance, PCI compliance, or SOC 2 attestation**

## Contents

- [CycloneDX 1.7 dependency graph](dependency-graph.cdx.json) — locally profile-validated; this is not independent or official certification.
- [License inventory](licenses.json) — SPDX expressions: ${expressions.verified ?? 0} verified, ${expressions.unknown ?? 0} unknown, ${expressions.ambiguous ?? 0} ambiguous; license texts: ${texts.verified ?? 0} verified, ${texts.unknown ?? 0} unknown, ${texts.ambiguous ?? 0} ambiguous.
- [Vulnerability and KEV report](vulnerabilities.json) — cached OSV batch and CISA KEV observations only.
- [SLSA/in-toto-shaped provenance](provenance.json) — shape only; no SLSA level or signer authenticity is claimed.
- [Supported corpus/runtime/bundler matrix](matrix.json) — unsupported and untested cells remain visible.
- [Adapter freeze record](adapter-freeze.json) — the migration engine adapter surface is frozen at commit \`${freeze.commit}\` with composite SHA-256 \`${freeze.composite}\`; the receipts, corpus, and witness registries are deliberately **outside** the freeze so holdout evidence can still be published additively.
- [Corpus conformance](corpus-conformance.json) — \`${inputs.conformance.integrity.canonicalDigest}\`; ${inputs.conformance.summary.verticals} verified verticals grouped into exactly ${inputs.conformance.summary.sourceApplications} source applications; zero designated pilots are verified.
${
	nextKilledByGoogleVerified
		? '- The immutable Killed by Google Next.js 12 Pages/webpack production vertical is verified only for its exact fixture; synthetic Next.js 12 Pages, 13 transition/App, and 14 App classification lanes remain **not-tested**, and generic Next.js support is not claimed.'
		: '- Next.js remains **not-tested**; no Killed by Google fixture evidence is integrated or claimed.'
}
- [Static script/resource surface](script-surface.json) — truthfully remains scoped to the prior nine verticals, two applications, and eighteen exact static deployment entrypoints; T220 is **not included** because its script surface was not separately observed; dynamic script insertion: **not-tested**; payment-page applicability: **not established**; PCI compliance is **not claimed**.
- [Qualified-journey runtime script observation](runtime-script-observation.json) — truthfully remains scoped to 36 runs across the prior nine verticals, two applications, and eighteen lanes; T220 is **not included** because its runtime scripts were not separately observed; this is **not global dynamic-insertion coverage**.
${
	maintainedReactVerified
		? `- React Boilerplate maintained-runtime proof is limited to Node 24.15.0 darwin-arm64 with webpack 4.47.0${vite8ReactVerified ? ' and a separate fixture-specific Vite 8.0.16 build' : ''}; other maintained targets remain unproved.`
		: '- React Boilerplate maintained-runtime target: **not-tested**.'
}
${angularRealworldWitnessVerified ? `- Angular-lineage production readiness: **${angularLineage}**; Harness qualification: **0/4**. PhoneCat remains unsupported for the required visible transition and is not counted. Angular RealWorld's browser proof stays verified and retained but is **not counted** toward the numerator: its migration changed zero application files, so it is a dependency version bump rebuilt under AOT rather than a proven application migration.` : `- Angular-lineage production readiness: **${angularLineage}**; Harness qualification: **0/4**.`}
${reactBoilerplateWitnessVerified ? `- React-lineage production readiness: **${reactLineage}; Judge approved**.` : `- React-lineage production readiness: **${reactLineage}; not-tested**.`}
${reactBoilerplateZeroSwVerified ? `- React Boilerplate current zero-service-worker policy reconciliation: **verified; the aligned React Boilerplate cell is Judge-counted**. The original offline-first evidence remains retained.` : '- React Boilerplate current zero-service-worker policy reconciliation: **not-tested**.'}
${reactPapercupsWitnessVerified ? `- Papercups v1.0.0 create-react-app→Vite 8 direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, and the Judge **counts** it, so React-lineage readiness is **${reactLineage}**.` : '- Papercups create-react-app direct-Witness browser proof: **not-tested**.'}
${reactHospitalrunWitnessVerified ? `- HospitalRun v2.0.0-alpha.7 create-react-app→Vite 8 direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, its baseline/migrated service-worker difference is **recorded, not masked**, and the Judge **counts** it with that difference visible, so React-lineage readiness is **${reactLineage}**.` : '- HospitalRun create-react-app direct-Witness browser proof: **not-tested**.'}
${angularFactoriolabWitnessVerified ? `- factoriolab Angular CLI 10.1→Angular 16.2 browser-builder direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, it really rewrote application source across six majors, and the Judge **counts** it, so Angular-lineage readiness is **${angularLineage}**.` : '- factoriolab Angular CLI direct-Witness browser proof: **not-tested**.'}
${angularJiraCloneWitnessVerified ? `- jira-clone Angular CLI 13.2 custom-webpack→Angular 16.2 browser-builder direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, the second counted Angular application, and the Judge **counts** it, so Angular-lineage readiness is **${angularLineage}**.` : '- jira-clone Angular CLI custom-webpack direct-Witness browser proof: **not-tested**.'}
${nextKilledByGoogleWitnessVerified ? '- Older-Next direct-Witness candidate: **verified, not counted (0/4) pending final Judge audit**.' : '- Older-Next production readiness: **0/4; not-tested**.'}
${holdouts}
- [Data-flow and control mappings](controls.json) — review inputs, not audit conclusions.
- [Retention and purge status](retention.json) — unresolved policy remains unknown/not-tested.

The dependency graph is a rooted complete inventory. Exact transitive dependency topology is not proven.

## Receipt preservation

${inputs.manifest.receipts.map((item) => `- \`${item.path}\`: \`${item.digest}\` (${item.state})`).join('\n')}

## Adapter freeze and capability status

Frozen at commit \`${freeze.commit}\`; composite SHA-256 \`${freeze.composite}\` over the newline-terminated \`<path> <tree-oid>\` lines below, in order.

${(inputs.freeze.freeze as { subtrees: Array<{ path: string; treeOid: string }> }).subtrees.map((subtree) => `- \`${subtree.path}\` \`${subtree.treeOid}\``).join('\n')}

Cross-proven on two independent applications each, and therefore in the matrix:

${freezeCapabilities.crossProven.entries.map((entry) => `- ${entry.lineage}: \`${entry.capability}\``).join('\n')}

Proven on exactly one application and therefore **experimental / out-of-matrix** pending T006 second-application evidence:

${freezeCapabilities.experimental.entries.map((entry) => `- ${entry.lineage}: \`${entry.capability}\``).join('\n')}

Angular holdout ingestion is **deferred post-T006**, and no candidate is admitted without a mandatory license-text-at-pin pre-screen.

## Known gaps

- Root license text: **unknown** (absent; the package manifest expression is not license text).
- SECURITY.md: **unknown** (absent).
- Git provenance and official CI identity: **unknown** (repository metadata is absent).
- Project signing identity and signer authenticity: **unknown**.
- TakeNote designated React pilot: **not-tested**.
- Angular2-HN designated Angular 2+ pilot, Angular CLI, and AOT: **not-tested**.
${maintainedReactVerified ? '- Maintained React target coverage is limited to the verified React Boilerplate lane.' : '- Maintained React target runtime: **not-tested**.'}
- Old-Vite migration and generic/unplugin adapter evidence: **not-tested**.
${nextKilledByGoogleVerified ? '- Generic Next.js support, synthetic Next.js lanes, Tier, pilot status, and production readiness remain **not-tested** or not claimed; the verified Killed by Google evidence is fixture-specific.' : '- Next.js provenance, migration, build, browser, locality, compiler/bundler runtime, Tier, pilot, and support: **not-tested**. Vite does not replace the candidate Next.js production stack.'}
- The Vite adapter is **fixture-specific**; generic adapter: **not-tested**; unplugin portability: **not-tested**.
${dataFlowVerified ? '- React connect-to-hooks data-flow migration proof is limited to the exact HomePage and RepoListItem shapes in the verified fixture.' : '- React connect-to-hooks data-flow migration: **not-tested**.'}
- Angular PhoneCat is AngularJS special-track/static evidence, not Angular 2+, Angular CLI/AOT, adjacent-major, or designated Angular-pilot proof.
${phonecatRouteVerified ? '- PhoneCat route-resolve and one-way component-binding proof is limited to the verified AngularJS static lane.' : '- PhoneCat route-resolve/component-binding modernization: **not-tested**.'}
${phonecatComposedVerified ? '- PhoneCat lexical-this plus route-resolve composition is order-independent for the exact verified AngularJS special-track shapes; it is not Angular 2+ or bundler proof.' : '- PhoneCat transform composition: **not-tested**.'}
${phonecatViteVerified ? '- PhoneCat Vite 8 evidence uses a fixture-specific adapter; old Vite and unplugin portability are **not-tested**. Service worker and PWA behavior are **out of scope**.' : '- PhoneCat Vite 8 bundling: **not-tested**.'}
${angularRealworldVerified ? `- Angular RealWorld proves one immutable Angular 15→16 CLI/Architect production-AOT adjacent-major vertical with process-scoped locality; it is not generic Angular support or a designated pilot.${angularRealworldWitnessVerified ? ' Its standalone direct-Witness production-readiness cell is verified for this exact lineage only.' : ' Production-readiness proof remains not-tested.'}` : '- Angular RealWorld 15→16 adjacent-major evidence: **not-tested**.'}
- Locality evidence is process-scoped and does not establish OS-wide isolation.
`;
}
