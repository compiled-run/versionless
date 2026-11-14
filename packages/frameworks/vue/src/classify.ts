import { charIn, createRegExp, oneOrMore } from 'magic-regexp';

export const VUE_DESCRIPTOR_SCHEMA = 'versionless.vue-descriptor.v1' as const;

export type VueMajor = 2 | 3;
export type VueHome = 'frameless' | 'versionless';

export interface VueClassification {
	framework: 'vue';
	major: VueMajor;
	home: VueHome;
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
		throw new Error(`Vue descriptor ${label} must be an object`);
	return value as Record<string, unknown>;
}

function exactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
	label: string,
): void {
	const actual = Object.keys(value).sort().join('\n');
	const wanted = [...expected].sort().join('\n');
	if (actual !== wanted) throw new Error(`Vue descriptor ${label} fields are invalid`);
}

function uniqueSortedNames(value: unknown, label: string): string[] {
	if (!Array.isArray(value)) throw new Error(`Vue descriptor ${label} must be an array`);
	const names = value.map((item, index) => {
		if (typeof item !== 'string' || item.length === 0)
			throw new Error(`Vue descriptor ${label}[${index}] must be a non-empty string`);
		return item;
	});
	if (new Set(names).size !== names.length)
		throw new Error(`Vue descriptor ${label} contains duplicate names`);
	const sorted = [...names].sort();
	for (let index = 0; index < names.length; index++)
		if (names[index] !== sorted[index])
			throw new Error(`Vue descriptor ${label} names are unsorted`);
	return names;
}

export function classifyVueDescriptor(value: unknown): {
	id: string;
	descriptor: unknown;
	inventory: VueClassification;
} {
	const root = record(value, 'root');
	exactKeys(root, ROOT_KEYS, 'root');
	if (root.schemaVersion !== VUE_DESCRIPTOR_SCHEMA)
		throw new Error('Unsupported Vue descriptor schema');
	if (typeof root.id !== 'string' || !portableIdPattern.test(root.id))
		throw new Error('Vue descriptor id is not portable');
	if (root.synthetic !== true) throw new Error('Vue descriptor must be explicitly synthetic');
	if (root.framework !== 'vue') throw new Error('Vue descriptor framework mismatch');
	if (root.executionRequested !== false)
		throw new Error('Vue descriptor candidate execution is forbidden');
	if (root.supportClaim !== false) throw new Error('Vue descriptor support claims are forbidden');
	if (root.migrationClaimed !== false)
		throw new Error('Vue descriptor migration claims are forbidden');
	if (root.packageDetected !== true)
		throw new Error('Vue descriptor packageDetected must be true');
	if (typeof root.major !== 'number' || !Number.isInteger(root.major))
		throw new Error('Vue descriptor major must be an integer');
	if (root.major !== 2 && root.major !== 3) throw new Error('Vue descriptor major is unknown');
	const home = root.home;
	if (home !== 'frameless' && home !== 'versionless')
		throw new Error('Vue descriptor home contradicts major');
	if ((root.major === 2 && home !== 'versionless') || (root.major === 3 && home !== 'frameless'))
		throw new Error('Vue descriptor home contradicts major');
	const apis = record(root.apis, 'apis');
	exactKeys(apis, ['current', 'legacy'], 'apis');
	return {
		id: root.id,
		descriptor: root,
		inventory: {
			framework: 'vue',
			major: root.major,
			home,
			packageDetected: true,
			migration: { claimed: false },
			apis: {
				current: uniqueSortedNames(apis.current, 'apis.current'),
				legacy: uniqueSortedNames(apis.legacy, 'apis.legacy'),
			},
		},
	};
}
