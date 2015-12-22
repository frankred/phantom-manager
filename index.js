var PhantomInstance = require('./lib/phantom-instance.js');
var debug = require('debug')('phantom-manager');
var async = require('async');
var extend = require('extend-fn');

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
        retries: 3,
        idle_time: 120000
    };

    this.options = extend(this.default_options, options);

    var self = this;
    self.createInstances(self.options.amount, function (error) {
        callback(error);
    });
};

PhantomManager.prototype.openURL = function (url, pageBefore, evaluate, evaluateInject, pageAfter, callback) {
    this.getInstance().openURL(url, pageBefore, evaluate, evaluateInject, pageAfter, callback);
};

PhantomManager.prototype.getInstance = function () {
    var shortest_queue = 0;

    for (var i = 1; i < this.instances.length; i++) {
        if (this.instances[i].queue.length() < this.instances[shortest_queue].queue.length()) {
            shortest_queue = i;
        }
    }

    return this.instances[shortest_queue];
};

PhantomManager.prototype.createInstances = function (amount, instancesCreatedCallback) {

    var self = this;

    var createInstance = function (index, callback) {
        var instance = new PhantomInstance(self.options);
        instance.init(function (error) {
            callback(error, instance);
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

PhantomManager.prototype.killallZombies = function (callback) {
    var platform = require('os').platform();
    var exec = require('child_process').exec;
    var cmd = '';

    switch (platform) {
        case 'linux':
            cmd = 'killall phantomjs';
            break;

        case 'win32':
            cmd = 'taskkill /F /IM phantomjs.exe /T';
            break;

        default:
            callback && callback(new Error('To kill all zombies processes your os is not supported'));
            return;
    }

    exec(cmd, function (error, stdout, stderr) {
        if (error) {
            debug('exec error ' + stderr);
        }
        debug('exec output ' + stdout);
        callback && callback(error);
    });
};

PhantomManager.prototype.shutdown = function (callback) {
    for (var i = 0; i < this.instances.length; i++) {
        this.instances[i].kill();
    }

    this.killallZombies(callback);
};

module.exports = PhantomManager;