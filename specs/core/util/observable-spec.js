/*global require, describe, it, jasmine, beforeEach, expect, spyOn, console */
const observable = require('../../../src/core/util/observable');
describe('Observable', function () {
	'use strict';
	let obs, listener;
	beforeEach(function () {
		obs = observable({});
		listener = jasmine.createSpy('Listener');
	});
	it('allows subscribers to observe an event', function () {
		obs.addEventListener('TestEvt', listener);
		obs.dispatchEvent('TestEvt', 'some', 'args');
		expect(listener).toHaveBeenCalledWith('some', 'args');
	});
	it('allows multiple subscribers to observe the same event', function () {
		obs.addEventListener('TestEvt', function () {});
		obs.addEventListener('TestEvt', listener);
		obs.dispatchEvent('TestEvt', 'some', 'args');
		expect(listener).toHaveBeenCalledWith('some', 'args');
	});
	it('allows same subscriber to observe multiple events', function () {
		obs.addEventListener('TestEvt', listener);
		obs.addEventListener('TestEvt2', listener);
		obs.dispatchEvent('TestEvt', 'some', 'args');
		obs.dispatchEvent('TestEvt2', 'more', 'params');
		expect(listener).toHaveBeenCalledWith('some', 'args');
		expect(listener).toHaveBeenCalledWith('more', 'params');
	});
	it('allows same subscriber to observe multiple events with a single subscription', function () {
		obs.addEventListener('TestEvt TestEvt2', listener);
		obs.dispatchEvent('TestEvt', 'some', 'args');
		obs.dispatchEvent('TestEvt2', 'more', 'params');
		expect(listener).toHaveBeenCalledWith('some', 'args');
		expect(listener).toHaveBeenCalledWith('more', 'params');
	});
	it('stops propagation if an event listener returns false', function () {
		obs.addEventListener('TestEvt', function () {
			return false;
		});
		obs.addEventListener('TestEvt', listener);
		obs.dispatchEvent('TestEvt', 'some', 'args');
		expect(listener).not.toHaveBeenCalledWith();
	});
	it('continnues if a listener barfs', function () {
		const barf = new Error('barf');
		obs.addEventListener('TestEvt', function () {
			throw barf;
		}, 1);
		obs.addEventListener('TestEvt', listener);
		spyOn(console, 'log');
		try {
			obs.dispatchEvent('TestEvt', 'some', 'args');
		} catch (e) {

		}

		expect(listener).toHaveBeenCalledWith('some', 'args');
		expect(console.log).toHaveBeenCalledWith('dispatchEvent failed',  barf, jasmine.any(Object));
	});
	it('does not dispatch events to unsubscribed listeners', function () {
		obs.addEventListener('TestEvt', listener);
		obs.removeEventListener('TestEvt', listener);
		obs.dispatchEvent('TestEvt', 'some', 'args');
		expect(listener).not.toHaveBeenCalled();
	});
	it('does not dispatch events to subscribers of unrelated events', function () {
		obs.addEventListener('TestEvt', listener);
		obs.dispatchEvent('UnrelatedEvt', 'some', 'args');
		expect(listener).not.toHaveBeenCalled();
	});
	it('supports listener priorities', function () {
		let result = '';
		obs.addEventListener('TestEvt', function () {
			result += 'first';
		}, 1);
		obs.addEventListener('TestEvt', function () {
			result += 'second';
		}, 3);
		obs.addEventListener('TestEvt', function () {
			result += 'third';
		}, 2);
		obs.dispatchEvent('TestEvt');

		expect(result).toBe('secondthirdfirst');
	});
});
