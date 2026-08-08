import { createHash } from 'node:crypto';
import { anyOf, createRegExp, exactly, whitespace, wordBoundary } from 'magic-regexp';
import { analyze } from 'yuku-analyzer';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const selfBinding = createRegExp(wordBoundary, exactly('self'), wordBoundary);
const legacyCallback = createRegExp(
	anyOf(exactly('function').and(whitespace.times.any(), '(phone)'), exactly('function setImage')),
);

export const PHONE_DETAIL_SOURCE_SHA256 =
	'0a14b1e0dfecf3bdbc77259a8199974b2d34b0a178943d0f920d10541a25ebb0';
export const PHONE_DETAIL_LEXICAL_TARGET_SHA256 =
	'96cf123fce3709928d6edf70f1199aca1ee24c5adfaf65a737573baa548f1865';
export const PHONE_DETAIL_ROUTE_TARGET_SHA256 =
	'14a6491146c24e28d02dd78891fea66132668e56267a55c46bfff6272e53fa4a';

const replacements: ReadonlyArray<readonly [string, string]> = [
	['        var self = this;\n', ''],
	[
		'        self.phone = Phone.get({phoneId: $routeParams.phoneId}, function(phone) {\n          self.setImage(phone.images[0]);\n        });',
		'        this.phone = Phone.get({phoneId: $routeParams.phoneId}, (phone) => {\n          this.setImage(phone.images[0]);\n        });',
	],
	[
		'        self.setImage = function setImage(imageUrl) {\n          self.mainImageUrl = imageUrl;\n        };',
		'        this.setImage = (imageUrl) => {\n          this.mainImageUrl = imageUrl;\n        };',
	],
];

function assertExact(source: string, needle: string, label: string): void {
	const start = source.indexOf(needle);
	if (start < 0 || source.indexOf(needle, start + 1) >= 0)
		throw new Error(`Refused: ${label} missing or ambiguous`);
}

export function transformPhoneDetailLexicalThis(
	source: string,
	options: { expectedSha256?: string } = {},
) {
	const sourceSha256 = sha256(source);
	if (sourceSha256 === PHONE_DETAIL_ROUTE_TARGET_SHA256 && !options.expectedSha256) {
		const module = analyze(source, {
			lang: 'js',
			path: 'app/phone-detail/phone-detail.component.js',
		});
		if (module.diagnostics.length)
			throw new Error(
				`Refused: composed Yuku diagnostics: ${JSON.stringify(module.diagnostics)}`,
			);
		assertExact(
			source,
			'controller: function PhoneDetailController() {',
			'composed controller',
		);
		assertExact(source, 'this.$onInit = () => {', 'composed lexical lifecycle');
		assertExact(source, 'this.setImage = (imageUrl) => {', 'composed lexical setImage');
		assertExact(source, 'this.setImage(this.phone.images[0]);', 'composed initial image');
		return {
			code: source,
			sourceSha256,
			targetSha256: sourceSha256,
			semanticEngine: {
				parser: 'yuku-parser@0.7.0',
				analyzer: 'yuku-analyzer@0.7.0',
				diagnostics: 0,
			},
			preconditions: [
				'exact route-resolve PhoneDetail target hash',
				'exact constructable PhoneDetailController',
				'exact lexical $onInit callback',
				'exact lexical setImage callback',
			],
			edits: [],
			idempotent: true,
		};
	}
	if (sourceSha256 !== (options.expectedSha256 ?? PHONE_DETAIL_SOURCE_SHA256))
		throw new Error('Refused: PhoneDetail source SHA-256 mismatch');
	const module = analyze(source, {
		lang: 'js',
		path: 'app/phone-detail/phone-detail.component.js',
	});
	if (module.diagnostics.length)
		throw new Error(`Refused: Yuku diagnostics: ${JSON.stringify(module.diagnostics)}`);
	assertExact(
		source,
		"controller: ['$routeParams', 'Phone',\n      function PhoneDetailController($routeParams, Phone) {",
		'constructable PhoneDetail controller and injection annotation',
	);
	assertExact(
		source,
		'Phone.get({phoneId: $routeParams.phoneId}, function(phone)',
		'Phone.get callback',
	);
	assertExact(source, 'function setImage(imageUrl)', 'setImage callback');
	assertExact(source, 'var self = this;', 'self alias');

	let code = source;
	const edits: Array<{ start: number; end: number; beforeSha256: string; afterSha256: string }> =
		[];
	for (const [before, after] of replacements) {
		assertExact(code, before, 'exact transform span');
		const start = code.indexOf(before);
		edits.push({
			start,
			end: start + before.length,
			beforeSha256: sha256(before),
			afterSha256: sha256(after),
		});
		code = `${code.slice(0, start)}${after}${code.slice(start + before.length)}`;
	}
	const target = analyze(code, {
		lang: 'js',
		path: 'app/phone-detail/phone-detail.component.js',
	});
	if (target.diagnostics.length)
		throw new Error(
			`Refused: transformed Yuku diagnostics: ${JSON.stringify(target.diagnostics)}`,
		);
	if (selfBinding.test(code) || legacyCallback.test(code))
		throw new Error('Refused: legacy callback or self alias remains');
	assertExact(
		code,
		"controller: ['$routeParams', 'Phone',\n      function PhoneDetailController($routeParams, Phone) {",
		'preserved constructable controller and injection annotation',
	);
	return {
		code,
		sourceSha256,
		targetSha256: sha256(code),
		semanticEngine: {
			parser: 'yuku-parser@0.7.0',
			analyzer: 'yuku-analyzer@0.7.0',
			diagnostics: 0,
		},
		preconditions: [
			'constructable named PhoneDetailController',
			'unchanged $routeParams and Phone injection annotation',
			'exact self alias',
			'exact Phone.get regular callback',
			'exact named setImage regular callback',
		],
		edits,
		idempotent: false,
	};
}
