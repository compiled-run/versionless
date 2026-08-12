import * as path from 'pathe';

export interface SensitiveFinding {
	path: string;
	kind:
		| 'forbidden-key'
		| 'secret-like-value'
		| 'pan-like-value'
		| 'pii-like-value'
		| 'support-claim-like-value';
}

const forbiddenKeyParts = new Set([
	'pan',
	'cvv',
	'cvc',
	'card',
	'cardholder',
	'cardnumber',
	'customer',
	'email',
	'firstname',
	'fullname',
	'lastname',
	'phone',
	'address',
	'payment',
	'account',
	'accountnumber',
	'auth',
	'authentication',
	'cookie',
	'egress',
	'secret',
	'token',
	'username',
]);
const tokenCharacter = charIn('0123456789._-').from('a', 'z');
const secretValue = createRegExp(
	anyOf(
		exactly('bearer').and(oneOrMore(whitespace), oneOrMore(tokenCharacter)),
		exactly('sk_').and(
			anyOf('live', 'test'),
			'_',
			oneOrMore(charIn('0123456789').from('a', 'z')),
		),
		exactly('-----BEGIN ').and(oneOrMore(charIn(' ').from('A', 'Z')), 'PRIVATE KEY-----'),
	),
	[caseInsensitive],
);
const panLike = createRegExp(digit.and(maybe(charIn(' -'))).times.between(13, 19));
const sha256Hex = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
	[caseInsensitive],
);

const safeEvidenceVocabulary = [
	'not-tested',
	'not tested',
	'not-established',
	'not established',
	'not-applicable',
	'not applicable',
	'nonclaim',
	'non-claim',
	'no support is established',
	'no support established',
];
const sensitiveDomains = ['payment', 'customer', 'authentication'];
const strengtheningVocabulary = [
	'certified',
	'compliant',
	'enabled',
	'established',
	'passed',
	'production-ready',
	'supported',
	'verified',
];

function hasSafeEvidenceVocabulary(value: string): boolean {
	const lower = value.toLowerCase();
	return (
		safeEvidenceVocabulary.some((marker) => lower.includes(marker)) ||
		(lower.startsWith('no ') && lower.includes('support is established'))
	);
}

function isSafeDomainKeyValue(key: string, value: unknown): boolean {
	const normalized = key.replaceAll('-', '').replaceAll('_', '').toLowerCase();
	if (!sensitiveDomains.some((domain) => normalized.startsWith(domain))) return false;
	if (typeof value === 'string') return hasSafeEvidenceVocabulary(value);
	if (Array.isArray(value))
		return (
			value.length > 0 &&
			value.every((item) => typeof item === 'string' && hasSafeEvidenceVocabulary(item))
		);
	return false;
}

function isEmailLike(value: string): boolean {
	const isLocalCharacter = (character: string): boolean => {
		const code = character.charCodeAt(0);
		return (
			(code >= 48 && code <= 57) ||
			(code >= 65 && code <= 90) ||
			(code >= 97 && code <= 122) ||
			'._%+-'.includes(character)
		);
	};
	const isDomainCharacter = (character: string): boolean => {
		const code = character.charCodeAt(0);
		return (
			(code >= 48 && code <= 57) ||
			(code >= 65 && code <= 90) ||
			(code >= 97 && code <= 122) ||
			'.-'.includes(character)
		);
	};
	for (let at = value.indexOf('@'); at !== -1; at = value.indexOf('@', at + 1)) {
		let localStart = at;
		while (localStart > 0 && isLocalCharacter(value[localStart - 1]!)) localStart -= 1;
		let domainEnd = at + 1;
		while (domainEnd < value.length && isDomainCharacter(value[domainEnd]!)) domainEnd += 1;
		const local = value.slice(localStart, at);
		const domain = value.slice(at + 1, domainEnd);
		const labels = domain.split('.');
		const topLevel = labels.at(-1) ?? '';
		if (
			local &&
			!local.startsWith('.') &&
			!local.endsWith('.') &&
			labels.length > 1 &&
			labels.every((label) => label && !label.startsWith('-') && !label.endsWith('-')) &&
			topLevel.length >= 2 &&
			[...topLevel].every((character) => {
				const code = character.charCodeAt(0);
				return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
			})
		)
			return true;
	}
	return false;
}

function hasSecretMarker(value: string): boolean {
	const lower = value.toLowerCase();
	return [
		'api-key:',
		'api-key=',
		'api_key:',
		'api_key=',
		'authorization:',
		'cookie:',
		'password=',
		'sessionid=',
		'x-api-key:',
	].some((marker) => lower.includes(marker));
}

