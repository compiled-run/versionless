import { createHash } from 'node:crypto';
import { anyOf, createRegExp, exactly } from 'magic-regexp';
import * as path from 'pathe';
import { analyze } from 'yuku-analyzer';
import { PHONE_DETAIL_LEXICAL_TARGET_SHA256 } from './phone-detail-lexical-this.ts';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const PHONE_ROUTE_RESOLVE_SOURCE_SHA256 = {
	appConfig: 'c228269232fac2dc4b5325b46697196a70d4c03bef91dc36ee9f3275ad0f73d7',
	phoneList: 'f51f2eb9e7b29a1233bc8f6663b67c82f48d8143bc2126cce0f4c5e04df27b92',
	phoneDetail: '0a14b1e0dfecf3bdbc77259a8199974b2d34b0a178943d0f920d10541a25ebb0',
} as const;
export const PHONE_ROUTE_RESOLVE_TARGET_SHA256 = {
	appConfig: '26cd79608f8fb99fef48fc4bcdb6f737e4c67626d1893797221128373217ca3e',
	phoneList: '56f2bde102867cfff70ea2e969dbfe89c2ff191345ebe9964ae84ac983951a6d',
	phoneDetail: '14a6491146c24e28d02dd78891fea66132668e56267a55c46bfff6272e53fa4a',
} as const;

const filePaths = {
	appConfig: 'app/app.config.js',
	phoneList: 'app/phone-list/phone-list.component.js',
	phoneDetail: 'app/phone-detail/phone-detail.component.js',
} as const;

const routeResolveEvidence = createRegExp(
	anyOf(exactly("phones: ['Phone'"), exactly("phone: ['$route', 'Phone'")),
);
const componentFetchEvidence = createRegExp(anyOf(exactly('Phone.query()'), exactly('Phone.get(')));

const replacements = {
	appConfig: [
		[
			"          template: '<phone-list></phone-list>'",
			`          template: '<phone-list phones="$resolve.phones"></phone-list>',
          resolve: {
            phones: ['Phone', function resolvePhones(Phone) {
              return Phone.query().$promise;
            }]
          }`,
		],
		[
			"          template: '<phone-detail></phone-detail>'",
			`          template: '<phone-detail phone="$resolve.phone"></phone-detail>',
          resolve: {
            phone: ['$route', 'Phone', function resolvePhone($route, Phone) {
              return Phone.get({phoneId: $route.current.params.phoneId}).$promise;
            }]
          }`,
		],
	],
	phoneList: [
		[
			`    templateUrl: 'phone-list/phone-list.template.html',
    controller: ['Phone',
      function PhoneListController(Phone) {
        this.phones = Phone.query();
        this.orderProp = 'age';
      }
    ]`,
			`    templateUrl: 'phone-list/phone-list.template.html',
    bindings: {
      phones: '<'
    },
    controller: function PhoneListController() {
      this.orderProp = 'age';
    }`,
		],
	],
	phoneDetail: [
		[
			`    templateUrl: 'phone-detail/phone-detail.template.html',
    controller: ['$routeParams', 'Phone',
      function PhoneDetailController($routeParams, Phone) {
        var self = this;
        self.phone = Phone.get({phoneId: $routeParams.phoneId}, function(phone) {
          self.setImage(phone.images[0]);
        });

        self.setImage = function setImage(imageUrl) {
          self.mainImageUrl = imageUrl;
        };
      }
    ]`,
			`    templateUrl: 'phone-detail/phone-detail.template.html',
    bindings: {
      phone: '<'
    },
    controller: function PhoneDetailController() {
      this.$onInit = () => {
        this.setImage(this.phone.images[0]);
      };

      this.setImage = (imageUrl) => {
        this.mainImageUrl = imageUrl;
      };
    }`,
		],
	],
} as const;

const lexicalPhoneDetailReplacement = [
	[
		`    templateUrl: 'phone-detail/phone-detail.template.html',
    controller: ['$routeParams', 'Phone',
      function PhoneDetailController($routeParams, Phone) {
        this.phone = Phone.get({phoneId: $routeParams.phoneId}, (phone) => {
          this.setImage(phone.images[0]);
        });

        this.setImage = (imageUrl) => {
          this.mainImageUrl = imageUrl;
        };
      }
    ]`,
		replacements.phoneDetail[0][1],
	],
] as const;

export interface PhoneRouteResolveSources {
	appConfig: string;
	phoneList: string;
	phoneDetail: string;
}

type SourceKey = keyof PhoneRouteResolveSources;

function assertExact(source: string, needle: string, label: string): void {
	const start = source.indexOf(needle);
	if (start < 0 || source.indexOf(needle, start + 1) >= 0)
		throw new Error(`Refused: ${label} missing or ambiguous`);
}

function analyzeSource(source: string, key: SourceKey, state: string): void {
	const module = analyze(source, { lang: 'js', path: path.normalize(filePaths[key]) });
	if (module.diagnostics.length)
		throw new Error(
			`Refused: ${state} Yuku diagnostics: ${JSON.stringify(module.diagnostics)}`,
		);
}

