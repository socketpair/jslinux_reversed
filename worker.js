"use strict";

(function () {
    var worker_instance;

    var is_pseudo;

    if (self.DIRTY_PASS) {
        worker_instance = self.DIRTY_PASS; // for pseudo-worker
        is_pseudo = true;
    } else {
        worker_instance = self; // for real worker
        is_pseudo = false;
    }

    var cached_text = '';

    var clipboard_get = function () {
        return cached_text;
    };

    var clibboard_set = function (data) {
        worker_instance.postMessage({
            what: 'clipboard_output',
            str: data
        });
        //should go back again, replace anyway...
        cached_text = data;
    };

    var pc;
    worker_instance.onmessage = function (evt) {
        var data = evt.data;

        switch (data.what) {
            case 'start':
                if (!is_pseudo) {
                    var i;
                    for (i = 0; i < data.scripts.length; i++) {
                        data.scripts[i] = data.prefix + data.scripts[i];
                    }
                    self.importScripts.apply(self, data.scripts);
                }
                pc = self.jslinux(clipboard_get, clibboard_set, data.name, data.prefix + '/bin');
                pc.log = function () {
                    worker_instance.postMessage({
                        what: 'log',
                        // convert arguments to generic array, to pass over postMessage in worker...
                        args: Array.prototype.slice.call(arguments[0], 0)
                    });
                };
                pc.com1.write_func = function (blob) {
                    worker_instance.postMessage({
                        what: 'com1_output',
                        str: blob
                    });
                };
                pc.com2.write_func = function (blob) {
                    worker_instance.postMessage({
                        what: 'com2_output',
                        str: blob
                    });
                };
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
                cached_text = data.str;
                break;
        }
    };
})();