function isStrengthenedSensitiveDomainClaim(value: string): boolean {
	const lower = value.toLowerCase();
	return (
		sensitiveDomains.some((domain) => lower.includes(domain)) &&
		strengtheningVocabulary.some((marker) => lower.includes(marker)) &&
		!hasSafeEvidenceVocabulary(lower)
	);
}

function hasForbiddenKeyPart(key: string): boolean {
	const separated: string[] = [];
	for (const character of key.replaceAll('-', '_')) {
		if (character !== character.toLowerCase() && separated.at(-1) !== '_') separated.push('_');
		separated.push(character.toLowerCase());
	}
	return separated
		.join('')
		.split('_')
		.some((part) => forbiddenKeyParts.has(part));
}

function isReceiptCryptographicDigest(value: string, path: string): boolean {
	const digestPath =
		['sha256', 'digest'].some((suffix) => path.toLowerCase().endsWith(suffix)) ||
		path === '$.verification.deterministicCore.first' ||
		path === '$.verification.deterministicCore.second';
	return digestPath && sha256Hex.test(value);
}

type EvidenceContext =
	| 'ordinary'
	| 'cyclonedx-components'
	| 'cyclonedx-component'
	| 'cyclonedx-hashes'
	| 'cyclonedx-hash'
	| 'runtime-verticals'
	| 'runtime-vertical'
	| 'runtime-lanes'
	| 'runtime-lane'
	| 'runtime-runs'
	| 'runtime-run'
	| 'runtime-journey-projection'
	| 't124-official-tree'
	| 't124-official-tree-row'
	| 't138-official-tree'
	| 't138-official-tree-row'
	| 'corpus-conformance-applications'
	| 'corpus-conformance-application'
	| 'corpus-conformance-application-source'
	| 'adapter-freeze-record'
	| 'adapter-freeze-supersedes';

const runtimeObservationSchema = 'versionless.runtime-script-observation.v1';
const runtimeObservationRootKeys = new Set([
	'schemaVersion',
	'summary',
	'boundaries',
	'inputs',
	'verticals',
	'detectorMutation',
]);
const t124ProvenanceRootKeys = new Set([
	'schemaVersion',
	'fixture',
	'repository',
	'repositoryIdentity',
	'commit',
	'tree',
	'archive',
	'fileCount',
	'officialTreeRowCount',
	'officialTree',
	'fileManifestSha256',
	'acceptedGlobalMetadata',
	'acceptedPathMetadata',
	'files',
	'rootLicense',
	'licensing',
	'assets',
	'corroboratedLeadFacts',
	'evidenceBlockers',
	'nestedCompatibleLicense',
	'excludedCommittedDist',
]);
const t124OfficialTreeRowKeys = new Set(['path', 'mode', 'type', 'sha']);
const t138ImmutableFixtureRootKeys = new Set([
	'schemaVersion',
	'id',
	'framework',
	'repository',
	'repositoryUrl',
	'commit',
	'tree',
	'archive',
	'archiveManifestSha256',
	'repositoryIdentity',
	'reliedPaths',
	'corroboratedLeadFacts',
	'evidenceBlockers',
	'usableClosure',
	'localityBoundaries',
	'nonclaims',
]);
const corpusConformanceSchema = 'versionless.corpus-conformance.v1';
const corpusConformanceRootKeys = new Set([
	'schemaVersion',
	'summary',
	'verticals',
	'applications',
	'frameworkLanes',
	'coverage',
	'integrity',
]);
/**
 * The revision-context keys derived corpus provenance actually publishes on a
 * source application. Nothing outside this closed list admits an object id.
 */
const corpusProvenanceRevisionKeys = new Set(['revision', 'parentRevision', 'targetRevision']);
const t124Repository = 'codyogden/killedbygoogle';
const t124Commit = '56809c31592e6ca1edce8af9bfe842fbcdf71f4d';
const t124Tree = 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763';
const t138Repository = 'timlrx/tailwind-nextjs-starter-blog';
const t138Commit = '09ba0550caea03a8c38bc4878d05838d2a57f999';
const t138Tree = '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf';
const t138ReliedPaths = [
	'.yarnrc.yml',
	'LICENSE',
	'app/api/newsletter2/route.ts',
	'app/blog/[...slug]/page.tsx',
	'app/layout.tsx',
	'next.config.js',
	'package.json',
	'yarn.lock',
];

