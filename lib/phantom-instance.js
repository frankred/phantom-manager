var async = require('async');
var phantom = require('phantom');
var Timeout = require('./timeout.js');

function PhantomInstance(options) {
    this.ph = null;
    this.options = options;
};

PhantomInstance.prototype.openURL = function (url, pageReady, evaluate, callback) {

    console.log('open url: ' + url);

    var self = this;

    var task = {
        url: url,
        evaluate: evaluate,
        pageReady: pageReady
    };

    this.queue.push(task, function (error, result) {
        console.log('task ready ' + task.url);
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
            console.log('create page');
            try {
                self.ph.createPage(function (page) {
                    callback(null, page);
                });
            } catch (e) {
                console.log(e);
            }
        };

        var setPageSettingsAction = function (page, callback) {
            console.log('set page settings');
            page.set('viewportSize', self.options.viewport, function () {
                page.set('settings.loadImages', self.options.load_images, function () {
                    page.set('settings.resourceTimeout', self.options.timeout, function () {
                        callback(null, page);
                    });
                });
            });
        };

        var openURLAction = function (page, callback) {

            console.log('open page');
            page.open(task.url, function (status) {

                switch (status) {
                    case 'fail':
                        callback(self.errors.PAGE_LOAD_FAILED);
                        break;
                    case 'success':
                        task.pageReady(page, function(){
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

            console.log('page evaluate');
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

            console.log('waterfall done');

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
        console.log('phantom crashed');
        self.queue.pause();
        self.restartPhantomProcess(function () {
            console.log('phantom process up again');
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
        console.log('kill phantom process');
        this.ph.exit();
    }
};

module.exports = PhantomInstance;