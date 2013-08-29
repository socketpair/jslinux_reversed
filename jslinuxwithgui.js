"use strict";

function PseudoWorker(url) {
    var me = this;

    function Child() {
    }

    Child.prototype.postMessage = function (msg) {
        me.onmessage({data: msg});
    };
    Child.prototype.onmessage = function (msg) {
    };

    this.child = new Child();

    window.DIRTY_PASS = this.child;
    jQuery.ajax({
        //context: me,
        dataType: "script",
        cache: true,
        url: url,
        async: false
    });
    window.DIRTY_PASS = null;
}

PseudoWorker.prototype.postMessage = function (msg) {
    this.child.onmessage({data: msg});
};

PseudoWorker.prototype.onmessage = function (evt) {
};

var worker_class;
var jslinux_scripts = [
    "/utils.js",
    "/term.js",
    "/cpux86-ta.js",
    "/clipboard.js",
    "/cmos.js",
    "/ide.js",
    "/keyboard.js",
    "/pic.js",
    "/pit.js",
    "/serial.js",
    "/block_reader.js",
    "/pcemulator.js",
    "/jslinux.js"
];

function prepare_jslinux(prefix, callback) {
    if (typeof Worker != 'undefined') {
        console.log('Using Fast worker model!');
        worker_class = Worker;
        callback();
        return;
    }

    console.log('Using SLOW emulation worker model. You are looser. upgrade browser');
    worker_class = PseudoWorker;

    var counter = jslinux_scripts.length;
    var i;
    for (i = counter - 1; i >= 0; i--) {
        jQuery.ajax({
            dataType: "script",
            cache: true,
            url: prefix + jslinux_scripts[i],
            async: true
        }).success(function () {
                counter--;
                if (!counter)
                    callback();
            });
    }
}

function JSLinuxWithGUI(term_container, linuxname, prefix) {
    if (typeof Uint8Array == 'undefined' || typeof Uint16Array == 'undefined' || typeof Int32Array == 'undefined' || typeof ArrayBuffer == 'undefined') {
        term_container.innerHTML = '<p>Typed arrays are not supported.</p><p>Please use <a href="http://caniuse.com/typedarrays">modern browser</a></p>';
        return;
    }
    var me = this;
    var term;
    var worker;

    //TODO: use worker.onerror
    //TODO: use worker.terminate()
    worker = new worker_class(prefix + '/worker.js');

    //predefined event
    worker.onmessage = function (evt) {
        switch (evt.data.what) {
            case 'com1_output':
                if (term)
                    term.write(evt.data.str);
                me.onterminaloutput({data: evt.data.str});
                break;
            case 'com2_output':
                //TODO: generate event
                //http://stackoverflow.com/questions/2490825/how-to-trigger-event-in-javascript
                me.oncom2data({data: evt.data.str});
                break;
            case 'clipboard_output':
                //todo: generate event
                //http://stackoverflow.com/questions/2490825/how-to-trigger-event-in-javascript
                me.onclipboardoutput({data: evt.data.str});
                break;
            case 'log':
                console.log.apply(console, evt.data.args);
                break;
            default:
                console.log('bugg', evt);
        }
    };
    //predefined function
    this.worker = worker;
    this.startparams = {
        what: 'start',
        name: linuxname,
        scripts: jslinux_scripts, // is not required on pseudoworker
        prefix: prefix
    };
    term = new Term(80, 30, function (data) {
        worker.postMessage({
            what: 'com1_input',
            str: data
        });
    });
    term.open(term_container);
}

JSLinuxWithGUI.prototype.onterminaloutput = function (evt) {
};

JSLinuxWithGUI.prototype.start = function() {
    this.worker.postMessage(this.startparams);
}

JSLinuxWithGUI.prototype.push_to_com2 = function (text) {
    this.worker.postMessage({
        what: 'com2_input',
        str: text
    });
};

JSLinuxWithGUI.prototype.push_to_clipboard = function (text) {
    this.worker.postMessage({
        what: 'clipboard_input',
        str: text
    });
};

JSLinuxWithGUI.prototype.oncom2data = function (evt) {

};

JSLinuxWithGUI.prototype.onclipboardoutput = function (evt) {

};
