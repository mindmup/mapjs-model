/*global module, require */
var sortedSubIdeas = require('./sorted-sub-ideas');
module.exports = function traverse(contentIdea, iterator, postOrder) {
	'use strict';
	if (!postOrder && (!contentIdea.formatVersion || contentIdea.formatVersion < 3)) {
		iterator(contentIdea);
	}
	sortedSubIdeas(contentIdea).forEach(function (subIdea) {
		traverse(subIdea, iterator, postOrder);
	});
	if (postOrder && (!contentIdea.formatVersion || contentIdea.formatVersion < 3)) {
		iterator(contentIdea);
	}
};

