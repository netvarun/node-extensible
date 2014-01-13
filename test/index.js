var assert = require('assert');
var sinon = require('sinon');
var extensible = require('../index');
var has = require('has');


for (var k in assert) global[k] = assert[k];


describe('extensible', function() {
  describe('object', function() {
    var obj;
  
    describe('with extensions', function() {
      var top, mid, bot, methodName = 'm';


      beforeEach(function() {
        top = {
          state: function(arg, next) {
            equal(this, obj);
            next(arg, passedState = {data: 5});
          }
        };
        top[methodName] = function(arg1, arg2, arg3, cb, next, layer) {
          equal(this, obj);
          equal(top, layer.impl);
          next(arg1 * 64, arg2, arg3, function(err, rv) { cb(err, rv / 64); });
        };
        mid = {
          state: function(arg, next) {
            equal(this, obj);
            next(arg);
          }
        };
        mid[methodName] = function(arg1, arg2, arg3, cb, next, layer) {
          equal(this, obj);
          equal(mid, layer.impl);
          next(arg1 * 64, arg2, arg3, function(err, rv) { cb(err, rv / 64); });
        };
        bot = function(opts) {
          equal(this, obj);
          // add a method
          this.$defineMethod(opts.methodName, 'arg1, arg2, arg3, cb');
          this.$defineMethod('state', 'arg');
          var rv = {
            state: function(arg, next, layer, state) {
              equal(this, obj);
              equal(rv, layer.impl);
              equal(passedState, state);
            }
          };
          rv[methodName] = function(arg1, arg2, arg3, cb, next, layer) {
            equal(this, obj);
            equal(rv, layer.impl);
            cb([1, 2], arg1);
          };
          return rv;
        };

        obj = extensible();
        obj.$use(bot, {methodName: methodName});
        obj.$use(mid);
        obj.$use(top);

        sinon.spy(obj.$layers.top.impl, methodName);
        sinon.spy(obj.$layers.top.next.impl, methodName);
        sinon.spy(obj.$layers.top.next.next.impl, methodName);
      });

      it('passes arguments from top to bottom layer', function() {
        obj[methodName](1, 3, 4, function() {});
        assert(obj.$layers.top.impl[methodName].calledWith(1, 3, 4));
        assert(obj.$layers.top.next.impl[methodName].calledWith(64, 3, 4));
        assert(obj.$layers.top.next.next.impl[methodName].calledWith(4096, 3, 4));
      });


      it('passes result from bottom to top layer', function(done) {
        obj[methodName](1, null, null, function(err, rv) {
          deepEqual([1, 2], err);
          deepEqual(1, rv);
          done();
        });
      });


      it('should pass state across layers', function() {
        obj.state(5); // assertion is done in layer definition
      });


      describe('eachLayer', function() {
        it('iterates through each layer', function() {
          var items = [];
          obj.$eachLayer(function(layer) { items.push(layer.impl); });
          deepEqual([obj.$layers.top.next.next.impl, mid, top], items);
        });
      });


      describe('$eachMethodDescriptor', function() {
        it('iterates through each method metadata', function() {
          var items = [];
          obj.$eachMethodDescriptor(function(method) { items.push(method); });
          meql([{
            name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb']
          }, {
            name: 'state', args: ['arg']
          }], items);
        });
      });


      describe('$getMethodDescriptor', function() {
        it('gets method by name', function() {
          meql({name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb']},
               obj.$getMethodDescriptor('m'));
          meql({name: 'state', args: ['arg']},
               obj.$getMethodDescriptor('state'));
        });
      });


      describe('instance', function() {
        it('links through the prototype chain', function() {
          assert(obj.isPrototypeOf(obj.$instance()));
        });
      });


      describe('fork', function() {
        var forked;
        beforeEach(function() {
          forked = obj.$fork();
        });


        it('links through the prototype chain', function() {
          assert(obj.isPrototypeOf(forked));
        });


        it('should copy method descriptors', function() {
          notEqual(obj.$descriptors, forked.$descriptors);
          meql({
            m: {
              name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb']
            },
            state: {
              name: 'state', args: ['arg']
            }
          }, obj.$descriptors);
          meql({
            m: {
              name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb']
            },
            state: {
              name: 'state', args: ['arg']
            }
          }, forked.$descriptors);
        });


        it('should copy layers', function() {
          notEqual(obj.$layers.top, forked.$layers.top);
          notEqual(obj.$layers.top.next, forked.$layers.top.next);
          notEqual(obj.$layers.top.next.next, forked.$layers.top.next.next);
          equal(obj.$layers.top.impl, forked.$layers.top.impl);
          equal(obj.$layers.top.next.impl, forked.$layers.top.next.impl);
          equal(obj.$layers.top.next.next.impl, forked.$layers.top.next.next.impl);
        });


        it('should copy layers', function() {
          notEqual(obj.$layers.top, forked.$layers.top);
          notEqual(obj.$layers.top.next, forked.$layers.top.next);
          notEqual(obj.$layers.top.next.next, forked.$layers.top.next.next);
          equal(obj.$layers.top.impl, forked.$layers.top.impl);
          equal(obj.$layers.top.next.impl, forked.$layers.top.next.impl);
          equal(obj.$layers.top.next.next.impl, forked.$layers.top.next.next.impl);
        });


        describe('forked object', function() {
          it("wont affect the original object methods", function() {
            forked.$defineMethod('y');
            meql({
              m: {
              name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb']
            },
            state: {
              name: 'state', args: ['arg']
            }
            }, obj.$descriptors);
            meql({
              m: {name: 'm', args: ['arg1', 'arg2', 'arg3', 'cb'] },
              state: { name: 'state', args: ['arg'] },
              y: { name: 'y', args: [] }
            }, forked.$descriptors);
            equal(true, 'm' in obj);
            equal(false, 'y' in obj);
            equal(true, 'y' in forked);
          });


          it("wont affect the original object layers", function() {
            forked.$use(top);
            equal(top, forked.$layers.top.impl);
            equal(top, forked.$layers.top.next.impl);
            equal(mid, forked.$layers.top.next.next.impl);
            equal(top, obj.$layers.top.impl);
            equal(mid, obj.$layers.top.next.impl);
          });
        });
      });


      describe('with upgraded method', function() {
        describe('and implementation', function() {
          beforeEach(function() {
            // remove 1 arg
            obj.$defineMethod(methodName, 'arg1, arg2, cb');
            // add a new layer with the new signature
            var newTop = {};
            newTop[methodName] = function(arg1, arg2, cb, next, layer) {
              equal(this, obj);
              equal(newTop, layer.impl);
              // the next layer should be unaffected
              next(arg1, arg2, 1000, cb);
            };
            obj.$use(newTop);
            sinon.spy(newTop, methodName);
          });


          it('should expose new API', function() {
            obj[methodName](1, 3, function() {});
            assert(obj.$layers.top.impl[methodName].calledWith(1, 3));
            assert(obj.$layers.top.next.impl[methodName].calledWith(1, 3, 1000));
            assert(obj.$layers.top.next.next.impl[methodName]
                   .calledWith(64, 3, 1000));
            assert(obj.$layers.top.next.next.next.impl[methodName].calledWith(
              4096, 3, 1000));
          });
        });


        describe('and missing implementation', function() {
          it('should throw when DEBUG is set', function() {
            obj.DEBUG = true;
            obj.$defineMethod(methodName, 'arg1, arg2, cb');
            throws(function() {
              obj[methodName](1, 3, function() {});
            }, /Layer class implementation missing/);
          });
        });
      });
    });

    describe('with missing layer method', function() {
      it('should throw when DEBUG is true', function() {
        obj = extensible();
        obj.DEBUG = true;
        obj.$defineMethod('missing', 'arg1, arg2, cb');
        obj.$use({ another: function(next) { return 1; } });
        throws(function() {
          obj.missing(1, 3, function() {});
        }, /Method 'missing' has no more layers/);
      });
    });
  });


  describe('callable', function() {
    var func;


    beforeEach(function() {
      func = extensible().$fork(true);
    });


    describe('with a $call method defined', function() {
      beforeEach(function() {
        func.$defineMethod('$call', 'name');
        func.$use({
          $call: function(name) {
            return 'Hello ' + name + ' from ' + this.origin;
          }
        });
        func.origin = 'greeter';
      });


      it('can be called like a function', function() {
        equal('Hello world from greeter', func('world'));
      });


      it('can be extended normally', function() {
        func.$defineMethod('$call', 'name, origin');
        func.$use({
          $call: function(name, another, next) {
            return next(name) + ', extended by ' + another;
          }
        });
        equal('Hello world from greeter, extended by foo',
              func('world', 'foo'));
      });


      it('can be inherited', function() {
        var f2 = func.$instance();
        // this will also alter 'func' since they share layers
        f2.$use({
          $call: function(name, next) {
            return next('constant');
          }
        });
        // modify the origin for f2
        f2.origin = 'another';
        equal(f2('world'), 'Hello constant from another');
        equal(func('world'), 'Hello constant from greeter');
      });


      it('can be forked', function() {
        var f2 = func.$fork();
        f2.$use({
          $call: function(name, next) {
            return next('constant');
          }
        });
        f2.origin = 'another';
        equal(f2('world'), 'Hello constant from another');
        equal(func('world'), 'Hello world from greeter');
      });
    });


    describe('without defining a $call method', function() {
      it('throws when called like a function', function() {
        throws(function() {
          func();
        });
      });
    });
  });
});



function meql(expected, actual) {
  if (!actual.args) {
    for (var k in actual) {
      if (!has(actual, k)) continue;
      delete actual[k].objectMethod;
      delete actual[k].layerMethod;
    }
  } else {
    delete actual.objectMethod;
    delete actual.layerMethod;
  }
  return deepEqual(expected, actual);
}
