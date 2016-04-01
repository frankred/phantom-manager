"use strict";

var os = require('os');
var cluster = require('cluster');
var debug = require('debug')('phantom-manager:integration');
var PhantomManager = require('../../index');

// Master
if (cluster.isMaster) {
    for (var i = 0; i < os.cpus().length; i++) {
        cluster.fork();
    }
    return;
} else if (cluster.isWorker) {
    // Fork
    var manager = new PhantomManager(function (error) {
        if(error) {
            manager.shutdown(function(err) {
                debug('manager terminated with ' + (err || 'no error'));
            });
        }
    }, {amount: 4});
}

setTimeout(function () {
    process.exit();
}, 10000);