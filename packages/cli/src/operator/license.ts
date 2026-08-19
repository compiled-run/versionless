/**
 * The `license-at-pin` stage: what licence the application carries at the
 * revision this pipeline pinned it to.
 *
 * Today this reading is hand-authored. `evidence/ingests/react-papercups-v1-0-0/license.json`
 * is a `versionless.legacy-corpus-rights.v1` document somebody wrote after
 * looking at the tree, and no code in this repository produces one. That is a
 * human intervention inside a run the pipeline is meant to complete unattended,
 * and it is the reason an application the pipeline has never seen cannot be
 * admitted without an operator reading a licence file for it.
 *
 * This stage reads it instead, and it reads it the way the rest of the operator
 * surface reads things: it states what the bytes say, it digests what it read,
 * and it refuses by name rather than filling a gap with a plausible identifier.
 *
 * The declared-policy shape is the one the install stage set. The identifier is
 * *observed* by default — matched against the licence texts this stage can
 * recognise — and `--license <spdx>` is the declaration that settles a tree this
 * stage cannot read. The default is refusing: a licence file whose text matches
 * nothing here, or a file that disagrees with the manifest's own `license`
 * field, is a named refusal rather than a guess, because "which licence this
 * source is under" is not a question a migration tool may answer approximately.
 *
 * Nothing here is a legal reading. The record says so in its own words, in the
 * same terms the sealed hand-authored record already uses.
 */

import { readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { gitBlobId } from '../fixture/legacy-candidate-ingest.ts';
import { readJsonFile } from './analyze.ts';
import { refuse } from './refusals.ts';

export const LICENSE_AT_PIN_SCHEMA = 'versionless.license-at-pin.v1';

/**
 * The licence file names this stage looks for at the source root.
 *
 * Both spellings, because the corpus carries both: the sealed papercups record
 * names `LICENSE` and the sealed react-realworld ingest names `LICENSE.md`.
 */
export const LICENCE_FILENAMES: readonly string[] = Object.freeze([
	'LICENSE',
	'LICENSE.md',
	'LICENSE.txt',
	'LICENCE',
	'LICENCE.md',
	'LICENCE.txt',
	'COPYING',
	'COPYING.md',
]);

/**
 * The licence texts this stage reads, each as the runs of text that must be
 * present and the runs that must be absent for the identifier to be stated.
 *
 * Every entry names an exact identifier, never a family: `BSD` and `GPL` are
 * not readings, because a record that says `GPL` has not said which obligations
 * apply. Where the variants are separated by a line in the canonical text, the
 * variants are listed separately; where they are not, the text is unrecognised
 * and the stage refuses. This is a text reading, not a parser — a reworded,
 * translated, amended or dual licence matches nothing here by design.
 */
const LICENCE_SIGNATURES: readonly Readonly<{
	identifier: string;
	requires: readonly string[];
	absent: readonly string[];
}>[] = Object.freeze([
	Object.freeze({
		identifier: 'MIT',
		requires: Object.freeze([
			'Permission is hereby granted, free of charge, to any person obtaining a copy',
		]),
		absent: Object.freeze([]),
	}),
	Object.freeze({
		identifier: 'Apache-2.0',
		requires: Object.freeze(['Apache License', 'Version 2.0']),
		absent: Object.freeze([]),
	}),
	Object.freeze({
		identifier: 'ISC',
		requires: Object.freeze([
			'Permission to use, copy, modify, and/or distribute this software',
		]),
		absent: Object.freeze([]),
	}),
	Object.freeze({
		identifier: 'MPL-2.0',
		requires: Object.freeze(['Mozilla Public License Version 2.0']),
		absent: Object.freeze([]),
	}),
	Object.freeze({
		identifier: 'Unlicense',
		requires: Object.freeze([
			'This is free and unencumbered software released into the public domain',
		]),
		absent: Object.freeze([]),
	}),
	Object.freeze({
		identifier: 'BSD-3-Clause',
		requires: Object.freeze([
			'Redistribution and use in source and binary forms',
			'Neither the name of',
		]),
		absent: Object.freeze([]),
	}),
	Object.freeze({
		identifier: 'BSD-2-Clause',
		requires: Object.freeze(['Redistribution and use in source and binary forms']),
		absent: Object.freeze(['Neither the name of']),
	}),
	Object.freeze({
		identifier: 'GPL-3.0',
		requires: Object.freeze(['GNU GENERAL PUBLIC LICENSE', 'Version 3']),
		absent: Object.freeze([]),
	}),
	Object.freeze({
		identifier: 'GPL-2.0',
		requires: Object.freeze(['GNU GENERAL PUBLIC LICENSE', 'Version 2']),
		absent: Object.freeze([]),
	}),
	Object.freeze({
		identifier: 'AGPL-3.0',
		requires: Object.freeze(['GNU AFFERO GENERAL PUBLIC LICENSE', 'Version 3']),
		absent: Object.freeze([]),
	}),
	Object.freeze({
		identifier: 'LGPL-3.0',
		requires: Object.freeze(['GNU LESSER GENERAL PUBLIC LICENSE', 'Version 3']),
		absent: Object.freeze([]),
	}),
	Object.freeze({
		identifier: 'LGPL-2.1',
		requires: Object.freeze(['GNU LESSER GENERAL PUBLIC LICENSE', 'Version 2.1']),
		absent: Object.freeze([]),
	}),
]);

/** The three clauses the sealed rights record checks a licence text for. */
const PERMISSION_GRANT_PHRASES: readonly string[] = Object.freeze([
	'Permission is hereby granted',
	'Permission to use, copy, modify',
	'Redistribution and use in source and binary forms',
	'You may obtain a copy of the License',
	'hereby grants You a world-wide',
	'released into the public domain',
	'copy, distribute and modify',
]);

const NOTICE_RETENTION_PHRASES: readonly string[] = Object.freeze([
	'above copyright notice',
	'copyright notice and this permission notice',
	'retain the above copyright notice',
	'must retain',
	'You must give any other recipients',
	'must include a copy',
]);

const WARRANTY_DISCLAIMER_PHRASES: readonly string[] = Object.freeze([
	'WITHOUT WARRANTY',
	'WITHOUT WARRANTIES',
	'AS IS',
	'DISCLAIMS ALL WARRANTIES',
]);

const carries = (text: string, phrases: readonly string[]): boolean =>
	phrases.some((phrase) => text.includes(phrase));

export type LicenceArtifact = Readonly<{
	/** Path relative to the source root, as the record reads it. */
	path: string;
	role: 'repository-root-licence' | 'frontend-manifest';
	gitBlobSha: string;
	bytes: number;
	sha256: string;
	/** The first non-empty line of a licence file, or `null` for a manifest. */
	firstLine: string | null;
	permissionGrantPresent: boolean | null;
	noticeRetentionClausePresent: boolean | null;
	warrantyDisclaimerPresent: boolean | null;
	/** The `license` field of a manifest, or `null` for a licence file. */
	licenseField: string | null;
}>;

/**
 * How the identifier was arrived at.
 *
 * `observed` means this stage read it out of the licence text at the pin.
 * `declared` means an operator supplied it with `--license` because the text
 * matched nothing this stage recognises. The two are never merged: a reader has
 * to be able to tell a reading from a declaration.
 */
export type LicenceIdentifierSource = 'observed' | 'declared';

export type LicencePolicy = Readonly<{
	/** The identifier an operator declares for a text this stage cannot read. */
	declaredIdentifier: string | null;
}>;

export const DEFAULT_LICENCE_POLICY: LicencePolicy = Object.freeze({ declaredIdentifier: null });

export type LicenceAtPinRecord = Readonly<{
	stage: 'license-at-pin';
	schemaVersion: string;
	ran: boolean;
	/** Why the stage did not run, when it did not. */
	reason: string | null;
	identifier: string | null;
	identifierSource: LicenceIdentifierSource | null;
	/** The basis, in the stage's own words, for the identifier it recorded. */
	identifierBasis: string | null;
	copyrightNotice: string | null;
	/** The `license` field the frontend manifest declares, or `null`. */
	manifestLicenseField: string | null;
	artifacts: readonly LicenceArtifact[];
	/** Licence files found at the source root. */
	licenceFilesAtRoot: readonly string[];
	notEstablished: readonly string[];
}>;

const LICENCE_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'This is a record of the licence text present at the pinned revision. It is not a legal opinion, a licence-compatibility finding, or legal approval.',
	'No licence determination is made for the transitive dependency closure. Each dependency carries its own terms and this stage evaluates none of them.',
	'The identifier is matched against the canonical wording of the licences this stage recognises. A reworded, translated, amended or dual licence is refused rather than matched to the nearest one, so an absent refusal is not evidence that no such amendment exists.',
	'Only the source root is read for licence files. A licence carried further down the tree, a per-directory notice, and a vendored third-party licence are outside this reading.',
	'`identifierSource: declared` means an operator supplied the identifier. This stage did not read it and does not corroborate it.',
]);

