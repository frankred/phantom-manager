# phantom-manager
A wrapper to handle multiple phantom instances based on phantomjs-node

## Usage
```js
var PhantomManager = require('phantom-manager');

var options = {
    phantom_port: 9900,
    amount: 4,
    parallel_each: 1,
    timeout: 30000,
    viewport: {
        width: 800,
        height: 600
    },
    load_images: true,
    retries: 3,
    idle_time: 60000
};

var manager = new PhantomManager(function(error){
    if(error){
        throw error;
    }

    var pageBefore = function (page, ready) {
        async.map([
            util_dir + '/util.js'
        ], page.injectJs, function () {
            ready();
        });
    };

    var evaluate = function () {
        return document.title;
    };

    var pageAfter = function (page, evalResult, ready) {
        ready();
    };

    manager.openURL(url, pageBefore, evaluate, null, pageAfter, function (error, task, result) {
       console.log('Page title is ' + result);
   });
}, options);
```