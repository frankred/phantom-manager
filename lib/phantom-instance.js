var async = require('async');
var phantom = require('phantom');

function PhantomInstance(options) {
    this.ph = null;
    this.options = options;
};

PhantomInstance.prototype.openURL = function (url, evaluate, callback) {

    var self = this;

    var task = {
        url: url,
        evaluate: evaluate
    };

    var timeout = setTimeout(function () {
        callback(self.errors.TIMEOUT);
    }, this.options.timeout);

    this.queue.push(task, function (error, result) {
        clearTimeout(timeout);
        callback(error, result);
    });
};

PhantomInstance.prototype.errors = {
    PAGE_LOAD_FAILED: 'PAGE_LOAD_FAILED',
    PAGE_LOAD_UNKNOWN: 'PAGE_LOAD_UNKNOWN',
    PAGE_LOAD_NO_RESULT: 'PAGE_LOAD_NO_RESULT',
    TIMEOUT: 'TIMEOUT'
};

PhantomInstance.prototype.setPhantomProcess = function (ph) {
    var self = this;

    this.ph = ph;

    this.queue = async.queue(function (task, taskCallback) {

        var createPageAction = function (callback) {
            ph.createPage(function (page) {
                callback(null, page);
            });
        };

        var setPageSettingsAction = function (page, callback) {
            page.set('viewportSize', self.options.viewport, function () {
                page.set('settings.loadImages', self.options.load_images, function () {
                    page.set('settings.resourceTimeout', self.options.resource_timeout, function () {
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
            taskCallback(error, result);
        });
    });
};

PhantomInstance.prototype.createPhantomProcess = function (createdCallback) {

    var self = this;

    this.killPhantomProcess();

    var onProcessExit = function () {
        self.createPhantomProcess(function () {
            console.log('phantom process up again');
        });
    };

    phantom.create("--web-security=no", "--ignore-ssl-errors=yes", {onExit: onProcessExit}, function (ph) {
        self.setPhantomProcess(ph);
        createdCallback();
    });
};

PhantomInstance.prototype.killPhantomProcess = function () {
    if (this.ph) {
        console.log('kill phantom process');
        this.ph.exit();
    }
};

module.exports = PhantomInstance;