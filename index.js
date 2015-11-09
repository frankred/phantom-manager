var PhantomInstance = require('./lib/phantom-instance.js');
var debug = require('debug')('phantom-manager');
var async = require('async');
var extend = require('extend-fn');

function PhantomManager(callback, options) {

    this.default_options = {
        phantom_port: 9900,
        amount: 4,
        parallel_each: 1,
        timeout: 30000,
        viewport: {
            width: 800,
            height: 600
        },
        load_images: true,
        retries: 3
    };

    this.options = extend(this.default_options, options);

    this.createInstances(this.options.amount, function (error) {
        callback(error);
    });
};

PhantomManager.prototype.openURL = function (url, pageBefore, evaluate, evaluateInject, pageAfter, callback) {
    this.getInstance().openURL(url, pageBefore, evaluate, evaluateInject, pageAfter, callback);
};

PhantomManager.prototype.getInstance = function () {
    var smallest_instance_index = 0;

    for (var i = 1; i < this.instances.length; i++) {
        if (this.instances[i].queue.length() < this.instances[smallest_instance_index].queue.length()) {
            smallest_instance_index = i;
        }
    }

    return this.instances[smallest_instance_index];
};

PhantomManager.prototype.createInstances = function (amount, instancesCreatedCallback) {

    var self = this;

    var createInstance = function (index, callback) {
        var instance = new PhantomInstance(self.options);
        instance.init(function () {
            callback(null, instance);
        });
    };

    async.times(amount, function (index, next) {
        createInstance(index, function (error, instance) {
            next(error, instance);
        });
    }, function (error, instances) {
        self.instances = instances;
        instancesCreatedCallback(error);
    });
};

module.exports = PhantomManager;