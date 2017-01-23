/*global module, require */
const sortedSubIdeas = require('./sorted-sub-ideas');
module.exports = function traverse(contentIdea, iterator, postOrder, level) {
	'use strict';
	const isSingleRootMap = !level && (!contentIdea.formatVersion || contentIdea.formatVersion < 3);
	level = level || (isSingleRootMap ? 1 : 0);
	if (!postOrder && (isSingleRootMap || level)) {
		iterator(contentIdea, level);
	}
	sortedSubIdeas(contentIdea).forEach(function (subIdea) {
		traverse(subIdea, iterator, postOrder, level + 1);
	});
	if (postOrder && (isSingleRootMap || level)) {
		iterator(contentIdea, level);
	}
};

