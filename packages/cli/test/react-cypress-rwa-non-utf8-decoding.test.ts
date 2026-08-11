import { describe, expect, test } from 'vitest';
import {
	holdoutOffendingFileSha256,
	holdoutRecordedInvalidBytes,
	invalidByteOffsetsIn,
	readNonUtf8DecodingMeasurement,
	verifyNonUtf8DecodingMeasurement,
} from '../src/fixture/react-cypress-rwa-non-utf8-decoding.ts';

describe('webpack 4 decoding measured on the cypress-realworld-app holdout bytes', () => {
	test('the recorded measurement verifies against the capability', async () => {
		const result = await verifyNonUtf8DecodingMeasurement();
		expect(result.failures).toEqual([]);
		expect(result.result).toBe('pass');
		expect(result.observations).toBe(6);
		expect(result.decodesMatchingWebpack).toBe(6);
		expect(result.offendingTokensClassifiedInvalid).toBe(6);
		expect(result.controlTokensClassifiedValid).toBe(6);
		// The hypothesis the control refuted: the capability must never produce it.
		expect(result.latin1DecodesProducedByTheCapability).toBe(0);
	});

	test('agrees with the immutable holdout receipt on the bytes themselves', async () => {
		const measurement = await readNonUtf8DecodingMeasurement();
		expect(measurement.offendingModule.sha256).toBe(await holdoutOffendingFileSha256());
		const recorded = await holdoutRecordedInvalidBytes();
		// The receipt listed five of the six; the measurement carries all six and
		// every one the receipt named is among them at the same offset.
		expect(recorded.length).toBe(5);
		expect(measurement.offendingModule.invalidUtf8ByteCount).toBe(6);
		for (const entry of recorded)
			expect(measurement.offendingModule.invalidUtf8ByteOffsets).toContain(entry.offset);
		expect(measurement.freezeOrder.holdoutRerunPerformedByThisUnit).toBe(false);
		expect(measurement.freezeOrder.supersededCompositeFingerprint).toBe(
			'd9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77',
		);
	});

	test('the emitted webpack literal is the replacement character, not the accent', async () => {
		const measurement = await readNonUtf8DecodingMeasurement();
		expect(measurement.verdict.semantics).toBe('utf-8-decode-with-replacement-character');
		for (const observation of measurement.observations) {
			expect(observation.foundInWebpackChunk).toBe(true);
			expect(observation.webpackDecodedText).toContain('�');
			expect(observation.webpackDecodedText).not.toBe(observation.iso88591Intent);
			expect(observation.control.foundInWebpackChunk).toBe(true);
			// The control travelled the same toolchain and kept its accent, so the
			// loss above is the decode and not anything downstream of it.
			expect(observation.control.sameTokenInValidUtf8Sibling).toBe(
				observation.iso88591Intent,
			);
		}
	});

	test('the scanner finds each recorded invalid byte inside its own token', async () => {
		const measurement = await readNonUtf8DecodingMeasurement();
		for (const observation of measurement.observations)
			expect(invalidByteOffsetsIn(observation.sourceBytesHex)).toEqual([
				observation.invalidByteOffset - observation.sourceByteOffset,
			]);
	});

	test('the measurement records what it does not claim', async () => {
		const measurement = await readNonUtf8DecodingMeasurement();
		const text = measurement.nonclaims.join(' ').toLowerCase();
		for (const subject of ['application source', 'utf-16', 'byte order mark', 're-run'])
			expect(text).toContain(subject);
	});
});
