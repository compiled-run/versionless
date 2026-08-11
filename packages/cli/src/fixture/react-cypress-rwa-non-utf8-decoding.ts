import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	craInvalidUtf8ByteOffsets,
	craModuleSourceEncoding,
	craWebpackDecodedSource,
} from '../../../frameworks/react/src/react-cra-vite-adapter.ts';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';

/**
 * Fixture-scoped verification of the webpack 4 decoding measurement recorded for
 * the cypress-realworld-app holdout. Every application-specific fact lives here
 * — the package, the file, the byte offsets — so the capability it checks can
 * stay a statement about encodings and nothing else.
 *
 * The measurement is a read of the holdout's own committed artefacts. This
 * verifier re-runs nothing: it recomputes the record's digest, replays the
 * recorded bytes through the capability, and cross-checks the bytes against the
 * immutable holdout receipt that named the missing capability in the first
 * place.
 */

const root = path.resolve(import.meta.dirname, '../../../..');
const measurementPath = path.join(
	root,
	'evidence/runs/react-cypress-rwa/non-utf8-module-decoding.json',
);
const holdoutReceiptPath = path.join(root, 'evidence/runs/holdout-react-cypress-rwa/receipt.json');

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export type NonUtf8DecodingControl = Readonly<{
	sameTokenInValidUtf8Sibling: string | null;
	sourceBytesHex: string | null;
	webpackEmittedLiteralInChunk: string | null;
	foundInWebpackChunk: boolean | null;
}>;

export type NonUtf8DecodingObservation = Readonly<{
	sourceByteOffset: number;
	sourceBytesHex: string;
	invalidByteOffset: number;
	invalidByte: string;
	iso88591Intent: string;
	webpackDecodedText: string;
	webpackEmittedLiteralInChunk: string;
	foundInWebpackChunk: boolean;
	control: NonUtf8DecodingControl;
}>;

export type NonUtf8DecodingMeasurement = Readonly<{
	schemaVersion: 'versionless.react-cypress-rwa-non-utf8-module-decoding.v1';
	unit: string;
	capability: string;
	webpackBuild: Readonly<{
		webpack: string;
		holdoutReceiptCanonicalDigest: string;
		chunk: Readonly<{ path: string; bytes: number; sha256: string }>;
	}>;
	offendingModule: Readonly<{
		path: string;
		sha256: string;
		invalidUtf8ByteCount: number;
		invalidUtf8ByteOffsets: readonly number[];
		entriesMissingFromWebpackChunkAfterUtf8ReplacementDecode: number;
	}>;
	controlModule: Readonly<{
		path: string;
		sha256: string;
		invalidUtf8ByteCount: number;
		entriesMissingFromWebpackChunkAfterOrdinaryUtf8Decode: number;
	}>;
	observations: readonly NonUtf8DecodingObservation[];
	verdict: Readonly<{ semantics: string; refutedHypothesis: string }>;
	nonclaims: readonly string[];
	freezeOrder: Readonly<{
		supersededCompositeFingerprint: string;
		holdoutRerunPerformedByThisUnit: boolean;
	}>;
	integrity: Readonly<{ algorithm: 'sha256'; canonicalDigest: string }>;
}>;

/** The record, refused unless its own canonical digest recomputes. */
export async function readNonUtf8DecodingMeasurement(): Promise<NonUtf8DecodingMeasurement> {
	const body = await readFile(measurementPath, 'utf8');
	const measurement = JSON.parse(body) as NonUtf8DecodingMeasurement;
	const { integrity, ...unsigned } = measurement;
	if (sha256(canonicalize(unsigned)) !== integrity.canonicalDigest)
		throw new Error('cypress-realworld-app non-UTF-8 decoding measurement digest differs');
	return measurement;
}

export type HoldoutInvalidByte = Readonly<{ offset: number; byte: string; inWord: string }>;

/**
 * The invalid bytes the holdout receipt itself recorded. That receipt is
 * immutable and predates this capability, so agreeing with it is a check on the
 * measurement rather than a restatement of it.
 */
