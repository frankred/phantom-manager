var assert = require("assert");
var cluster = require('cluster');
var os = require('os');
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

    }, {amount: 4});
}

setTimeout(function () {
    process.exit();
}, 10000)