/** The record for a stage the run did not ask for. */
export function licenceNotRequested(reason: string): LicenceAtPinRecord {
	return Object.freeze({
		stage: 'license-at-pin',
		schemaVersion: LICENSE_AT_PIN_SCHEMA,
		ran: false,
		reason,
		identifier: null,
		identifierSource: null,
		identifierBasis: null,
		copyrightNotice: null,
		manifestLicenseField: null,
		artifacts: Object.freeze([]),
		licenceFilesAtRoot: Object.freeze([]),
		notEstablished: LICENCE_NOT_ESTABLISHED,
	});
}

/** The first non-empty line of a licence text. */
export function firstLineOf(text: string): string {
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (trimmed !== '') return trimmed;
	}
	return '';
}

/** The copyright line a licence text carries, or `null` when it carries none. */
export function copyrightNoticeOf(text: string): string | null {
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (trimmed.startsWith('Copyright') && trimmed !== 'Copyright') return trimmed;
	}
	return null;
}

/**
 * The identifier a licence text states, or `null` when it states none this
 * stage recognises. A text matching more than one signature is `null` as well:
 * two identifiers in one file is a reading this stage will not make.
 */
export function licenceIdentifierOf(text: string): string | null {
	const matched = LICENCE_SIGNATURES.filter(
		(signature) =>
			signature.requires.every((phrase) => text.includes(phrase)) &&
			signature.absent.every((phrase) => !text.includes(phrase)),
	);
	if (matched.length !== 1) return null;
	return (matched[0] as (typeof LICENCE_SIGNATURES)[number]).identifier;
}

/** Licence file names present at the source root, in the declared order. */
export async function licenceFilesAtRoot(sourceRoot: string): Promise<readonly string[]> {
	let entries: string[];
	try {
		entries = (await readdir(sourceRoot, { withFileTypes: true }))
			.filter((entry) => entry.isFile())
			.map((entry) => entry.name);
	} catch {
		return Object.freeze([]);
	}
	return Object.freeze(LICENCE_FILENAMES.filter((name) => entries.includes(name)));
}

/**
 * Read the licence at the pinned source, or refuse by name.
 *
 * `sourceRoot` is the repository root at the pin — the sealed records read the
 * repository-root licence, not the frontend subdirectory's. `manifestFile` is
 * the frontend manifest whose `license` field the record carries beside it.
 */
