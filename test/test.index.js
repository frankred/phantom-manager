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
    res.sendfile(webSitesDirOuterTestsDir + req.params[0]);
});

// Test
describe("phantom-manager test", function () {

    var classUnderTest;

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
        this.timeout(60000);
        classUnderTest.openURL(testWebsitesUrls['testpage1'], null, function () {
            return document.title;
        }, function (error, url, result) {
            assert.ifError(error);
            done();
        });
    });

    it("check title", function (done) {
        this.timeout(60000);
        classUnderTest.openURL(testWebsitesUrls['testpage1'], null, function () {
            return document.title;
        }, function (error, url, result) {
            assert.ifError(error);
            assert.equal(result, 'Home - Astrid Florence Cassing');
            done();
        });
    });

    it("check error: PAGE LOAD FAILED", function (done) {
        this.timeout(60000);
        const invalid_url = 'invalidurlhahahahah';
        classUnderTest.openURL(invalid_url, null, function () {
            return document.title;
        }, function (error, url, result) {
            assert(error, 'PAGE_LOAD_FAILED');
            done();
        });
    });
});

function getTestWebSitesUrls(dir) {
    var baseUrl = 'http://' + pjson.config['test-host'] + ':' + pjson.config['test-port'] + '/',
        startFile = 'index.html',
        results = {};
    fs.readdirSync(dir).forEach(function (file) {

        var newDir = dir + '/' + file;
        var stat = fs.statSync(newDir);

        if (stat && stat.isDirectory()) {
            results[file] = baseUrl + file + '/' + startFile;
        }
    });
    return results;
};