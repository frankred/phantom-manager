"use strict";

var PhantomManager = require('../../index');

var manager = new PhantomManager(function(){

    var evaluate = function() {
        return document.title;
    };

    manager.openURL('http://cassing.de', null, evaluate, null, null, function(error, task, title){
        if(error){
            console.log('error: ' + error);
        }

        console.log('title: ' + JSON.stringify(title));
    });
});