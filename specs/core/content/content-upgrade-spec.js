/*global describe,  expect, it, require*/
const contentUpgrade = require('../../../src/core/content/content-upgrade');
describe('content upgrade', function () {
	'use strict';
	describe('upgrade to v3', function () {
		it ('should do nothing if already v3', function () {
			const content = {
				formatVersion: 3,
				id: 'original',
				attr: {
					style: 'red'
				}
			};
			contentUpgrade(content);
			expect(content).toEqual({
				formatVersion: 3,
				id: 'original',
				attr: {
					style: 'red'
				}
			});
		});
		it('should upgrade version number', function () {
			const content = {};
			contentUpgrade(content);
			expect(content.formatVersion).toEqual(3);
		});
		it('should add an parent idea above the root idea', function () {
			const content = {id: 1, title: 'hello'};
			contentUpgrade(content);
			expect(content.ideas).toEqual({
				1: {id: 1, title: 'hello', attr: {}}
			});
		});
		it('should change the root node to have id of "root"', function () {
			const content = {id: 1, title: 'hello'};
			contentUpgrade(content);
			expect(content.id).toEqual('root');
		});
		it('should remove the title from the idea root', function () {
			const content = {id: 1, title: 'hello'};
			contentUpgrade(content);
			expect(content.title).toBeFalsy();
		});
		it('should preserve root attributes on root', function () {
			const content = {id: 1, title: 'hello', attr: {theme: 'foo', 'measurements-config': 'bar', storyboards: 'foobar', someother: 'foo'}};
			contentUpgrade(content);
			expect(content.attr).toEqual({theme: 'foo', 'measurements-config': 'bar', storyboards: 'foobar'});
		});
		it('should move non root attributes to new sub idea', function () {
			const content = {id: 1, title: 'hello', attr: {theme: 'foo', 'measurements-config': 'bar', storyboards: 'foobar', someother: 'foo'}};
			contentUpgrade(content);
			expect(content.ideas[1].attr).toEqual({someother: 'foo'});
		});
		it('should move the root idea subnodes, preserving rank', function () {
			const content = {
				id: 1,
				title: 'hello',
				ideas: {
					'-1': {id: 2, title: 'sub1'},
					2: {id: 3, title: 'sub2'}
				}
			};
			contentUpgrade(content);
			expect(content.ideas[1].ideas).toEqual({
				'-1': {id: 2, title: 'sub1'},
				2: {id: 3, title: 'sub2'}
			});
		});
	});
});