function isLowercaseHex(value: unknown, length: number, requireLetter = false): value is string {
	if (typeof value !== 'string' || value.length !== length) return false;
	let hasLetter = false;
	for (const character of value) {
		if (character >= '0' && character <= '9') continue;
		if (character >= 'a' && character <= 'f') {
			hasLetter = true;
			continue;
		}
		return false;
	}
	return !requireLetter || hasLetter;
}

function isPortableOfficialTreePath(value: unknown): value is string {
	if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.includes('\\'))
		return false;
	const segments = value.split('/');
	return segments.every((segment) => segment && segment !== '.' && segment !== '..');
}

function isT124OfficialTreeRow(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const row = value as Record<string, unknown>;
	const keys = Object.keys(row);
	if (
		keys.length !== t124OfficialTreeRowKeys.size ||
		keys.some((key) => !t124OfficialTreeRowKeys.has(key)) ||
		!isPortableOfficialTreePath(row.path) ||
		!isLowercaseHex(row.sha, 40)
	)
		return false;
	return (
		(row.type === 'tree' && row.mode === '040000') ||
		(row.type === 'blob' && (row.mode === '100644' || row.mode === '100755'))
	);
}

function isT124ProvenanceDocument(value: Record<string, unknown>): boolean {
	const keys = Object.keys(value);
	const identity = value.repositoryIdentity;
	const identityKeys =
		identity !== null && typeof identity === 'object' && !Array.isArray(identity)
			? Object.keys(identity)
			: [];
	return (
		keys.length === t124ProvenanceRootKeys.size &&
		keys.every((key) => t124ProvenanceRootKeys.has(key)) &&
		value.schemaVersion === 'versionless.cross-source-provenance.v1' &&
		value.fixture === 'next-killedbygoogle' &&
		value.repository === t124Repository &&
		identity !== null &&
		typeof identity === 'object' &&
		!Array.isArray(identity) &&
		identityKeys.length === 2 &&
		identityKeys.every((key) => key === 'fullName' || key === 'fork') &&
		(identity as Record<string, unknown>).fullName === t124Repository &&
		(identity as Record<string, unknown>).fork === false &&
		value.commit === t124Commit &&
		value.tree === t124Tree &&
		value.officialTreeRowCount === 86 &&
		Array.isArray(value.officialTree) &&
		value.officialTree.length === 86 &&
		value.officialTree.every(isT124OfficialTreeRow)
	);
}

function isT138ProvenanceDocument(value: Record<string, unknown>): boolean {
	const keys = Object.keys(value);
	const identity = value.repositoryIdentity;
	const identityKeys =
		identity !== null && typeof identity === 'object' && !Array.isArray(identity)
			? Object.keys(identity)
			: [];
	const officialTree = value.officialTree;
	return (
		keys.length === t124ProvenanceRootKeys.size &&
		keys.every((key) => t124ProvenanceRootKeys.has(key)) &&
		value.schemaVersion === 'versionless.cross-source-provenance.v1' &&
		value.fixture === 'next-tailwind-starter-blog' &&
		value.repository === t138Repository &&
		identity !== null &&
		typeof identity === 'object' &&
		!Array.isArray(identity) &&
		identityKeys.length === 2 &&
		identityKeys.every((key) => key === 'fullName' || key === 'fork') &&
		(identity as Record<string, unknown>).fullName === t138Repository &&
		(identity as Record<string, unknown>).fork === false &&
		value.commit === t138Commit &&
		value.tree === t138Tree &&
		value.officialTreeRowCount === 138 &&
		Array.isArray(officialTree) &&
		officialTree.length === 138 &&
		officialTree.every(isT124OfficialTreeRow) &&
		new Set(officialTree.map((row) => (row as Record<string, unknown>).path)).size === 138
	);
}

