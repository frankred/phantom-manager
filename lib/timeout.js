"use strict";

function Timeout(fn, interval, scope, args) {
    scope = scope;
    var self = this;
    var wrap = function () {
        self.clear();
        self.was_already_called = true;
        fn.apply(scope, args || arguments);
    };
    this.id = setTimeout(wrap, interval);
    this.was_already_called = false;
}

Timeout.prototype.id = null;

Timeout.prototype.cleared = false;

Timeout.prototype.wasAlreadyCalled = function () {
    return this.was_already_called;
};

Timeout.prototype.clear = function () {
    clearTimeout(this.id);
    this.cleared = true;
    this.id = null;
};

Timeout.prototype.tryToClear = function () {
    if (this.cleared === false) {
        this.clear(); // delete timeout
    } else if (this.cleared === true) {
        return; // timeout error already called, you come to late
    }
};

Timeout.prototype.isCleared = function () {
    return this.cleared;
};

module.exports = Timeout;