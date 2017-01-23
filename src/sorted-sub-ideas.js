/*global module */
const positive = function positive(key) {
		'use strict';
		return key >= 0;
	},
	negative = function negative(key) {
		'use strict';
		return !positive(key);
	},
	absCompare = function (a, b) {
		'use strict';
		return Math.abs(a) - Math.abs(b);
	},
	safeSort = function (contentIdea) {
		'use strict';
		const childKeys = Object.keys(contentIdea.ideas).map(parseFloat),
			sortedChildKeys = childKeys.filter(positive).sort(absCompare).concat(childKeys.filter(negative).sort(absCompare));
		return sortedChildKeys.map(function (key) {
			return contentIdea.ideas[key];
		});
	};
module.exports = function sortedSubIdeas(contentIdea) {
	'use strict';

	if (!contentIdea.ideas) {
		return [];
	}
	return safeSort(contentIdea);
};

