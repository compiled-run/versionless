import { charIn, createRegExp, oneOrMore } from 'magic-regexp';

export const SOLID_DESCRIPTOR_SCHEMA = 'versionless.solid-descriptor.v1' as const;

export type SolidMajor = 1 | 2;
export type SolidHome = 'frameless';

export interface SolidClassification {
	framework: 'solid';
	major: SolidMajor;
	home: SolidHome;
	packageDetected: true;
	migration: { claimed: false };
	apis: { current: string[]; legacy: string[] };
}

const portableIdPattern = createRegExp(
	oneOrMore(charIn('0123456789-').from('a', 'z')).at.lineStart().at.lineEnd(),
);

const ROOT_KEYS = [
	'schemaVersion',
	'id',
	'synthetic',
	'framework',
	'executionRequested',
	'supportClaim',
	'migrationClaimed',
	'packageDetected',
	'major',
	'home',
	'apis',
] as const;

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Solid descriptor ${label} must be an object`);
	return value as Record<string, unknown>;
}

function exactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
	label: string,
): void {
	const actual = Object.keys(value).sort().join('\n');
	const wanted = [...expected].sort().join('\n');
	if (actual !== wanted) throw new Error(`Solid descriptor ${label} fields are invalid`);
}

function uniqueSortedNames(value: unknown, label: string): string[] {
	if (!Array.isArray(value)) throw new Error(`Solid descriptor ${label} must be an array`);
	const names = value.map((item, index) => {
		if (typeof item !== 'string' || item.length === 0)
			throw new Error(`Solid descriptor ${label}[${index}] must be a non-empty string`);
		return item;
	});
	if (new Set(names).size !== names.length)
		throw new Error(`Solid descriptor ${label} contains duplicate names`);
	const sorted = [...names].sort();
	for (let index = 0; index < names.length; index++)
		if (names[index] !== sorted[index])
			throw new Error(`Solid descriptor ${label} names are unsorted`);
	return names;
}

export function classifySolidDescriptor(value: unknown): {
	id: string;
	descriptor: unknown;
	inventory: SolidClassification;
} {
	const root = record(value, 'root');
	exactKeys(root, ROOT_KEYS, 'root');
	if (root.schemaVersion !== SOLID_DESCRIPTOR_SCHEMA)
		throw new Error('Unsupported Solid descriptor schema');
	if (typeof root.id !== 'string' || !portableIdPattern.test(root.id))
		throw new Error('Solid descriptor id is not portable');
	if (root.synthetic !== true) throw new Error('Solid descriptor must be explicitly synthetic');
	if (root.framework !== 'solid') throw new Error('Solid descriptor framework mismatch');
	if (root.executionRequested !== false)
		throw new Error('Solid descriptor candidate execution is forbidden');
	if (root.supportClaim !== false)
		throw new Error('Solid descriptor support claims are forbidden');
	if (root.migrationClaimed !== false)
		throw new Error('Solid descriptor migration claims are forbidden');
	if (root.packageDetected !== true)
		throw new Error('Solid descriptor packageDetected must be true');
	if (typeof root.major !== 'number' || !Number.isInteger(root.major))
		throw new Error('Solid descriptor major must be an integer');
	if (root.major !== 1 && root.major !== 2) throw new Error('Solid descriptor major is unknown');
	if (root.home !== 'frameless') throw new Error('Solid descriptor home contradicts major');
	const apis = record(root.apis, 'apis');
	exactKeys(apis, ['current', 'legacy'], 'apis');
	return {
		id: root.id,
		descriptor: root,
		inventory: {
			framework: 'solid',
			major: root.major,
			home: 'frameless',
			packageDetected: true,
			migration: { claimed: false },
			apis: {
				current: uniqueSortedNames(apis.current, 'apis.current'),
				legacy: uniqueSortedNames(apis.legacy, 'apis.legacy'),
			},
		},
	};
}
