import { request } from 'node:https';
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { join } from 'pathe';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	AcquisitionFailure,
	canonicalResponseRecord,
	exactRequestUrl,
	responseRecord,
	type AcquisitionObservation,
	type AcquisitionState,
	type DurableResponseRecord,
	type ExactRequestDescriptor,
} from '../../../core/src/acquisition/transaction.ts';

export type AcquisitionTransaction = Readonly<{
	consentId: string;
	durableRoot: string;
	metadataCap: number;
	archiveCap: number;
	aggregateCap: number;
}>;

const fsyncDirectory = async (directory: string): Promise<void> => {
	const handle = await open(directory, 'r');
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
};

export async function persistAcceptedResponse(
	transaction: AcquisitionTransaction,
	descriptor: ExactRequestDescriptor,
	state: AcquisitionState,
	body: Buffer,
): Promise<DurableResponseRecord> {
	await mkdir(transaction.durableRoot, { recursive: true });
	const record = responseRecord(descriptor, state.acceptedResponses + 1, body);
	const bodyPath = join(transaction.durableRoot, record.bodyFile);
	const partialPath = `${bodyPath}.partial`;
	const bodyHandle = await open(partialPath, 'wx');
	try {
		await bodyHandle.writeFile(body);
		await bodyHandle.sync();
	} finally {
		await bodyHandle.close();
	}
	await rename(partialPath, bodyPath);
	await fsyncDirectory(transaction.durableRoot);
	const journal = await open(join(transaction.durableRoot, 'journal.ndjson'), 'a');
	try {
		await journal.writeFile(`${canonicalResponseRecord(record)}\n`);
		await journal.sync();
	} finally {
		await journal.close();
	}
	return record;
}

export async function acquireExactResponse(
	transaction: AcquisitionTransaction,
	descriptor: ExactRequestDescriptor,
	state: AcquisitionState,
): Promise<Buffer> {
	const url = exactRequestUrl(descriptor);
	const cap =
		descriptor.responseKind === 'archive' ? transaction.archiveCap : transaction.metadataCap;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await new Promise<Buffer>((resolvePromise, reject) => {
				let responseObserved = false;
				const call = request(
					url,
					{
						method: 'GET',
						headers: {
							accept:
								descriptor.responseKind === 'json'
									? 'application/vnd.github+json'
									: 'application/octet-stream',
							'accept-encoding': 'identity',
							'user-agent': 'versionless-shared-acquisition',
							'x-versionless-consent-id': transaction.consentId,
						},
					},
					(response) => {
						responseObserved = true;
						const observation: AcquisitionObservation = {
							method: 'GET',
							url,
							purpose: descriptor.purpose,
							attempt,
							status: response.statusCode ?? 0,
							headersObserved: true,
							bodyBytes: 0,
							acceptedResponse: false,
						};
						state.observations.push(observation);
						if (response.statusCode !== 200) {
							response.destroy();
							reject(
								new AcquisitionFailure(
									'transport',
									response.statusCode &&
										response.statusCode >= 300 &&
										response.statusCode < 400
										? 'redirect-status'
										: 'non-200-status',
									200,
									response.statusCode ?? 0,
									'Acquisition response status differs',
								),
							);
							return;
						}
						if ((response.headers['content-encoding'] ?? 'identity') !== 'identity') {
							response.destroy();
							reject(
								new AcquisitionFailure(
									'transport',
									'content-encoding',
									'identity',
									'non-identity',
									'Acquisition content encoding differs',
								),
							);
							return;
						}
						let bytes = 0;
						const chunks: Buffer[] = [];
						response.on('data', (chunk: Buffer) => {
							bytes += chunk.byteLength;
							(observation as { bodyBytes: number }).bodyBytes = bytes;
							if (
								bytes > cap ||
								state.aggregateBytes + bytes > transaction.aggregateCap
							)
								response.destroy(
									new AcquisitionFailure(
										'transport',
										'body-cap',
										`<=${cap}`,
										bytes,
										'Acquisition response cap exceeded',
									),
								);
							else chunks.push(Buffer.from(chunk));
						});
						response.once('error', reject);
						response.once('end', async () => {
							try {
								const body = Buffer.concat(chunks, bytes);
								const record = await persistAcceptedResponse(
									transaction,
									descriptor,
									state,
									body,
								);
								(observation as { acceptedResponse: boolean }).acceptedResponse =
									true;
								state.acceptedResponses += 1;
								state.aggregateBytes += bytes;
								state.ledger.push(record);
								resolvePromise(body);
							} catch (error) {
								reject(error);
							}
						});
					},
				);
				call.setTimeout(60_000, () => call.destroy(new Error('zero-observation timeout')));
				call.once('error', (error) => {
					if (!responseObserved) {
						state.observations.push({
							method: 'GET',
							url,
							purpose: descriptor.purpose,
							attempt,
							status: null,
							headersObserved: false,
							bodyBytes: 0,
							acceptedResponse: false,
						});
						Object.assign(error, { zeroObservation: true });
					}
					reject(error);
				});
				call.end();
			});
		} catch (error) {
			if (!(error instanceof Error) || !('zeroObservation' in error) || attempt === 3)
				throw error;
		}
	}
	throw new AcquisitionFailure(
		'transport',
		'zero-observation-retries',
		3,
		3,
		'Acquisition transport exhausted',
	);
}

export async function verifyDurableResponses(
	transaction: AcquisitionTransaction,
	records: readonly DurableResponseRecord[],
): Promise<void> {
	for (const record of records) {
		const bytes = await readFile(join(transaction.durableRoot, record.bodyFile));
		const replay = {
			bodyBytes: bytes.byteLength,
			sha256: sha256(bytes),
			sha512: createHash('sha512').update(bytes).digest('hex'),
		};
		if (
			replay.bodyBytes !== record.bodyBytes ||
			replay.sha256 !== record.sha256 ||
			replay.sha512 !== record.sha512
		)
			throw new AcquisitionFailure(
				'offline-replay',
				'durable-response-record',
				{ bodyBytes: record.bodyBytes, sha256: record.sha256, sha512: record.sha512 },
				replay,
				'Durable acquisition replay differs',
			);
	}
}
