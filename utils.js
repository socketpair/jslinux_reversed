/* 
 Javascript Utilities

 Copyright (c) 2011-2012 Fabrice Bellard

 Redistribution or commercial use is prohibited without the author's
 permission.
 */
"use strict";

/* Load a binary data. cb(data, len) is called with data = null and
 * len = -1 in case of error. Otherwise len is the length in
 * bytes. data can be a string, Array or Uint8Array depending on
 * the implementation. */
function load_binary(url, callback) {
    var req, typed_array, is_ie;

    req = new XMLHttpRequest();
    req.open('GET', url, true);

    /* completion function */
    req.onreadystatechange = function () {
        var data, len, buf;

        if (req.readyState !== 4) {
            return;
        }

        if (req.status != 200 && req.status != 0) {
            callback(null, -1);
            return;
        }

        if (is_ie) {
            data = new VBArray(req.responseBody).toArray();
            len = data.length;
            callback(data, len);
            return;
        }

        if (typed_array && 'mozResponse' in req) {
            /* firefox 6 beta */
            data = req.mozResponse;
        } else if (typed_array && req.mozResponseArrayBuffer) {
            /* Firefox 4 */
            data = req.mozResponseArrayBuffer;
        } else if ('responseType' in req) {
            /* Note: in Android 3.0 there is no typed arrays so its
             returns UTF8 text */
            data = req.response;
        } else {
            data = req.responseText;
            typed_array = false;
        }

        if (typed_array) {
            len = data.byteLength;
            buf = new Uint8Array(data, 0, len);
            callback(buf, len);
        } else {
            len = data.length;
            callback(data, len);
        }
    };

    is_ie = (typeof ActiveXObject == "function");
    if (!is_ie) {
        typed_array = ('ArrayBuffer' in window && 'Uint8Array' in window);
        if (typed_array && 'mozResponseType' in req) {
            /* firefox 6 beta */
            req.mozResponseType = 'arraybuffer';
        } else if (typed_array && 'responseType' in req) {
            /* Chrome */
            req.responseType = 'arraybuffer';
        } else {
            req.overrideMimeType('text/plain; charset=x-user-defined');
            typed_array = false;
        }
    }
    req.send(null);
}

