var async = require('async');
var phantom = require('phantom');
var Timeout = require('./timeout.js');

function PhantomInstance(options) {
    this.ph = null;
    this.options = options;
};

PhantomInstance.prototype.openURL = function (url, pageBefore, evaluate, evaluateInject, pageAfter, callback) {
    var self = this;

    var task = {
        url: url,
        evaluate: evaluate,
        evaluateInject: evaluateInject,
        pageBefore: pageBefore,
        pageAfter: pageAfter,
        tries: 0
    };

    var taskDone = function (error, result) {
        if (error) {
            if (task.tries >= self.options.retries) {
                callback(error, task, result);
            } else {
                self.queue.push(task, taskDone);
            }
        } else {
            callback(error, task, result);
        }
    };

    this.queue.push(task, taskDone);
};

PhantomInstance.prototype.errors = {
    PAGE_LOAD_FAILED: 'PAGE_LOAD_FAILED',
    PAGE_LOAD_UNKNOWN: 'PAGE_LOAD_UNKNOWN',
    PAGE_LOAD_NO_RESULT: 'PAGE_LOAD_NO_RESULT',
    TIMEOUT: 'PAGE_LOAD_TIMEOUT'
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
        task.tries++;

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

                page.onConsoleMessage(function (msg) {
                    console.log('page console: ' + msg);
                });

                switch (status) {
                    case 'fail':
                        callback(self.errors.PAGE_LOAD_FAILED);
                        break;
                    case 'success':
                        if (task.pageBefore) {
                            task.pageBefore(page, function () {
                                callback(null, page);
                            });
                            return;
                        }

                        callback(null, page);
                        break;
                    default :
                        callback(self.errors.PAGE_LOAD_UNKNOWN);
                        break;
                }
            });
        };

        var evalAction = function (page, callback) {
            page.evaluate(task.evaluate, function (result) {

                if (typeof result === 'undefined') {
                    callback(self.errors.PAGE_LOAD_NO_RESULT);
                    return;
                }

                callback(null, page, result);
            }, task.evaluateInject);
        };

        var afterEvalAction = function (page, result, callback) {
            if (task.pageAfter) {
                task.pageAfter(page, result, function () {
                    callback(null, result);
                });
                return;
            }

            callback(null, result);
        };

        var actions = [
            createPageAction,
            setPageSettingsAction,
            openURLAction,
            evalAction,
            afterEvalAction
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
        self.queue && self.queue.pause();
        self.restartPhantomProcess(function () {
            self.queue && self.queue.resume();
        });
    };

    var parameters = {
        "web-security": false,
        "ignore-ssl-errors": "yes"
    };

    phantom.create({parameters: parameters}, {onExit: onExit}, function (ph) {
        self.ph = ph;
        if (self.options.proxy) {
            self.ph.setProxy(self.options.proxy.host, self.options.proxy.port, self.options.proxy.protocol, null, null, function () {
                callback();
            });
            return;
        }
        callback();
    });
};

PhantomInstance.prototype.restartPhantomProcess = function (restartedCallback) {
    this.killPhantomProcess();
    this.createPhantomProcess(function () {
        restartedCallback();
    });
};

PhantomInstance.prototype.killPhantomProcess = function () {
    if (this.ph) {
        this.ph.exit();
    }
};

module.exports = PhantomInstance;