function applyReplacements(source: string, key: SourceKey) {
	let code = source;
	const edits: Array<{
		start: number;
		end: number;
		beforeSha256: string;
		afterSha256: string;
	}> = [];
	const selected =
		key === 'phoneDetail' && sha256(source) === PHONE_DETAIL_LEXICAL_TARGET_SHA256
			? lexicalPhoneDetailReplacement
			: replacements[key];
	for (const [before, after] of selected) {
		assertExact(code, before, `${filePaths[key]} transform span`);
		const start = code.indexOf(before);
		edits.push({
			start,
			end: start + before.length,
			beforeSha256: sha256(before),
			afterSha256: sha256(after),
		});
		code = `${code.slice(0, start)}${after}${code.slice(start + before.length)}`;
	}
	return { code, edits };
}

function expectedTargets(sources: PhoneRouteResolveSources): PhoneRouteResolveSources {
	return {
		appConfig: applyReplacements(sources.appConfig, 'appConfig').code,
		phoneList: applyReplacements(sources.phoneList, 'phoneList').code,
		phoneDetail: applyReplacements(sources.phoneDetail, 'phoneDetail').code,
	};
}

export function transformPhoneRouteResolve(
	sources: PhoneRouteResolveSources,
	options: { expectedSha256?: Partial<Record<SourceKey, string>> } = {},
) {
	const actualHashes = {
		appConfig: sha256(sources.appConfig),
		phoneList: sha256(sources.phoneList),
		phoneDetail: sha256(sources.phoneDetail),
	};
	const expectedHashes = { ...PHONE_ROUTE_RESOLVE_SOURCE_SHA256, ...options.expectedSha256 };
	const alreadyTransformed = (Object.keys(filePaths) as SourceKey[]).every(
		(key) => actualHashes[key] === PHONE_ROUTE_RESOLVE_TARGET_SHA256[key],
	);
	if (alreadyTransformed) {
		for (const key of Object.keys(filePaths) as SourceKey[])
			analyzeSource(sources[key], key, 'idempotent target');
		return {
			files: (Object.keys(filePaths) as SourceKey[]).map((key) => ({
				key,
				path: filePaths[key],
				code: sources[key],
				sourceSha256: actualHashes[key],
				targetSha256: actualHashes[key],
				edits: [],
			})),
			code: sources,
			semanticEngine: {
				parser: 'yuku-parser@0.7.0',
				analyzer: 'yuku-analyzer@0.7.0',
				diagnostics: 0,
			},
			preconditions: ['already transformed exact target hashes'],
			idempotent: true,
		};
	}
	const lexicalIntermediate =
		actualHashes.appConfig === expectedHashes.appConfig &&
		actualHashes.phoneList === expectedHashes.phoneList &&
		actualHashes.phoneDetail === PHONE_DETAIL_LEXICAL_TARGET_SHA256;
	for (const key of Object.keys(filePaths) as SourceKey[])
		if (
			actualHashes[key] !== expectedHashes[key] &&
			!(key === 'phoneDetail' && lexicalIntermediate)
		)
			throw new Error(`Refused: ${filePaths[key]} SHA-256 mismatch`);
	for (const key of Object.keys(filePaths) as SourceKey[])
		analyzeSource(sources[key], key, 'source');

	const transformed = expectedTargets(sources);
	const files = (Object.keys(filePaths) as SourceKey[]).map((key) => {
		const { edits } = applyReplacements(sources[key], key);
		analyzeSource(transformed[key], key, 'transformed');
		return {
			key,
			path: filePaths[key],
			code: transformed[key],
			sourceSha256: actualHashes[key],
			targetSha256: sha256(transformed[key]),
			edits,
		};
	});
	if (!routeResolveEvidence.test(transformed.appConfig))
		throw new Error('Refused: route resolve evidence missing');
	if (
		componentFetchEvidence.test(transformed.phoneList) ||
		componentFetchEvidence.test(transformed.phoneDetail)
	)
		throw new Error('Refused: component data acquisition remains');
	for (const [code, binding] of [
		[transformed.phoneList, "phones: '<'"],
		[transformed.phoneDetail, "phone: '<'"],
	] as const)
		assertExact(code, binding, 'one-way component binding');
	assertExact(transformed.phoneDetail, 'this.$onInit = () => {', 'detail lifecycle');
	return {
		files,
		code: transformed,
		semanticEngine: {
			parser: 'yuku-parser@0.7.0',
			analyzer: 'yuku-analyzer@0.7.0',
			diagnostics: 0,
		},
		preconditions: [
			'exact list and detail route templates',
			'exact Phone.query list controller',
			lexicalIntermediate
				? 'exact lexical-this PhoneDetail intermediate'
				: 'exact $routeParams/Phone detail controller',
			'frozen local Phone resource service',
		],
		idempotent: false,
	};
}
