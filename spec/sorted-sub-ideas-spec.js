/*global describe, it, expect, require */
var sortedSubIdeas = require('../src/sorted-sub-ideas');
describe('sortedSubIdeas', function () {
	'use strict';
	it('sorts children by key, positive first then negative, by absolute value', function () {
		var content = {id: 1, title: 'root', ideas: {'-100': {title: '-100'}, '-1': {title: '-1'}, '1': {title: '1'}, '100': {title: '100'}}},
			result = sortedSubIdeas(content).map(function (subidea) {
				return subidea.title;
			});
		expect(result).toEqual(['1', '100', '-1', '-100']);
	});
});

