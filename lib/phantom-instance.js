var async = require('async');
var phantom = require('phantom');
var Timeout = require('./timeout.js');

function PhantomInstance(options) {
    this.ph = null;
    this.options = options;
};

PhantomInstance.prototype.openURL = function (url, pageReady, evaluate, callback) {
    var self = this;

    var task = {
        url: url,
        evaluate: evaluate,
        pageReady: pageReady
    };

    this.queue.push(task, function (error, result) {
        callback(error, task.url, result);
    });
};

PhantomInstance.prototype.errors = {
    PAGE_LOAD_FAILED: 'PAGE_LOAD_FAILED',
    PAGE_LOAD_UNKNOWN: 'PAGE_LOAD_UNKNOWN',
    PAGE_LOAD_NO_RESULT: 'PAGE_LOAD_NO_RESULT',
    TIMEOUT: 'TIMEOUT',
    CRASHED: 'CRASHED'
};

PhantomInstance.prototype.init = function (callback) {
    var self = this;
    this.createPhantomProcess(function (ph) {
        self.initQueue();
        callback();
    });
};

PhantomInstance.prototype.initQueue = function () {

    var self = this;

    this.queue = async.queue(function (task, taskCallback) {

        var timeout = new Timeout(function () {
            taskCallback(self.errors.TIMEOUT);
        }, self.options.timeout);

        var createPageAction = function (callback) {
            self.ph.createPage(function (page) {
                callback(null, page);
            });
        };

        var setPageSettingsAction = function (page, callback) {
            page.set('viewportSize', self.options.viewport, function () {
                page.set('settings.loadImages', self.options.load_images, function () {
                    page.set('settings.resourceTimeout', self.options.timeout, function () {
                        callback(null, page);
                    });
                });
            });
        };

        var openURLAction = function (page, callback) {
            page.open(task.url, function (status) {

                switch (status) {
                    case 'fail':
                        callback(self.errors.PAGE_LOAD_FAILED);
                        break;
                    case 'success':
                        task.pageReady(page, function () {
                            callback(null, page);
                        });
                        break;
                    default :
                        callback(self.errors.PAGE_LOAD_UNKNOWN);
                        break;
                }
            });
        };

        var evalAction = function (page, callback) {
            page.evaluate(task.evaluate, function (result) {

                if (!result) {
                    callback(self.errors.PAGE_LOAD_NO_RESULT);
                    return;
                }
                callback(null, result);
            }, task);
        };

        var actions = [
            createPageAction,
            setPageSettingsAction,
            openURLAction,
            evalAction
        ];

        async.waterfall(actions, function (error, result) {
            if (timeout.cleared === false) {
                timeout.clear();
            } else if (timeout.cleared === true) {
                return; // timeout error already called, you come to late
            }

            taskCallback(error, result);
        });
    }, this.options.parallel_each);
};

PhantomInstance.prototype.createPhantomProcess = function (callback) {
    var self = this;

    var onExit = function () {
        self.queue.pause();
        self.restartPhantomProcess(function () {
            self.queue.resume();
        });
    };

    phantom.create("--web-security=no", "--ignore-ssl-errors=yes", {onExit: onExit}, function (ph) {
        self.ph = ph;
        callback();
    });
};

PhantomInstance.prototype.restartPhantomProcess = function (restartedCallback) {
    var self = this;
    this.killPhantomProcess();
    this.createPhantomProcess(function (ph) {
        restartedCallback();
    });
};

PhantomInstance.prototype.killPhantomProcess = function () {
    if (this.ph) {
        this.ph.exit();
    }
};

module.exports = PhantomInstance;