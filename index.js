var async = require('async');
var extend = require('extend');
var PhantomInstance = require('./lib/phantom-instance.js');

function PhantomManager(callback, options) {

    this.default_options = {
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

PhantomManager.prototype.openURL = function (url, pageReady, evaluate, callback) {
    var instance = this.getInstance();
    instance.openURL(url, pageReady, evaluate, callback);
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

    this.instances = [];

    var createInstance = function (callback) {
        var instance = new PhantomInstance(self.options);
        instance.init(function () {
            self.instances.push(instance);
            callback();
        });
    };

    var doParallelFunctions = [];

    for (var i = 0; i < amount; i++) {
        doParallelFunctions.push(createInstance);
    }

    async.parallel(doParallelFunctions, function (error, results) {
        instancesCreatedCallback(error);
    });
};

module.exports = PhantomManager;