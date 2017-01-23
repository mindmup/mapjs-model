/*global module, require*/
const urlHelper = require('./url-helper');
module.exports = function (nodeTitle, maxUrlLength) {
	'use strict';
	const strippedTitle = nodeTitle && urlHelper.stripLink(nodeTitle);
	if (!nodeTitle) {
		return '';
	}
	if (strippedTitle.trim() === '') {
		return (!maxUrlLength || (nodeTitle.length < maxUrlLength) ? nodeTitle : (nodeTitle.substring(0, maxUrlLength) + '...'));
	}  else {
		return strippedTitle;
	}
};

