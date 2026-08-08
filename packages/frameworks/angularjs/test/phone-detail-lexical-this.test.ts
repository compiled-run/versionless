import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import {
	PHONE_DETAIL_LEXICAL_TARGET_SHA256,
	PHONE_DETAIL_ROUTE_TARGET_SHA256,
	transformPhoneDetailLexicalThis,
} from '../src/phone-detail-lexical-this.ts';

const source = `'use strict';

// Register \`phoneDetail\` component, along with its associated controller and template
angular.
  module('phoneDetail').
  component('phoneDetail', {
    templateUrl: 'phone-detail/phone-detail.template.html',
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
    ]
  });
`;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

describe('PhoneDetail lexical-this transform', () => {
	test('uses three deterministic spans and preserves the constructable controller', () => {
		const result = transformPhoneDetailLexicalThis(source);
		expect(result.edits).toHaveLength(3);
		expect(result.code).toContain('function PhoneDetailController($routeParams, Phone)');
		expect(result.code).toContain('this.phone = Phone.get');
		expect(result.code).toContain('(phone) =>');
		expect(result.code).toContain('this.setImage = (imageUrl) =>');
		expect(result.code).not.toContain('self');
		expect(transformPhoneDetailLexicalThis(source).targetSha256).toBe(result.targetSha256);
		expect(result.targetSha256).toBe(PHONE_DETAIL_LEXICAL_TARGET_SHA256);
	});

	test('refuses changed callback and source shapes', () => {
		expect(() => transformPhoneDetailLexicalThis(`${source}\n`)).toThrow('SHA-256 mismatch');
		const changed = source.replace('function(phone)', '(phone) =>');
		expect(() =>
			transformPhoneDetailLexicalThis(changed, { expectedSha256: hash(changed) }),
		).toThrow('Phone.get callback');
	});

	test('accepts only the exact route-resolve final shape as a composed lexical target', () => {
		const routeTarget = source.replace(
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
		);
		expect(hash(routeTarget)).toBe(PHONE_DETAIL_ROUTE_TARGET_SHA256);
		const result = transformPhoneDetailLexicalThis(routeTarget);
		expect(result.idempotent).toBe(true);
		expect(result.edits).toEqual([]);
		expect(result.code).toBe(routeTarget);
	});
});
