var assert = require("assert");
var PhantomManager = require('../../index');

var manager = new PhantomManager(function(){

});


setTimeout(function(){
    manager.openURL('http://cassing.de', null, function(){return document.title}, null, null, function(error, task, title){
        if(error){
            console.log('error: ' + error);
        }

        console.log('title: ' + JSON.stringify(title));
    });
}, 10000);