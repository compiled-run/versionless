import { ANGULAR_PRE_IVY_SUPPORT_BOUNDARY } from './holdout-angular-pigallery2.ts';

/**
 * The T022 follow-up amendment to the declared pre-Ivy support boundary.
 *
 * The boundary itself was published by `lrapr-t023/u1-boundary-publish-refreeze`
 * as part of the pigallery2 falsification receipt, and that receipt is immutable:
 * its bytes, its digest and every claim inside it stay exactly as they were. So
 * this amendment is a separate, append-only record that the boundary ledger
 * carries *beside* the declaration rather than inside it. Nothing here softens
 * the boundary, moves a numerator, or reclassifies a cell — it adds the two
 * reading rules the follow-up ruling codified, the prevalence the gate-zero
 * screen measured, and the population statement a future GREEN has to be read
 * against.
 *
 * The order matters: the boundary was declared from one tested instance, the
 * screen then observed the same condition in four more applications, and the
 * amendment publishes that as evidence *for* the boundary while narrowing what
 * any application clearing it can be said to prove.
 */
export const ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT_SCHEMA =
	'versionless.angular-pre-ivy-boundary-amendment.v1' as const;
export const ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT_UNIT =
	'lrapr-t023/u3-boundary-amend-candidate3-acquire' as const;
export const ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT_RULING =
	'lrapr-t022 boundary ruling, follow-up ruling (Judge, 2026-08-14) after the gate-zero screen' as const;

/**
 * The registry bytes the successor-across-names rule was read from.
 *
 * Recorded verbatim, including the difference between what the ruling
 * paraphrased and what the registry actually says: the deprecation names the
 * package `@angular/common`, and the guide anchor it links to is the one for
 * `@angular/http`. `@angular/common/http` is the entry point *within* that named
 * package, so the rule's requirement — registry deprecation metadata naming the
 * successor — is met by the bytes, and the paraphrase is narrowed to them here
 * rather than the other way round.
 */
export const ANGULAR_HTTP_DEPRECATION_EVIDENCE = Object.freeze({
	package: '@angular/http',
	deprecationMessage:
		'Package no longer supported. Use @angular/common instead, see https://angular.io/guide/deprecations#angularhttp',
	successorPackageNamed: '@angular/common',
	successorEntryPoint: '@angular/common/http',
	nameDifference:
		'The registry string names the package `@angular/common`; the successor API surface inside it is the `@angular/common/http` entry point. The ruling paraphrased the entry point, the registry names the package, and both point at the same first-party successor.',
	newestPublishedVersion: '7.2.16',
	distTags: Object.freeze({
		latest: '7.2.16',
		next: '8.0.0-beta.10',
		'v4-lts': '4.4.7',
		'v5-lts': '5.2.11',
	}),
	versionsPublished: 252,
	versionsCarryingThisDeprecation: 122,
	distinctDeprecationMessages: 1,
	packumentModified: '2022-06-12T14:41:58.643Z',
	capturedBy: ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT_UNIT,
	consentId: 'VL-LEGACY-CORPUS-2026-08-10',
	sources: Object.freeze([
		Object.freeze({
			url: 'https://registry.npmjs.org/@angular/http/7.2.16',
			accept: 'application/json',
			status: 200,
			bytes: 3086,
			sha256: 'f3eeae03e225e29b6a877313eaedac08ac8eb37d964118ce88697039061faadf',
		}),
		Object.freeze({
			url: 'https://registry.npmjs.org/@angular/http',
			accept: 'application/vnd.npm.install-v1+json',
			status: 200,
			bytes: 253997,
			sha256: 'fd36610eb553adacaa5110f5ebcb269533d3a1cc3e02eda9fbd4e29834d3a76c',
		}),
	]),
});

/**
 * The two reading rules the follow-up ruling codified.
 *
 * Both are stated as *ecosystem* facts. That is the whole point of writing them
 * down: a boundary that is read off what the adapter can be made to do is a
 * capability claim wearing a boundary's clothes, and it would make the screen
 * cherry-picking. What the frozen adapter does with a successor is measured by a
 * run, and a RED there is falsification evidence, not a boundary.
 */
