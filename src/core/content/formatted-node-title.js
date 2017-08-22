/*global module, require*/
const urlHelper = require('../util/url-helper'),
	removeLinks = function (nodeTitle, maxUrlLength) {
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
	},
	removeExtraSpaces = function (nodeTitle) {
		'use strict';
		return nodeTitle.replace(/[ \t]+/g, ' ');
	},
	trimLines = function (nodeTitle) {
		'use strict';
		return nodeTitle.replace(/\r/g, '').split('\n').map(line => line.trim()).join('\n');
	};
module.exports = function (nodeTitle, maxUrlLength) {
	'use strict';
	return trimLines(removeExtraSpaces(removeLinks(nodeTitle, maxUrlLength)));
};

