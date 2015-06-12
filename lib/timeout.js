function Timeout(fn, interval, scope, args) {
    scope = scope;
    var self = this;
    var wrap = function () {
        self.clear();
        fn.apply(scope, args || arguments);
    }
    this.id = setTimeout(wrap, interval);
};

Timeout.prototype.id = null

Timeout.prototype.cleared = false;

Timeout.prototype.clear = function () {
    clearTimeout(this.id);
    this.cleared = true;
    this.id = null;
};

module.exports = Timeout;