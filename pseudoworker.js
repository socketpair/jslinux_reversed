"use strict";

function PseudoWorker(url) {
    var me = this;
    var buffered_messages = [];

    function Child() {
    }

    Child.prototype.postMessage = function (msg) {
        me.onmessage({data: msg});
    };

    Child.prototype.onmessage = function (msg) {
    };

    var child = new Child();
    this.child = child;

    if (typeof JslinuxWorker != "undefined") {
        JslinuxWorker(child, true);
        return;
    }

    var success = function () {
        new JslinuxWorker(child, true);

        var pushmsgtome = function (msg) {
            child.onmessage({data: msg});
        };

        // replace postMessage hook
        me.postMessage = pushmsgtome.bind(me);

        var i;
        for (i = 0; i < buffered_messages.length; i++) {
            me.postMessage(buffered_messages[i]);
        }
        // TODO:
        //delete this['buffered_messages'];
    };

    var error = function () {
        throw 'Error loading pseudoworker body..';
    };

    // buffer for messages until fully loaded...


    this.buffered_messages = buffered_messages;
    loadScript(url, success, error);
}

//this function will be discarded when everything is loaded...
PseudoWorker.prototype.postMessage = function (msg) {
    this.buffered_messages.push(msg);
};

PseudoWorker.prototype.onmessage = function (evt) {
};

PseudoWorker.prototype.close = function () {
};
