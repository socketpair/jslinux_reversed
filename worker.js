"use strict";

function JslinuxWorker(worker_child, is_pseudo) {
    var cached_clipboard_text = '';

    var clipboard_get = function () {
        return cached_clipboard_text;
    };

    var clibboard_set = function (data) {
        worker_child.postMessage({
            what: 'clipboard_output',
            str: data
        });
        //should go back again, replace anyway...
        cached_clipboard_text = data;
    };

    var pc;

    var load_jslinux_scripts = function (prefix, callback) {
        var jslinux_scripts = [
            prefix + "/utils.js",
            prefix + "/term.js",
            prefix + "/cpux86-ta.js",
            prefix + "/clipboard.js",
            prefix + "/cmos.js",
            prefix + "/ide.js",
            prefix + "/keyboard.js",
            prefix + "/pic.js",
            prefix + "/pit.js",
            prefix + "/serial.js",
            prefix + "/block_reader.js",
            prefix + "/pcemulator.js",
            prefix + "/jslinux.js"
        ];
        if (is_pseudo) {
            loadScripts(jslinux_scripts, callback);
        } else {
            importScripts.apply(self, jslinux_scripts);
            callback();
        }
    };

    var post_log_message = function () {
        worker_child.postMessage({
            what: 'log',
            // convert arguments to generic array, to pass over postMessage in worker...
            args: Array.prototype.slice.call(arguments, 0)
        });
    };

    var post_com1_message = function (string) {
        worker_child.postMessage({
            what: 'com1_output',
            str: string
        });
    };

    var post_com2_message = function (string) {
        worker_child.postMessage({
            what: 'com2_output',
            str: string
        });
    };

    worker_child.onmessage = function (evt) {
        var data = evt.data;
        switch (data.what) {
            case 'start':
                load_jslinux_scripts(data.prefix, function () {
                    pc = self.jslinux(clipboard_get, clibboard_set, data.name, data.prefix + '/bin', data.cmdline);
                    pc.log = post_log_message.bind(worker_child);
                    pc.com1.write_func = post_com1_message.bind(worker_child);
                    pc.com2.write_func = post_com2_message.bind(worker_child);
                    //post_log_message(document.getElementsByTagName('script'));
                });
                break;
            case 'com1_input':
                if (pc)
                    pc.com1.send_chars(data.str);
                break;
            case 'com2_input':
                if (pc)
                    pc.com2.send_chars(data.str);
                break;
            case 'clipboard_input':
                cached_clipboard_text = data.str;
                break;
        }
    };

    worker_child.postMessage({
        what: 'worker_loaded'
    });
}

if (typeof window == 'undefined') {
    JslinuxWorker(self, false);
} else {
    window.JslinuxWorker = JslinuxWorker;
}