function isT138ImmutableFixtureDocument(value: Record<string, unknown>): boolean {
	const keys = Object.keys(value);
	const identity = value.repositoryIdentity;
	const identityKeys =
		identity !== null && typeof identity === 'object' && !Array.isArray(identity)
			? Object.keys(identity)
			: [];
	return (
		keys.length === t138ImmutableFixtureRootKeys.size &&
		keys.every((key) => t138ImmutableFixtureRootKeys.has(key)) &&
		value.schemaVersion === 'versionless.immutable-fixture.v1' &&
		value.id === 'next-tailwind-starter-blog' &&
		value.framework === 'nextjs' &&
		value.repository === t138Repository &&
		value.repositoryUrl === 'https://github.com/timlrx/tailwind-nextjs-starter-blog' &&
		identity !== null &&
		typeof identity === 'object' &&
		!Array.isArray(identity) &&
		identityKeys.length === 2 &&
		identityKeys.every((key) => key === 'fullName' || key === 'fork') &&
		(identity as Record<string, unknown>).fullName === t138Repository &&
		(identity as Record<string, unknown>).fork === false &&
		value.commit === t138Commit &&
		value.tree === t138Tree &&
		JSON.stringify(value.reliedPaths) === JSON.stringify(t138ReliedPaths) &&
		value.archive !== null &&
		typeof value.archive === 'object' &&
		!Array.isArray(value.archive) &&
		typeof value.archiveManifestSha256 === 'string' &&
		value.corroboratedLeadFacts !== null &&
		typeof value.corroboratedLeadFacts === 'object' &&
		!Array.isArray(value.corroboratedLeadFacts) &&
		Array.isArray(value.evidenceBlockers) &&
		value.usableClosure !== null &&
		typeof value.usableClosure === 'object' &&
		!Array.isArray(value.usableClosure) &&
		Array.isArray(value.localityBoundaries) &&
		Array.isArray(value.nonclaims)
	);
}

function targetsT138ProvenanceContext(value: Record<string, unknown>): boolean {
	const markers = [
		value.schemaVersion === 'versionless.cross-source-provenance.v1',
		value.fixture === 'next-tailwind-starter-blog',
		value.repository === t138Repository,
		value.commit === t138Commit,
		value.tree === t138Tree,
		value.officialTreeRowCount === 138,
	].filter(Boolean).length;
	return markers >= 2;
}

function isCycloneDx17Document(value: Record<string, unknown>): boolean {
	return (
		value.bomFormat === 'CycloneDX' &&
		value.specVersion === '1.7' &&
		value.version === 1 &&
		Array.isArray(value.components)
	);
}

function isRuntimeObservationDocument(value: Record<string, unknown>): boolean {
	const keys = Object.keys(value);
	return (
		value.schemaVersion === runtimeObservationSchema &&
		Array.isArray(value.verticals) &&
		keys.length === runtimeObservationRootKeys.size &&
		keys.every((key) => runtimeObservationRootKeys.has(key))
	);
}

function isCorpusConformanceDocument(value: Record<string, unknown>): boolean {
	const keys = Object.keys(value);
	return (
		value.schemaVersion === corpusConformanceSchema &&
		Array.isArray(value.applications) &&
		Array.isArray(value.verticals) &&
		keys.length === corpusConformanceRootKeys.size &&
		keys.every((key) => corpusConformanceRootKeys.has(key))
	);
}

/**
 * Recognises the derived adapter-freeze record document.
 *
 * The freeze record is authored evidence about a Git state, so it publishes the
 * exact commit at which the adapter surface was frozen — and that commit's forty
 * hex characters can open with a long digit run (cce3417's freeze SHA carries a
 * fourteen-digit run) that is indistinguishable from a primary account number to
 * the digit-run detector. The document is recognised by its distinctive freeze
 * substructure — the `versionless.trust.v1` schema plus a `freeze` object
 * carrying a commit, a composite, `algorithm: 'sha256'`, `state: 'frozen'`, and a
 * subtree list — which no other trust artifact shares.
 */
function isAdapterFreezeDocument(value: Record<string, unknown>): boolean {
	if (value.schemaVersion !== 'versionless.trust.v1') return false;
	const freeze = value.freeze;
	if (freeze === null || typeof freeze !== 'object' || Array.isArray(freeze)) return false;
	const record = freeze as Record<string, unknown>;
	return (
		typeof record.commit === 'string' &&
		typeof record.composite === 'string' &&
		record.algorithm === 'sha256' &&
		record.state === 'frozen' &&
		Array.isArray(record.subtrees)
	);
}

