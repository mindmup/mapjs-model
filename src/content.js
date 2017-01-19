/*jshint loopfunc:true */
/*global module, require*/
var _ = require('underscore'),
	observable = require('./observable'),
	contentUpgrade = require('./content-upgrade');
module.exports = function content(contentAggregate, sessionKey) {
	'use strict';
	var cachedId,
		invalidateIdCache = function () {
			cachedId = undefined;
		},
		maxId = function maxId(idea) {
			idea = idea || contentAggregate;
			if (!idea.ideas) {
				return parseInt(idea.id, 10) || 0;
			}
			return _.reduce(
				idea.ideas,
				function (result, subidea) {
					return Math.max(result, maxId(subidea));
				},
				parseInt(idea.id, 10) || 0
			);
		},
		nextId = function nextId(originSession) {
			originSession = originSession || sessionKey;
			if (!cachedId) {
				cachedId =  maxId();
			}
			cachedId += 1;
			if (originSession) {
				return cachedId + '.' + originSession;
			}
			return cachedId;
		},
		init = function (contentIdea, originSession) {
			var initOfRoot = contentIdea.id === contentAggregate.id;
			if (!contentIdea.id) {
				contentIdea.id = nextId(originSession);
			} else {
				invalidateIdCache();
			}
			if (contentIdea.ideas) {
				_.each(contentIdea.ideas, function (value, key) {
					if (!initOfRoot && value.attr && value.attr.group && _.isEmpty(value.ideas)) {
						delete contentIdea.ideas[key];
					} else {
						contentIdea.ideas[parseFloat(key)] = init(value, originSession);
					}

				});
			}
			if (!contentIdea.title) {
				contentIdea.title = '';
			}
			contentIdea.containsDirectChild = contentIdea.findChildRankById = function (childIdeaId) {
				return parseFloat(
					_.reduce(
						contentIdea.ideas,
						function (res, value, key) {
							return value.id == childIdeaId ? key : res;
						},
						undefined
					)
				);
			};
			contentIdea.findSubIdeaById = function (childIdeaId) {
				var myChild = _.find(contentIdea.ideas, function (idea) {
					return idea.id == childIdeaId;
				});
				return myChild || _.reduce(contentIdea.ideas, function (result, idea) {
					return result || idea.findSubIdeaById(childIdeaId);
				}, undefined);
			};
			contentIdea.isEmptyGroup = function () {
				return !contentAggregate.isRootNode(contentIdea.id) && contentIdea.attr && contentIdea.attr.group && _.isEmpty(contentIdea.ideas);
			};
			contentIdea.find = function (predicate) {
				var current = predicate(contentIdea) ? [_.pick(contentIdea, 'id', 'title')] : [];
				if (_.size(contentIdea.ideas) === 0) {
					return current;
				}
				return _.reduce(contentIdea.ideas, function (result, idea) {
					return _.union(result, idea.find(predicate));
				}, current);
			};
			contentIdea.getAttr = function (name) {
				if (contentIdea.attr && contentIdea.attr[name]) {
					return _.clone(contentIdea.attr[name]);
				}
				return false;
			};
			contentIdea.sortedSubIdeas = function () {
				var result = [],
					childKeys,
					sortedChildKeys;
				if (!contentIdea.ideas) {
					return [];
				}
				childKeys = _.groupBy(_.map(_.keys(contentIdea.ideas), parseFloat), function (key) {
					return key > 0;
				});
				sortedChildKeys = _.sortBy(childKeys[true], Math.abs).concat(_.sortBy(childKeys[false], Math.abs));
				_.each(sortedChildKeys, function (key) {
					result.push(contentIdea.ideas[key]);
				});
				return result;
			};
			contentIdea.traverse = function (iterator, postOrder) {
				if (!postOrder && contentIdea !== contentAggregate) {
					iterator(contentIdea);
				}
				_.each(contentIdea.sortedSubIdeas(), function (subIdea) {
					subIdea.traverse(iterator, postOrder);
				});
				if (postOrder && contentIdea !== contentAggregate) {
					iterator(contentIdea);
				}
			};
			return contentIdea;
		},
		maxKey = function (kvMap, sign) {
			var currentKeys;
			sign = sign || 1;
			if (_.size(kvMap) === 0) {
				return 0;
			}
			currentKeys = _.keys(kvMap);
			currentKeys.push(0); /* ensure at least 0 is there for negative ranks */
			return _.max(_.map(currentKeys, parseFloat), function (x) {
				return x * sign;
			});
		},
		isRootNode = function (id) {
			return !!_.find(contentAggregate.ideas, function (idea) {
				return idea.id === id;
			});
		},
		nextChildRank = function (parentIdea) {
			var newRank, counts, childRankSign = 1;
			if (isRootNode(parentIdea.id) && contentAggregate.getAttr('rootChildRanks') !== 'sequential') {
				counts = _.countBy(parentIdea.ideas, function (v, k) {
					return k < 0;
				});
				if ((counts['true'] || 0) < counts['false']) {
					childRankSign = -1;
				}
			}
			newRank = maxKey(parentIdea.ideas, childRankSign) + childRankSign;
			return newRank;
		},
		appendSubIdea = function (parentIdea, subIdea) {
			var rank;
			parentIdea.ideas = parentIdea.ideas || {};
			rank = nextChildRank(parentIdea);
			parentIdea.ideas[rank] = subIdea;
			return rank;
		},
		findIdeaById = function (ideaId) {
			return contentAggregate.id == ideaId ? contentAggregate : contentAggregate.findSubIdeaById(ideaId);
		},
		sameSideSiblingRanks = function (parentIdea, ideaRank) {
			return _(_.map(_.keys(parentIdea.ideas), parseFloat)).reject(function (k) {
				return k * ideaRank < 0;
			});
		},
		sign = function (number) {
			/* intentionally not returning 0 case, to help with split sorting into 2 groups */
			return number < 0 ? -1 : 1;
		},
		eventStacks = {},
		redoStacks = {},
		isRedoInProgress = false,
		batches = {},
		notifyChange = function (method, args, originSession) {
			if (originSession) {
				contentAggregate.dispatchEvent('changed', method, args, originSession);
			} else {
				contentAggregate.dispatchEvent('changed', method, args);
			}
		},
		appendChange = function (method, args, undofunc, originSession) {
			var prev;
			if (method === 'batch' || batches[originSession] || !eventStacks || !eventStacks[originSession] || eventStacks[originSession].length === 0) {
				logChange(method, args, undofunc, originSession);
				return;
			} else {
				prev = eventStacks[originSession].pop();
				if (prev.eventMethod === 'batch') {
					eventStacks[originSession].push({
						eventMethod: 'batch',
						eventArgs: prev.eventArgs.concat([[method].concat(args)]),
						undoFunction: function () {
							undofunc();
							prev.undoFunction();
						}
					});
				} else {
					eventStacks[originSession].push({
						eventMethod: 'batch',
						eventArgs: [[prev.eventMethod].concat(prev.eventArgs)].concat([[method].concat(args)]),
						undoFunction: function () {
							undofunc();
							prev.undoFunction();
						}
					});
				}
			}
			if (isRedoInProgress) {
				contentAggregate.dispatchEvent('changed', 'redo', undefined, originSession);
			} else {
				notifyChange(method, args, originSession);
				redoStacks[originSession] = [];
			}
		},
		logChange = function (method, args, undofunc, originSession) {
			var event = {eventMethod: method, eventArgs: args, undoFunction: undofunc};
			if (batches[originSession]) {
				batches[originSession].push(event);
				return;
			}
			if (!eventStacks[originSession]) {
				eventStacks[originSession] = [];
			}
			eventStacks[originSession].push(event);

			if (isRedoInProgress) {
				contentAggregate.dispatchEvent('changed', 'redo', undefined, originSession);
			} else {
				notifyChange(method, args, originSession);
				redoStacks[originSession] = [];
			}
		},
		reorderChild = function (parentIdea, newRank, oldRank) {
			var undoFunction = function () {
				if (parentIdea.ideas[oldRank] || !parentIdea.ideas[newRank]) {
					return false;
				}
				parentIdea.ideas[oldRank] = parentIdea.ideas[newRank];
				delete parentIdea.ideas[newRank];
			};
			parentIdea.ideas[newRank] = parentIdea.ideas[oldRank];
			delete parentIdea.ideas[oldRank];
			return undoFunction;
		},
		sessionFromId = function (id) {
			var dotIndex = String(id).indexOf('.');
			return dotIndex > 0 && id.substr(dotIndex + 1);
		},
		commandProcessors = {},
		configuration = {},
		uniqueResourcePostfix = '/xxxxxxxx-yxxx-yxxx-yxxx-xxxxxxxxxxxx/'.replace(/[xy]/g, function (c) {
			/*jshint bitwise: false*/
			// jscs:disable
			var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r&0x3|0x8);
			// jscs:enable
			return v.toString(16);
		}) + (sessionKey || ''),
		updateAttr = function (object, attrName, attrValue) {
			var oldAttr;
			if (!object) {
				return false;
			}
			oldAttr = _.extend({}, object.attr);
			object.attr = _.extend({}, object.attr);
			if (!attrValue || attrValue === 'false' || (_.isObject(attrValue) && _.isEmpty(attrValue))) {
				if (!object.attr[attrName]) {
					return false;
				}
				delete object.attr[attrName];
			} else {
				if (_.isEqual(object.attr[attrName], attrValue)) {
					return false;
				}
				object.attr[attrName] = JSON.parse(JSON.stringify(attrValue));
			}
			if (_.size(object.attr) === 0) {
				delete object.attr;
			}
			return function () {
				object.attr = oldAttr;
			};
		};



	contentAggregate.setConfiguration = function (config) {
		configuration = config || {};
	};
	contentAggregate.getSessionKey = function () {
		return sessionKey;
	};
	contentAggregate.nextSiblingId = function (subIdeaId) {
		var parentIdea = contentAggregate.findParent(subIdeaId),
			currentRank,
			candidateSiblingRanks,
			siblingsAfter;
		if (!parentIdea) {
			return false;
		}
		currentRank = parentIdea.findChildRankById(subIdeaId);
		candidateSiblingRanks = sameSideSiblingRanks(parentIdea, currentRank);
		siblingsAfter = _.reject(candidateSiblingRanks, function (k) {
			return Math.abs(k) <= Math.abs(currentRank);
		});
		if (siblingsAfter.length === 0) {
			return false;
		}
		return parentIdea.ideas[_.min(siblingsAfter, Math.abs)].id;
	};
	contentAggregate.sameSideSiblingIds = function (subIdeaId) {
		var parentIdea = contentAggregate.findParent(subIdeaId),
			currentRank = parentIdea.findChildRankById(subIdeaId);
		return _.without(_.map(_.pick(parentIdea.ideas, sameSideSiblingRanks(parentIdea, currentRank)), function (i) {
			return i.id;
		}), subIdeaId);
	};
	contentAggregate.getAttrById = function (ideaId, attrName) {
		var idea = findIdeaById(ideaId);
		return idea && idea.getAttr(attrName);
	};
	contentAggregate.previousSiblingId = function (subIdeaId) {
		var parentIdea = contentAggregate.findParent(subIdeaId),
			currentRank,
			candidateSiblingRanks,
			siblingsBefore;
		if (!parentIdea) {
			return false;
		}
		currentRank = parentIdea.findChildRankById(subIdeaId);
		candidateSiblingRanks = sameSideSiblingRanks(parentIdea, currentRank);
		siblingsBefore = _.reject(candidateSiblingRanks, function (k) {
			return Math.abs(k) >= Math.abs(currentRank);
		});
		if (siblingsBefore.length === 0) {
			return false;
		}
		return parentIdea.ideas[_.max(siblingsBefore, Math.abs)].id;
	};
	contentAggregate.clone = function (subIdeaId) {
		var toClone = (subIdeaId && subIdeaId != contentAggregate.id && contentAggregate.findSubIdeaById(subIdeaId)) || contentAggregate;
		return JSON.parse(JSON.stringify(toClone));
	};
	contentAggregate.cloneMultiple = function (subIdeaIdArray) {
		return _.map(subIdeaIdArray, contentAggregate.clone);
	};
	contentAggregate.calculatePath = function (ideaId, currentPath, potentialParent) {
		if (contentAggregate.isRootNode(ideaId)) {
			return [];
		}
		currentPath = currentPath || [contentAggregate];
		potentialParent = potentialParent || contentAggregate;
		if (potentialParent.containsDirectChild(ideaId)) {
			return currentPath;
		}
		return _.reduce(
			potentialParent.ideas,
			function (result, child) {
				return result || contentAggregate.calculatePath(ideaId, [child].concat(currentPath), child);
			},
			false
		);
	};
	contentAggregate.getSubTreeIds = function (rootIdeaId) {
		var result = [],
			collectIds = function (idea) {
				if (_.isEmpty(idea.ideas)) {
					return [];
				}
				_.each(idea.sortedSubIdeas(), function (child) {
					collectIds(child);
					result.push(child.id);
				});
			};
		collectIds(contentAggregate.findSubIdeaById(rootIdeaId) || contentAggregate);
		return result;
	};
	contentAggregate.findParent = function (subIdeaId, parentIdea) {
		parentIdea = parentIdea || contentAggregate;
		if (contentAggregate.isRootNode(subIdeaId)) {
			return false;
		}
		if (parentIdea.containsDirectChild(subIdeaId)) {
			return parentIdea;
		}
		return _.reduce(
			parentIdea.ideas,
			function (result, child) {
				return result || contentAggregate.findParent(subIdeaId, child);
			},
			false
		);
	};

	/**** aggregate command processing methods ****/
	contentAggregate.isBatchActive = function (originSession) {
		var activeSession = originSession || sessionKey;
		return !!batches[activeSession];
	};
	contentAggregate.startBatch = function (originSession) {
		var activeSession = originSession || sessionKey;
		contentAggregate.endBatch(originSession);
		batches[activeSession] = [];
	};
	contentAggregate.discardBatch = function (originSession) {
		var activeSession = originSession || sessionKey;
		batches[activeSession] = undefined;
	};
	contentAggregate.endBatch = function (originSession) {
		var activeSession = originSession || sessionKey,
			inBatch = batches[activeSession],
			batchArgs,
			batchUndoFunctions,
			undo;
		batches[activeSession] = undefined;
		if (_.isEmpty(inBatch)) {
			return;
		}
		if (_.size(inBatch) === 1) {
			logChange(inBatch[0].eventMethod, inBatch[0].eventArgs, inBatch[0].undoFunction, activeSession);
		} else {
			batchArgs = _.map(inBatch, function (event) {
				return [event.eventMethod].concat(event.eventArgs);
			});
			batchUndoFunctions = _.sortBy(
				_.map(inBatch, function (event) {
					return event.undoFunction;
				}),
				function (f, idx) {
					return -1 * idx;
				}
			);
			undo = function () {
				_.each(batchUndoFunctions, function (eventUndo) {
					eventUndo();
				});
			};
			logChange('batch', batchArgs, undo, activeSession);
		}
	};
	contentAggregate.execCommand = function (cmd, args, originSession) {
		if (!commandProcessors[cmd]) {
			return false;
		}
		return commandProcessors[cmd].apply(contentAggregate, [originSession || sessionKey].concat(_.toArray(args)));
	};

	contentAggregate.batch = function (batchOp) {
		var hasActiveBatch = contentAggregate.isBatchActive(),
			results;
		if (!hasActiveBatch) {
			contentAggregate.startBatch();
		}
		try {
			results = batchOp();
		} catch (e) {
			if (!hasActiveBatch) {
				contentAggregate.discardBatch();
			}
			throw e;
		}
		if (!hasActiveBatch) {
			contentAggregate.endBatch();
		}
		return results;
	};

	commandProcessors.batch = function (originSession) {
		contentAggregate.startBatch(originSession);
		try {
			_.each(_.toArray(arguments).slice(1), function (event) {
				contentAggregate.execCommand(event[0], event.slice(1), originSession);
			});
		}
		finally {
			contentAggregate.endBatch(originSession);
		}
	};
	contentAggregate.pasteMultiple = function (parentIdeaId, jsonArrayToPaste) {
		return contentAggregate.batch(function () {
			return _.map(jsonArrayToPaste, function (json) {
				return contentAggregate.paste(parentIdeaId, json);
			});
		});
	};

	contentAggregate.paste = function (/*parentIdeaId, jsonToPaste, initialId*/) {
		return contentAggregate.execCommand('paste', arguments);
	};
	commandProcessors.paste = function (originSession, parentIdeaId, jsonToPaste, initialId) {
		var pasteParent = (parentIdeaId == contentAggregate.id) ?  contentAggregate : contentAggregate.findSubIdeaById(parentIdeaId),
			cleanUp = function (json) {
				var result =  _.omit(json, 'ideas', 'id', 'attr'), index = 1, childKeys, sortedChildKeys;
				result.attr = _.omit(json.attr, configuration.nonClonedAttributes);
				if (_.isEmpty(result.attr)) {
					delete result.attr;
				}
				if (json.ideas) {
					childKeys = _.groupBy(_.map(_.keys(json.ideas), parseFloat), function (key) {
						return key > 0;
					});
					sortedChildKeys = _.sortBy(childKeys[true], Math.abs).concat(_.sortBy(childKeys[false], Math.abs));
					result.ideas = {};
					_.each(sortedChildKeys, function (key) {
						result.ideas[index++] = cleanUp(json.ideas[key]);
					});
				}
				return result;
			},
			newIdea,
			newRank;
		if (initialId) {
			cachedId = parseInt(initialId, 10) - 1;
		}
		newIdea =  jsonToPaste && (jsonToPaste.title || jsonToPaste.attr) && init(cleanUp(jsonToPaste), sessionFromId(initialId));
		if (!pasteParent || !newIdea) {
			return false;
		}
		newRank = appendSubIdea(pasteParent, newIdea);
		if (initialId) {
			invalidateIdCache();
		}
		updateAttr(newIdea, 'position');
		logChange('paste', [parentIdeaId, jsonToPaste, newIdea.id], function () {
			delete pasteParent.ideas[newRank];
		}, originSession);
		return newIdea.id;
	};
	contentAggregate.flip = function (/*ideaId*/) {
		return contentAggregate.execCommand('flip', arguments);
	};
	commandProcessors.flip = function (originSession, ideaId) {
		var newRank, maxRank,
			parentIdea = contentAggregate.findParent(ideaId),
			undoFunction,
			currentRank = parentIdea && contentAggregate.isRootNode(parentIdea.id) &&  parentIdea.findChildRankById(ideaId);
		if (!currentRank) {
			return false;
		}
		maxRank = maxKey(parentIdea.ideas, -1 * sign(currentRank));
		newRank = maxRank - 10 * sign(currentRank);
		undoFunction = reorderChild(parentIdea, newRank, currentRank);
		logChange('flip', [ideaId], undoFunction, originSession);
		return true;
	};
	contentAggregate.initialiseTitle = function (/*ideaId, title*/) {
		return contentAggregate.execCommand('initialiseTitle', arguments);
	};
	commandProcessors.initialiseTitle = function (originSession, ideaId, title) {
		var idea = findIdeaById(ideaId), originalTitle;
		if (!idea) {
			return false;
		}
		originalTitle = idea.title;
		if (originalTitle == title) {
			return false;
		}
		idea.title = title;
		appendChange('initialiseTitle', [ideaId, title], function () {
			idea.title = originalTitle;
		}, originSession);
		return true;
	};
	contentAggregate.updateTitle = function (/*ideaId, title*/) {
		return contentAggregate.execCommand('updateTitle', arguments);
	};
	commandProcessors.updateTitle = function (originSession, ideaId, title) {
		var idea = findIdeaById(ideaId), originalTitle;
		if (!idea) {
			return false;
		}
		originalTitle = idea.title;
		if (originalTitle == title) {
			return false;
		}
		idea.title = title;
		logChange('updateTitle', [ideaId, title], function () {
			idea.title = originalTitle;
		}, originSession);
		return true;
	};
	contentAggregate.addSubIdea = function (/*parentId, ideaTitle, optionalNewId*/) {
		return contentAggregate.execCommand('addSubIdea', arguments);
	};
	commandProcessors.addSubIdea = function (originSession, parentId, ideaTitle, optionalNewId) {
		var idea, parent = findIdeaById(parentId), newRank;
		if (!parent) {
			return false;
		}
		if (optionalNewId && findIdeaById(optionalNewId)) {
			return false;
		}
		idea = init({
			title: ideaTitle,
			id: optionalNewId
		});
		newRank = appendSubIdea(parent, idea);
		logChange('addSubIdea', [parentId, ideaTitle, idea.id], function () {
			delete parent.ideas[newRank];
		}, originSession);
		return idea.id;
	};
	contentAggregate.removeMultiple = function (subIdeaIdArray) {
		var results;
		contentAggregate.startBatch();
		results = _.map(subIdeaIdArray, contentAggregate.removeSubIdea);
		contentAggregate.endBatch();
		return results;
	};
	contentAggregate.removeSubIdea = function (/*subIdeaId*/) {
		return contentAggregate.execCommand('removeSubIdea', arguments);
	};
	commandProcessors.removeSubIdea = function (originSession, subIdeaId) {
		var parent, oldRank, oldIdea, oldLinks;

		if (contentAggregate.isRootNode(subIdeaId)) {
			if (_.size(contentAggregate.ideas) > 1) {
				parent = contentAggregate;
			}
		} else {
			parent = contentAggregate.findParent(subIdeaId);
		}
		if (!parent) {
			return false;
		}
		oldRank = parent.findChildRankById(subIdeaId);
		oldIdea = parent.ideas[oldRank];
		delete parent.ideas[oldRank];
		oldLinks = contentAggregate.links;
		contentAggregate.links = _.reject(contentAggregate.links, function (link) {
			return link.ideaIdFrom == subIdeaId || link.ideaIdTo == subIdeaId;
		});
		logChange('removeSubIdea', [subIdeaId], function () {
			parent.ideas[oldRank] = oldIdea;
			contentAggregate.links = oldLinks;
		}, originSession);
		return true;
	};
	contentAggregate.insertIntermediateMultiple = function (idArray, ideaOptions) {
		return contentAggregate.batch(function () {
			var newId = contentAggregate.insertIntermediate(idArray[0], ideaOptions && ideaOptions.title);
			if (ideaOptions && ideaOptions.attr) {
				Object.keys(ideaOptions.attr).forEach(function (key) {
					contentAggregate.updateAttr(newId, key, ideaOptions.attr[key]);
				});
			}
			_.each(idArray.slice(1), function (id) {
				contentAggregate.changeParent(id, newId);
			});
			return newId;
		});
	};
	contentAggregate.insertIntermediate = function (/*inFrontOfIdeaId, title, optionalNewId*/) {
		return contentAggregate.execCommand('insertIntermediate', arguments);
	};
	commandProcessors.insertIntermediate = function (originSession, inFrontOfIdeaId, title, optionalNewId) {
		var childRank, oldIdea, newIdea, parentIdea;
		if (contentAggregate.id == inFrontOfIdeaId) {
			return false;
		}
		if (contentAggregate.isRootNode(inFrontOfIdeaId)) {
			parentIdea = contentAggregate;
		} else {
			parentIdea = contentAggregate.findParent(inFrontOfIdeaId);
		}
		if (!parentIdea) {
			return false;
		}
		if (optionalNewId && findIdeaById(optionalNewId)) {
			return false;
		}
		childRank = parentIdea.findChildRankById(inFrontOfIdeaId);
		if (!childRank) {
			return false;
		}
		oldIdea = parentIdea.ideas[childRank];
		newIdea = init({
			title: title,
			id: optionalNewId
		});
		parentIdea.ideas[childRank] = newIdea;
		newIdea.ideas = {
			1: oldIdea
		};
		logChange('insertIntermediate', [inFrontOfIdeaId, title, newIdea.id], function () {
			parentIdea.ideas[childRank] = oldIdea;
		}, originSession);
		return newIdea.id;
	};
	contentAggregate.changeParent = function (/*ideaId, newParentId*/) {
		return contentAggregate.execCommand('changeParent', arguments);
	};
	commandProcessors.changeParent = function (originSession, ideaId, newParentId) {
		var oldParent, oldRank, newRank, idea, oldPosition,
			parent = findIdeaById(newParentId);
		if (ideaId == newParentId) {
			return false;
		}
		if (!parent) {
			return false;
		}
		idea = contentAggregate.findSubIdeaById(ideaId);
		if (!idea) {
			return false;
		}
		if (idea.findSubIdeaById(newParentId)) {
			return false;
		}
		if (parent.containsDirectChild(ideaId)) {
			return false;
		}
		if (contentAggregate.isRootNode(ideaId)) {
			oldParent = contentAggregate;
		} else {
			oldParent = contentAggregate.findParent(ideaId);
		}
		if (!oldParent) {
			return false;
		}
		oldRank = oldParent.findChildRankById(ideaId);
		newRank = appendSubIdea(parent, idea);
		oldPosition = idea.getAttr('position');
		updateAttr(idea, 'position');
		delete oldParent.ideas[oldRank];
		logChange('changeParent', [ideaId, newParentId], function () {
			updateAttr(idea, 'position', oldPosition);
			oldParent.ideas[oldRank] = idea;
			delete parent.ideas[newRank];
		}, originSession);
		return true;
	};
	contentAggregate.mergeAttrProperty = function (ideaId, attrName, attrPropertyName, attrPropertyValue) {
		var val = contentAggregate.getAttrById(ideaId, attrName) || {};
		if (attrPropertyValue) {
			val[attrPropertyName] = attrPropertyValue;
		} else {
			delete val[attrPropertyName];
		}
		if (_.isEmpty(val)) {
			val = false;
		}
		return contentAggregate.updateAttr(ideaId, attrName, val);
	};
	contentAggregate.updateAttr = function (/*ideaId, attrName, attrValue*/) {
		return contentAggregate.execCommand('updateAttr', arguments);
	};
	commandProcessors.updateAttr = function (originSession, ideaId, attrName, attrValue) {
		var idea = findIdeaById(ideaId), undoAction;
		undoAction = updateAttr(idea, attrName, attrValue);
		if (undoAction) {
			logChange('updateAttr', [ideaId, attrName, attrValue], undoAction, originSession);
		}
		return !!undoAction;
	};
	contentAggregate.getOrderedSiblingRanks = function (ideaId, options) {
		var parentIdea = contentAggregate.findParent(ideaId),
			currentRank = parentIdea && parentIdea.findChildRankById(ideaId);
		if (!currentRank) {
			return false;
		}
		if (options && options.ignoreRankSide) {
			return _.sortBy(_.map(_.keys(parentIdea.ideas), parseFloat));
		} else {
			return _.sortBy(sameSideSiblingRanks(parentIdea, currentRank), Math.abs);
		}
	};
	contentAggregate.moveRelative = function (ideaId, relativeMovement, options) {
		var parentIdea = contentAggregate.findParent(ideaId),
			currentRank = parentIdea && parentIdea.findChildRankById(ideaId),
			siblingRanks = contentAggregate.getOrderedSiblingRanks(ideaId, options),
			currentIndex = siblingRanks && siblingRanks.indexOf(currentRank),
			calcNewIndex = function () {
				var calcIndex = currentIndex + (relativeMovement > 0 ? relativeMovement + 1 : relativeMovement);
				if (options && options.ignoreRankSide) {
					if (currentRank < 0) {
						calcIndex = currentIndex + (relativeMovement < 0 ? relativeMovement - 1 : relativeMovement);
						if (siblingRanks[calcIndex] > 0) {
							calcIndex = calcIndex + 1;
						}
					} else if (siblingRanks[calcIndex] < 0) {
						calcIndex = calcIndex - 1;
					}
				}
				return calcIndex;

			},
			/* we call positionBefore, so movement down is actually 2 spaces, not 1 */
			newIndex = calcNewIndex(),
			beforeRank = newIndex >= 0 && siblingRanks && siblingRanks.length && siblingRanks[newIndex],
			beforeSibling = beforeRank && parentIdea && parentIdea.ideas[beforeRank],
			shouldNotPosition = function () {
				if (!parentIdea) {
					return false;
				}
				if (options && options.ignoreRankSide && currentRank < 0) {
					return newIndex	> (siblingRanks.length - 1);
				}
				return (newIndex < 0);
			}, result;
		if (shouldNotPosition()) {
			return false;
		}
		contentAggregate.startBatch();
		//handle reordering on top down maps where moving from positive to negative or vice versa
		if (options && options.ignoreRankSide && beforeRank && beforeSibling && ((beforeRank * currentRank) < 0)) {
			contentAggregate.flip(ideaId);
		}
		result =  contentAggregate.positionBefore(ideaId, beforeSibling && beforeSibling.id, parentIdea);
		contentAggregate.endBatch();
		return result;
	};
	contentAggregate.positionBefore = function (/*ideaId, positionBeforeIdeaId, parentIdea*/) {
		return contentAggregate.execCommand('positionBefore', arguments);
	};
	commandProcessors.positionBefore = function (originSession, ideaId, positionBeforeIdeaId, parentIdea) {
		var newRank, afterRank, siblingRanks, candidateSiblings, beforeRank, maxRank, currentRank, undoFunction;
		parentIdea = parentIdea || contentAggregate.findParent(ideaId);
		if (!parentIdea) {
			return false;
		}
		currentRank = parentIdea.findChildRankById(ideaId);
		if (ideaId == positionBeforeIdeaId) {
			return false;
		}
		newRank = 0;
		if (positionBeforeIdeaId) {
			afterRank = parentIdea.findChildRankById(positionBeforeIdeaId);
			if (!afterRank) {
				return false;
			}
			siblingRanks = sameSideSiblingRanks(parentIdea, afterRank);
			candidateSiblings = _.reject(_.sortBy(siblingRanks, Math.abs), function (k) {
				return Math.abs(k) >= Math.abs(afterRank);
			});
			beforeRank = candidateSiblings.length > 0 ? _.max(candidateSiblings, Math.abs) : 0;
			if (beforeRank == currentRank) {
				return false;
			}
			newRank = beforeRank + (afterRank - beforeRank) / 2;
		} else {
			maxRank = maxKey(parentIdea.ideas, currentRank < 0 ? -1 : 1);
			if (maxRank == currentRank) {
				return false;
			}
			newRank = maxRank + 10 * (currentRank < 0 ? -1 : 1);
		}
		if (newRank == currentRank) {
			return false;
		}
		undoFunction = reorderChild(parentIdea, newRank, currentRank);
		logChange('positionBefore', [ideaId, positionBeforeIdeaId], undoFunction, originSession);
		return true;
	};
	observable(contentAggregate);
	(function () {
		var isLinkValid = function (ideaIdFrom, ideaIdTo) {
			var isParentChild, ideaFrom, ideaTo;
			if (ideaIdFrom === ideaIdTo) {
				return false;
			}
			ideaFrom = findIdeaById(ideaIdFrom);
			if (!ideaFrom) {
				return false;
			}
			ideaTo = findIdeaById(ideaIdTo);
			if (!ideaTo) {
				return false;
			}
			isParentChild = _.find(
				ideaFrom.ideas,
				function (node) {
					return node.id === ideaIdTo;
				}
			) || _.find(
				ideaTo.ideas,
				function (node) {
					return node.id === ideaIdFrom;
				}
			);
			if (isParentChild) {
				return false;
			}
			return true;
		};
		contentAggregate.addLink = function (/*ideaIdFrom, ideaIdTo*/) {
			return contentAggregate.execCommand('addLink', arguments);
		};
		commandProcessors.addLink = function (originSession, ideaIdFrom, ideaIdTo) {
			var alreadyExists, link;
			if (!isLinkValid(ideaIdFrom, ideaIdTo)) {
				return false;
			}
			alreadyExists = _.find(
				contentAggregate.links,
				function (link) {
					return (link.ideaIdFrom === ideaIdFrom && link.ideaIdTo === ideaIdTo) || (link.ideaIdFrom === ideaIdTo && link.ideaIdTo === ideaIdFrom);
				}
			);
			if (alreadyExists) {
				return false;
			}
			contentAggregate.links = contentAggregate.links || [];
			link = {
				ideaIdFrom: ideaIdFrom,
				ideaIdTo: ideaIdTo,
				attr: {
					style: {
						color: '#FF0000',
						lineStyle: 'dashed'
					}
				}
			};
			contentAggregate.links.push(link);
			logChange('addLink', [ideaIdFrom, ideaIdTo], function () {
				contentAggregate.links.pop();
			}, originSession);
			return true;
		};
		contentAggregate.removeLink = function (/*ideaIdOne, ideaIdTwo*/) {
			return contentAggregate.execCommand('removeLink', arguments);
		};
		commandProcessors.removeLink = function (originSession, ideaIdOne, ideaIdTwo) {
			var i = 0, link;

			while (contentAggregate.links && i < contentAggregate.links.length) {
				link = contentAggregate.links[i];
				if (String(link.ideaIdFrom) === String(ideaIdOne) && String(link.ideaIdTo) === String(ideaIdTwo)) {
					contentAggregate.links.splice(i, 1);
					logChange('removeLink', [ideaIdOne, ideaIdTwo], function () {
						contentAggregate.links.push(_.clone(link));
					}, originSession);
					return true;
				}
				i += 1;
			}
			return false;
		};
		contentAggregate.getLinkAttr = function (ideaIdFrom, ideaIdTo, name) {
			var link = _.find(
				contentAggregate.links,
				function (link) {
					return link.ideaIdFrom == ideaIdFrom && link.ideaIdTo == ideaIdTo;
				}
			);
			if (link && link.attr && link.attr[name]) {
				return link.attr[name];
			}
			return false;
		};
		contentAggregate.updateLinkAttr = function (/*ideaIdFrom, ideaIdTo, attrName, attrValue*/) {
			return contentAggregate.execCommand('updateLinkAttr', arguments);
		};
		commandProcessors.updateLinkAttr = function (originSession, ideaIdFrom, ideaIdTo, attrName, attrValue) {
			var link = _.find(
				contentAggregate.links,
				function (link) {
					return link.ideaIdFrom == ideaIdFrom && link.ideaIdTo == ideaIdTo;
				}
			), undoAction;
			undoAction = updateAttr(link, attrName, attrValue);
			if (undoAction) {
				logChange('updateLinkAttr', [ideaIdFrom, ideaIdTo, attrName, attrValue], undoAction, originSession);
			}
			return !!undoAction;
		};
	}());
	/* undo/redo */
	contentAggregate.canUndo = function () {
		return !!(eventStacks[sessionKey] && eventStacks[sessionKey].length > 0);
	};
	contentAggregate.canRedo = function () {
		return !!(redoStacks[sessionKey] && redoStacks[sessionKey].length > 0);
	};
	contentAggregate.undo = function () {
		return contentAggregate.execCommand('undo', arguments);
	};
	commandProcessors.undo = function (originSession) {
		var topEvent;
		contentAggregate.endBatch();
		topEvent = eventStacks[originSession] && eventStacks[originSession].pop();
		if (topEvent && topEvent.undoFunction) {
			topEvent.undoFunction();
			if (!redoStacks[originSession]) {
				redoStacks[originSession] = [];
			}
			redoStacks[originSession].push(topEvent);
			contentAggregate.dispatchEvent('changed', 'undo', [], originSession);
			return true;
		}
		return false;
	};
	contentAggregate.redo = function () {
		return contentAggregate.execCommand('redo', arguments);
	};
	commandProcessors.redo = function (originSession) {
		var topEvent;
		contentAggregate.endBatch();
		topEvent = redoStacks[originSession] && redoStacks[originSession].pop();
		if (topEvent) {
			isRedoInProgress = true;
			contentAggregate.execCommand(topEvent.eventMethod, topEvent.eventArgs, originSession);
			isRedoInProgress = false;
			return true;
		}
		return false;
	};
	contentAggregate.storeResource = function (/*resourceBody, optionalKey*/) {
		return contentAggregate.execCommand('storeResource', arguments);
	};
	commandProcessors.storeResource = function (originSession, resourceBody, optionalKey) {
		var existingId, id,
			maxIdForSession = function () {
				var toInt = function (string) {
						return parseInt(string, 10);
					},
					keys, filteredKeys, intKeys;

				if (_.isEmpty(contentAggregate.resources)) {
					return 0;
				}
				keys = _.keys(contentAggregate.resources);
				filteredKeys = sessionKey ? _.filter(keys, RegExp.prototype.test.bind(new RegExp('\\/' + sessionKey + '$'))) : keys;
				intKeys = _.map(filteredKeys, toInt);
				return _.isEmpty(intKeys) ? 0 : _.max(intKeys);
			},
			nextResourceId = function () {
				var intId = maxIdForSession() + 1;
				return intId + uniqueResourcePostfix;
			};

		if (!optionalKey && contentAggregate.resources) {
			existingId = _.find(_.keys(contentAggregate.resources), function (key) {
				return contentAggregate.resources[key] === resourceBody;
			});
			if (existingId) {
				return existingId;
			}
		}
		id = optionalKey || nextResourceId();
		contentAggregate.resources = contentAggregate.resources || {};
		contentAggregate.resources[id] = resourceBody;
		contentAggregate.dispatchEvent('resourceStored', resourceBody, id, originSession);
		return id;
	};
	contentAggregate.getResource = function (id) {
		return contentAggregate.resources && contentAggregate.resources[id];
	};
	contentAggregate.hasSiblings = function (id) {
		var parent;
		if (contentAggregate.isRootNode(id)) {
			return false;
		}
		parent = contentAggregate.findParent(id);
		return parent && _.size(parent.ideas) > 1;
	};
	contentAggregate.isRootNode = function (id) {
		return isRootNode(id);
	};
	contentAggregate.getDefaultRootId = function () {
		var rootNodes = contentAggregate && _.values(contentAggregate.ideas);
		return rootNodes && rootNodes.length && rootNodes[0].id;
	};
	contentUpgrade(contentAggregate);
	// if (!contentAggregate.formatVersion || contentAggregate.formatVersion < 2) {
	// 	upgrade(contentAggregate);
	// 	contentAggregate.formatVersion = 2;
	// }
	init(contentAggregate);
	return contentAggregate;
};
