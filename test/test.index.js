var express = require('express');
var path = require('path');
var assert = require("assert");
var fs = require('fs');
var PhantomManager = require('../index.js');
var pjson = require('../package.json');

var testWebsitesUrls = null,
    webSitesDirInnerTestsDir = 'websites',
    webSitesDirOuterTestsDir = 'test/' + webSitesDirInnerTestsDir;

var app = express();
app.get(/^(.+)$/, function (req, res) {
    res.sendFile(path.resolve(webSitesDirOuterTestsDir + req.params[0]));
});

// Test
describe("phantom-manager test", function () {

    var classUnderTest;

    const timeout = 60000;

    before(function (done) {
        var sitesDir = path.join(__dirname, webSitesDirInnerTestsDir);
        testWebsitesUrls = getTestWebSitesUrls(sitesDir);
        app.listen(pjson.config['test-port'], function () {
            classUnderTest = new PhantomManager(function () {
                done();
            });
        });
    });

    it("check null pageReady", function (done) {
        this.timeout(timeout);
        classUnderTest.openURL(testWebsitesUrls['testpage1'], null, function () {
            return document.title;
        }, null, null, function (error, task, result) {
            assert.ifError(error);
            done();
        });
    });

    it("check title", function (done) {
        this.timeout(timeout);
        classUnderTest.openURL(testWebsitesUrls['testpage1'], null, function () {
            return document.title;
        }, null, function (page, result, callback) {
            page.renderBase64("PNG", function (data) {
                callback();
            });
        }, function (error, task, result) {
            assert.ifError(error);
            assert.equal(result, 'Home - Astrid Florence Cassing');
            done();
        });
    });

    it("check error: PAGE LOAD FAILED", function (done) {
        this.timeout(timeout);
        const invalid_url = 'invalidurlhahahahah';
        classUnderTest.openURL(invalid_url, null, function () {
            return document.title;
        }, null, null, function (error, task, result) {
            assert.equal(error, 'PAGE_LOAD_FAILED');
            done();
        });
    });

    it("check retries", function (done) {
        this.timeout(timeout);
        const invalid_url = 'invalidurlhahahahah';
        classUnderTest.openURL(invalid_url, null, function () {
            return document.title;
        }, null, null, function (error, task, result) {
            assert.equal(error, 'PAGE_LOAD_FAILED');
            assert.equal(task.tries, classUnderTest.options.retries);
            done();
        });
    });

    it("check eval inject", function (done) {
        this.timeout(timeout);
        classUnderTest.openURL(testWebsitesUrls['testpage1'], null, function (text) {
            return document.title + ' ' + text;
        }, 'hallo', null, function (error, task, result) {
            assert.ifError(error);
            assert.equal(result, 'Home - Astrid Florence Cassing hallo');
            done();
        });
    });

});

function getTestWebSitesUrls(dir) {
    var baseUrl = 'http://' + pjson.config['test-host'] + ':' + pjson.config['test-port'] + '/';
    var startFile = 'index.html';
    var results = {};

    fs.readdirSync(dir).forEach(function (file) {
        var newDir = dir + '/' + file;
        var stat = fs.statSync(newDir);

        if (stat && stat.isDirectory()) {
            results[file] = baseUrl + file + '/' + startFile;
        }
    });
    return results;
};