function childContext(
	context: EvidenceContext,
	key: string,
	rootIsCycloneDx17: boolean,
	rootIsRuntimeObservation: boolean,
	rootIsT124Provenance: boolean,
	rootIsT138Provenance: boolean,
	rootIsCorpusConformance: boolean,
	rootIsAdapterFreeze: boolean,
): EvidenceContext {
	if (rootIsCycloneDx17 && key === 'components') return 'cyclonedx-components';
	if (context === 'cyclonedx-component' && key === 'hashes') return 'cyclonedx-hashes';
	if (rootIsRuntimeObservation && key === 'verticals') return 'runtime-verticals';
	if (context === 'runtime-vertical' && key === 'lanes') return 'runtime-lanes';
	if (context === 'runtime-lane' && key === 'runs') return 'runtime-runs';
	if (context === 'runtime-run' && key === 'journeyProjection')
		return 'runtime-journey-projection';
	if (rootIsT124Provenance && key === 'officialTree') return 't124-official-tree';
	if (rootIsT138Provenance && key === 'officialTree') return 't138-official-tree';
	if (rootIsCorpusConformance && key === 'applications') return 'corpus-conformance-applications';
	if (context === 'corpus-conformance-application' && key === 'source')
		return 'corpus-conformance-application-source';
	if (rootIsAdapterFreeze && key === 'freeze') return 'adapter-freeze-record';
	if (context === 'adapter-freeze-record' && key === 'supersedes')
		return 'adapter-freeze-supersedes';
	return 'ordinary';
}

function arrayItemContext(context: EvidenceContext): EvidenceContext {
	if (context === 'cyclonedx-components') return 'cyclonedx-component';
	if (context === 'cyclonedx-hashes') return 'cyclonedx-hash';
	if (context === 'runtime-verticals') return 'runtime-vertical';
	if (context === 'runtime-lanes') return 'runtime-lane';
	if (context === 'runtime-runs') return 'runtime-run';
	if (context === 't124-official-tree') return 't124-official-tree-row';
	if (context === 't138-official-tree') return 't138-official-tree-row';
	if (context === 'corpus-conformance-applications') return 'corpus-conformance-application';
	return 'ordinary';
}

function isCanonicalRuntimeObservationUsername(
	value: unknown,
	key: string,
	context: EvidenceContext,
): boolean {
	return context === 'runtime-journey-projection' && key === 'username' && value === 'octocat';
}

function isCycloneDxSha256Content(
	value: string,
	key: string,
	parent: Record<string, unknown>,
	context: EvidenceContext,
): boolean {
	return (
		context === 'cyclonedx-hash' &&
		key === 'content' &&
		parent.alg === 'SHA-256' &&
		sha256Hex.test(value)
	);
}

function isT124OfficialTreeObjectId(value: string, key: string, context: EvidenceContext): boolean {
	return context === 't124-official-tree-row' && key === 'sha' && isLowercaseHex(value, 40, true);
}

function isT138OfficialTreeObjectId(value: string, key: string, context: EvidenceContext): boolean {
	return context === 't138-official-tree-row' && key === 'sha' && isLowercaseHex(value, 40, true);
}

/**
 * Admits a source-application git object id published by derived corpus and
 * trust provenance.
 *
 * A Git revision is a forty-character lowercase hex object id, and some of them
 * — HospitalRun's `8156955145551d0366df10faa28e724f3377dea1` among them — open
 * with a thirteen-digit run that is indistinguishable from a primary account
 * number to the digit-run detector. The admission is deliberately as narrow as
 * the object id itself: the value must be exactly forty lowercase hex
 * characters including at least one letter, it must sit under one of the
 * closed revision-context keys, and that key must sit on the `source` record of
 * a source application inside a document whose root is exactly the derived
 * corpus-conformance shape. A bare digit run, a wrong-length or upper-case
 * value, an object id under any other key, and an object id in any other
 * document all keep tripping the detector.
 */
function isCorpusProvenanceRevisionObjectId(
	value: string,
	key: string,
	context: EvidenceContext,
): boolean {
	return (
		context === 'corpus-conformance-application-source' &&
		corpusProvenanceRevisionKeys.has(key) &&
		isLowercaseHex(value, 40, true)
	);
}

/**
 * Admits the git commit object id the adapter-freeze record was computed at.
 *
 * The freeze record names the real commit at which the frozen adapter state was
 * established, and that commit — cce3417's re-freeze SHA among them — can open
 * with a fourteen-digit run indistinguishable from a primary account number to
 * the digit-run detector. The admission is exactly as narrow as a git object id:
 * the value must be exactly forty lowercase hex characters including at least one
 * letter, the key must be the freeze record's `commit` key, and that key must sit
 * either directly on the freeze record or on its `supersedes` record inside a
 * document whose root is exactly the adapter-freeze shape. A bare digit run, a
 * wrong-length or upper-case value, an object id under any other key, and an
 * object id in any other document all keep tripping the detector — the record
 * names the commit, the scanner only learns the git-object-id shape.
 */
