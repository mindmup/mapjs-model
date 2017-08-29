/*global beforeEach, describe, expect, it, jasmine, spyOn, require */
const _ = require('underscore'),
	content = require('../../../src/core/content/content');
describe('content aggregate', function () {
	'use strict';
	const ideaIdsByRank = function (ideas) {
		const map = {};
		_.map(ideas, function (val, key) {
			map[key] = val.id;
		});
		return map;
	};
	describe('contentAggregate wapper', function () {
		it('automatically upgrades to v3 structure', function () {
			const wrapped = content({title: 'My Idea'});
			expect(wrapped.id).toBe('root');
			expect(wrapped.title).toBe('');
			expect(_.size(wrapped.ideas)).toBe(1);
			expect(wrapped.ideas[1].title).toBe('My Idea');
		});
		it('automatically assigns IDs to ideas without IDs', function () {
			const wrapped = content({title: 'My Idea'});
			expect(wrapped.ideas[1].id).toBe(1);
		});
		it('appends session ID after ID when generating', function () {
			const wrapped = content({title: 'My Idea'}, 'sessionkey');
			expect(wrapped.ideas[1].id).toBe('1.sessionkey');
		});
		it('initialises missing titles with a blank string - so the rest of the code can always expect a string', function () {
			const wrapped = content({});
			expect(wrapped.title).not.toBeUndefined();
			expect(wrapped.title).toBe('');
		});
		it('does not touch any IDs already assigned', function () {
			const wrapped = content({id: 22, title: 'My Idea', ideas: { 1: {id: 23, title: 'My First Subidea'}}});
			expect(wrapped.ideas[1].ideas[1].id).toBe(23);
		});
		it('skips over any IDs already assigned while adding new IDs', function () {
			const wrapped = content({id: 55, title: 'My Idea', ideas: { 1: {title: 'My First Subidea'}}});
			expect(wrapped.ideas[1].ideas[1].id).toBe(56);
		});
		it('preserves any meta data stored in JSON while wrapping', function () {
			const wrapped = content({id: 55, title: 'My Idea', ideas: { 1: {title: 'My First Subidea', meta: {newAttr: 'new_val'}}}});
			expect(wrapped.ideas[1].ideas[1].meta.newAttr).toBe('new_val');
		});
		it('removes any nodes that are groups without children', function () {
			const wrapped = content({
				id: 1,
				title: 'My Idea',
				ideas: {
					1: {
						title: 'My group Subidea',
						attr: {
							group: true
						}
					},
					2: {
						title: 'My non group Subidea'
					}
				}
			});
			expect(wrapped.ideas[1].ideas[1]).toBeFalsy();
			expect(wrapped.ideas[1].ideas[2]).toBeTruthy();
		});
		it('preserves any nodes that are groups with children', function () {
			const wrapped = content({
				id: 1,
				title: 'My Idea',
				ideas: {
					1: {
						title: 'My group Subidea',
						attr: {
							group: true
						},
						ideas: {
							3: {
								title: 'My group Subidea child'
							}
						}
					},
					2: {
						title: 'My non group Subidea'
					}
				}
			});
			expect(_.size(wrapped.ideas[1].ideas)).toBe(2);
		});
		it('preserves root node that is a group without children', function () {
			const wrapped = content({
				id: 1,
				title: 'My Idea',
				attr: {
					group: true
				}
			});
			expect(wrapped.ideas[1].attr.group).toBeTruthy();
		});

		it('normalises all ranks to floats to avoid selection problems with x.0', function () {
			const wrapped = content({id: 55, ideas: { '2.0': {id: 2}, 3.0: {id: 3}, '-4.0': {id: 4}}});
			expect(wrapped.ideas[1].ideas[2.0].id).toBe(2);
			expect(wrapped.ideas[1].ideas[3].id).toBe(3);
			expect(wrapped.ideas[1].ideas[-4].id).toBe(4);
		});
		describe('path retrieval', function () {
			let wrapped, i111, i11;
			beforeEach(function () {

				i111 = {
					id: 111,
					ideas: {
						1: {
							id: 1111
						}
					}
				};
				i11 = {
					id: 11,
					ideas: {
						1: i111
					}
				};
				wrapped = content({
					id: 1,
					ideas: {
						1: i11,
						2: {
							id: 12
						}
					}
				});
			});
			describe('calculatePath', function () {
				it('should return single item for root node', function () {
					expect(wrapped.calculatePath(1)).toEqual([]);
				});
				it('should path to the root node', function () {
					expect(wrapped.calculatePath(11)).toEqual([wrapped.ideas[1], wrapped]);
					expect(wrapped.calculatePath(111)).toEqual([i11, wrapped.ideas[1], wrapped]);
					expect(wrapped.calculatePath(1111)).toEqual([i111, i11, wrapped.ideas[1], wrapped]);
				});
				it('should return false if the node does not exist', function () {
					expect(wrapped.calculatePath(123)).toBeFalsy();
				});
			});
			describe('getSubTreeIds', function () {
				it('should return empty array for leaf nodes', function () {
					expect(wrapped.getSubTreeIds(1111)).toEqual([]);
				});
				it('should return IDs of all subideas and their subideas for non leaf nodes, depth-first and rank sorted', function () {
					expect(wrapped.getSubTreeIds(111)).toEqual([1111]);
					expect(wrapped.getSubTreeIds(11)).toEqual([1111, 111]);
					expect(wrapped.getSubTreeIds(1)).toEqual([1111, 111, 11, 12]);
				});
			});
		});
		describe('isEmptyGroup', function () {
			let wrapped;
			beforeEach(function () {
				wrapped = content({
					id: 1,
					title: 'My Idea',
					ideas: {
						1: {
							title: 'My group Subidea',
							attr: {
								group: true
							},
							ideas: {
								3: {
									title: 'My group Subidea child'
								}
							}
						},
						2: {
							title: 'My non group Subidea'
						}
					}
				});
			});
			it('should be truthy if the node is a group without child nodes', function () {
				wrapped.ideas[1].ideas[1].ideas[3].attr = {group: true};
				expect(wrapped.ideas[1].ideas[1].ideas[3].isEmptyGroup()).toBeTruthy();
			});
			it('should be falsy if the node is not a group', function () {
				expect(wrapped.ideas[1].ideas[1].ideas[3].isEmptyGroup()).toBeFalsy();
			});
			it('should be falsy if the node is a group with child nodes', function () {
				expect(wrapped.ideas[1].ideas[1].isEmptyGroup()).toBeFalsy();
			});
			it('should be falsy if the root node is a group without child nodes', function () {
				wrapped.ideas[1].ideas = {};
				wrapped.ideas[1].attr = {group: true};
				expect(wrapped.ideas[1].isEmptyGroup()).toBeFalsy();
			});

		});
		describe('getAttr', function () {
			it('returns false if the attribute is not defined', function () {
				const wrapped = content({});
				expect(wrapped.ideas[1].getAttr('xx')).toBeFalsy();
			});
			it('returns the attribute if defined', function () {
				const wrapped = content({attr: {xx: 'yellow'}});
				expect(wrapped.ideas[1].getAttr('xx')).toBe('yellow');
			});
		});
		describe('findChildRankById', function () {
			const idea = content({id: 1, title: 'I1', ideas: { 5: { id: 2, title: 'I2'}, 10: { id: 3, title: 'I3'}, 15: {id: 4, title: 'I4'}}});
			it('returns the key in the parent idea list of an idea by its id', function () {
				expect(idea.ideas[1].findChildRankById(2)).toEqual(5);
				expect(idea.ideas[1].findChildRankById(3)).toEqual(10);
				expect(idea.ideas[1].findChildRankById(4)).toEqual(15);
			});
			it('returns false/NaN if no such child exists', function () {
				expect(idea.findChildRankById('xxx')).toBeFalsy();
			});
		});
		describe('findParent', function () {
			const idea = content({id: 1, title: 'I1', ideas: { 5: { id: 2, title: 'I2', ideas: {8: {id: 8}}}, 10: { id: 3, title: 'I3'}, 15: {id: 4, title: 'I4'}}});
			it('returns the parent idea by child id', function () {
				expect(idea.findParent(2)).toBe(idea.ideas[1]);
				expect(idea.findParent(8)).toEqual(jasmine.objectContaining({id: 2}));
			});
			it('returns false if no such child exists', function () {
				expect(idea.findParent('xxx')).toBeFalsy();
			});
			it('returns false if no parent', function () {
				expect(idea.findParent(1)).toBeFalsy();
			});
		});
		describe('findSubIdeaById', function () {
			it('returns the idea reference for a direct child matching the ID', function () {
				const idea = content({id: 1, title: 'I1', ideas: { 5: { id: 2, title: 'I2'}, 10: { id: 3, title: 'I3'}, 15: {id: 4, title: 'I4'}}});
				expect(idea.findSubIdeaById(2).id).toBe(2);
			});
			it('returns the idea reference for any indirect child matching the ID', function () {
				const idea = content({id: 5, title: 'I0', ideas: {9: {id: 1, title: 'I1', ideas: { '-5': { id: 2, title: 'I2'}, '-10': { id: 3, title: 'I3'}, '-15': {id: 4, title: 'I4'}}}}});
				expect(idea.findSubIdeaById(2).id).toBe(2);
			});
			it('works with number.session keys', function () {
				const idea = content({id: 5, ideas: {9: {id: 1, ideas: { '-5': { id: '2.b'}, '-10': { id: 3}, '-15': {id: 4}}}}});
				expect(idea.findSubIdeaById('2.b').id).toBe('2.b');
			});
			it('returns undefined if it matches the ID itself - to avoid false positives in parent search', function () {
				const idea = content({id: 1, title: 'I1', ideas: { 5: { id: 2, title: 'I2'}, 10: { id: 3, title: 'I3'}, 15: {id: 4, title: 'I4'}}});
				expect(idea.ideas[1].findSubIdeaById(1)).toBeFalsy();
			});
			it('returns undefined if no immediate child or any indirect child matches the ID', function () {
				const idea = content({id: 1, title: 'I1', ideas: { 5: { id: 2, title: 'I2'}, 10: { id: 3, title: 'I3'}, 15: {id: 4, title: 'I4'}}});
				expect(idea.findSubIdeaById(33)).toBeFalsy();
			});
		});
		describe('sameSideSiblingIds', function () {
			it('returns siblings with the same rank sign, excluding the argument idea', function () {
				const idea = content({id: 1, ideas: { 5: {id: 2}, '-10': {id: 3}, 15: {id: 4}, '-20': {id: 5}, 20: {id: 6}}});
				expect(idea.sameSideSiblingIds(2)).toEqual([4, 6]);
				expect(idea.sameSideSiblingIds(5)).toEqual([3]);
			});
		});
		describe('find', function () {
			it('returns an array of ideas that match a predicate, sorted by depth. It only returns ID and title', function () {
				const aggregate = content({id: 5, title: 'I0', ideas: {9: {id: 1, title: 'I1', ideas: { '-5': { id: 2, title: 'I2'}, '-10': { id: 3, title: 'I3'}, '-15': {id: 4, title: 'I4'}}}}});
				expect(aggregate.find(function (idea) {
					return idea.id < 3;
				})).toEqual([{id: 1, title: 'I1'}, {id: 2, title: 'I2'}]);
			});
			it('returns an empty array if nothing matches the predicate', function () {
				const aggregate = content({id: 5, title: 'I0', ideas: {9: {id: 1, title: 'I1', ideas: { '-5': { id: 2, title: 'I2'}, '-10': { id: 3, title: 'I3'}, '-15': {id: 4, title: 'I4'}}}}});
				expect(aggregate.find(function (idea) {
					return idea.id > 103;
				})).toEqual([]);
			});
		});
		describe('nextSiblingId', function () {
			it('returns the next sibling ID by rank within the parent', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 10: { id: 3}, 15: {id: 4}}});
				expect(idea.nextSiblingId(2)).toBe(3);
			});
			it('for negative ranks, looks for the next rank by absolute value', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}, '-10': { id: 3}, '-15': {id: 4}}});
				expect(idea.nextSiblingId(2)).toBe(3);
			});
			it('only looks within its rank group (positive/negative)', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}, '-10': { id: 3}, 15: {id: 4}}});
				expect(idea.nextSiblingId(2)).toBe(3);
			});
			it('returns false if there is no next sibling', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}, 10: { id: 3}, 15: {id: 4}}});
				expect(idea.nextSiblingId(4)).toBeFalsy();
				expect(idea.nextSiblingId(2)).toBeFalsy();
			});
			it('returns false if there is no such idea', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 10: { id: 3}, 15: {id: 4}}});
				expect(idea.nextSiblingId(22)).toBeFalsy();
			});
			it('returns false if there are no siblings', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}}});
				expect(idea.nextSiblingId(5)).toBeFalsy();
			});
		});
		describe('previousSiblingId', function () {
			it('returns the previous sibling ID by rank within the parent', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 10: { id: 3}, 15: {id: 4}}});
				expect(idea.previousSiblingId(3)).toBe(2);
			});
			it('for negative ranks, looks for the previous rank by absolute value', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}, '-10': { id: 3}, '-15': {id: 4}}});
				expect(idea.previousSiblingId(3)).toBe(2);
			});
			it('only looks within its rank group (positive/negative)', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}, 10: { id: 3}, 15: {id: 4}}});
				expect(idea.previousSiblingId(4)).toBe(3);
			});
			it('returns false if there is no previous sibling', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}, 10: { id: 3},  15: {id: 4}}});
				expect(idea.previousSiblingId(2)).toBeFalsy();
				expect(idea.previousSiblingId(3)).toBeFalsy();
			});
			it('returns false if there is no such idea', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 10: { id: 3},  15: {id: 4}}});
				expect(idea.previousSiblingId(22)).toBeFalsy();
			});
			it('returns false if there are no siblings', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}}});
				expect(idea.previousSiblingId(5)).toBeFalsy();
			});
		});
		describe('clone', function () {
			const toClone = function () {
				return { id: 2, title: 'copy me', attr: {background: 'red'}, ideas: {'5': {id: 66, title: 'hey there'}}};
			};
			it('returns a deep clone copy of a subidea by id', function () {
				const idea = content({id: 1, ideas: { '-5': toClone(), '-10': { id: 3}, '-15': {id: 4}}});
				expect(idea.clone(2)).toEqual(toClone());
				expect(idea.clone(2)).not.toBe(idea.ideas[-5]);
			});
			it('clones the aggregate if no subidea given', function () {
				const idea = content({id: 1, ideas: {'-10': { id: 3}, '-15': {id: 4}}});
				expect(idea.clone().ideas[1].id).toBe(1);
			});
			it('clones the aggregate if aggregate ID given', function () {
				const idea = content({id: 1, ideas: {'-10': { id: 3}, '-15': {id: 4}}});
				expect(idea.clone(1).id).toBe(1);
			});
		});
		describe('sortedSubIdeas', function () {
			it('sorts children by key, positive first then negative, by absolute value', function () {
				const aggregate = content({id: 1, title: 'root', ideas: {'-100': {title: '-100'}, '-1': {title: '-1'}, '1': {title: '1'}, '100': {title: '100'}}}),
					result = _.map(aggregate.ideas[1].sortedSubIdeas(), function (subidea) {
						return subidea.title;
					});
				expect(result).toEqual(['1', '100', '-1', '-100']);
			});
		});
		describe('getAttrById', function () {
			let wrapped;
			beforeEach(function () {
				wrapped = content({
					attr: {
						style: {
							background: 'red'
						}
					},
					id: 12
				});
			});
			it('returns false if the there is no idea for the id', function () {
				expect(wrapped.getAttrById(31412, 'style')).toBeFalsy();
			});
			it('returns false if the there is no attr matching', function () {
				expect(wrapped.getAttrById(12, 'xx')).toBeFalsy();
			});
			it('should return the attr from the matching node', function () {
				expect(wrapped.getAttrById(12, 'style')).toEqual({background: 'red'});
			});
			it('should not return a live copy allowing the client to mess with the internals', function () {
				wrapped.getAttrById(12, 'style').background = 'blue';
				expect(wrapped.getAttrById(12, 'style')).toEqual({background: 'red'});
			});
		});
		describe('mergeAttrProperty', function () {
			let underTest;
			beforeEach(function () {
				underTest = content({
					attr: {
						style: {
							background: 'red'
						}
					},
					id: 12
				});
			});
			it('adds a new attribute if nothing existed before', function () {
				underTest.mergeAttrProperty(12, 'kick', 'me', 'yes');
				expect(underTest.getAttrById(12, 'kick')).toEqual({me: 'yes'});
			});
			it('adds a property to an existing attribute if it was a hashmap', function () {
				underTest.mergeAttrProperty(12, 'style', 'me', 'yes');
				expect(underTest.getAttrById(12, 'style')).toEqual({background: 'red', me: 'yes'});
			});
			it('removes an existing hashmap property', function () {
				underTest.mergeAttrProperty(12, 'style', 'me', 'yes');
				underTest.mergeAttrProperty(12, 'style', 'background', false);
				expect(underTest.getAttrById(12, 'style')).toEqual({me: 'yes'});
			});
			it('changes an existing hashmap property', function () {
				underTest.mergeAttrProperty(12, 'style', 'background', 'blue');
				expect(underTest.getAttrById(12, 'style')).toEqual({background: 'blue'});
			});
			it('fires an updateAttr event', function () {
				const spy = jasmine.createSpy('changed');
				underTest.addEventListener('changed', spy);
				underTest.mergeAttrProperty(12, 'style', 'me', 'yes');
				expect(spy).toHaveBeenCalledWith('updateAttr', [12, 'style', {background: 'red', me: 'yes'}]);
			});
			it('removes the last property', function () {
				underTest.mergeAttrProperty(12, 'style', 'background', false);
				expect(underTest.getAttrById(12, 'style')).toBeFalsy();
			});
			it('returns true if the value is changed', function () {
				expect(underTest.mergeAttrProperty(12, 'style', 'background', 'yellow')).toBeTruthy();
				expect(underTest.mergeAttrProperty(12, 'style', 'background', false)).toBeTruthy();
				expect(underTest.mergeAttrProperty(12, 'style', 'me', 'yellow')).toBeTruthy();
				expect(underTest.mergeAttrProperty(12, 'you', 'me', 'yellow')).toBeTruthy();
			});
			it('returns false if the value is unchanged', function () {
				expect(underTest.mergeAttrProperty(12, 'style', 'background', 'red')).toBeFalsy();
				expect(underTest.mergeAttrProperty(12, 'style', 'me', false)).toBeFalsy();
				expect(underTest.mergeAttrProperty(12, 'you', 'me', false)).toBeFalsy();
			});
		});
	});
	describe('command processing', function () {
		describe('execCommand', function () {
			it('executes updateTitle', function () {
				const idea = content({id: 1, title: 'abc'}),
					listener = jasmine.createSpy();
				idea.addEventListener('changed', listener);

				idea.execCommand('updateTitle', [1, 'new']);

				expect(listener).toHaveBeenCalledWith('updateTitle', [1, 'new']);
			});
			it('attaches a default session ID if provided during construction', function () {
				const idea = content({id: 1, title: 'abc'}, 'session'),
					listener = jasmine.createSpy();
				idea.addEventListener('changed', listener);

				idea.execCommand('updateTitle', [1, 'new']);

				expect(listener).toHaveBeenCalledWith('updateTitle', [1, 'new'], 'session');
			});
			it('attaches the provided session ID if provided in command', function () {
				const idea = content({id: 1, title: 'abc'}, 'session'),
					listener = jasmine.createSpy();
				idea.addEventListener('changed', listener);

				idea.execCommand('updateTitle', [1, 'new'], 'other');

				expect(listener).toHaveBeenCalledWith('updateTitle', [1, 'new'], 'other');
			});
		});
		describe('paste', function () {
			let idea, toPaste, result;
			beforeEach(function () {
				idea = content({id: 1, ideas: {'-10': { id: 3}, '-15': {id: 4}}});
				toPaste = {title: 'pasted', id: 1};
			});
			it('should create a new child and paste cloned contentAggregates', function () {
				result = idea.paste(3, toPaste);
				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas[-10].ideas[1]).toEqual(jasmine.objectContaining({title: 'pasted'}));
			});
			describe('when no ID provided', function () {
				it('should reassign IDs based on next available ID in the aggregate', function () {
					result = idea.paste(3, toPaste);
					expect(result).toBeTruthy();
					expect(idea.ideas[1].ideas[-10].ideas[1].id).toBe(5);
				});
				it('should append session key if given when re-assigning', function () {
					idea = content({id: 1, ideas: {'-10': { id: 3}, '-15': {id: 4}}}, 'sess');
					result = idea.paste(3, toPaste);
					expect(result).toBeTruthy();
					expect(idea.ideas[1].ideas[-10].ideas[1].id).toBe('5.sess');
				});
				it('should reassign IDs recursively based on next available ID in the aggregate', function () {
					result = idea.paste(3, _.extend(toPaste, {ideas: {1: { id: 66, title: 'sub sub'}}}));
					expect(result).toBeTruthy();
					expect(idea.ideas[1].ideas[-10].ideas[1].id).toBe(5);
					expect(idea.ideas[1].ideas[-10].ideas[1].ideas[1].id).toBe(6);
				});
			});
			describe('when ID is provided', function () {
				it('should reassign IDs based on provided ID for the root of the pasted hierarchy', function () {
					result = idea.paste(3, toPaste, 777);
					expect(result).toBeTruthy();
					expect(idea.ideas[1].ideas[-10].ideas[1].id).toBe(777);
				});
				it('should use session key from provided ID', function () {
					idea = content({id: 1, ideas: {'-10': { id: 3}, '-15': {id: 4}}}, 'sess');
					result = idea.paste(3, toPaste, '778.sess2');
					expect(result).toBeTruthy();
					expect(idea.ideas[1].ideas[-10].ideas[1].id).toBe('778.sess2');
				});
				it('should reassign IDs recursively based', function () {
					result = idea.paste(3, _.extend(toPaste, {ideas: {1: { id: 66, title: 'sub sub'}}}), 779);
					expect(result).toBeTruthy();
					expect(idea.ideas[1].ideas[-10].ideas[1].id).toBe(779);
					expect(idea.ideas[1].ideas[-10].ideas[1].ideas[1].id).toBe(780);
				});
				it('should keep session ID when reassigning recursively', function () {
					result = idea.paste(3, _.extend(toPaste, {ideas: {1: { id: 66, title: 'sub sub'}}}), '781.abc');
					expect(result).toBeTruthy();
					expect(idea.ideas[1].ideas[-10].ideas[1].id).toBe('781.abc');
					expect(idea.ideas[1].ideas[-10].ideas[1].ideas[1].id).toBe('782.abc');
				});
			});
			it('should reorder children by absolute rank, positive first then negative', function () {
				let newChildren = '';
				idea.paste(3, _.extend(toPaste, {ideas: {
					77: {id: 10, title: '77'},
					1: { id: 11, title: '1'},
					'-77': {id: 12, title: '-77'},
					'-1': {id: 13, title: '-1'}
				}}));
				newChildren = idea.ideas[1].ideas[-10].ideas[1].ideas;

				expect(newChildren[1].title).toBe('1');
				expect(newChildren[2].title).toBe('77');
				expect(newChildren[3].title).toBe('-1');
				expect(newChildren[4].title).toBe('-77');
			});
			it('should clean up attributes from the list of non cloned recursively', function () {
				let	pastedRoot = '', pastedChild = '', childChild = '';
				idea.setConfiguration({nonClonedAttributes: ['noncloned', 'xnoncloned']});
				idea.paste(3, _.extend(toPaste, {
					attr: { cloned: 'ok', noncloned: 'notok' },
					ideas: {
						1: {id: 10, title: 'pastedchild', attr: { xcloned: 'ok', noncloned: 'notok', xnoncloned: 'notok' },
							ideas: { 1: { id: 11, title: 'childchild', attr: {noncloned: 'notok'} } }
						}
					}
				}));
				pastedRoot = idea.ideas[1].ideas[-10].ideas[1];
				pastedChild = pastedRoot.ideas[1];
				childChild = pastedRoot.ideas[1].ideas[1];
				expect(pastedRoot.attr).toEqual({cloned: 'ok'});
				expect(pastedChild.attr).toEqual({xcloned: 'ok'});
				expect(childChild.attr).toBeUndefined();
			});
			it('should paste to aggregate root if root ID is given', function () {
				const result = idea.paste(1, toPaste),
					newRank = idea.ideas[1].findChildRankById(5);
				expect(result).toBeTruthy();
				expect(newRank).toBeTruthy();
				expect(idea.ideas[1].ideas[newRank]).toEqual(jasmine.objectContaining({title: 'pasted'}));
			});
			it('should fail if invalid idea id', function () {
				const result = idea.paste(-3, toPaste);
				expect(result).toBeFalsy();
			});
			it('should fail if nothing pasted', function () {
				const spy = jasmine.createSpy('paste');
				idea.addEventListener('changed', spy);
				expect(idea.paste(1)).toBeFalsy();
				expect(spy).not.toHaveBeenCalled();
			});
			it('should fire a paste event when it succeeds, appending the new ID as the last', function () {
				const spy = jasmine.createSpy('paste');
				idea.addEventListener('changed', spy);
				idea.paste(3, toPaste);
				expect(spy).toHaveBeenCalledWith('paste', [3, toPaste, 5]);
			});
			it('event should contain session ID if provided', function () {
				const idea = content({id: 3}, 'sess'),
					spy = jasmine.createSpy('paste');
				idea.addEventListener('changed', spy);
				idea.paste(3, toPaste);
				expect(spy).toHaveBeenCalledWith('paste', [3, toPaste, '4.sess'], 'sess');
			});
			it('should paste an idea with an empty title but with attributes', function () {
				toPaste.title = '';
				toPaste.attr = {'x': 'y'};

				const result = idea.paste(1, toPaste),
					pasted = idea.findSubIdeaById(result);

				expect(result).not.toBeFalsy();
				expect(pasted.attr).toEqual({'x': 'y'});
				expect(pasted.title).toBeFalsy();
			});
			it('pushes an event on the undo stack if successful', function () {
				idea.paste(3, toPaste);
				idea.undo();
				expect(idea.ideas[1].ideas[-10].ideas).toEqual({});
			});
		});
		describe('updateAttr', function () {
			it('should allow an attribute to be set on the aggregate', function () {
				const aggregate = content({id: 71, title: 'My Idea'}),
					result = aggregate.updateAttr(71, 'newAttr', 'newValue');
				expect(result).toBeTruthy();
				expect(aggregate.ideas[1].getAttr('newAttr')).toBe('newValue');
			});
			it('should allow a set attr to be set on the child', function () {
				const aggregate = content({id: 1, ideas: { 5: { id: 2}}}),
					result = aggregate.updateAttr(2, 'newAttr', 'newValue');
				expect(result).toBeTruthy();
				expect(aggregate.ideas[1].ideas[5].getAttr('newAttr')).toBe('newValue');
			});
			it('clones attr when setting to a new object to prevent stale references', function () {
				const oldAttr = {},
					aggregate = content({id: 1, attr: oldAttr});
				aggregate.updateAttr(1, 'newAttr', 'newValue');
				expect(oldAttr).toEqual({});
			});
			it('should remove attrs which have been set to false', function () {
				const aggregate = content({id: 1, attr: {keptAttr: 'oldValue', newAttr: 'value'}}),
					result = aggregate.updateAttr(1, 'newAttr', false);
				expect(result).toBeTruthy();
				expect(aggregate.ideas[1].attr.newAttr).toBeUndefined();
				expect(aggregate.ideas[1].attr.keptAttr).toBe('oldValue');
			});
			it('should remove attrs which have been set to empty hash', function () {
				const aggregate = content({id: 1, attr: {keptAttr: 'oldValue', newAttr: 'value'}}),
					result = aggregate.updateAttr(1, 'newAttr', {});
				expect(result).toBeTruthy();
				expect(aggregate.ideas[1].attr.newAttr).toBeUndefined();
				expect(aggregate.ideas[1].attr.keptAttr).toBe('oldValue');
			});
			it('should remove attrs which have been set to false - as a string', function () {
				const aggregate = content({id: 1, attr: {keptAttr: 'oldValue', newAttr: 'value'}}),
					result = aggregate.updateAttr(1, 'newAttr', 'false');
				expect(result).toBeTruthy();
				expect(aggregate.ideas[1].attr.newAttr).toBeUndefined();
				expect(aggregate.ideas[1].attr.keptAttr).toBe('oldValue');
			});
			it('should remove attr hash when no attrs are left in the object', function () {
				const aggregate = content({id: 1, attr: {newAttr: 'value'}}),
					result = aggregate.updateAttr(1, 'newAttr', false);
				expect(result).toBeTruthy();
				expect(aggregate.ideas[1].attr).toBeUndefined();
			});
			it('fires an event matching the method call when the attr changes', function () {
				const listener = jasmine.createSpy('attr_listener'),
					wrapped = content({});
				wrapped.addEventListener('changed', listener);
				wrapped.updateAttr(1, 'new', 'yellow');
				expect(listener).toHaveBeenCalledWith('updateAttr', [1, 'new', 'yellow']);
			});
			it('fires an event with session if defined', function () {
				const listener = jasmine.createSpy('attr_listener'),
					wrapped = content({id: 1}, 'sess');
				wrapped.addEventListener('changed', listener);
				wrapped.updateAttr(1, 'new', 'yellow');
				expect(listener).toHaveBeenCalledWith('updateAttr', [1, 'new', 'yellow'], 'sess');
			});
			it('should fail if no such child exists', function () {
				const listener = jasmine.createSpy('attr_listener'),
					aggregate = content({id: 1, ideas: { 5: { id: 2}}});
				aggregate.addEventListener('changed', listener);

				expect(aggregate.updateAttr(100, 'newAttr', 'newValue')).toBeFalsy();
				expect(listener).not.toHaveBeenCalled();
			});
			it('should fail if old attr equals new one', function () {
				const listener = jasmine.createSpy('attr_listener'),
					aggregate = content({id: 1, attr: {'v': 'x'} });

				expect(aggregate.addEventListener('changed', listener)).toBeFalsy();
				expect(listener).not.toHaveBeenCalled();
			});
			it('should fail if old attr equals new one as a complex object', function () {
				const listener = jasmine.createSpy('attr_listener'),
					aggregate = content({id: 1, attr: {'v': { sub: 'x'} } });
				aggregate.addEventListener('changed', listener);
				expect(aggregate.updateAttr(1, 'v', { sub: 'x'})).toBeFalsy();
				expect(listener).not.toHaveBeenCalled();
			});
			it('should fail if removing a non existent property', function () {
				const listener = jasmine.createSpy('attr_listener'),
					aggregate = content({id: 1, attr: {'v': 'x'} });
				aggregate.addEventListener('changed', listener);
				expect(aggregate.updateAttr(1, 'y', false)).toBeFalsy();
				expect(listener).not.toHaveBeenCalled();
			});
			it('should pop an undo function onto event stack if successful', function () {
				const aggregate = content({id: 71, attr: {'newAttr': 'oldValue'}});
				aggregate.updateAttr(71, 'newAttr', 'newValue');
				aggregate.undo();
				expect(aggregate.ideas[1].getAttr('newAttr')).toBe('oldValue');
			});
			it('should undo attr deletion if successful', function () {
				const aggregate = content({id: 71, attr: {'newAttr': 'oldValue'}});
				aggregate.updateAttr(71, 'newAttr', false);
				aggregate.undo();
				expect(aggregate.ideas[1].getAttr('newAttr')).toBe('oldValue');
			});
			it('deep clones complex objects to prevent outside changes', function () {
				const aggregate = content({id: 71}),
					attrOb = { background: 'yellow', sub: { subsub: 0 }};
				aggregate.updateAttr(71, 'new', attrOb);
				attrOb.background  = 'white';
				attrOb.sub.subsub = 1;
				expect(aggregate.ideas[1].getAttr('new').background).toBe('yellow');
				expect(aggregate.ideas[1].getAttr('new').sub.subsub).toBe(0);
			});
		});
		_.each(['updateTitle', 'initialiseTitle'], function (cmd) {
			describe(cmd, function () {
				it('changes the title of the current idea only if it matches ID in command', function () {
					const first = content({id: 71, title: 'My Idea'}),
						firstSucceeded = first[cmd](71, 'Updated');
					expect(firstSucceeded).toBeTruthy();
					expect(first.ideas[1].title).toBe('Updated');
				});
				it('changes the title of the current idea only if it matches ID in command even if given as a string  (DOM/_.js quirk workaround)', function () {
					const first = content({id: 71.5, title: 'My Idea'}),
						firstSucceeded = first[cmd]('71.5', 'Updated');
					expect(firstSucceeded).toBeTruthy();
					expect(first.ideas[1].title).toBe('Updated');
				});
				it('fails if the aggregate does not contain the target ID', function () {
					const second = content({id: 72, title: 'Untouched'}),
						listener = jasmine.createSpy('title_listener');
					second.addEventListener('changed', listener);
					expect(second[cmd](71, 'Updated')).toBeFalsy();
					expect(second.ideas[1].title).toBe('Untouched');
					expect(listener).not.toHaveBeenCalled();
				});
				it('fails if the title is the same', function () {
					const second = content({id: 1, title: 'Untouched'}),
						listener = jasmine.createSpy('title_listener');
					second.addEventListener('changed', listener);
					expect(second[cmd](1, 'Untouched')).toBeFalsy();
					expect(listener).not.toHaveBeenCalled();
				});
				it('propagates changes to child ideas if the ID does not match, succeeding if there is a matching child', function () {
					const ideas = content({id: 1, title: 'My Idea',
							ideas: {  1: {id: 2, title: 'My First Subidea', ideas: {1: {id: 3, title: 'My First sub-sub-idea'}}}}
						}),
						result = ideas[cmd](3, 'Updated');
					expect(result).toBeTruthy();
					expect(ideas.ideas[1].ideas[1].ideas[1].title).toBe('Updated');
					expect(ideas[cmd]('Non Existing', 'XX')).toBeFalsy();
				});
				it('fires an event matching the method call when the title changes', function () {
					const listener = jasmine.createSpy('title_listener'),
						wrapped = content({title: 'My Idea', id: 2, ideas: {1: {id: 1, title: 'Old title'}}});
					wrapped.addEventListener('changed', listener);
					wrapped[cmd](1, 'New Title');
					expect(listener).toHaveBeenCalledWith(cmd, [1, 'New Title']);
				});
				it('fires an event with session ID if defined', function () {
					const listener = jasmine.createSpy('title_listener'),
						wrapped = content({id: 1}, 'sess');
					wrapped.addEventListener('changed', listener);
					wrapped[cmd](1, 'New Title');
					expect(listener).toHaveBeenCalledWith(cmd, [1, 'New Title'], 'sess');
				});
				it('puts a undo method on the stack when successful', function () {
					const wrapped = content({id: 71, title: 'My Idea'});
					wrapped[cmd](71, 'Updated');
					wrapped.undo();
					expect(wrapped.ideas[1].title).toBe('My Idea');
				});
			});
		});

		describe('initialiseTitle batches the update with the previous command', function () {
			let contentAggregate;

			describe('if the previous command was a batch', function () {
				beforeEach(function () {
					contentAggregate = content({id: 2, title: 'old title'});
					contentAggregate.updateTitle(2, 'new title');
					contentAggregate.startBatch();
					contentAggregate.updateTitle(2, 'batched new title');
					contentAggregate.addSubIdea(2);
					contentAggregate.endBatch();
					contentAggregate.initialiseTitle(3, 'should be batched');
				});
				it('retro-fits it into the batch', function () {
					contentAggregate.undo();
					expect(contentAggregate.ideas[1].title).toBe('new title');
					expect(contentAggregate.ideas[1].ideas).toEqual({});
				});
				it('adds itself to the redo stack for the previous command', function () {
					contentAggregate.undo();
					contentAggregate.redo();
					expect(contentAggregate.ideas[1].ideas[1].title).toBe('should be batched');
					expect(contentAggregate.ideas[1].title).toBe('batched new title');
				});
				it('does not mess up the undo stack for earlier commands', function () {
					contentAggregate.undo();
					contentAggregate.undo();
					expect(contentAggregate.ideas[1].title).toBe('old title');
					expect(contentAggregate.ideas[1].ideas).toEqual({});
				});
				it('does not mess up the redo stack for earlier commands', function () {
					contentAggregate.undo();
					contentAggregate.undo();
					contentAggregate.redo();
					expect(contentAggregate.ideas[1].title).toBe('new title');
					expect(contentAggregate.ideas[1].ideas).toEqual({});
				});
			});

			describe('if the previous command was not a batch', function () {

				beforeEach(function () {
					contentAggregate = content({id: 2, title: 'old title'});
					contentAggregate.updateTitle(2, 'new title');
					contentAggregate.addSubIdea(2);
					contentAggregate.initialiseTitle(3, 'should be batched');
				});
				it('retro-fits it into the batch', function () {
					contentAggregate.undo();
					expect(contentAggregate.ideas[1].title).toBe('new title');
					expect(contentAggregate.ideas[1].ideas).toEqual({});
				});
				it('adds itself to the redo stack for the previous command', function () {
					contentAggregate.undo();
					contentAggregate.redo();
					expect(contentAggregate.ideas[1].ideas[1].title).toBe('should be batched');
				});
				it('does not mess up the undo stack for earlier commands', function () {
					contentAggregate.undo();
					contentAggregate.undo();
					expect(contentAggregate.ideas[1].title).toBe('old title');
					expect(contentAggregate.ideas[1].ideas).toEqual({});
				});
				it('does not mess up the redo stack for earlier commands', function () {
					contentAggregate.undo();
					contentAggregate.undo();
					contentAggregate.redo();
					expect(contentAggregate.ideas[1].title).toBe('new title');
					expect(contentAggregate.ideas[1].ideas).toEqual({});
				});

			});

		});


		describe('insertIntermediate', function () {
			let listener, idea;
			beforeEach(function () {
				idea = content({id: 1, ideas: {77: {id: 2, title: 'Moved'}}});
				listener = jasmine.createSpy('insert_listener');
				idea.addEventListener('changed', listener);
			});
			it('adds an idea between the argument idea and its parent, keeping the same rank for the new node and reassigning rank of 1 to the argument', function () {
				const result = idea.insertIntermediate(2, 'Steve');
				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas[77]).toEqual(jasmine.objectContaining({id: 3, title: 'Steve'}));
				expect(_.size(idea.ideas[1].ideas)).toBe(1);
				expect(_.size(idea.ideas[1].ideas[77].ideas)).toBe(1);
				expect(idea.ideas[1].ideas[77].ideas[1]).toEqual(jasmine.objectContaining({id: 2, title: 'Moved'}));
			});
			it('assigns an ID automatically if not provided', function () {
				const result = idea.insertIntermediate(2, 'Steve');
				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas[77].id).not.toBeNull();
			});
			it('assigns the provided ID if argument given', function () {
				const result = idea.insertIntermediate(2, 'Steve', 777);
				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas[77].id).toBe(777);
			});
			it('does not mess up automatic ID for nodes after operation when ID is provided', function () {
				idea.addSubIdea(2, 'x');
				idea.insertIntermediate(2, 'Steve', 777);
				idea.addSubIdea(2, 'y');
				expect(idea.findSubIdeaById(2).ideas[2].id).toBe(778);
			});
			it('fails if the ID is provided and it already exists', function () {
				const result = idea.insertIntermediate(2, 'Steve', 2);
				expect(result).toBeFalsy();
				expect(idea.ideas[1].ideas[77].id).toBe(2);
			});
			it('fires an event matching the method call when the operation succeeds', function () {
				idea.insertIntermediate(2, 'Steve');
				expect(listener).toHaveBeenCalledWith('insertIntermediate', [2, 'Steve', 3]);
			});
			it('fires an event with session ID if defined', function () {
				const idea = content({id: 1, ideas: {77: {id: 2, title: 'Moved'}}}, 'sess');
				listener = jasmine.createSpy('insert_listener');
				idea.addEventListener('changed', listener);
				idea.insertIntermediate(2, 'Steve');
				expect(listener).toHaveBeenCalledWith('insertIntermediate', [2, 'Steve', '3.sess'], 'sess');
			});
			it('fires the generated ID in the event if the ID was not supplied', function () {
				idea.insertIntermediate(2, 'Steve');
				const newId = idea.ideas[1].ideas[77].id;
				expect(listener).toHaveBeenCalledWith('insertIntermediate', [2, 'Steve', newId]);
			});
			it('fails if argument idea does not exist', function () {
				expect(idea.insertIntermediate(22, 'Steve')).toBeFalsy();
				expect(listener).not.toHaveBeenCalled();
			});
			it('inserts a root node if the  if idea is a root node', function () {
				const newId = idea.insertIntermediate(1, 'Steve');
				expect(newId).toBeTruthy();
				expect(idea.ideas[1].id).toEqual(newId);
				expect(idea.ideas[1].title).toEqual('Steve');
				expect(idea.ideas[1].ideas[1].id).toEqual(1);
			});
			it('pops an event to undo stack if successful', function () {
				idea.insertIntermediate(2, 'Steve');
				idea.undo();
				expect(idea.ideas[1].ideas[77]).toEqual(jasmine.objectContaining({id: 2, title: 'Moved'}));
			});
		});
		describe('addSubIdea', function () {
			it('adds a sub-idea to the idea in the argument', function () {
				const idea = content({id: 71, title: 'My Idea'}),
					succeeded = idea.addSubIdea(71, 'New idea'),
					asArray = _.toArray(idea.ideas[1].ideas);
				expect(succeeded).toBeTruthy();
				expect(asArray.length).toBe(1);
				expect(asArray[0].title).toBe('New idea');
			});
			it('repeatedly adds only one idea (bug resurrection check)', function () {
				const idea = content({id: 71, title: 'My Idea'});
				idea.addSubIdea(71, 'First idea');
				idea.addSubIdea(71, 'Second idea');
				expect(_.size(idea.ideas[1].ideas)).toBe(2);
			});
			it('assigns the next available ID to the new idea if the ID was not provided', function () {
				const idea = content({id: 71, title: 'My Idea'});
				idea.addSubIdea(71);
				expect(_.toArray(idea.ideas[1].ideas)[0].id).toBe(72);
			});
			it('returns the assigned ID if successful', function () {
				const idea = content({id: 71, title: 'My Idea'}),
					newId = idea.addSubIdea(71);
				expect(newId).toBe(72);
			});
			it('appends the session key if given', function () {
				const idea = content({id: 71, title: 'My Idea'}, 'session');
				idea.addSubIdea(71);
				expect(_.toArray(idea.ideas[1].ideas)[0].id).toBe('72.session');
			});
			it('uses the provided ID if one is provided', function () {
				const idea = content({id: 71, title: 'My Idea'});
				idea.addSubIdea(71, 'T', 555);
				expect(_.toArray(idea.ideas[1].ideas)[0].id).toBe(555);
			});
			it('does not mess up automatic ID for nodes after operation when ID is provided', function () {
				const idea = content({id: 71, title: 'My Idea'});
				idea.addSubIdea(71, 'x');
				idea.addSubIdea(72, 'T', 555);
				idea.addSubIdea(555, 'y');
				expect(idea.findSubIdeaById(555).ideas[1].id).toBe(556);
			});
			it('fails if provided ID clashes with an existing ID', function () {
				const idea = content({id: 71, title: 'My Idea'}),
					result = idea.addSubIdea(71, 'X', 71);
				expect(result).toBeFalsy();
				expect(_.size(idea.ideas[1].ideas)).toBe(0);
			});
			it('assigns the first subidea the rank of 1', function () {
				const idea = content({id: 71, title: 'My Idea'});
				idea.addSubIdea(71);
				expect(idea.ideas[1].findChildRankById(72)).toBe(1);
			});
			it('when adding nodes to 2nd level items and more, adds a node at a rank greater than any of its siblings', function () {
				const idea = content({id: 1, ideas: {1: {id: 5, ideas: {5: {id: 2}, 10: { id: 3},  15: {id: 4}}}}});
				idea.addSubIdea(5, 'x');
				expect(idea.ideas[1].ideas[1].findChildRankById(6)).not.toBeLessThan(15);
			});
			it('propagates to children if it does not match the requested id, succeeding if any child ID matches', function () {
				const ideas = content({id: 1, title: 'My Idea',
						ideas: {1: {id: 2, title: 'My First Subidea', ideas: {1: {id: 3, title: 'My First sub-sub-idea'}}}}
					}),
					result = ideas.addSubIdea(3, 'New New');
				expect(result).toBeTruthy();
				expect(ideas.ideas[1].ideas[1].ideas[1].ideas[1].title).toBe('New New');
			});
			it('fails if no child ID in hierarchy matches requested id', function () {
				const ideas = content({id: 1, title: 'My Idea',
					ideas: {1: {id: 2, title: 'My First Subidea', ideas: {1: {id: 3, title: 'My First sub-sub-idea'}}}}});
				expect(ideas.addSubIdea(33, 'New New')).toBeFalsy();
			});
			it('fires an event matching the method call when a new idea is added', function () {
				const idea = content({id: 71, title: 'My Idea'}),
					addedListener = jasmine.createSpy();
				idea.addEventListener('changed', addedListener);
				idea.addSubIdea(71, 'New Title');
				expect(addedListener).toHaveBeenCalledWith('addSubIdea', [71, 'New Title', 72]);
			});
			it('fires an event with session ID if provided', function () {
				const idea = content({id: 71, title: 'My Idea'}, 'sess'),
					addedListener = jasmine.createSpy();
				idea.addEventListener('changed', addedListener);
				idea.addSubIdea(71, 'New Title');
				expect(addedListener).toHaveBeenCalledWith('addSubIdea', [71, 'New Title', '72.sess'], 'sess');
			});
			it('pops an event on the undo stack if successful', function () {
				const idea = content({id: 4, ideas: {1: {id: 5, title: 'My Idea'}}});
				idea.addSubIdea(4, 'New');
				idea.undo();
				expect(idea.ideas[1].ideas[1]).toEqual(jasmine.objectContaining({id: 5, title: 'My Idea'}));
				expect(_.size(idea.ideas)).toBe(1);
			});
			it('takes negative rank items as absolute while calculating new rank ID (bug resurrection test)', function () {
				const idea = content({id: 1, title: 'I1', ideas: {5: {id: 2, title: 'I2'}, 6: {id: 3, title: 'I3'}, '-16': {id: 4, title: 'I4'}}});
				idea.addSubIdea(1);
				expect(Math.abs(idea.findChildRankById(5))).not.toBeLessThan(16);
			});
			describe('balances positive/negative ranks when adding to aggegate root', function () {
				it('gives first child a positive rank', function () {
					const idea = content({id: 1});
					idea.addSubIdea(1, 'new');
					expect(idea.findChildRankById(2)).not.toBeLessThan(0);
				});
				it('gives second child a negative rank', function () {
					const idea = content({id: 1});
					idea.addSubIdea(1, 'new');
					idea.addSubIdea(1, 'new');
					expect(idea.ideas[1].findChildRankById(3)).toBeLessThan(0);
				});
				it('adds a negative rank if there are more positive ranks than negative', function () {
					const idea = content({id: 1, title: 'I1', ideas: {5: {id: 2, title: 'I2'}, 10: {id: 3, title: 'I3'}, '-15': {id: 4, title: 'I4'}}});
					idea.addSubIdea(1);
					expect(idea.ideas[1].findChildRankById(5)).toBeLessThan(0);
				});
				it('adds a positive rank if there are less or equal positive ranks than negative', function () {
					const idea = content({id: 1, title: 'I1', ideas: {5: {id: 2, title: 'I2'}, '-15': {id: 4, title: 'I4'}}});
					idea.addSubIdea(1);
					expect(idea.ideas[1].findChildRankById(5)).not.toBeLessThan(0);
				});
				it('when adding positive rank nodes, adds a node at a rank greater than any of its siblings', function () {
					const idea = content({id: 1, ideas: {'-3': {id: 5}, '-5': {id: 2}, 10: {id: 3},  15: {id: 4}}});
					idea.addSubIdea(1, 'x');
					expect(idea.ideas[1].findChildRankById(6)).not.toBeLessThan(15);
				});
				it('when adding negative rank nodes, adds a node at a rank lesser than any of its siblings', function () {
					const idea = content({id: 1, ideas: {'-3': {id: 5}, '-5': {id: 2}, 10: {id: 3}, 15: {id: 4}, 20: {id: 6}}});
					idea.addSubIdea(1, 'x');
					expect(idea.ideas[1].findChildRankById(7)).toBeLessThan(-5);
				});
			});
		});
		describe('changeParent', function () {
			let idea;
			beforeEach(function () {
				idea = content({id: 5, ideas: {9: {id: 1, ideas: { '-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}});
			});
			it('removes an idea from its parent and reassings to another parent', function () {
				const result = idea.changeParent(4, 5);
				expect(result).toBeTruthy();
				expect(idea.ideas[1].containsDirectChild(4)).toBeTruthy();
				expect(idea.ideas[1].ideas[9].containsDirectChild(4)).toBeFalsy();
			});
			it('fails if no such idea exists to remove', function () {
				expect(idea.changeParent(14, 5)).toBeFalsy();
			});
			it('fails if no such new parent exists', function () {
				expect(idea.changeParent(4, 11)).toBeFalsy();
				expect(idea.ideas[1].ideas[9].ideas[-15].id).toBe(4);
			});
			it('fires an event matching the method call when a parent is changed', function () {
				const listener = jasmine.createSpy('changeParent');
				idea.addEventListener('changed', listener);
				idea.changeParent(4, 5);
				expect(listener).toHaveBeenCalledWith('changeParent', [4, 5]);
			});
			it('fires an event with session ID if provided', function () {
				const idea = content({id: 5, ideas: {9: {id: 1, ideas: { '-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}}, 'sess'),
					listener = jasmine.createSpy('changeParent');
				idea.addEventListener('changed', listener);
				idea.changeParent(4, 5);
				expect(listener).toHaveBeenCalledWith('changeParent', [4, 5], 'sess');
			});
			it('fails if asked to make a idea its own parent', function () {
				expect(idea.changeParent(2, 2)).toBeFalsy();
			});
			it('fails if asked to make a cycle (make a idea a child of its own child)', function () {
				expect(idea.changeParent(1, 2)).toBeFalsy();
			});
			it('should convert types passed as ids for parent and child nodes', function () {
				expect(idea.changeParent(1, '2')).toBeFalsy();
				expect(idea.changeParent('1', 2)).toBeFalsy();
			});
			it('fails if asked to put an idea in its current parent', function () {
				expect(idea.changeParent(1, 5)).toBeFalsy();
			});
			it('pushes an operation to the undo stack if it succeeds', function () {
				idea.changeParent(4, 5);
				idea.undo();
				expect(idea.containsDirectChild(4)).toBeFalsy();
				expect(idea.ideas[1].ideas[9].containsDirectChild(4)).toBeTruthy();
			});
			it('should make a root node the child of the target', function () {
				idea = content({
					id: 'root',
					formatVersion: 3,
					ideas: {
						1: {id: 1},
						2: {id: 2}
					}
				});
				idea.changeParent(2, 1);
				expect(_.size(idea.ideas)).toBe(1);
				expect(idea.ideas[1].containsDirectChild(2)).toBeTruthy();
			});
			it('should not make a root node the child of one of its sub nodes', function () {
				idea = content({
					id: 'root',
					formatVersion: 3,
					ideas: {
						1: {id: 1, ideas: {
							1: {id: 2, ideas: {
								1: {id: 3}
							}}
						}}
					}
				});
				expect(idea.changeParent(1, 3)).toBeFalsy();
				expect(_.size(idea.ideas)).toBe(1);
				expect(idea.ideas[1].id).toEqual(1);
			});
		});
		describe('removeSubIdea', function () {
			it('removes a child idea matching the provided id', function () {
				const idea = content({id: 1, ideas: {5: {id: 2}, 10: {id: 3}, 15: {id: 4}}});
				expect(idea.removeSubIdea(2)).toBeTruthy();
				expect(_.size(idea.ideas[1].ideas)).toBe(2);
				expect(idea.ideas[1].ideas[10].id).toBe(3);
				expect(idea.ideas[1].ideas[15].id).toBe(4);
			});
			it('delegates to children if no immediate child matches id', function () {
				const idea = content({id: 0, ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}});
				expect(idea.removeSubIdea(3)).toBeTruthy();
				expect(_.size(idea.ideas[1].ideas[9].ideas)).toBe(2);
				expect(idea.ideas[1].ideas[9].ideas[-5].id).toBe(2);
				expect(idea.ideas[1].ideas[9].ideas[-15].id).toBe(4);
			});
			it('fails if no immediate child matches id', function () {
				const idea = content({id: 0, ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}}),
					listener = jasmine.createSpy();
				idea.addEventListener('changed', listener);
				expect(idea.removeSubIdea(13)).toBeFalsy();
				expect(listener).not.toHaveBeenCalled();
			});
			it('fires an event matching the method call if successful', function () {
				const idea = content({id: 0, ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}}),
					listener = jasmine.createSpy();
				idea.addEventListener('changed', listener);
				idea.removeSubIdea(3);
				expect(listener).toHaveBeenCalledWith('removeSubIdea', [3]);
			});
			it('fires an event with session ID if provided', function () {
				const idea = content({id: 0, ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}}, 'sess'),
					listener = jasmine.createSpy();
				idea.addEventListener('changed', listener);
				idea.removeSubIdea(3);
				expect(listener).toHaveBeenCalledWith('removeSubIdea', [3], 'sess');
			});
			it('pushes an event to undo stack if successful', function () {
				const idea = content({id: 1, ideas: {5: {id: 2}, 10: {id: 3}, 15: {id: 4}}});
				idea.removeSubIdea(2);
				idea.undo();
				expect(idea.ideas[1].ideas[5]).toEqual(jasmine.objectContaining({id: 2}));
			});
			it('should remove a root node if there is more than one', function () {
				const idea = content({id: 'root', formatVersion: 3, ideas: {5: {id: 1}, 15: {id: 2}}});
				expect(idea.removeSubIdea(1)).toBeTruthy();
				expect(_.size(idea.ideas)).toEqual(1);
				expect(_.size(idea.ideas[15])).toBeTruthy();
			});
			it('should not remove a root node if there is only one', function () {
				const idea = content({id: 'root', formatVersion: 3, ideas: {5: {id: 1}}});
				expect(idea.removeSubIdea(1)).toBeFalsy();
				expect(_.size(idea.ideas)).toEqual(1);
				expect(_.size(idea.ideas[5])).toBeTruthy();
			});
			it('should remove any links for the node', () => {
				const idea = content({
					id: 'root',
					formatVersion: 3,
					ideas: {
						5: {
							id: 31,
							ideas: {
								1: {
									id: 311
								}
							}
						},
						10: {
							id: 32,
							ideas: {
								1: {
									id: 321
								}
							}
						},
						15: {
							id: 33
						},
						20: {
							id: 34
						}
					},
					links: [
						{ideaIdFrom: 31, ideaIdTo: 32},
						{ideaIdFrom: 32, ideaIdTo: 33},
						{ideaIdFrom: 33, ideaIdTo: 31},
						{ideaIdFrom: 311, ideaIdTo: 321}
					]
				});
				idea.removeSubIdea(31);
				expect(idea.links).toEqual([{ideaIdFrom: 32, ideaIdTo: 33}]);
			});
		});
		describe('flip', function () {
			it('assigns the idea the largest positive rank if the current rank was negative', function () {
				const idea = content({id: 1, ideas: {'-5': {id: 2}, 10: {id: 3}, 15: {id: 4}}}),
					result = idea.flip(2);
				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas[10].id).toBe(3);
				expect(idea.ideas[1].ideas[15].id).toBe(4);
				expect(idea.ideas[1].findChildRankById(2)).not.toBeLessThan(15);
			});
			it('assigns the idea the smallest negative rank if the current rank was positive', function () {
				const idea = content({id: 1, ideas: {'-5': {id: 2}, 10: {id: 3}, 15: {id: 4}}}),
					result = idea.flip(3);
				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas['-5'].id).toBe(2);
				expect(idea.ideas[1].ideas[15].id).toBe(4);
				expect(idea.ideas[1].findChildRankById(3)).toBeLessThan(-5);
			});
			it('fails if called on idea that was not a child of the aggregate root', function () {
				const idea = content({id: 0, ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}});
				spyOn(idea, 'dispatchEvent');
				expect(idea.flip(2)).toBeFalsy();
				expect(idea.dispatchEvent).not.toHaveBeenCalled();
			});
			it('fails if called on non-existing idea that was not a child of the aggregate root', function () {
				const idea = content({id: 0, ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}});
				spyOn(idea, 'dispatchEvent');
				expect(idea.flip(99)).toBeFalsy();
				expect(idea.dispatchEvent).not.toHaveBeenCalled();
			});
			it('fires a flip event with arguments matching function call if successful', function () {
				const idea = content({id: 1, ideas: {'-5': {id: 2}, 10: {id: 3}, 15: {id: 4}}});
				spyOn(idea, 'dispatchEvent');
				idea.flip(2);
				expect(idea.dispatchEvent).toHaveBeenCalledWith('changed', 'flip', [2]);
			});
			it('fires an event with session ID if provided', function () {
				const idea = content({id: 1, ideas: {'-5': {id: 2}, 10: {id: 3}, 15: {id: 4}}}, 'sess');
				spyOn(idea, 'dispatchEvent');
				idea.flip(2);
				expect(idea.dispatchEvent).toHaveBeenCalledWith('changed', 'flip', [2], 'sess');
			});
			it('pushes an undo function on the event stack', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}}});
				let newRank = null;

				idea.flip(2);
				newRank = idea.findChildRankById(2);
				idea.undo();

				expect(idea.ideas[1].findChildRankById(2)).toBe(-5);
				expect(idea.ideas[1].ideas[newRank]).toBeUndefined();
			});
			it('should not undo if another session has subsequently flipped the idea', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}}});
				idea.flip(2);
				idea.execCommand('flip', [2], 'anotherSession');

				idea.undo();

				expect(idea.ideas[1].findChildRankById(2)).toBe(-10);
				expect(Object.keys(idea.ideas[1].ideas)).toEqual(['-10']);
			});
		});
		describe('getOrderedSiblingRanks', function () {
			let options, idea;
			beforeEach(function () {
				idea = content({id: 1, ideas: { '-5': { id: 20}, '-10': { id: 30}, '-15': {id: 40}, '5': { id: 2}, '10': { id: 3}, '15': {id: 4}}});
			});
			describe('when no options are supplied', function () {
				beforeEach(function () {
					options = undefined;
				});
				it('returns other positive ranks for nodeid of positive rank', function () {
					expect(idea.getOrderedSiblingRanks(2, options)).toEqual([5, 10, 15]);
				});
				it('returns other negative ranks for nodeid of negative rank', function () {
					expect(idea.getOrderedSiblingRanks(20, options)).toEqual([-5, -10, -15]);
				});
				it('returns falsy of nodeid not found', function () {
					expect(idea.getOrderedSiblingRanks(5, options)).toBeFalsy();
				});
			});
			describe('when ignoreRankSide option is supplied', function () {
				beforeEach(function () {
					options = {ignoreRankSide: true};
				});
				it('returns both positive and negative ranks for nodeid of positive rank', function () {
					expect(idea.getOrderedSiblingRanks(2, options)).toEqual([-15, -10, -5, 5, 10, 15]);
				});
				it('returns both positive and negative ranks for nodeid of negative rank', function () {
					expect(idea.getOrderedSiblingRanks(20, options)).toEqual([-15, -10, -5, 5, 10, 15]);
				});
				it('returns falsy of nodeid not found', function () {
					expect(idea.getOrderedSiblingRanks(5, options)).toBeFalsy();
				});
			});

		});
		describe('moveRelative', function () {
			let options, idea;
			describe('when no options are supplied', function () {
				beforeEach(function () {
					options = undefined;
				});
				describe('for positive ranks larger numbers are ranked later', function () {
					beforeEach(function () {
						idea = content({id: 1, ideas: {5: {id: 2}, 10: {id: 3},  15: {id: 4}}});
					});
					it('if movement is negative, moves an idea relative to its immediate previous siblings', function () {
						expect(idea.moveRelative(4, -1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '10': 3, '7.5': 4});
					});
					it('if movement is positive, moves an idea relative to its immediate following siblings', function () {
						expect(idea.moveRelative(2, 1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'12.5': 2, '10': 3, '15': 4});
					});
					it('moves to top', function () {
						expect(idea.moveRelative(3, -1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '2.5': 3, '15': 4});
					});
					it('does nothing if already on top and movement negative', function () {
						expect(idea.moveRelative(2, -1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '10': 3, '15': 4});
					});
					it('fails if no idea', function () {
						expect(idea.moveRelative(10, 1, options)).toBeFalsy();
					});
					it('does nothing if no idea', function () {
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '10': 3, '15': 4});
					});
					it('moves to bottom', function () {
						expect(idea.moveRelative(3, 1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '25': 3, '15': 4});
					});
					it('does nothing if already on bottom and movement positive', function () {
						expect(idea.moveRelative(15, 1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '10': 3, '15': 4});
					});

				});
				describe('for negative ranks, larger numbers are ranked earlier', function () {
					beforeEach(function () {
						idea = content({id: 1, ideas: { '-5': { id: 2}, '-10': { id: 3}, '-15': {id: 4}}});
					});
					it('moves an idea before its immediate previous sibling', function () {
						expect(idea.moveRelative(4, -1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-5': 2, '-10': 3, '-7.5': 4});
					});
					it('moves an idea after its immediate following sibling', function () {
						expect(idea.moveRelative(2, 1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-12.5': 2, '-10': 3, '-15': 4});
					});
					it('moves to top', function () {
						expect(idea.moveRelative(3, -1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-5': 2, '-2.5': 3, '-15': 4});
					});
					it('does nothing if already on top and movement negative', function () {
						expect(idea.moveRelative(2, -1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-5': 2, '-10': 3, '-15': 4});
					});
					it('fails if no idea', function () {
						expect(idea.moveRelative(10, 1, options)).toBeFalsy();
					});
					it('does nothing if no idea', function () {
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-5': 2, '-10': 3, '-15': 4});
					});
					it('moves to bottom', function () {
						expect(idea.moveRelative(3, 1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-5': 2, '-25': 3, '-15': 4});
					});
					it('does nothing if already on bottom and movement positive', function () {
						expect(idea.moveRelative(4, 1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-5': 2, '-10': 3, '-15': 4});
					});
				});
				describe('when there mixed positive and negative ranks, ordering of each side is considered separate', function () {
					beforeEach(function () {
						idea = content({id: 1, ideas: { '-5': { id: 20}, '-10': { id: 30}, '-15': {id: 40}, '5': { id: 2}, '10': { id: 3}, '15': {id: 4}}});
					});
					it('moves negative ideas to top', function () {
						expect(idea.moveRelative(30, -1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-5': 20, '-2.5': 30, '-15': 40, '5': 2, '10': 3, '15': 4});
					});
					it('does nothing if negative already on top and movement negative', function () {
						expect(idea.moveRelative(20, -1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-5': 20, '-10': 30, '-15': 40, '5': 2, '10': 3, '15': 4});
					});
					it('does nothing if negative already on bottom and movement positive', function () {
						expect(idea.moveRelative(40, 1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-5': 20, '-10': 30, '-15': 40, '5': 2, '10': 3, '15': 4});
					});
					it('does nothing if positive already on top and movement negative', function () {
						expect(idea.moveRelative(2, -1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-5': 20, '-10': 30, '-15': 40, '5': 2, '10': 3, '15': 4});
					});
					it('does nothing if positive already on bottom and movement positive', function () {
						expect(idea.moveRelative(4, 1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'-5': 20, '-10': 30, '-15': 40, '5': 2, '10': 3, '15': 4});
					});

				});
			});
			describe('when ignoreRankSide option is supplied', function () {
				beforeEach(function () {
					options = {ignoreRankSide: true};
				});
				describe('for positive ranks larger numbers are ranked later', function () {
					beforeEach(function () {
						idea = content({id: 1, ideas: {5: {id: 2}, 10: {id: 3},  15: {id: 4}}});
					});
					it('if movement is negative, moves an idea relative to its immediate previous siblings', function () {
						expect(idea.moveRelative(4, -1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '10': 3, '7.5': 4});
					});
					it('if movement is positive, moves an idea relative to its immediate following siblings', function () {
						expect(idea.moveRelative(2, 1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'12.5': 2, '10': 3, '15': 4});
					});
					it('moves to top', function () {
						expect(idea.moveRelative(3, -1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '2.5': 3, '15': 4});
					});
					it('does nothing if already on top and movement negative', function () {
						expect(idea.moveRelative(2, -1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '10': 3, '15': 4});
					});
					it('fails if no idea', function () {
						expect(idea.moveRelative(10, 1, options)).toBeFalsy();
					});
					it('does nothing if no idea', function () {
						idea.moveRelative(10, 1, options);
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '10': 3, '15': 4});
					});
					it('moves to bottom', function () {
						expect(idea.moveRelative(3, 1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '25': 3, '15': 4});
					});
					it('does nothing if already on bottom and movement positive', function () {
						expect(idea.moveRelative(15, 1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({'5': 2, '10': 3, '15': 4});
					});

				});
				describe('for negative ranks, larger numbers are ranked later', function () {
					beforeEach(function () {
						idea = content({id: 1, ideas: {
							'-15': {id: 4},
							'-10': { id: 3},
							'-5': { id: 2}
						}});
					});
					it('should move an idea before its immediate previous sibling', function () {
						expect(idea.moveRelative(2, -1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-15': 4,
							'-12.5': 2,
							'-10': 3
						});
					});
					it('moves an idea after its immediate following sibling', function () {
						expect(idea.moveRelative(4, 1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-10': 3,
							'-7.5': 4,
							'-5': 2
						});
					});
					it('moves to top', function () {
						expect(idea.moveRelative(3, -1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-25': 3,
							'-15': 4,
							'-5': 2
						});
					});
					it('does nothing if already on top and movement negative', function () {
						expect(idea.moveRelative(4, -1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-15': 4,
							'-10': 3,
							'-5': 2
						});
					});
					it('fails if no idea', function () {
						expect(idea.moveRelative(10, 1, options)).toBeFalsy();
					});
					it('does nothing if no idea', function () {
						idea.moveRelative(10, 1, options);
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-15': 4,
							'-10': 3,
							'-5': 2
						});
					});
					it('moves to bottom', function () {
						expect(idea.moveRelative(3, 1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-15': 4,
							'-5': 2,
							'-2.5': 3
						});
					});
					it('does nothing if already on bottom and movement positive', function () {
						expect(idea.moveRelative(2, 1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-15': 4,
							'-10': 3,
							'-5': 2
						});
					});
				});
				describe('when there mixed positive and negative ranks, ordering of each side is considered separate', function () {
					beforeEach(function () {
						idea = content({id: 1, ideas: {
							'-15': {id: 40},
							'-10': { id: 30},
							'-5': { id: 20},
							'5': { id: 2},
							'10': { id: 3},
							'15': {id: 4}
						}});
					});
					it('moves negative ideas to top', function () {
						expect(idea.moveRelative(30, -1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-25': 30,
							'-15': 40,
							'-5': 20,
							'5': 2,
							'10': 3,
							'15': 4
						});
					});
					it('does nothing if negative already on top and movement negative', function () {
						expect(idea.moveRelative(40, -1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-15': 40,
							'-10': 30,
							'-5': 20,
							'5': 2,
							'10': 3,
							'15': 4
						});
					});
					it('does nothing if positive already on bottom and movement positive', function () {
						expect(idea.moveRelative(4, 1, options)).toBeFalsy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-15': 40,
							'-10': 30,
							'-5': 20,
							'5': 2,
							'10': 3,
							'15': 4
						});
					});
					it('should move positive before negative when movement negative', function () {
						expect(idea.moveRelative(2, -1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-15': 40,
							'-10': 30,
							'-7.5': 2,
							'-5': 20,
							'10': 3,
							'15': 4
						});
					});
					it('should move negative before positive when movement positive', function () {
						expect(idea.moveRelative(20, 1, options)).toBeTruthy();
						expect(ideaIdsByRank(idea.ideas[1].ideas)).toEqual({
							'-15': 40,
							'-10': 30,
							'5': 2,
							'7.5': 20,
							'10': 3,
							'15': 4
						});
					});
				});
			});
		});
		describe('positionBefore', function () {
			it('prevents a node to be reordered into itself, if is it already in the right position (production bugcheck)', function () {
				const idea = content({id: 1, ideas: {1: {id: 2}, 2: {id: 4}, 3: {id: 6}, 4: {id: 8}, '-1': {id: 3}, '-2': {id: 5}, '-3': {id: 7}, '-4': {id: 9}}});
				expect(idea.positionBefore(5, 7)).toBeFalsy();
				expect(_.size(idea.ideas[1].ideas)).toBe(8);
			});
			it('ignores different sign ranks when ordering', function () {
				const idea = content({id: 1, ideas: {'-0.25': {id: 24}, '-10.25': {id: 32}, '0.0625': {id: 5}, '0.03125': {id: 6}, '1.0625': {id: 7}}});
				spyOn(idea, 'dispatchEvent');
				expect(idea.positionBefore(24, 32)).toBeFalsy();
				expect(idea.dispatchEvent).not.toHaveBeenCalled();
			});
			it('reorders immediate children by changing the rank of an idea to be immediately before the provided idea', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 10: { id: 3},  15: {id: 4}}}),
					result = idea.positionBefore(4, 3),
					newKey = idea.ideas[1].findChildRankById(4);

				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas[5].id).toBe(2);
				expect(idea.ideas[1].ideas[10].id).toBe(3);
				expect(newKey).toBeLessThan(10);
				expect(newKey).not.toBeLessThan(5);
			});
			it('fails if the idea should be ordered before itself', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 12: { id: 3},  15: {id: 4}}});
				spyOn(idea, 'dispatchEvent');

				expect(idea.positionBefore(3, 3)).toBeFalsy();
				expect(idea.ideas[1].ideas[5].id).toBe(2);
				expect(idea.ideas[1].ideas[12].id).toBe(3);
				expect(idea.ideas[1].ideas[15].id).toBe(4);
				expect(idea.dispatchEvent).not.toHaveBeenCalled();
			});
			it('fails if the idea should be ordered in the same place', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 12: { id: 3},  15: {id: 4}}});
				spyOn(idea, 'dispatchEvent');

				expect(idea.positionBefore(3, 4)).toBeFalsy();
				expect(idea.ideas[1].ideas[5].id).toBe(2);
				expect(idea.ideas[1].ideas[12].id).toBe(3);
				expect(idea.ideas[1].ideas[15].id).toBe(4);
				expect(idea.dispatchEvent).not.toHaveBeenCalled();
			});
			it('fails if it cannot find appropriate idea to reorder', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 10: { id: 3},  15: {id: 4}}}),
					result = idea.positionBefore(12, 3);
				expect(result).toBeFalsy();
			});
			it('fails if idea should be ordered before non-sibling', function () {
				const idea = content({
					id: 1,
					ideas: {
						5: {
							id: 2,
							ideas: {
								5: {
									id: 3
								},
								10: {
									id: 4
								}
							}
						},
						10: {
							id: 5,
							ideas: {
								5: {
									id: 6
								},
								10: {
									id: 7
								}
							}
						}
					}
				});
				spyOn(idea, 'dispatchEvent');

				expect(idea.positionBefore(6, 3)).toBe(false);
				expect(idea.ideas[1].ideas[10].ideas.NaN).not.toBeDefined();
				expect(idea.dispatchEvent).not.toHaveBeenCalled();
			});
			it('orders negative ideas as negative ranks', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}, '-10': { id: 3}, '-15': {id: 4}}}),
					result = idea.positionBefore(4, 3),
					newKey = idea.ideas[1].findChildRankById(4);

				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas[-5].id).toBe(2);
				expect(idea.ideas[1].ideas[-10].id).toBe(3);
				expect(newKey).not.toBeLessThan(-10);
				expect(newKey).toBeLessThan(-5);
			});
			it('puts the child in the first rank if the boundary idea was the first', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 10: { id: 3},  15: {id: 4}}}),
					result = idea.positionBefore(4, 2),
					newKey = idea.ideas[1].findChildRankById(4);

				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas[5].id).toBe(2);
				expect(idea.ideas[1].ideas[10].id).toBe(3);
				expect(newKey).toBeLessThan(5);
			});
			it('gives the idea the largest positive rank if the boundary idea was not defined and current rank was positive', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 10: { id: 3},  15: {id: 4}}}),
					result = idea.positionBefore(2),
					newKey = idea.ideas[1].findChildRankById(2);

				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas[10].id).toBe(3);
				expect(idea.ideas[1].ideas[15].id).toBe(4);
				expect(newKey).not.toBeLessThan(15);
			});
			it('fails if the boundary idea was not defined and child was already last', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 10: { id: 3},  15: {id: 4}}});
				spyOn(idea, 'dispatchEvent');

				expect(idea.positionBefore(4)).toBeFalsy();
				expect(idea.ideas[1].ideas[5].id).toBe(2);
				expect(idea.ideas[1].ideas[10].id).toBe(3);
				expect(idea.ideas[1].ideas[15].id).toBe(4);
				expect(idea.dispatchEvent).not.toHaveBeenCalled();
			});
			it('puts the child closest to zero from the - side if the boundary idea was the smallest negative', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}, '-10': { id: 3}, '-15': {id: 4}}}),
					result = idea.positionBefore(4, 2),
					newKey = idea.ideas[1].findChildRankById(4);

				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas[-5].id).toBe(2);
				expect(idea.ideas[1].ideas[-10].id).toBe(3);
				expect(newKey).not.toBeLessThan(-5);
				expect(newKey).toBeLessThan(0);
			});
			it('puts the child in the last negative rank if the boundary idea was not defined but current rank is negative', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}, '-10': { id: 3}, '-15': {id: 4}}}),
					result = idea.positionBefore(2),
					newKey = idea.ideas[1].findChildRankById(2);

				expect(result).toBeTruthy();
				expect(idea.ideas[1].ideas[-10].id).toBe(3);
				expect(idea.ideas[1].ideas[-15].id).toBe(4);
				expect(newKey).toBeLessThan(-15);
			});
			it('fails if the boundary idea was not defined and child was already last with negative ranks', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2}, '-10': { id: 3}, '-15': {id: 4}}});
				spyOn(idea, 'dispatchEvent');

				expect(idea.positionBefore(4)).toBeFalsy();
				expect(idea.ideas[1].ideas[-5].id).toBe(2);
				expect(idea.ideas[1].ideas[-10].id).toBe(3);
				expect(idea.ideas[1].ideas[-15].id).toBe(4);
				expect(idea.dispatchEvent).not.toHaveBeenCalled();
			});
			it('fails if the boundary idea was not defined and child was already last in its group (positive/negative)', function () {
				const idea = content({id: 1, ideas: {5: { id: 2}, 8: {id: 5}, '-10': {id: 3}, '-15': {id: 4}}});
				spyOn(idea, 'dispatchEvent');
				expect(idea.positionBefore(4)).toBeFalsy();
				expect(idea.positionBefore(5)).toBeFalsy();
				expect(idea.dispatchEvent).not.toHaveBeenCalled();
			});
			it('delegates to children if it does not contain the requested idea, succeeding if any child does', function () {
				const idea = content({id: 0, title: 'I0', ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}}),
					result = idea.positionBefore(4, 2),
					child = idea.ideas[1].ideas[9],
					newKey = child.findChildRankById(4);

				expect(result).toBeTruthy();
				expect(child.ideas[-5].id).toBe(2);
				expect(child.ideas[-10].id).toBe(3);
				expect(newKey).toBeLessThan(10);
				expect(newKey).not.toBeLessThan(-5);
				expect(newKey).toBeLessThan(0);
			});
			it('fails if none of the children contain the requested idea either', function () {
				const idea = content({id: 0, ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}}),
					result = idea.positionBefore(-4, 2);
				expect(result).toBeFalsy();
			});
			it('fires an event matching the method call if it succeeds', function () {
				const idea = content({id: 0, ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}}),
					childRankSpy = jasmine.createSpy();
				idea.addEventListener('changed', childRankSpy);
				idea.positionBefore(4, 2);
				expect(childRankSpy).toHaveBeenCalledWith('positionBefore', [4, 2]);
			});
			it('fires an event with session ID if defined', function () {
				const idea = content({id: 0, ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}}, 'sess'),
					childRankSpy = jasmine.createSpy();
				idea.addEventListener('changed', childRankSpy);
				idea.positionBefore(4, 2);
				expect(childRankSpy).toHaveBeenCalledWith('positionBefore', [4, 2], 'sess');
			});
			it('triggers correct session in a multi-session scenario when reordering children - bug resurrection check', function () {
				const idea = content({id: 0, ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}}, 'sess'),
					childRankSpy = jasmine.createSpy();
				idea.addEventListener('changed', childRankSpy);
				idea.execCommand('positionBefore', [4, 2], 'second');
				expect(childRankSpy).toHaveBeenCalledWith('positionBefore', [4, 2], 'second');
			});
			it('should work for negative ranks', function () {
				const idea = content({
					'title': '1',
					'id': 1,
					'ideas': {
						'-3': {
							'title': '4',
							'id': 4
						},
						'-2': {
							'title': '3',
							'id': 3
						},
						'-1': {
							'title': '2',
							'id': 2
						}
					}
				});
				expect(idea.positionBefore(2, 4)).toBe(true);
			});
			it('pushes an undo function onto the event stack if successful', function () {
				const idea = content({id: 1, ideas: { 5: { id: 2}, 10: { id: 3},  15: {id: 4}}});
				let newKey = '';
				idea.positionBefore(4, 3);

				newKey = idea.findChildRankById(4);
				idea.undo();

				expect(idea.ideas[1].ideas[15].id).toBe(4);
				expect(idea.ideas[1].ideas[newKey]).toBeUndefined();
				expect(_.size(idea.ideas[1].ideas)).toBe(3);
			});
		});
	});
	describe('redo', function () {
		let result;
		it('succeeds if there is something to redo', function () {
			const wrapped = content({id: 1, title: 'Original'});
			wrapped.updateTitle(1, 'First');
			wrapped.undo();

			result = wrapped.redo();
			expect(result).toBeTruthy();
			expect(wrapped.ideas[1].title).toBe('First');
		});
		it('fails if there is nothing to undo', function () {
			const wrapped = content({id: 1, title: 'Original'});
			wrapped.updateTitle(1, 'First');

			result = wrapped.redo();
			expect(result).toBeFalsy();
		});
		it('cancels the top undo from the stack', function () {
			const wrapped = content({id: 1, title: 'Original'});
			wrapped.updateTitle(1, 'First');
			wrapped.updateTitle(1, 'Second');
			wrapped.undo();

			result = wrapped.redo();
			expect(result).toBeTruthy();
			expect(wrapped.ideas[1].title).toBe('Second');
		});
		it('fires a change event if it succeeds', function () {
			const wrapped = content({id: 1, title: 'Original'}),
				spy = jasmine.createSpy('change');
			wrapped.updateTitle(1, 'First');
			wrapped.undo();
			wrapped.addEventListener('changed', spy);
			wrapped.redo();
			expect(spy).toHaveBeenCalledWith('redo', undefined, undefined);
		});
		it('fires an event with session ID if dedined', function () {
			const wrapped = content({id: 1, title: 'Original'}, 'sess'),
				spy = jasmine.createSpy('change');
			wrapped.updateTitle(1, 'First');
			wrapped.undo();
			wrapped.addEventListener('changed', spy);
			wrapped.redo();
			expect(spy).toHaveBeenCalledWith('redo', undefined, 'sess');
		});
		it('does not leave trailing redos if the last action was not caused by an undo/redo', function () {
			const wrapped = content({id: 1, title: 'Original'});
			wrapped.updateTitle(1, 'First');
			wrapped.undo();
			wrapped.updateTitle(1, 'Second');
			wrapped.redo();
			expect(wrapped.ideas[1].title).toBe('Second');
		});
		it('shortcut method only redos undos from current session', function () {
			const wrapped = content({id: 1, title: 'Original'}, 'session1');
			wrapped.updateTitle(1, 'First');
			wrapped.execCommand('addSubIdea', [1], 'session2');
			wrapped.undo();
			wrapped.execCommand('undo', [1], 'session2');
			wrapped.redo();
			expect(wrapped.ideas[1].title).toBe('First');
			expect(_.size(wrapped.ideas[1].ideas)).toBe(0);
		});
		it('command processor redos undos from the given session', function () {
			const wrapped = content({id: 1, title: 'Original'}, 'session1');
			wrapped.updateTitle(1, 'First');
			wrapped.execCommand('addSubIdea', [1], 'session2');
			wrapped.execCommand('undo', [1], 'session2');
			wrapped.undo();
			wrapped.execCommand('redo', [], 'session2');
			expect(wrapped.ideas[1].title).toBe('Original');
			expect(_.size(wrapped.ideas[1].ideas)).toBe(1);
		});
	});
	describe('undo', function () {
		it('succeeds if there is something to undo', function () {
			const wrapped = content({id: 1, title: 'Original'});
			wrapped.updateTitle(1, 'First');
			expect(wrapped.undo()).toBeTruthy();
			expect(wrapped.ideas[1].title).toBe('Original');
		});
		it('undos the top event from the stack', function () {
			const wrapped = content({id: 1, title: 'Original'});
			wrapped.updateTitle(1, 'First');
			wrapped.updateTitle(1, 'Second');
			wrapped.undo();
			expect(wrapped.ideas[1].title).toBe('First');
		});

		it('multiple changes stack on the undo stack in the order of recency', function () {
			const wrapped = content({id: 1, title: 'Original'});
			wrapped.updateTitle(1, 'First');
			wrapped.updateTitle(1, 'Second');
			wrapped.undo();
			wrapped.undo();
			expect(wrapped.ideas[1].title).toBe('Original');
		});
		it('fires a change event if it succeeds', function () {
			const wrapped = content({id: 1, title: 'Original'}),
				spy = jasmine.createSpy('change');
			wrapped.updateTitle(1, 'First');
			wrapped.addEventListener('changed', spy);
			wrapped.undo();
			expect(spy).toHaveBeenCalledWith('undo', [], undefined);
		});
		it('fires an event with session ID if defined', function () {
			const wrapped = content({id: 1, title: 'Original'}, 'sess'),
				spy = jasmine.createSpy('change');
			wrapped.updateTitle(1, 'First');
			wrapped.addEventListener('changed', spy);
			wrapped.undo();
			expect(spy).toHaveBeenCalledWith('undo', [], 'sess');
		});
		it('fails if there is nothing to undo', function () {
			const wrapped = content({id: 1, title: 'Original'}),
				spy = jasmine.createSpy('change');
			wrapped.addEventListener('changed', spy);
			expect(wrapped.undo()).toBeFalsy();
			expect(spy).not.toHaveBeenCalled();
		});
		it('shortcut method only undos events caused by the default session', function () {
			const wrapped = content({id: 1, title: 'Original'}, 'session1');
			wrapped.updateTitle(1, 'First');
			wrapped.execCommand('addSubIdea', [1], 'session2');
			wrapped.undo();
			expect(wrapped.ideas[1].title).toBe('Original');
			expect(_.size(wrapped.ideas[1].ideas)).toBe(1);
		});
		it('command processor undos events caused by the provided session', function () {
			const wrapped = content({id: 1, title: 'Original'}, 'session1');
			wrapped.execCommand('addSubIdea', [1], 'session2');
			wrapped.updateTitle(1, 'First');
			wrapped.execCommand('undo', [1], 'session2');
			wrapped.undo();
			expect(wrapped.ideas[1].title).toBe('Original');
			expect(_.size(wrapped.ideas[1].ideas)).toBe(0);
		});
	});
	describe('canUndo', function () {
		let underTest;
		beforeEach(function () {
			underTest = content({id: 1, title: 'Original'}, 'session1');
		});
		it('should be false before first change', function () {
			expect(underTest.canUndo()).toBe(false);
		});
		it('should be true when the idea can run an undo', function () {
			underTest.updateTitle(1, 'changed');
			expect(underTest.canUndo()).toBe(true);
		});
		it('should be false when the idea can not run an undo any more', function () {
			underTest.updateTitle(1, 'changed');
			underTest.undo();
			expect(underTest.canUndo()).toBe(false);
		});
		it('should be true if there are changes in the queue even after an undo', function () {
			underTest.updateTitle(1, 'changed');
			underTest.updateTitle(1, 'changed again');
			underTest.undo();
			expect(underTest.canUndo()).toBe(true);
		});
		describe('should not be affected by changes from other sessions', function () {
			it('does not consider external changes', function () {
				underTest.execCommand('addSubIdea', [1], 'session2');
				expect(underTest.canUndo()).toBe(false);
			});
			it('does not consider external undos', function () {
				underTest.updateTitle(1, 'changed');
				underTest.execCommand('addSubIdea', [1], 'session2');
				underTest.undo();
				expect(underTest.canUndo()).toBe(false);
			});
		});
	});
	describe('canRedo', function () {
		let underTest;
		beforeEach(function () {
			underTest = content({id: 1, title: 'Original'}, 'session1');
		});
		it('should be false before first change', function () {
			expect(underTest.canRedo()).toBe(false);
		});
		it('should be false before first undo', function () {
			underTest.updateTitle(1, 'changed');
			expect(underTest.canRedo()).toBe(false);
		});
		it('should be true when the idea after an undo', function () {
			underTest.updateTitle(1, 'changed');
			underTest.undo();
			expect(underTest.canRedo()).toBe(true);
		});
		it('should be false when the idea can not run an redo any more', function () {
			underTest.updateTitle(1, 'changed');
			underTest.undo();
			underTest.redo();
			expect(underTest.canRedo()).toBe(false);
		});
		it('should be true when there are still redos possible in case of multiple operations', function () {
			underTest.updateTitle(1, 'changed');
			underTest.updateTitle(1, 'changed again');
			underTest.undo();
			underTest.undo();
			underTest.redo();
			expect(underTest.canRedo()).toBe(true);
		});
		describe('should not be affected by changes from other sessions', function () {
			it('does not consider external changes', function () {
				underTest.execCommand('addSubIdea', [1], 'session2');
				underTest.execCommand('undo', [1], 'session2');
				expect(underTest.canRedo()).toBe(false);
			});
			it('does not consider external redos', function () {
				underTest.updateTitle(1, 'updated');
				underTest.undo();
				underTest.execCommand('redo', [1], 'session2');
				expect(underTest.canRedo()).toBe(true);
			});
		});

	});
	describe('command batching', function () {
		describe('batch shortcut method', function () {
			let wrapped, listener;
			beforeEach(function () {
				wrapped = content({id: 1, title: 'Original'});
				listener = jasmine.createSpy('listener');
				wrapped.addEventListener('changed', listener);
			});
			it('executes a batch as a shortcut method', function () {
				wrapped.batch(function () {
					wrapped.updateTitle(1, 'Mix');
					wrapped.updateTitle(1, 'Max');
				});
				expect(listener.calls.count()).toBe(1);
				expect(listener).toHaveBeenCalledWith('batch', [
					['updateTitle', 1, 'Mix'],
					['updateTitle', 1, 'Max']
				]);
			});
			it('does not create a separate batch if one already runs', function () {
				wrapped.batch(function () {
					wrapped.updateTitle(1, 'Mix');
					wrapped.batch(function () {
						wrapped.updateTitle(1, 'Max');
					});
				});
				expect(listener.calls.count()).toBe(1);
				expect(listener).toHaveBeenCalledWith('batch', [
					['updateTitle', 1, 'Mix'],
					['updateTitle', 1, 'Max']
				]);
			});
			it('returns the results of the batch operation', function () {
				expect(wrapped.batch(function () {
					return 'res1';
				})).toEqual('res1');
			});
			it('does not submit a batch in case of an exception', function () {
				let caughtError;
				try {
					wrapped.batch(function () {
						wrapped.updateTitle(1, 'Mix');
						wrapped.updateTitle(1, 'Max');
						throw 'z';
					});
				} catch (e) {
					caughtError = e;
				}
				expect(caughtError).toEqual('z');
				expect(wrapped.isBatchActive()).toBeFalsy();
				expect(listener).not.toHaveBeenCalled();
			});
		});
		describe('in local session', function () {
			let wrapped, listener;
			beforeEach(function () {
				wrapped = content({id: 1, title: 'Original'});
				listener = jasmine.createSpy();
				wrapped.addEventListener('changed', listener);
				wrapped.startBatch();
				wrapped.updateTitle(1, 'Mix');
				wrapped.updateTitle(1, 'Max');
			});
			it('sends out a single event for the entire batch', function () {
				wrapped.endBatch();
				expect(listener.calls.count()).toBe(1);
				expect(listener).toHaveBeenCalledWith('batch', [
					['updateTitle', 1, 'Mix'],
					['updateTitle', 1, 'Max']
				]);
			});
			it('does not send the event if the batch is discarded', function () {
				wrapped.discardBatch();
				expect(listener).not.toHaveBeenCalled();
				expect(wrapped.isBatchActive()).toBeFalsy();
			});
			it('will open a new batch if starting and there is an open one', function () {
				wrapped.startBatch();
				wrapped.updateTitle(1, 'Nox');
				wrapped.updateTitle(1, 'Vox');
				wrapped.endBatch();

				expect(listener.calls.count()).toBe(2);
				expect(listener).toHaveBeenCalledWith('batch', [
					['updateTitle', 1, 'Mix'],
					['updateTitle', 1, 'Max']
				]);
				expect(listener).toHaveBeenCalledWith('batch', [
					['updateTitle', 1, 'Nox'],
					['updateTitle', 1, 'Vox']
				]);
			});
			it('will not send out an empty batch', function () {
				wrapped = content({id: 1, title: 'Original'});
				listener = jasmine.createSpy();
				wrapped.addEventListener('changed', listener);
				wrapped.startBatch();
				wrapped.endBatch();

				expect(listener).not.toHaveBeenCalled();
			});
			it('will not send out an undefined batch', function () {
				wrapped = content({id: 1, title: 'Original'});
				listener = jasmine.createSpy();
				wrapped.addEventListener('changed', listener);
				wrapped.endBatch();

				expect(listener).not.toHaveBeenCalled();
			});
			it('supports mixing batched and non batched commands', function () {
				wrapped.endBatch();
				wrapped.addSubIdea(1);
				expect(listener.calls.count()).toBe(2);
				expect(listener.calls.first().args[0]).toBe('batch');
				expect(listener.calls.all()[1].args[0]).toBe('addSubIdea');
			});
			it('does not confuse non batched commands after an empty batch', function () {
				wrapped.endBatch();
				wrapped.startBatch();
				wrapped.endBatch();
				wrapped.addSubIdea(1);
				expect(listener.calls.count()).toBe(2);
				expect(listener.calls.first().args[0]).toBe('batch');
				expect(listener.calls.all()[1].args[0]).toBe('addSubIdea');
			});
			it('will send the event directly instead of a batch with a single event', function () {
				wrapped = content({id: 1, title: 'Original'});
				listener = jasmine.createSpy();
				wrapped.addEventListener('changed', listener);
				wrapped.startBatch();
				wrapped.updateTitle(1, 'New');
				wrapped.endBatch();

				expect(listener).toHaveBeenCalledWith('updateTitle', [1, 'New']);
			});
			it('undoes an entire batch', function () {
				wrapped.endBatch();

				wrapped.undo();

				expect(wrapped.ideas[1].title).toBe('Original');
				expect(listener.calls.count()).toBe(2);
			});
			it('undos an open batch as a separate event', function () {
				wrapped.undo();

				expect(wrapped.ideas[1].title).toBe('Original');
				expect(listener.calls.count()).toBe(2);
			});
			it('redos an entire batch', function () {
				wrapped.endBatch();
				wrapped.undo();

				wrapped.redo();

				expect(wrapped.ideas[1].title).toBe('Max');
			});
			it('redos an open batch', function () {
				wrapped.undo();

				wrapped.redo();

				expect(wrapped.ideas[1].title).toBe('Max');
			});
			it('redos in correct order', function () {
				const newId = wrapped.addSubIdea(1, 'Hello World');
				wrapped.updateTitle(newId, 'Yello World');
				wrapped.endBatch();
				wrapped.undo();
				wrapped.redo();

				expect(wrapped.findSubIdeaById(newId).title).toBe('Yello World');
			});
		});
		describe('with sessions', function () {
			let wrapped, listener;
			beforeEach(function () {
				wrapped = content({id: 1, title: 'Original'}, 'session1');
				listener = jasmine.createSpy();
				wrapped.addEventListener('changed', listener);
				wrapped.execCommand('batch', [
					['updateTitle', 1, 'Mix'],
					['updateTitle', 1, 'Max']
				], 'session2');
			});
			it('sends out a single event for the entire batch', function () {
				expect(listener.calls.count()).toBe(1);
				expect(listener).toHaveBeenCalledWith('batch', [
					['updateTitle', 1, 'Mix'],
					['updateTitle', 1, 'Max']
				], 'session2');
			});
			it('undos an entire batch as a single event', function () {
				wrapped.execCommand('undo', [], 'session2');

				expect(wrapped.ideas[1].title).toBe('Original');
				expect(listener.calls.count()).toBe(2);
			});
			it('redos an entire batch as a single event', function () {
				wrapped.execCommand('undo', [], 'session2');

				wrapped.execCommand('redo', [], 'session2');

				expect(wrapped.ideas[1].title).toBe('Max');
				expect(listener.calls.count()).toBe(3);
			});
		});
		describe('across sessions', function () {
			let wrapped;
			beforeEach(function () {
				wrapped = content({id: 1, title: 'Original'}, 'session1');
				wrapped.startBatch();
				wrapped.addSubIdea(1);
				wrapped.execCommand('batch', [
					['updateTitle', 1, 'Mix'],
					['updateTitle', 1, 'Max']
				], 'session2');
				wrapped.addSubIdea(1);
				wrapped.endBatch();
			});
			describe('tracks batches for each session separately', function () {
				it('undos local batches without messing up remote batches', function () {
					wrapped.undo();
					expect(_.size(wrapped.ideas[1].ideas)).toBe(0);
					expect(wrapped.ideas[1].title).toBe('Max');
				});
				it('undos remote batches without messing up local batches', function () {
					wrapped.execCommand('undo', [], 'session2');
					expect(_.size(wrapped.ideas[1].ideas)).toBe(2);
					expect(wrapped.ideas[1].title).toBe('Original');
				});
			});
		});
		describe('isBatchActive', function () {
			let wrapped;
			beforeEach(function () {
				wrapped = content({id: 1, title: 'Original'}, 'session1');
			});
			it('is false if no batch running for session', function () {
				expect(wrapped.isBatchActive('abc')).toBeFalsy();
			});
			it('is true if batch is running for a session', function () {
				wrapped.startBatch('abc');
				expect(wrapped.isBatchActive('abc')).toBeTruthy();
			});
			it('is false if batch is closed for a session', function () {
				wrapped.startBatch('abc');
				wrapped.endBatch('abc');
				expect(wrapped.isBatchActive('abc')).toBeFalsy();
			});
			it('is true within the batch method', function () {
				wrapped.batch(function () {
					expect(wrapped.isBatchActive()).toBeTruthy();
				});
				expect(wrapped.isBatchActive()).toBeFalsy();
			});
			it('checks local session if no arg provided', function () {
				wrapped.startBatch();
				expect(wrapped.isBatchActive()).toBeTruthy();
			});
			it('checks only the provided session', function () {
				wrapped.startBatch('abc');
				expect(wrapped.isBatchActive('def')).toBeFalsy();
			});
		});
	});
	describe('links', function () {
		let idea, result;
		beforeEach(function () {
			idea = content({
				id: 1,
				title: 'Node 1',
				ideas: {
					1: {
						id: 2,
						title: 'Node 2'
					},
					2: {
						id: 3,
						title: 'Node 3'
					}
				}
			});
		});
		it('should add a link between two ideas when addLink method is called', function () {
			const result = idea.addLink(2, 3);

			expect(result).toBe(true);
		});
		it('should remove link when start node is removed', function () {
			idea.addLink(2, 3);
			idea.removeSubIdea(2);
			expect(_.size(idea.links)).toBe(0);
		});
		it('should remove link when end node is removed', function () {
			idea.addLink(2, 3);
			idea.removeSubIdea(3);
			expect(_.size(idea.links)).toBe(0);
		});
		it('should put link removal into undo stack when node is removed', function () {
			idea.addLink(2, 3);
			idea.removeSubIdea(3);
			idea.undo();
			expect(_.size(idea.links)).toBe(1);
		});
		it('should dispatch a changed event when addLink method is called', function () {
			const changedListener = jasmine.createSpy();
			idea.addEventListener('changed', changedListener);

			idea.addLink(2, 3);

			expect(changedListener).toHaveBeenCalledWith('addLink', [2, 3]);
		});
		it('should dispatch a changed event with session ID if dedined', function () {
			const idea = content({id: 1, ideas: {1: {id: 2}, 2: { id: 3}}}, 'sess'),
				changedListener = jasmine.createSpy();
			idea.addEventListener('changed', changedListener);

			idea.addLink(2, 3);

			expect(changedListener).toHaveBeenCalledWith('addLink', [2, 3], 'sess');
		});
		it('should not be able to add link if both nodes don\'t exist', function () {
			const changedListener = jasmine.createSpy();
			idea.addEventListener('changed', changedListener);

			result = idea.addLink(1, 22);

			expect(result).toBe(false);
			expect(idea.links).not.toBeDefined();
			expect(changedListener).not.toHaveBeenCalled();
		});
		it('should not be able to create a link between same two nodes', function () {
			const changedListener = jasmine.createSpy();
			idea.addEventListener('changed', changedListener);

			result = idea.addLink(2, 2);

			expect(result).toBe(false);
			expect(idea.links).not.toBeDefined();
			expect(changedListener).not.toHaveBeenCalledWith('addLink', 2, 2);
		});
		it('should not be able to create a link between a parent and a child', function () {
			const changedListener = jasmine.createSpy();
			idea.addEventListener('changed', changedListener);

			result = idea.addLink(1, 2);

			expect(result).toBe(false);
			expect(idea.links).not.toBeDefined();
			expect(changedListener).not.toHaveBeenCalledWith('addLink', 1, 2);
		});
		it('should not be able to add the same link twice', function () {
			const changedListener = jasmine.createSpy();
			idea.addLink(2, 3);
			idea.addEventListener('changed', changedListener);

			result = idea.addLink(2, 3);

			expect(result).toBe(false);
			expect(idea.links.length).toBe(1);
			expect(idea.links[0]).toEqual(jasmine.objectContaining({
				ideaIdFrom: 2,
				ideaIdTo: 3
			}));
			expect(changedListener).not.toHaveBeenCalled();
		});
		it('should not be able to add the link in the opposite direction of an already existing link', function () {
			const changedListener = jasmine.createSpy();
			idea.addLink(2, 3);
			idea.addEventListener('changed', changedListener);

			result = idea.addLink(3, 2);

			expect(result).toBe(false);
			expect(idea.links.length).toBe(1);
			expect(idea.links[0]).toEqual(jasmine.objectContaining({
				ideaIdFrom: 2,
				ideaIdTo: 3
			}));
			expect(changedListener).not.toHaveBeenCalled();
		});
		it('should remove a link when removeLink method is invoked', function () {
			const changedListener = jasmine.createSpy();
			idea.addLink(2, 3);
			idea.addEventListener('changed', changedListener);

			result = idea.removeLink(2, 3);

			expect(result).toBe(true);
			expect(idea.links).toEqual([]);
			expect(changedListener).toHaveBeenCalledWith('removeLink', [2, 3]);
		});
		it('should fire an event with session ID if provided when remove link is invoked', function () {
			const idea = content({id: 1, ideas: {1: {id: 2}, 2: { id: 3}}}, 'sess'),
				changedListener = jasmine.createSpy();
			idea.addLink(2, 3);
			idea.addEventListener('changed', changedListener);

			idea.removeLink(2, 3);

			expect(changedListener).toHaveBeenCalledWith('removeLink', [2, 3], 'sess');
		});
		it('should not be able to remove link that does not exist', function () {
			const changedListener = jasmine.createSpy();
			idea.addLink(2, 3);
			idea.addEventListener('changed', changedListener);

			result = idea.removeLink(1, 1);

			expect(result).toBe(false);
			expect(idea.links.length).toBe(1);
			expect(idea.links[0]).toEqual(jasmine.objectContaining({
				ideaIdFrom: 2,
				ideaIdTo: 3
			}));
			expect(changedListener).not.toHaveBeenCalled();
		});
		it('should allow a link attribute to be set on the aggregate', function () {
			const changedListener = jasmine.createSpy();
			idea.addEventListener('changed', changedListener);
			idea.addLink(2, 3);

			result = idea.updateLinkAttr(2, 3, 'newAttr', 'newValue');

			expect(result).toBe(true);
			expect(idea.getLinkAttr(2, 3, 'newAttr')).toBe('newValue');
			expect(changedListener).toHaveBeenCalledWith('updateLinkAttr', [2, 3, 'newAttr', 'newValue']);
		});
		it('should return false when trying to set the attribute of a non-existing link', function () {
			const result = idea.updateLinkAttr(2, 3, 'newAttr', 'newValue');

			expect(result).toBe(false);
		});
	});
	describe('support for multiple versions', function () {
		it('should append current format version', function () {
			const wrapped = content({title: 'My Idea'});
			expect(wrapped.formatVersion).toBe(3);
		});
		it('should upgrade from version 1 by splitting background and collapsed', function () {
			const wrapped = content({title: 'My Idea', style: {background: 'black', collapsed: true}});

			expect(wrapped.ideas[1].style).toBeUndefined();
			expect(wrapped.ideas[1].attr.style.background).toBe('black');
			expect(wrapped.ideas[1].attr.style.collapsed).toBeUndefined();
			expect(wrapped.ideas[1].attr.collapsed).toBe(true);
		});
		it('should upgrade recursively', function () {
			const wrapped = content({title: 'asdf', ideas: { 1: {title: 'My Idea', style: {background: 'black', collapsed: true}}}});

			expect(wrapped.ideas[1].ideas[1].style).toBeUndefined();
			expect(wrapped.ideas[1].ideas[1].attr.style.background).toBe('black');
			expect(wrapped.ideas[1].ideas[1].attr.style.collapsed).toBeUndefined();
			expect(wrapped.ideas[1].ideas[1].attr.collapsed).toBe(true);
		});
		it('should not upgrade if formatVersion is 3', function () {
			const wrapped = content({title: 'My Idea', attr: { style: {background: 'black'}, collapsed: true }, formatVersion: 3});

			expect(wrapped.attr.style).toEqual({background: 'black'});
			expect(wrapped.attr.collapsed).toEqual(true);
		});
	});
	describe('support for multi-node operations', function () {
		describe('cloneMultiple', function () {
			it('should return an array of cloned ideas when given an array of idea IDs', function () {
				const idea = content({id: 1, ideas: { '-5': { id: 2, title: 'copy me', attr: {background: 'red'}, ideas: {'5': {id: 66, title: 'hey there'}}}, '-10': { id: 3}, '-15': {id: 4}}}),
					result = idea.cloneMultiple([2, 3]);
				expect(result[0]).toEqual(JSON.parse(JSON.stringify(idea.ideas[1].ideas['-5'])));
				expect(result[0]).not.toBe(idea.ideas[1].ideas['-5']);
				expect(result[1]).toEqual(JSON.parse(JSON.stringify(idea.ideas[1].ideas['-10'])));
				expect(result[1]).not.toBe(idea.ideas[1].ideas['-10']);
			});
		});
		describe('removeMultiple', function () {
			let idea, result;
			beforeEach(function () {
				idea = content({id: 0, ideas: {9: {id: 1, ideas: {'-5': {id: 2}, '-10': {id: 3}, '-15': {id: 4}}}}});
				result = idea.removeMultiple([2, 3, 6]);
			});
			it('removes subideas given as an array of IDs', function () {
				expect(_.size(idea.ideas[1].ideas[9].ideas)).toBe(1);
				expect(idea.ideas[1].ideas[9].ideas[-15].id).toBe(4);
			});
			it('batches the removal', function () {
				idea.undo();
				expect(_.size(idea.ideas[1].ideas[9].ideas)).toBe(3);
				expect(idea.ideas[1].ideas[9].ideas[-15].id).toBe(4);
				expect(idea.ideas[1].ideas[9].ideas[-5].id).toBe(2);
				expect(idea.ideas[1].ideas[9].ideas[-10].id).toBe(3);
			});
			it('returns an array of removal results', function () {
				expect(result).toEqual([true, true, false]);
			});
		});
		describe('pasteMultiple', function () {
			let idea, toPaste, result;
			beforeEach(function () {
				idea = content({id: 1, title: 'original', ideas: {'-10': { id: 3}, '-15': {id: 4}}});
				idea.setConfiguration({
					nonClonedAttributes: ['noncloned']
				});
				toPaste = [{title: 'pasted', id: 1, ideas: {1: { id: 66, attr: {cloned: 1, noncloned: 2}, title: 'sub sub'}}}, {title: 'pasted2'}];
			});
			it('cleans up attributes', function () {
				result = idea.pasteMultiple(3, toPaste);
				expect(idea.ideas[1].ideas[-10].ideas[1].ideas[1].attr).toEqual({cloned: 1});
			});
			it('pastes an array of JSONs into the subidea idea by id', function () {
				result = idea.pasteMultiple(3, toPaste);
				expect(idea.ideas[1].ideas[-10].ideas[1].title).toBe('pasted');
				expect(idea.ideas[1].ideas[-10].ideas[1].id).toBe(5);
				expect(idea.ideas[1].ideas[-10].ideas[1].ideas[1].title).toBe('sub sub');
				expect(idea.ideas[1].ideas[-10].ideas[1].ideas[1].id).toBe(6);
				expect(idea.ideas[1].ideas[-10].ideas[2].title).toBe('pasted2');
				expect(idea.ideas[1].ideas[-10].ideas[2].id).toBe(7);
			});
			it('batches the paste', function () {
				result = idea.pasteMultiple(3, toPaste);
				idea.undo();
				expect(idea.ideas[1].ideas[-10].ideas).toEqual({});
			});
			it('does not create a batch if one is already active', function () {
				idea.batch(function () {
					idea.updateTitle(1, 'updated');
					idea.pasteMultiple(3, toPaste);
				});
				idea.undo();

				expect(idea.ideas[1].ideas[-10].ideas).toEqual({});
				expect(idea.findSubIdeaById(1).title).toEqual('original');
			});
			it('returns an array of pasting results', function () {
				result = idea.pasteMultiple(3, toPaste);
				expect(result).toEqual([5, 7]);
			});
		});
		describe('insertIntermediateMultiple', function () {
			let idea, result;
			beforeEach(function () {
				idea = content({id: 1, ideas: {77: {id: 2, title: 'Moved'}, 88: {id: 3, title: 'also', ideas: { 99: {id: 4, title: 'under'}}}}});
				result = idea.insertIntermediateMultiple([4, 2]);
			});
			it('adds an idea in front of first provided idea in array and reparents all other ideas', function () {
				const newIdea = idea.ideas[1].ideas[88].ideas[99];
				expect(newIdea.id).toEqual(5);
				expect(_.size(idea.ideas[1].ideas)).toBe(1);
				expect(_.size(newIdea.ideas)).toBe(2);
				expect(newIdea.ideas[1]).toEqual(jasmine.objectContaining({id: 4, title: 'under'}));
				expect(newIdea.ideas[2]).toEqual(jasmine.objectContaining({id: 2, title: 'Moved'}));
			});
			it('returns the new node id', function () {
				expect(result).toEqual(5);
			});
			it('batches the operation', function () {
				idea.undo();
				const oldIdea = idea.ideas[1].ideas[88].ideas[99];
				expect(_.size(idea.ideas[1].ideas)).toBe(2);
				expect(_.size(oldIdea.ideas)).toBe(0);
				expect(oldIdea).toEqual(jasmine.objectContaining({id: 4, title: 'under'}));
				expect(idea.ideas[1].ideas[77]).toEqual(jasmine.objectContaining({id: 2, title: 'Moved'}));
			});
			it('assigns attributes to new node', function () {
				idea = content({id: 1, ideas: {77: {id: 2, title: 'Moved'}, 88: {id: 3, title: 'also', ideas: { 99: {id: 4, title: 'under'}}}}});
				result = idea.insertIntermediateMultiple([4, 2], { attr: {group: 'blue'}});
				expect(idea.findSubIdeaById(result).attr).toEqual({group: 'blue'});
			});
			it('assigns title to new node', function () {
				idea = content({id: 1, ideas: {77: {id: 2, title: 'Moved'}, 88: {id: 3, title: 'also', ideas: { 99: {id: 4, title: 'under'}}}}});
				result = idea.insertIntermediateMultiple([4, 2], { title: 'tom'});
				expect(idea.findSubIdeaById(result).title).toEqual('tom');
			});
		});
	});
	describe('traverse', function () {
		it('applies a depth-first, pre-order traversal', function () {
			const contentAggregate = content({ id: 1, ideas: { '11': {id: 11, ideas: { 1: { id: 111}, 2: {id: 112} } }, '-12': {id: 12, ideas: { 1: {id: 121} } }, '-13': {id: 13} } }),
				result = [];
			contentAggregate.traverse(function (idea) {
				result.push(idea.id);
			});
			expect(result).toEqual([1, 11, 111, 112, 12, 121, 13]);
		});
		it('does a post-order traversal if second argument is true', function () {
			const contentAggregate = content({ id: 1, ideas: { '11': {id: 11, ideas: { 1: { id: 111}, 2: {id: 112} } }, '-12': {id: 12, ideas: { 1: {id: 121} } }, '-13': {id: 13} } }),
				result = [];
			contentAggregate.traverse(function (idea) {
				result.push(idea.id);
			}, true);
			expect(result).toEqual([111, 112, 11, 121, 12, 13, 1]);
		});
	});
	describe('resource management', function () {
		let underTest;
		beforeEach(function () {
			underTest = content({title: 'test'});
		});
		it('stores a resource without cloning (to save memory) and returns the new resource ID in the format NUM/UNIQUE-UUID/', function () {
			const arr = [1, 2, 3, 4, 5],
				result = underTest.storeResource(arr);
			expect(result).toMatch(/^[0-9/+\/[a-z0-9-]*\/$/);
			expect(underTest.resources[result]).toEqual(arr);
			arr.push(6);
			expect(underTest.resources[result][5]).toBe(6);
		});
		it('stores a resource using execCommand', function () {
			const listener = jasmine.createSpy('resource');
			underTest.addEventListener('resourceStored', listener);
			underTest.execCommand('storeResource', ['resbody', 'resurl'], 'remoteSession');

			expect(underTest.resources.resurl).toEqual('resbody');
			expect(listener).toHaveBeenCalledWith('resbody', 'resurl', 'remoteSession');
		});
		it('generates a unique UUID with every contentAggregate initialisation to avoid fake cache hits', function () {
			const secondcontent = content({title: 'test'}),
				firstKey = underTest.storeResource('123'),
				secondKey = secondcontent.storeResource('123');
			expect(firstKey).not.toEqual(secondKey);
		});
		it('appends the session key to the unique ID if session exists', function () {
			const secondcontent = content({title: 'test'}, 'session1'),
				secondKey = secondcontent.storeResource('123');
			expect(secondKey).toMatch(/^[0-9/+\/[a-z0-9-]*\/session1$/);
		});
		it('retrieves the resource contentAggregate without cloning (to save memory)', function () {
			underTest.resources = {abc: [1, 2, 3]};
			expect(underTest.getResource('abc')).toEqual([1, 2, 3]);
			underTest.getResource('abc').push(4);
			expect(underTest.resources.abc[3]).toEqual(4);
		});
		it('starts IDs with 1, as a string, without session', function () {
			expect(underTest.storeResource('xx')).toMatch(/^1\//);
		});
		it('starts with ID 1.sessionId with session', function () {
			underTest = content({}, 'sk');
			expect(underTest.storeResource('xx')).toMatch(/1\/[0-9a-z-]+\/sk/);
		});
		it('assigns sequential resource IDs without session', function () {
			underTest = content({title: 'test', resources: {'5/1/session1': 'r1', '7/2/session1': 'r2', '9/2/session2': 'r3', '10': 'r4'}});
			const key = underTest.storeResource('abc');
			expect(key).toMatch(/^11\//);
		});

		describe('assigning URLs', function () {
			let listener;
			beforeEach(function () {
				listener = jasmine.createSpy('resource');
				underTest = content({title: 'test', resources: {'5/1/session1': 'r1', '7/2/session1': 'r2', '9/2/session2': 'r3', '10': 'r4'}}, 'session1');
				underTest.addEventListener('resourceStored', listener);
			});
			it('assigns sequential resource IDs for the session if the contentAggregate does not match', function () {
				const key = underTest.storeResource('abc');
				expect(key).toMatch(/^8\/[^\/]+\/session1$/);
				expect(listener).toHaveBeenCalled();
			});
			it('re-assigns the same URL for the same contentAggregate - without firing an event - if the key is not supplied and the contentAggregate matches', function () {
				const key = underTest.storeResource('r3');
				expect(key).toEqual('9/2/session2');
				expect(listener).not.toHaveBeenCalled();
			});
			it('does not re-assign the same URL for the same contentAggregate and fires an event if the key is supplied even if the contentAggregate matches', function () {
				const key = underTest.storeResource('r3', '6/6/6');
				expect(key).toEqual('6/6/6');
				expect(listener).toHaveBeenCalledWith('r3', '6/6/6', 'session1');
			});
		});
		it('fires event when resource added without cloning the resource (to save memory)', function () {
			const arr = [1, 2, 3, 4, 5],
				listener = jasmine.createSpy('resource');
			let result = '';

			underTest = content({title: 'A'}, 'session1');
			underTest.addEventListener('resourceStored', listener);
			result = underTest.storeResource(arr);
			expect(listener).toHaveBeenCalledWith(arr, result, 'session1');
			arr.push(6);
			expect(listener.calls.mostRecent().args[0][5]).toEqual(6);
		});
		it('adds a resource with a particular key if provided', function () {
			const key = underTest.storeResource('abc');
			underTest.storeResource('def', key);
			expect(underTest.getResource(key)).toEqual('def');
		});
	});
	describe('hasSiblings', function () {
		let underTest;
		beforeEach(function () {
			underTest = content({
				id: 1,
				ideas: {
					1: {
						id: 2,
						ideas: {
							11: {id: 4},
							12: {id: 5},
							13: {id: 6}
						}
					},
					'-1': {
						id: 3,
						ideas: {
							21: {id: 7}
						}
					}
				}
			}, 'session1');
		});
		it('should return false if there are no siblings', function () {
			expect(underTest.hasSiblings(1)).toBeFalsy();
			expect(underTest.hasSiblings(7)).toBeFalsy();
		});
		it('should return false if node id does not exist', function () {
			expect(underTest.hasSiblings(17)).toBeFalsy();
		});
		it('should return true if there are siblings on same side', function () {
			expect(underTest.hasSiblings(4)).toBeTruthy();
			expect(underTest.hasSiblings(5)).toBeTruthy();
			expect(underTest.hasSiblings(6)).toBeTruthy();
		});
		it('should return true if siblings are on different sides', function () {
			expect(underTest.hasSiblings(2)).toBeTruthy();
			expect(underTest.hasSiblings(3)).toBeTruthy();
		});
	});
});
