"use strict";

function JSLinuxWithGUI(term_container, linuxname, prefix, cmdline, canvas_container) {
    if (typeof Uint8Array == 'undefined' || typeof Uint16Array == 'undefined' || typeof Int32Array == 'undefined' || typeof ArrayBuffer == 'undefined') {
        this.report_no_support(term_container);
        return;
    }

    var me = this;
    var term;
    var worker;

    //TODO: use worker.onerror
    //TODO: use worker.terminate()
    if (typeof Worker != 'undefined') {
        console.log("Using FAST native worker");
        worker = new Worker(prefix + '/worker.js');
    } else {
        console.log("Using SLOW worker emulation");
        worker = new PseudoWorker(prefix + '/worker.js');
    }

    var canvas = document.createElement('canvas');
    canvas.width=640;
    canvas.height=480;
    canvas.style.border = "1px solid green";
    var context = canvas.getContext('2d');
    var imageData = context.createImageData(640, 480);
    canvas_container.appendChild(canvas);
    var i;

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
            case 'worker_loaded':
                //console.log('Worker for ' + linuxname + ' loaded');
                break;
            case 'screenshot':
                imageData.data.set(evt.data.data);
                for (i=3; i<imageData.data.length; i+=4) {
                    // remove alpha-values
                    imageData.data[i]=0xff;
                }
                context.putImageData(imageData,0,0);
                break;
            default:
                // TODO: report this to user
                console.log('bugg', evt);
                break;
        }
    };
    //predefined function
    this.worker = worker;
    this.startparams = {
        what: 'start',
        name: linuxname,
        prefix: prefix,
        cmdline: cmdline
    };
    term = new Term(80, 30, function (data) {
        worker.postMessage({
            what: 'com1_input',
            str: data
        });
    });
    term.open(term_container);
}

JSLinuxWithGUI.prototype.report_no_support = function (term_container) {
    term_container.innerHTML = '<p>Typed arrays are not supported.</p><p>Please use <a href="http://caniuse.com/typedarrays">modern browser</a></p>';
};

JSLinuxWithGUI.prototype.onterminaloutput = function (evt) {
};

JSLinuxWithGUI.prototype.start = function () {
    this.worker.postMessage(this.startparams);
};

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