function isAdapterFreezeCommitObjectId(
	value: string,
	key: string,
	context: EvidenceContext,
): boolean {
	return (
		(context === 'adapter-freeze-record' || context === 'adapter-freeze-supersedes') &&
		key === 'commit' &&
		isLowercaseHex(value, 40, true)
	);
}

function collectSensitiveSignals(
	value: unknown,
	path: string,
	findings: SensitiveFinding[],
	context: EvidenceContext,
): void {
	if (Array.isArray(value)) {
		const itemContext = arrayItemContext(context);
		value.forEach((item, index) =>
			collectSensitiveSignals(item, `${path}[${index}]`, findings, itemContext),
		);
	} else if (value !== null && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const rootIsCycloneDx17 = path === '$' && isCycloneDx17Document(record);
		const rootIsRuntimeObservation = path === '$' && isRuntimeObservationDocument(record);
		const rootIsT124Provenance = path === '$' && isT124ProvenanceDocument(record);
		const rootIsT138Provenance = path === '$' && isT138ProvenanceDocument(record);
		const rootIsT138ImmutableFixture = path === '$' && isT138ImmutableFixtureDocument(record);
		const rootIsCorpusConformance = path === '$' && isCorpusConformanceDocument(record);
		const rootIsAdapterFreeze = path === '$' && isAdapterFreezeDocument(record);
		if (
			path === '$' &&
			targetsT138ProvenanceContext(record) &&
			!rootIsT138Provenance &&
			!rootIsT138ImmutableFixture
		)
			findings.push({ path, kind: 'pan-like-value' });
		for (const [key, child] of Object.entries(record)) {
			const childPath = `${path}.${key}`;
			if (
				hasForbiddenKeyPart(key) &&
				!isSafeDomainKeyValue(key, child) &&
				!isCanonicalRuntimeObservationUsername(child, key, context)
			)
				findings.push({ path: childPath, kind: 'forbidden-key' });
			if (typeof child === 'string') {
				if (secretValue.test(child) || hasSecretMarker(child))
					findings.push({ path: childPath, kind: 'secret-like-value' });
				if (isEmailLike(child)) findings.push({ path: childPath, kind: 'pii-like-value' });
				if (isStrengthenedSensitiveDomainClaim(child))
					findings.push({ path: childPath, kind: 'support-claim-like-value' });
				const digest =
					isReceiptCryptographicDigest(child, childPath) ||
					isCycloneDxSha256Content(child, key, record, context) ||
					isT124OfficialTreeObjectId(child, key, context) ||
					isT138OfficialTreeObjectId(child, key, context) ||
					isCorpusProvenanceRevisionObjectId(child, key, context) ||
					isAdapterFreezeCommitObjectId(child, key, context);
				if (!digest && panLike.test(child))
					findings.push({ path: childPath, kind: 'pan-like-value' });
			} else {
				collectSensitiveSignals(
					child,
					childPath,
					findings,
					childContext(
						context,
						key,
						rootIsCycloneDx17,
						rootIsRuntimeObservation,
						rootIsT124Provenance,
						rootIsT138Provenance,
						rootIsCorpusConformance,
						rootIsAdapterFreeze,
					),
				);
			}
		}
	} else if (typeof value === 'string') {
		if (secretValue.test(value) || hasSecretMarker(value))
			findings.push({ path, kind: 'secret-like-value' });
		if (isEmailLike(value)) findings.push({ path, kind: 'pii-like-value' });
		if (isStrengthenedSensitiveDomainClaim(value))
			findings.push({ path, kind: 'support-claim-like-value' });
		if (!isReceiptCryptographicDigest(value, path) && panLike.test(value))
			findings.push({ path, kind: 'pan-like-value' });
	}
}

export function findSensitiveSignals(
	value: unknown,
	path = '$',
	findings: SensitiveFinding[] = [],
): SensitiveFinding[] {
	collectSensitiveSignals(value, path, findings, 'ordinary');
	return findings;
}

export function assertSyntheticEvidence(value: unknown): void {
	const findings = findSensitiveSignals(value);
	if (findings.length) throw new Error(`Sensitive material refused: ${JSON.stringify(findings)}`);
}
import {
	anyOf,
	caseInsensitive,
	charIn,
	createRegExp,
	digit,
	exactly,
	maybe,
	oneOrMore,
	whitespace,
} from 'magic-regexp';