export async function holdoutRecordedInvalidBytes(): Promise<readonly HoldoutInvalidByte[]> {
	const receipt = JSON.parse(await readFile(holdoutReceiptPath, 'utf8')) as {
		finding: { offendingFile: { sha256: string; invalidBytes: readonly HoldoutInvalidByte[] } };
	};
	return receipt.finding.offendingFile.invalidBytes;
}

/** The offending file's digest as the immutable holdout receipt recorded it. */
export async function holdoutOffendingFileSha256(): Promise<string> {
	const receipt = JSON.parse(await readFile(holdoutReceiptPath, 'utf8')) as {
		finding: { offendingFile: { sha256: string } };
	};
	return receipt.finding.offendingFile.sha256;
}

export type NonUtf8DecodingVerification = Readonly<{
	result: 'pass' | 'fail';
	observations: number;
	decodesMatchingWebpack: number;
	offendingTokensClassifiedInvalid: number;
	controlTokensClassifiedValid: number;
	latin1DecodesProducedByTheCapability: number;
	failures: readonly string[];
}>;

/**
 * Replay the recorded bytes through the capability.
 *
 * Three properties are checked per observation, and each one is a different way
 * of being wrong:
 *
 * - the capability's decode equals the text webpack emitted, byte for byte;
 * - the offending bytes classify as invalid UTF-8 while the control bytes, the
 *   same characters stored well formed, classify as valid and are left alone;
 * - the capability never produces the ISO-8859-1 reading, which is the decode
 *   the control measurement refuted.
 */
export async function verifyNonUtf8DecodingMeasurement(): Promise<NonUtf8DecodingVerification> {
	const measurement = await readNonUtf8DecodingMeasurement();
	const failures: string[] = [];
	let decodesMatchingWebpack = 0;
	let offendingTokensClassifiedInvalid = 0;
	let controlTokensClassifiedValid = 0;
	let latin1DecodesProducedByTheCapability = 0;
	for (const observation of measurement.observations) {
		const bytes = Buffer.from(observation.sourceBytesHex, 'hex');
		const decoded = craWebpackDecodedSource(bytes);
		if (decoded === observation.webpackDecodedText) decodesMatchingWebpack += 1;
		else failures.push(`decode differs at offset ${observation.invalidByteOffset}`);
		if (decoded === observation.iso88591Intent) latin1DecodesProducedByTheCapability += 1;
		if (craModuleSourceEncoding(bytes) === 'utf-8-with-invalid-bytes')
			offendingTokensClassifiedInvalid += 1;
		else failures.push(`encoding misclassified at offset ${observation.invalidByteOffset}`);
		const controlHex = observation.control.sourceBytesHex;
		if (controlHex === null) continue;
		const controlBytes = Buffer.from(controlHex, 'hex');
		if (
			craModuleSourceEncoding(controlBytes) === 'utf-8' &&
			craWebpackDecodedSource(controlBytes) ===
				observation.control.sameTokenInValidUtf8Sibling
		)
			controlTokensClassifiedValid += 1;
		else failures.push(`control misclassified at offset ${observation.invalidByteOffset}`);
	}
	const recorded = await holdoutRecordedInvalidBytes();
	for (const entry of recorded)
		if (!measurement.offendingModule.invalidUtf8ByteOffsets.includes(entry.offset))
			failures.push(`holdout recorded byte at offset ${entry.offset} is unaccounted for`);
	if ((await holdoutOffendingFileSha256()) !== measurement.offendingModule.sha256)
		failures.push('offending file digest differs from the holdout receipt');
	if (latin1DecodesProducedByTheCapability > 0)
		failures.push('the capability produced the refuted ISO-8859-1 reading');
	return {
		result: failures.length === 0 ? 'pass' : 'fail',
		observations: measurement.observations.length,
		decodesMatchingWebpack,
		offendingTokensClassifiedInvalid,
		controlTokensClassifiedValid,
		latin1DecodesProducedByTheCapability,
		failures: failures.sort(),
	};
}

/**
 * The invalid byte offsets the capability finds in a buffer assembled from the
 * recorded tokens, for a caller that wants to check the scanner against the
 * recorded positions rather than against itself.
 */
export function invalidByteOffsetsIn(hex: string): readonly number[] {
	return craInvalidUtf8ByteOffsets(Buffer.from(hex, 'hex'));
}