export const ANGULAR_PRE_IVY_BOUNDARY_READING_RULES = Object.freeze([
	Object.freeze({
		id: 'successor-across-names',
		rule: 'A successor reading counts across package names: a dependency has a published Ivy successor when registry deprecation metadata names the successor and that named successor ships published Ivy bytes, even where the successor carries a different package name than the dependency it replaces.',
		kind: 'ecosystem-availability-fact',
		neverAnAdapterCapabilityFact:
			'The rule reads published registry metadata and published bytes only. It says nothing about whether the frozen adapter carries the corresponding migration; that is what a holdout run measures, and a RED there is valid falsification rather than a boundary.',
		evidenceRequired: Object.freeze([
			'registry deprecation metadata on the dependency that names the successor package',
			"the named successor's published Ivy bytes at the target cell",
		]),
		precedent:
			'Successor readings across package names are the boundary mechanism the record already used: the G3 ngx-toastr successor-line table read a successor line rather than a same-name version bump.',
		instance: ANGULAR_HTTP_DEPRECATION_EVIDENCE,
	}),
	Object.freeze({
		id: 'declared-but-never-imported-is-not-active-use',
		rule: 'A dependency that a manifest declares but the application never imports is not in active application use, and therefore cannot fail the boundary. Active use means an import site in the pinned application source on the build path.',
		kind: 'ecosystem-availability-fact',
		neverAnAdapterCapabilityFact:
			'The rule is settled by reading the pinned source for import sites, never by asking what a migration would have to do with the dependency.',
		evidenceRequired: Object.freeze([
			'the pinned compilation graph, rooted at the application entry point',
			'the absence of any import site for the dependency in that graph',
		]),
		instance: Object.freeze({
			package: 'preboot',
			application: 'eShopOnContainers',
			declaredVersion: '6.0.0-beta.5',
			verdict: 'declared but never imported — not active use, so it does not fail the boundary',
			evidence:
				"The WebSPA compilation graph is 60 TypeScript files rooted at Client/main.ts; main.ts, app.module.ts and shared.module.ts carry no preboot import, and the tree has no server-side-rendering entry (main.server.ts / app.server.module.ts are absent), which is the only thing preboot exists for.",
		}),
	}),
]);

/**
 * How often the boundary condition was actually observed, published with the
 * strength of each observation kept visible.
 *
 * Five of six, never six of six. The sixth application, eShopOnContainers,
 * carries a *first-party-successor removal* — a distinct and narrower condition
 * that the successor-across-names rule above resolves — so folding it into the
 * count would inflate the prevalence with a case the boundary does not describe.
 * And the one tested failure is not interchangeable with the four screened ones:
 * pigallery2 was ingested and run to a RED, the other four were read from
 * manifests and registry documents and never installed, built or migrated.
 */
export const ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE = Object.freeze({
	statement:
		'The no-successor pre-Ivy condition was observed in 5 of 6 independently selected webpack-era Angular applications: 1 tested-and-failed and 4 screened-and-failed. The sixth, eShopOnContainers, carries a first-party-successor removal, which is a distinct condition and is not counted in the 5.',
	applicationsExamined: 6,
	applicationsObservedWithTheCondition: 5,
	published: '5-of-6',
	neverPublishedAs: '6-of-6',
	tested: Object.freeze({
		count: 1,
		applications: Object.freeze(['pigallery2']),
		strength: 'tested-and-failed',
		method:
			'ingested at a pin, baseline lane run green in the era toolchain, migrated lane run to a RED with no artifact ever produced',
		evidence: ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.instanceEvidence.receipt,
	}),
	screened: Object.freeze({
		count: 4,
		applications: Object.freeze([
			'cyclos4-ui',
			'ngx-starter-kit',
			'tabby',
			'coreui-free-angular-admin-template',
		]),
		strength: 'screened-and-failed',
		method:
			'boundary-only gate-zero screen from pinned manifests, npm registry documents and published bytes, with the import site found in the pinned source; never installed, built, migrated or trialled',
		evidence:
			'docs/goals/legacy-react-angular-production-readiness/notes/t023-candidate-selection.md',
	}),
	distinctCondition: Object.freeze({
		count: 1,
		application: 'eShopOnContainers',
		condition: 'first-party-successor removal',
		why: 'The failing dependency, @angular/http, was removed from the framework with a first-party successor named in its registry deprecation metadata, whose bytes are Ivy at the target cell. That is not a dead third-party library with no successor to align to, so it is a different — and narrower — condition than the boundary describes.',
		countedInPrevalence: false,
	}),
	distinctionRationale:
		'A tested failure and a screened failure are different strengths of evidence and are never merged into one number: the tested one measured a build, the screened ones read published metadata. Collapsing them, or counting the distinct sixth condition, would overstate what was measured.',
	sourceRecord:
		'docs/goals/legacy-react-angular-production-readiness/notes/t023-candidate-selection.md',
});

/**
 * What any application that clears this gate can, and cannot, be read as
 * evidence for.
 *
 * This is the caveat the screen itself produced and the one that costs the most
 * to say: selecting until a candidate passes does not shrink the boundary, it
 * narrows the population the eventual result speaks for.
 */