export async function readLicenceAtPin(
	sourceRoot: string,
	manifestFile: string | null = null,
	policy: LicencePolicy = DEFAULT_LICENCE_POLICY,
): Promise<LicenceAtPinRecord> {
	const found = await licenceFilesAtRoot(sourceRoot);
	if (found.length === 0)
		refuse({
			code: 'license-at-pin.licence-file-absent',
			message: `License at pin: the source root carries none of ${LICENCE_FILENAMES.join(', ')}, so there is no licence text to read at the pinned revision. This flow records the licence it observed rather than inferring one from a manifest field, and it does not admit an application whose terms it never read.`,
			stage: 'license-at-pin',
			origin: 'pipeline',
		});
	const artifacts: LicenceArtifact[] = [];
	const readings = new Map<string, string | null>();
	let copyrightNotice: string | null = null;
	for (const name of found) {
		const bytes = await readFile(path.join(sourceRoot, name));
		const text = bytes.toString('utf8');
		const identifier = licenceIdentifierOf(text);
		readings.set(name, identifier);
		copyrightNotice = copyrightNotice ?? copyrightNoticeOf(text);
		artifacts.push(
			Object.freeze({
				path: name,
				role: 'repository-root-licence' as const,
				gitBlobSha: gitBlobId(bytes),
				bytes: bytes.byteLength,
				sha256: sha256(bytes),
				firstLine: firstLineOf(text),
				permissionGrantPresent: carries(text, PERMISSION_GRANT_PHRASES),
				noticeRetentionClausePresent: carries(text, NOTICE_RETENTION_PHRASES),
				warrantyDisclaimerPresent: carries(text, WARRANTY_DISCLAIMER_PHRASES),
				licenseField: null,
			}),
		);
	}
	let manifestLicenseField: string | null = null;
	if (manifestFile !== null) {
		const manifest = await readJsonFile(manifestFile);
		if (manifest !== null) {
			if (typeof manifest.license === 'string' && manifest.license !== '')
				manifestLicenseField = manifest.license;
			const bytes = await readFile(manifestFile);
			artifacts.push(
				Object.freeze({
					path: path.relative(sourceRoot, manifestFile),
					role: 'frontend-manifest' as const,
					gitBlobSha: gitBlobId(bytes),
					bytes: bytes.byteLength,
					sha256: sha256(bytes),
					firstLine: null,
					permissionGrantPresent: null,
					noticeRetentionClausePresent: null,
					warrantyDisclaimerPresent: null,
					licenseField: manifestLicenseField,
				}),
			);
		}
	}
	const observed = [...new Set([...readings.values()].filter((value) => value !== null))];
	if (policy.declaredIdentifier === null && observed.length > 1)
		refuse({
			code: 'license-at-pin.root-licence-files-state-different-identifiers',
			message: `License at pin: the source root carries ${String(found.length)} licence files stating ${observed.join(' and ')}. Which one the application is offered under is a reading this flow will not make; declare it with --license <identifier> if the pinned source settles it, and this record will say the identifier was declared rather than observed.`,
			stage: 'license-at-pin',
			origin: 'pipeline',
		});
	const single = observed[0] ?? null;
	if (policy.declaredIdentifier === null && single === null)
		refuse({
			code: 'license-at-pin.identifier-not-recognised',
			message: `License at pin: ${found.join(', ')} is present at the pinned revision and its text matches none of the licences this stage reads verbatim (${LICENCE_SIGNATURES.map((signature) => signature.identifier).join(', ')}). A licence this flow cannot read is not a licence it will guess at; declare it with --license <identifier>, and this record will say the identifier was declared rather than observed.`,
			stage: 'license-at-pin',
			origin: 'pipeline',
		});
	if (
		policy.declaredIdentifier === null &&
		manifestLicenseField !== null &&
		single !== null &&
		manifestLicenseField !== single
	)
		refuse({
			code: 'license-at-pin.manifest-field-conflicts-with-licence-text',
			message: `License at pin: the licence text at the pinned revision reads ${single} and the manifest declares ${manifestLicenseField}. This flow does not pick between a file and a field that disagree; declare the identifier with --license <identifier> to settle it, and this record will say it was declared.`,
			stage: 'license-at-pin',
			origin: 'pipeline',
		});
	const identifier = policy.declaredIdentifier ?? (single as string);
	const identifierSource: LicenceIdentifierSource =
		policy.declaredIdentifier === null ? 'observed' : 'declared';
	return Object.freeze({
		stage: 'license-at-pin',
		schemaVersion: LICENSE_AT_PIN_SCHEMA,
		ran: true,
		reason: null,
		identifier,
		identifierSource,
		/**
		 * The observed wording is the sealed hand-authored record's own —
		 * `evidence/ingests/react-papercups-v1-0-0/license.json` reads
		 * "verbatim MIT text in the repository root LICENSE file at the pinned
		 * revision" — so a record this stage derives and a record somebody wrote
		 * can be compared rather than merely both being about a licence.
		 */
		identifierBasis:
			identifierSource === 'observed'
				? `verbatim ${identifier} text in the repository root ${found.join(', ')} file at the pinned revision`
				: `declared with --license ${identifier}; the text in ${found.join(', ')} at the pinned revision was not read as an identifier by this stage`,
		copyrightNotice,
		manifestLicenseField,
		artifacts: Object.freeze(artifacts),
		licenceFilesAtRoot: found,
		notEstablished: LICENCE_NOT_ESTABLISHED,
	});
}

/** The licence record as an operator reads it. */
export function renderLicenceAtPin(record: LicenceAtPinRecord): string {
	const lines = record.ran
		? [
				`licence: ${record.identifier ?? ''} (${record.identifierSource ?? ''})`,
				`basis: ${record.identifierBasis ?? ''}`,
				`copyright: ${record.copyrightNotice ?? 'none stated'}`,
				`manifest license field: ${record.manifestLicenseField ?? 'none declared'}`,
				'',
			]
		: [`licence: not read — ${record.reason ?? ''}`, ''];
	for (const artifact of record.artifacts)
		lines.push(
			`  ${artifact.path} (${artifact.role}) ${artifact.sha256.slice(0, 12)} ${String(artifact.bytes)} bytes`,
		);
	lines.push('');
	for (const line of record.notEstablished) lines.push(`not established: ${line}`);
	return `${lines.join('\n')}\n`;
}
