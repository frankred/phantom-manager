"use strict";

var assert = require("assert");
var debug = require("debug")("phantom-manager:test");
var pjson = require('../../package.json');
var PhantomManager = require('../../index');
var Webserver = require('local-webserver');

// Test
describe("PhantomManager", function () {

    var websites;
    var server = new Webserver("./test/websites", pjson.config['test-port']);

    var classUnderTest;

    const timeout = 60000;

    before(function (done) {
        this.timeout(timeout);

        server.start(function () {
            websites = server.getAvailableWebsites();
            var options = {
                amount: 4,
                timeout: 5000
            };

            classUnderTest = new PhantomManager(function (error) {
                assert.ifError(error);
                done();
            }, options);
        });

    });

    after(function (done) {
        server.close(function() {
            classUnderTest.shutdown(function(error) {
                if(error) {
                    debug(error.message);
                }
                done();
            });
        });
    });


    it("bring them all to idle", function (done) {
        this.timeout(timeout);
        classUnderTest.openURL(websites['testpage.com'], null, function (text) {
            return document.title + ' ' + text;
        }, 'hallo', null, function (error, task, result) {
            assert.ifError(error);
            assert.equal(result, 'Home - Astrid Florence Cassing hallo');

            setTimeout(function () {
                done();
            }, 10000);
        });
    });

    it("check null pageReady", function (done) {
        this.timeout(timeout);
        classUnderTest.openURL(websites['testpage.com'], null, function () {
            return document.title;
        }, null, null, function (error, task, result) {
            assert.ifError(error);
            assert.ok(result);
            done();
        });
    });

    it("check manager killall before openURL", function (done) {
        this.timeout(timeout);

        classUnderTest.shutdown(function () {
            classUnderTest.openURL(websites['testpage.com'], null, function () {
                return document.title;
            }, null, null, function (error, task, result) {
                assert.ifError(error);
                assert.equal(result, 'Home - Astrid Florence Cassing');
                done();
            });
        });
    });

    it("check manager killallzombies before openURL", function (done) {
        this.timeout(timeout);

        classUnderTest.killallZombies(function (error) {
            assert.ifError(error);
            classUnderTest.openURL(websites['testpage.com'], null, function () {
                return document.title;
            }, null, null, function (error, task, result) {
                assert.ifError(error);
                assert.equal(result, 'Home - Astrid Florence Cassing');
                done();
            });
        });
    });

    it("check pageAfter", function (done) {
        this.timeout(timeout);

        var pageAfter = function (page, eval_result, ready) {
            assert.ok(page);
            assert.ok(page.openUrl);
            assert.equal(eval_result, 'Home - Astrid Florence Cassing');
            ready();
        };

        classUnderTest.openURL(websites['testpage.com'], null, function () {
            return document.title;
        }, null, pageAfter, function (error, task, result) {
            assert.ifError(error);
            assert.ok(result);
            done();
        });
    });

    it("check inject", function (done) {
        this.timeout(timeout);

        classUnderTest.openURL(websites['testpage.com'], null, function (obj) {
            return obj.x;
        }, {x: 'bla'}, null, function (error, task, result) {
            assert.ifError(error);
            assert.equal(result, 'bla');
            assert.notEqual(result, 'blubb');
            done();
        });
    });

    it("check instances amount", function (done) {
        this.timeout(timeout);
        assert.equal(classUnderTest.instances.length, classUnderTest.options.amount);
        done();
    });

    it("check title and first try", function (done) {
        this.timeout(timeout);
        classUnderTest.openURL(websites['testpage.com'], null, function () {
            return document.title;
        }, null, function (page, result, callback) {
            page.renderBase64("PNG", function (error, data) {
                assert.ifError(error);
                assert.ok(data);
                callback();
            });
        }, function (error, task, result) {
            assert.ifError(error);
            assert.equal(result, 'Home - Astrid Florence Cassing');
            assert.equal(task.tries, 1);
            done();
        });
    });

    it("check error: PAGE LOAD FAILED", function (done) {
        this.timeout(timeout);
        const invalid_url = 'invalidurlhahahahah';
        classUnderTest.openURL(invalid_url, null, function () {
            return document.title;
        }, null, null, function (error) {
            assert.equal(error, 'PAGE_LOAD_FAILED');
            done();
        });
    });

    it("check retries", function (done) {
        this.timeout(timeout);
        const invalid_url = 'invalidurlhahahahah';
        classUnderTest.openURL(invalid_url, null, function () {
            return document.title;
        }, null, null, function (error, task) {
            assert.equal(error, 'PAGE_LOAD_FAILED');
            assert.equal(task.tries, classUnderTest.options.retries);
            done();
        });
    });

    it("check eval inject", function (done) {
        this.timeout(timeout);
        classUnderTest.openURL(websites['testpage.com'], null, function (text) {
            return document.title + ' ' + text;
        }, 'hallo', null, function (error, task, result) {
            assert.ifError(error);
            assert.equal(result, 'Home - Astrid Florence Cassing hallo');
            done();
        });
    });
});