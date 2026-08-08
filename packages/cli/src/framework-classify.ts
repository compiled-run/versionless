import { readFile } from 'node:fs/promises';
import { charIn, createRegExp, oneOrMore } from 'magic-regexp';
import { isAbsolute, normalize, relative, resolve } from 'pathe';
import {
	createFrameworkClassificationReceipt,
	parseFrameworkClassificationReceipt,
	type FrameworkClassificationReceipt,
} from '../../core/src/receipts/framework-classification.ts';
import { classifyNextjsDescriptor } from '../../frameworks/nextjs/src/classify.ts';

const portableIdPattern = createRegExp(
	oneOrMore(charIn('0123456789-').from('a', 'z')).at.lineStart().at.lineEnd(),
);

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Framework descriptor ${label} must be an object`);
	return value as Record<string, unknown>;
}

function exactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
	label: string,
): void {
	if (Object.keys(value).sort().join('\n') !== [...expected].sort().join('\n'))
		throw new Error(`Framework descriptor ${label} fields are invalid`);
}

export function classifyFrameworkDescriptor(value: unknown): FrameworkClassificationReceipt {
	const root = record(value, 'root');
	if (root.framework === 'nextjs') {
		const result = classifyNextjsDescriptor(root);
		return parseFrameworkClassificationReceipt(
			createFrameworkClassificationReceipt({
				descriptor: result.descriptor,
				id: result.id,
				framework: 'nextjs',
				adapter: 'nextjs',
				inventory: result.inventory as unknown as Record<string, unknown>,
			}),
		);
	}
	if (root.framework !== 'react')
		throw new Error(`Unsupported framework dispatch: ${String(root.framework)}`);
	exactKeys(
		root,
		[
			'schemaVersion',
			'id',
			'synthetic',
			'framework',
			'executionRequested',
			'supportClaim',
			'packageDetected',
			'nextPackageDetected',
		],
		'generic React root',
	);
	if (
		root.schemaVersion !== 'versionless.react-descriptor.v1' ||
		typeof root.id !== 'string' ||
		!portableIdPattern.test(root.id) ||
		root.synthetic !== true ||
		root.executionRequested !== false ||
		root.supportClaim !== false ||
		root.packageDetected !== true ||
		root.nextPackageDetected !== false
	)
		throw new Error('Generic React descriptor is invalid or attempts Next.js uplift');
	return parseFrameworkClassificationReceipt(
		createFrameworkClassificationReceipt({
			descriptor: root,
			id: root.id,
			framework: 'react',
			adapter: 'generic-react',
			inventory: {
				packageDetected: true,
				nextPackageDetected: false,
				nextjsRouting: 'not-applicable',
				nextjsRuntime: 'not-applicable',
			},
		}),
	);
}

export async function runFrameworkClassification(options: {
	descriptorPath: string;
	offline: boolean;
	environment?: NodeJS.ProcessEnv;
	rootDir?: string;
}): Promise<FrameworkClassificationReceipt> {
	const environment = options.environment ?? process.env;
	if (!options.offline || environment.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error(
			'framework:classify requires --offline and VERSIONLESS_NETWORK_MODE=offline',
		);
	const descriptorPath = normalize(options.descriptorPath);
	if (
		descriptorPath !== options.descriptorPath ||
		descriptorPath === '..' ||
		descriptorPath.startsWith('../')
	)
		throw new Error('framework:classify descriptor path must be normalized and in scope');
	const root = resolve(options.rootDir ?? '.');
	const file = isAbsolute(descriptorPath) ? descriptorPath : resolve(root, descriptorPath);
	const relativeFile = relative(root, file);
	if (relativeFile === '..' || relativeFile.startsWith('../') || isAbsolute(relativeFile))
		throw new Error('framework:classify descriptor path escapes the workspace');
	return classifyFrameworkDescriptor(JSON.parse(await readFile(file, 'utf8')));
}
