import { readFile } from 'node:fs/promises';
import { join } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';

export const REACT_DEJAVU_RECEIPT_PATH = 'evidence/runs/witness-react-dejavu/receipt.json' as const;

export type ReactDejavuReceipt = {
	schemaVersion: 1;
	id: 'react-dejavu-legacy-to-vite8';
	status: 'verified';
	source: {
		repository: 'appbaseio/dejavu';
		revision: string;
		tree: string;
		license: 'MIT';
		gitObjectParityDigest: string;
		symlinks: number;
	};
	target: { react: '18.3.1'; node: '24.15.0'; vite: '8.0.16'; bundler: 'vite' };
	builds: { legacy: [string, string]; target: [string, string] };
	journeys: { observations: 8; directWitness: true; loopbackOnly: true };
	serviceWorker: { registrations: 0; controllers: 0; requests: 0; outputFiles: 0 };
	mutation: { red: true; restored: true; sourceIdentityRestored: true };
	artifacts: Array<{ path: string; sha256: string }>;
	digest: string;
};

function isHex(value: string, length: number): boolean {
	return (
		value.length === length &&
		value.split('').every((character) => '0123456789abcdef'.includes(character))
	);
}

export function verifyReactDejavuReceipt(value: unknown): ReactDejavuReceipt {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('React Dejavu receipt must be an object');
	const receipt = value as ReactDejavuReceipt;
	if (
		receipt.schemaVersion !== 1 ||
		receipt.id !== 'react-dejavu-legacy-to-vite8' ||
		receipt.status !== 'verified' ||
		receipt.source?.repository !== 'appbaseio/dejavu' ||
		receipt.source?.license !== 'MIT' ||
		!isHex(receipt.source.revision, 40) ||
		!isHex(receipt.source.tree, 40) ||
		!isHex(receipt.source.gitObjectParityDigest, 64) ||
		!Number.isInteger(receipt.source.symlinks) ||
		receipt.source.symlinks < 1 ||
		receipt.target?.react !== '18.3.1' ||
		receipt.target?.node !== '24.15.0' ||
		receipt.target?.vite !== '8.0.16' ||
		receipt.target?.bundler !== 'vite' ||
		receipt.builds?.legacy[0] !== receipt.builds?.legacy[1] ||
		receipt.builds?.target[0] !== receipt.builds?.target[1] ||
		receipt.journeys?.observations !== 8 ||
		receipt.journeys?.directWitness !== true ||
		receipt.journeys?.loopbackOnly !== true ||
		receipt.serviceWorker?.registrations !== 0 ||
		receipt.serviceWorker?.controllers !== 0 ||
		receipt.serviceWorker?.requests !== 0 ||
		receipt.serviceWorker?.outputFiles !== 0 ||
		receipt.mutation?.red !== true ||
		receipt.mutation?.restored !== true ||
		receipt.mutation?.sourceIdentityRestored !== true ||
		!Array.isArray(receipt.artifacts) ||
		receipt.artifacts.length < 8
	)
		throw new Error('React Dejavu receipt invariants differ');
	for (const artifact of receipt.artifacts)
		if (!artifact.path || artifact.path.startsWith('/') || !isHex(artifact.sha256, 64))
			throw new Error('React Dejavu artifact identity differs');
	const { digest, ...unsigned } = receipt;
	if (!isHex(digest, 64) || digest !== sha256(canonicalize(unsigned)))
		throw new Error('React Dejavu receipt digest differs');
	return receipt;
}

export async function verifyReactDejavuEvidence(root: string): Promise<{
	digest: string;
	artifacts: number;
}> {
	const receipt = verifyReactDejavuReceipt(
		JSON.parse(await readFile(join(root, REACT_DEJAVU_RECEIPT_PATH), 'utf8')),
	);
	for (const artifact of receipt.artifacts) {
		const bytes = await readFile(join(root, artifact.path));
		if (sha256(bytes) !== artifact.sha256)
			throw new Error(`React Dejavu artifact differs: ${artifact.path}`);
	}
	return { digest: receipt.digest, artifacts: receipt.artifacts.length };
}

export function reactDejavuAggregateMember(digest: string): {
	id: 'react-dejavu-legacy-to-vite8';
	receipt: typeof REACT_DEJAVU_RECEIPT_PATH;
	digest: string;
} {
	if (!isHex(digest, 64)) throw new Error('React Dejavu aggregate digest differs');
	return { id: 'react-dejavu-legacy-to-vite8', receipt: REACT_DEJAVU_RECEIPT_PATH, digest };
}
