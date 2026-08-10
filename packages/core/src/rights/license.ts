export type PermissiveLicenseFamily = 'MIT' | 'Apache-2.0';

export type PermissiveLicenseQualification = Readonly<{
	family: PermissiveLicenseFamily;
	method: 'content-semantic';
	corroboration: 'spdx' | 'title';
	legalCertification: false;
}>;

const whitespace = new Set([' ', '\n', '\r', '\t', '\f', '\v', '\u00a0']);

const normalizeText = (value: string): string => {
	let normalized = '';
	let pendingSpace = false;
	for (const rawCharacter of value) {
		const character =
			rawCharacter === '“' || rawCharacter === '”'
				? '"'
				: rawCharacter === '’'
					? "'"
					: rawCharacter;
		if (whitespace.has(character)) {
			pendingSpace = normalized.length > 0;
			continue;
		}
		if (pendingSpace) normalized += ' ';
		normalized += character.toLowerCase();
		pendingSpace = false;
	}
	return normalized.trim();
};

const normalizeIdentifier = (value: string): string => {
	let normalized = '';
	for (const character of value.trim().toLowerCase())
		if (
			(character >= 'a' && character <= 'z') ||
			(character >= '0' && character <= '9') ||
			character === '.' ||
			character === '-'
		)
			normalized += character;
	return normalized;
};

const containsEvery = (text: string, fragments: readonly string[]): boolean =>
	fragments.every((fragment) => text.includes(fragment));

const mitContent = [
	'permission is hereby granted, free of charge, to any person obtaining a copy',
	'to deal in the software without restriction',
	'subject to the following conditions',
	'the above copyright notice and this permission notice shall be included',
	'the software is provided "as is", without warranty of any kind',
	'in no event shall the authors or copyright holders be liable',
] as const;

const apacheContent = [
	'terms and conditions for use, reproduction, and distribution',
	'grant of copyright license',
	'grant of patent license',
	'redistribution',
	'submission of contributions',
	'trademarks',
	'disclaimer of warranty',
	'limitation of liability',
	'end of terms and conditions',
] as const;

export function qualifyPermissiveLicense(
	text: string,
	spdxExpression?: string,
): PermissiveLicenseQualification | null {
	const normalized = normalizeText(text);
	const mit = containsEvery(normalized, mitContent);
	const apache = containsEvery(normalized, apacheContent);
	if (mit === apache) return null;

	const spdx = spdxExpression === undefined ? null : normalizeIdentifier(spdxExpression);
	if (mit) {
		const spdxMatch = spdx === 'mit';
		const titleMatch =
			normalized.includes('mit license') || normalized.includes('mit expat license');
		if (!spdxMatch && !titleMatch) return null;
		if (spdx !== null && !spdxMatch) return null;
		return {
			family: 'MIT',
			method: 'content-semantic',
			corroboration: spdxMatch ? 'spdx' : 'title',
			legalCertification: false,
		};
	}

	const spdxMatch = spdx === 'apache-2.0';
	const titleMatch =
		normalized.includes('apache license') && normalized.includes('version 2.0, january 2004');
	if (!spdxMatch && !titleMatch) return null;
	if (spdx !== null && !spdxMatch) return null;
	return {
		family: 'Apache-2.0',
		method: 'content-semantic',
		corroboration: spdxMatch ? 'spdx' : 'title',
		legalCertification: false,
	};
}