export const ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT =
	'Any application clearing this gate is, by construction, drawn from a narrower and younger-dependency population than the webpack-era enterprise fleet this goal targets: its entire third-party Angular surface must still be maintained or have a published successor. A GREEN holdout therefore speaks for the supported cell only, and is not evidence about the fleet shape the 5-of-6 prevalence describes.' as const;

export interface AngularPreIvyBoundaryAmendment {
	schemaVersion: typeof ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT_SCHEMA;
	amends: typeof ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.id;
	appendOnly: true;
	declaredBy: typeof ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT_RULING;
	publishedBy: typeof ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT_UNIT;
	immutabilityNote: string;
	readingRules: typeof ANGULAR_PRE_IVY_BOUNDARY_READING_RULES;
	prevalence: typeof ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE;
	populationStatement: typeof ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT;
}

export const ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT: AngularPreIvyBoundaryAmendment = Object.freeze({
	schemaVersion: ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT_SCHEMA,
	amends: ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.id,
	appendOnly: true,
	declaredBy: ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT_RULING,
	publishedBy: ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT_UNIT,
	immutabilityNote:
		'Appended beside the declaration, never merged into it. The pigallery2 receipt that established the boundary is unchanged, its digest is unchanged, and the boundary condition, mechanism, certification language and non-claims are unchanged. This record only adds reading rules, prevalence and the population statement.',
	readingRules: ANGULAR_PRE_IVY_BOUNDARY_READING_RULES,
	prevalence: ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE,
	populationStatement: ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT,
});

/**
 * Refuses an amendment whose honesty-carrying parts have been stripped or
 * softened.
 *
 * The failure mode this exists for is not a wrong field, it is a quiet deletion:
 * prevalence rounded up to six of six, the tested/screened distinction collapsed,
 * or the population statement dropped so a GREEN reads as a fleet claim. Each of
 * those is checked as a mechanism rather than trusted from construction, because
 * the same check runs against the emitted artifacts in the trust verifier.
 */
export function assertAngularPreIvyBoundaryAmendment(value: unknown): void {
	const amendment = value as AngularPreIvyBoundaryAmendment | undefined;
	if (
		amendment === undefined ||
		amendment.schemaVersion !== ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT_SCHEMA ||
		amendment.amends !== ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.id ||
		amendment.appendOnly !== true
	)
		throw new Error('The pre-Ivy boundary amendment is missing or does not amend the boundary');
	const rules = amendment.readingRules;
	if (!Array.isArray(rules) || rules.length !== ANGULAR_PRE_IVY_BOUNDARY_READING_RULES.length)
		throw new Error('The pre-Ivy boundary reading rules were stripped');
	for (const expected of ANGULAR_PRE_IVY_BOUNDARY_READING_RULES) {
		const rule = rules.find((entry) => entry?.id === expected.id);
		if (
			rule === undefined ||
			rule.rule !== expected.rule ||
			rule.kind !== 'ecosystem-availability-fact' ||
			typeof rule.neverAnAdapterCapabilityFact !== 'string' ||
			rule.neverAnAdapterCapabilityFact.length === 0
		)
			throw new Error(`The pre-Ivy boundary reading rule ${expected.id} was stripped or weakened`);
	}
	const prevalence = amendment.prevalence;
	if (
		prevalence === undefined ||
		prevalence.applicationsExamined !== 6 ||
		prevalence.applicationsObservedWithTheCondition !== 5 ||
		prevalence.published !== '5-of-6' ||
		prevalence.tested?.count !== 1 ||
		prevalence.tested?.strength !== 'tested-and-failed' ||
		prevalence.screened?.count !== 4 ||
		prevalence.screened?.strength !== 'screened-and-failed' ||
		prevalence.tested.applications.length !== 1 ||
		prevalence.screened.applications.length !== 4 ||
		prevalence.distinctCondition?.application !== 'eShopOnContainers' ||
		prevalence.distinctCondition?.countedInPrevalence !== false ||
		typeof prevalence.statement !== 'string' ||
		!prevalence.statement.includes('5 of 6')
	)
		throw new Error('The pre-Ivy boundary prevalence was stripped, collapsed or overstated');
	if (
		prevalence.tested.count + prevalence.screened.count !==
			prevalence.applicationsObservedWithTheCondition ||
		prevalence.applicationsObservedWithTheCondition + prevalence.distinctCondition.count !==
			prevalence.applicationsExamined
	)
		throw new Error('The pre-Ivy boundary prevalence counts do not add up');
	if (
		typeof amendment.populationStatement !== 'string' ||
		amendment.populationStatement !== ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT
	)
		throw new Error('The pre-Ivy boundary population statement is missing or altered');
}
