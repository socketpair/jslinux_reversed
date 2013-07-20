"use strict";

(function () {
    var asdasd;

    var is_pseudo;

    if (self.DIRTY_PASS) {
        asdasd = self.DIRTY_PASS; // for pseudo-worker
        is_pseudo = true;
    } else {
        asdasd = self; // for real worker
        is_pseudo = false;
    }

    var cached_text = '';

    var clipboard_get = function () {
        return cached_text;
    };

    var clibboard_set = function (data) {
        asdasd.postMessage({
            what: 'clipboard_output',
            str: data
        });
        //should go back again, replace anyway...
        cached_text = data;
    };

    var pc;
    asdasd.onmessage = function (evt) {
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
                pc.com1.write_func = function (blob) {
                    asdasd.postMessage({
                        what: 'com1_output',
                        str: blob
                    });
                };
                pc.com2.write_func = function (blob) {
                    asdasd.postMessage({
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
