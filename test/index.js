var assert = require('assert');
var sinon = require('sinon');
var extensible = require('../index');


for (var k in assert) global[k] = assert[k];


describe('extensible object', function() {
  var obj, top, mid, bot, methodName = 'm';


  beforeEach(function() {
    top = {};
    top[methodName] = function(arg1, arg2, arg3, cb, next, layer) {
      equal(this, obj);
      equal(top, layer.impl);
      next(arg1 * 64, arg2, arg3, function(err, rv) { cb(err, rv / 64); });
    };
    mid = {};
    mid[methodName] = function(arg1, arg2, arg3, cb, next, layer) {
      equal(this, obj);
      equal(mid, layer.impl);
      next(arg1 * 64, arg2, arg3, function(err, rv) { cb(err, rv / 64); });
    };
    bot = function(opts) {
      equal(this, obj);
      // add a method
      this.addMethod(opts.methodName, 'arg1, arg2, arg3, cb');
      var rv = {};
      rv[methodName] = function(arg1, arg2, arg3, cb, next, layer) {
        equal(this, obj);
        equal(rv, layer.impl);
        cb([1, 2], arg1);
      };
      return rv;
    };

    obj = extensible();
    obj.use(bot, {methodName: methodName});
    obj.use(mid);
    obj.use(top);

    sinon.spy(obj._top.impl, methodName);
    sinon.spy(obj._top.next.impl, methodName);
    sinon.spy(obj._top.next.next.impl, methodName);
  });


  it('passes arguments from top to bottom layer', function() {
    obj[methodName](1, 3, 4, function() {});
    assert(obj._top.impl[methodName].calledWith(1, 3, 4));
    assert(obj._top.next.impl[methodName].calledWith(64, 3, 4));
    assert(obj._top.next.next.impl[methodName].calledWith(4096, 3, 4));
  });


  it('passes result from bottom to top layer', function(done) {
    obj[methodName](1, null, null, function(err, rv) {
      deepEqual([1, 2], err);
      deepEqual(1, rv);
      done();
    });
  });


  describe('eachLayer', function() {
    it('iterates through each layer', function() {
      var items = [];
      obj.eachLayer(function(layer) { items.push(layer.impl); });
      deepEqual([obj._top.next.next.impl, mid, top], items);
    });
  });


  describe('eachMethod', function() {
    it('iterates through each method metadata', function() {
      var items = [];
      obj.eachMethod(function(method) { items.push(method); });
      deepEqual([{name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb']}], items);
    });
  });


  describe('getMethod', function() {
    it('gets method by name', function() {
      deepEqual({name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb']},
                obj.getMethod('m'));
    });
  });


  describe('instance', function() {
    it('links through the prototype chain', function() {
      assert(obj.isPrototypeOf(obj.instance()));
    });
  });


  describe('fork', function() {
    var forked;
    beforeEach(function() {
      forked = obj.fork();
    });


    it('links through the prototype chain', function() {
      assert(obj.isPrototypeOf(forked));
    });


    it('should copy method descriptors', function() {
      notEqual(obj._methods, forked._methods);
      deepEqual([{name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb']}],
                obj._methods);
      deepEqual([{name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb']}],
                forked._methods);
    });


    it('should copy layers', function() {
      notEqual(obj._top, forked._top);
      notEqual(obj._top.next, forked._top.next);
      notEqual(obj._top.next.next, forked._top.next.next);
      equal(obj._top.impl, forked._top.impl);
      equal(obj._top.next.impl, forked._top.next.impl);
      equal(obj._top.next.next.impl, forked._top.next.next.impl);
    });


    it('should copy layers', function() {
      notEqual(obj._top, forked._top);
      notEqual(obj._top.next, forked._top.next);
      notEqual(obj._top.next.next, forked._top.next.next);
      equal(obj._top.impl, forked._top.impl);
      equal(obj._top.next.impl, forked._top.next.impl);
      equal(obj._top.next.next.impl, forked._top.next.next.impl);
    });


    describe('forked object', function() {
      it("wont affect the original object methods", function() {
        forked.addMethod('y');
        deepEqual([{name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb']}],
                  obj._methods);
        deepEqual([{name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb']},
          {name: 'y', args: []}], forked._methods);
        equal(true, 'm' in obj);
        equal(false, 'y' in obj);
        equal(true, 'y' in forked);
      });


      it("wont affect the original object layers", function() {
        forked.use(top);
        equal(top, forked._top.impl);
        equal(top, forked._top.next.impl);
        equal(mid, forked._top.next.next.impl);
        equal(top, obj._top.impl);
        equal(mid, obj._top.next.impl);
      });


      it("has the orignal object as prototype", function() {
        equal(obj, Object.getPrototypeOf(forked));
      });
    });
  });
});
