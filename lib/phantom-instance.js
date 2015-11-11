var async = require('async');
var debug = require('debug')('phantom-manager:phantom-instance');
var Timeout = require('./timeout.js');
var phantom_simple = require('node-phantom-simple');

function PhantomInstance(options) {
    this.browser = null;
    this.options = options;
    this.idle_timeout_id = -1;

    this.resetIdleTimer();
};

PhantomInstance.prototype.errors = {
    PAGE_LOAD_FAILED: 'PAGE_LOAD_FAILED',
    PAGE_LOAD_UNKNOWN: 'PAGE_LOAD_UNKNOWN',
    PAGE_LOAD_NO_RESULT: 'PAGE_LOAD_NO_RESULT',
    TIMEOUT: 'PAGE_LOAD_TIMEOUT'
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
            debug('Request task done with error: ' + error.message);
            if (task.tries >= self.options.retries) {
                callback(error, task, result);
            } else {
                debug('Retry erronous request: ' + error.message);
                self.queue.push(task, taskDone);
            }
        } else {
            callback(error, task, result);
        }
    };

    this.queue.push(task, taskDone);

    this.resetIdleTimer();
};

PhantomInstance.prototype.init = function (callback) {
    var self = this;
    this.createPhantomProcess(function (error) {
        if (error) {
            return callback(error);
        }

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
            self.browser.createPage(function (error, page) {
                callback(error, page);
            });
        };

        var setPageSettingsAction = function (page, callback) {
            page.onConsoleMessage = function (msg, lineNumber, sourceId) {
                console.log('page console: ' + msg);
            };

            page.set('viewportSize', self.options.viewport, function () {
                page.set('settings.loadImages', self.options.load_images, function () {
                    page.set('settings.resourceTimeout', self.options.timeout, function () {
                        callback(null, page);
                    });
                });
            });
        };

        var openURLAction = function (page, callback) {
            debug('page open ' + task.url);
            page.open(task.url, function (error, status) {

                if (error) {
                    callback(error);
                    return;
                }

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
            debug('page eval ' + task.evaluate);
            page.evaluate(task.evaluate, task.evaluateInject, function (error, result) {
                if (error || typeof result === 'undefined') {
                    callback(self.errors.PAGE_LOAD_NO_RESULT);
                    return;
                }

                callback(null, page, result);
            });
        };

        var afterEvalAction = function (page, result, callback) {
            debug('page after ' + task.pageAfter);
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
            if (timeout.wasAlreadyCalled()) {
                return;
            }

            timeout.tryToClear();

            if (error) {

                if (error.name === 'HeadlessError') {
                    debug('phantom process on idle or crashed');
                    self.onExit(function () {
                        return taskCallback(error);
                    });
                    return;
                }

                taskCallback(error);
                return;
            }

            taskCallback(error, result);
        });
    }, this.options.parallel_each);
};

PhantomInstance.prototype.createPhantomProcess = function (callback) {
    var self = this;

    var parameters = {
        "web-security": false,
        "ignore-ssl-errors": "yes"
    };

    debug('create phantom process');
    phantom_simple.create({parameters: parameters}, function (error, browser) {

        if (error) {
            debug('error creating phantom process: ' + error);
            return callback(error);
        }

        self.browser = browser;
        if (self.options.proxy) {
            self.browser.setProxy(self.options.proxy.host, self.options.proxy.port, self.options.proxy.protocol, null, null, function () {
                callback();
            });
            return;
        }

        callback();
    });
};

PhantomInstance.prototype.onExit = function (callback) {

    var self = this;

    this.queue && this.queue.pause();

    debug('restart phantom process');
    this.restartPhantomProcess(function () {
        self.queue && self.queue.resume();

        debug('restart done, queue resumed');
        callback();
    });
};

PhantomInstance.prototype.restartPhantomProcess = function (restartedCallback) {
    this.kill();
    this.createPhantomProcess(function () {
        restartedCallback();
    });
};

PhantomInstance.prototype.kill = function () {
    if (this.browser) {
        debug('kill phantom process');
        this.browser.exit();
    }
};

PhantomInstance.prototype.resetIdleTimer = function () {
    var self = this;

    debug('reset idle time to ' + this.options.idle_time + ' ms');
    if (this.idle_timeout_id > -1) {
        clearTimeout(this.idle_timeout_id);
    }

    this.idle_timeout_id = setTimeout(function () {
        self.onIdle();
    }, self.options.idle_time);
};

PhantomInstance.prototype.onIdle = function () {
    debug('go idle');
    this.kill();
};

module.exports = PhantomInstance;
