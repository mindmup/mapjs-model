/*global describe, it, expect, require*/
var traverse = require('../src/traverse');
describe('traverse', function () {
	'use strict';
	describe('when version is not specified (so non root nodes or v2)', function () {
		it('applies a depth-first, pre-order traversal', function () {
			var content = {  id: 1, ideas: { '11': {id: 11, ideas: { 1: { id: 111}, 2: {id: 112} } }, '-12': {id: 12, ideas: { 1: {id: 121} } }, '-13' : {id: 13} } },
			result = [];
			traverse(content, function (idea) {
				result.push(idea.id);
			});
			expect(result).toEqual([1, 11, 111, 112, 12, 121, 13]);
		});
		it('does a post-order traversal if second argument is true', function () {
			var content = { id: 1, ideas: { '11': {id: 11, ideas: { 1: { id: 111}, 2: {id: 112} } }, '-12': {id: 12, ideas: { 1: {id: 121} } }, '-13' : {id: 13} } },
			result = [];
			traverse(content, function (idea) {
				result.push(idea.id);
			}, true);
			expect(result).toEqual([111, 112, 11, 121, 12, 13, 1]);
		});
	});
	describe('v3', function () {
		it('skips root node in preorder traversal', function () {
			var content = { formatVersion: 3, id: 1, ideas: { '11': {id: 11, ideas: { 1: { id: 111}, 2: {id: 112} } }, '-12': {id: 12, ideas: { 1: {id: 121} } }, '-13' : {id: 13} } },
			result = [];
			traverse(content, function (idea) {
				result.push(idea.id);
			});
			expect(result).toEqual([11, 111, 112, 12, 121, 13]);
		});
		it('skips root node in postoder traversal', function () {
			var content = { id: 1, formatVersion: 3, ideas: { '11': {id: 11, ideas: { 1: { id: 111}, 2: {id: 112} } }, '-12': {id: 12, ideas: { 1: {id: 121} } }, '-13' : {id: 13} } },
			result = [];
			traverse(content, function (idea) {
				result.push(idea.id);
			}, true);
			expect(result).toEqual([111, 112, 11, 121, 12, 13]);
		});
	});
});

