/*global describe, it, expect, require*/
const URLHelper = require('../../../src/core/util/url-helper');
describe('URLHelper', function () {
	'use strict';
	describe('containsURL', function () {
		it('checks if the text contains a URL with protocol or starting with www somewhere', function () {
			expect(URLHelper.containsLink('http://www.google.com')).toBeTruthy();
			expect(URLHelper.containsLink('prefix http://www.google.com suffix')).toBeTruthy();
			expect(URLHelper.containsLink('https://www.google.com')).toBeTruthy();
			expect(URLHelper.containsLink('www.google.com')).toBeTruthy();
			expect(URLHelper.containsLink('abc.google.com')).toBeFalsy();
		});
		it('can work with undefined', function () {
			expect(URLHelper.containsLink(undefined)).toBeFalsy();
		});
	});
	describe('stripLink', function () {
		it('removes the first link and returns the remaining text', function () {
			expect(URLHelper.stripLink('http://www.google.com')).toBe('');
			expect(URLHelper.stripLink('prefix http://www.google.com suffix')).toBe('prefix  suffix');
			expect(URLHelper.stripLink('prefix http://www.google.com')).toBe('prefix');
			expect(URLHelper.stripLink('http://www.google.com suffix')).toBe('suffix');
			expect(URLHelper.stripLink('https://www.google.com')).toBe('');
			expect(URLHelper.stripLink('www.google.com')).toBe('');
			expect(URLHelper.stripLink('abc.google.com')).toBe('abc.google.com');
			expect(URLHelper.stripLink('https://sv.wikipedia.org/wiki/Mjölke_(växt)')).toBe('');
		});
		it('leaves any other links intact', function () {
			expect(URLHelper.stripLink('prefix http://www.google.com suffix http://xkcd.com')).toBe('prefix  suffix http://xkcd.com');
			expect(URLHelper.stripLink('https://sv.wikipedia.org/wiki/Mjölke_(växt) also')).toBe('also');
		});
		it('can work with undefined', function () {
			expect(URLHelper.stripLink(undefined)).toEqual('');
		});
	});
	describe('getLink', function () {
		it('can work with undefined', function () {
			expect(URLHelper.getLink(undefined)).toBeFalsy();
		});
		it('returns the first link, optionally adding http protocol', function () {
			expect(URLHelper.getLink('http://www.google.com')).toBe('http://www.google.com');
			expect(URLHelper.getLink('prefix http://www.google.com suffix')).toBe('http://www.google.com');
			expect(URLHelper.getLink('https://www.google.com')).toBe('https://www.google.com');
			expect(URLHelper.getLink('www.google.com')).toBe('http://www.google.com');
			expect(URLHelper.getLink('abc.google.com')).toBeFalsy();
		});
		it('supports google forum links', function () {
			expect(URLHelper.getLink('https://groups.google.com/forum/#!topic/deltabot/kDagXbWri94')).toBe('https://groups.google.com/forum/#!topic/deltabot/kDagXbWri94');
		});
		it('only retrieves the first link', function () {
			expect(URLHelper.getLink('prefix http://www.google.com suffix http://xkcd.com')).toBe('http://www.google.com');
		});
		it('retrieves the query string part of URL as well', function () {
			expect(URLHelper.getLink('http://www.google.com?abc=def&xkcd=mmm&amp;zeka=peka')).toBe('http://www.google.com?abc=def&xkcd=mmm&amp;zeka=peka');
		});
		it('retrieves the has part of URL as well', function () {
			expect(URLHelper.getLink('http://www.google.com#abcdef')).toBe('http://www.google.com#abcdef');
		});
		it('supports swedish letters', function () {
			expect(URLHelper.getLink('https://sv.wikipedia.org/wiki/Mjölke_(växt)')).toBe('https://sv.wikipedia.org/wiki/Mjölke_(växt)');
		});
	});
});
