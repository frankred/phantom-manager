"use strict";

var async = require('async');
var extend = require('extend-fn');
var Timeout = require('./timeout');
var phantom_simple = require('node-phantom-simple');
var debug = require('debug');

var logger = {
    debug: debug('phantom-manager:phantom-instance:debug'),
    retry: debug('phantom-manager:phantom-instance:retry'),
    warn: debug('phantom-manager:phantom-instance:warn'),
    error: debug('phantom-manager:phantom-instance:error')
};

function PhantomInstance(options) {
    this.browser = null;
    this.options = options;
    this.idle_timeout_id = -1;
    this.customHeaders = {};

    if(this.options['use-proxy-cache'] === false) {
        this.customHeaders = extend(this.customHeaders, {'Cache-Control': 'no-cache', 'Pragma': 'no-cache'});
    }

    this.resetIdleTimer();
}

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
        tries: 0,
        timeout: 0
    };

    var taskDone = function (error, result) {
        if (error) {
            logger.error(url + ' error: ' + error);
            if (task.tries >= self.options.retries) {
                callback(error, task, result);
            } else {
                logger.retry('Retry(' + task.tries + '): ' + url + ' waited ' + (task.timeout/1000) + 's');
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
        task.timeout = task.timeout + self.options.timeout;

        var timeout = new Timeout(function () {
            taskCallback(self.errors.TIMEOUT);
        }, task.timeout);

        var createPageAction = function (callback) {
            self.browser.createPage(function (error, page) {
                callback(error, page);
            });
        };

        var setPageSettingsAction = function (page, callback) {

            if (!page) {
                callback(self.errors.PAGE_LOAD_FAILED);
                return;
            }

            page.onConsoleMessage = function (msg) {
                console.log('page console: ' + msg);
            };

            page.set('viewportSize', self.options.viewport, function () {
                page.set('settings.loadImages', self.options.load_images, function () {
                    page.set('settings.resourceTimeout', self.options.timeout, function () {
                        page.set('customHeaders', self.customHeaders, function () {
                            callback(null, page);
                        });
                    });
                });
            });
        };

        var openURLAction = function (page, callback) {
            logger.debug('page open ' + task.url);
            page.open(task.url, function (error, status) {

                if (error) {
                    callback(error);
                    return;
                }

                switch (status) {
                    case 'fail':
                        logger.error('failed after ' + task.tries + ' tries and ' + task.timeout/1000 + 's waiting time');
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
            page.evaluate(task.evaluate, task.evaluateInject, function (error, result) {
                if (error || typeof result === 'undefined') {
                    callback(self.errors.PAGE_LOAD_NO_RESULT);
                    return;
                }

                callback(null, page, result);
            });
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
            if (timeout.wasAlreadyCalled()) {
                return;
            }

            timeout.tryToClear();

            if (error) {

                if (error.name === 'HeadlessError') {
                    logger.debug('phantom process on idle or crashed');
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

    logger.debug('create phantom process');
    phantom_simple.create({parameters: parameters}, function (error, browser) {

        if (error) {
            logger.error('error creating phantom process: ' + error);
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

    if (this.queue) {
        this.queue.pause();
    }

    logger.debug('restart phantom process');
    this.restartPhantomProcess(function () {
        if(self.queue) {
            self.queue.resume();
        }

        logger.debug('restart done, queue resumed');
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
        logger.debug('kill phantom process');
        this.browser.exit();
    }
};

PhantomInstance.prototype.resetIdleTimer = function () {
    var self = this;

    logger.debug('reset idle time to ' + this.options.idle_time + ' ms');
    if (this.idle_timeout_id !== -1) {
        clearTimeout(this.idle_timeout_id);
    }

    this.idle_timeout_id = setTimeout(function () {
        self.onIdle();
    }, self.options.idle_time);
};

PhantomInstance.prototype.onIdle = function () {
    logger.debug('go idle');
    this.kill();
};

module.exports = PhantomInstance;
