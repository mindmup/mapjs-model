/*global module, require */
const _ = require('underscore');
module.exports = function contentUpgrade(content) {
	'use strict';
	const upgradeV2 = function () {
			const doUpgrade = function (idea) {
				let collapsed;
				if (idea.style) {
					idea.attr = {};
					collapsed = idea.style.collapsed;
					delete idea.style.collapsed;
					idea.attr.style = idea.style;
					if (collapsed) {
						idea.attr.collapsed = collapsed;
					}
					delete idea.style;
				}
				if (idea.ideas) {
					_.each(idea.ideas, doUpgrade);
				}
			};
			if (content.formatVersion && content.formatVersion >= 2) {
				return;
			}
			doUpgrade(content);
			content.formatVersion = 2;
		},
		upgradeV3 = function () {
			const doUpgrade = function () {
				const rootAttrKeys = ['theme', 'measurements-config', 'storyboards', 'progress-statuses'],
					oldRootAttr = (content && content.attr) || {},
					newRootAttr = _.pick(oldRootAttr, rootAttrKeys),
					newRootNodeAttr = _.omit(oldRootAttr, rootAttrKeys),
					firstLevel = (content && content.ideas),
					newRoot = {
						id: content.id,
						title: content.title,
						attr: newRootNodeAttr
					};
				if (firstLevel) {
					newRoot.ideas = firstLevel;
				}
				content.id = 'root';
				content.ideas = {
					1: newRoot
				};
				delete content.title;
				content.attr = newRootAttr;
			};
			if (content.formatVersion && content.formatVersion >= 3) {
				return;
			}
			doUpgrade();
			content.formatVersion = 3;
		};

	upgradeV2();
	upgradeV3();
	return content;
};
