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

        if (data === null || data === undefined) {
            //TODO: report error to GUI (!)
            callback(null, -1);
            return;
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
        typed_array = ((typeof ArrayBuffer != 'undefined') && (typeof Uint8Array != 'undefined'));
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
/*
 jQuery.ajax({
 //context: me,
 dataType: "script",
 cache: true,
 url: url,
 async: false
 });
 */

function loadScript(url, success_callback, error_callback) {
    var script = document.createElement('script');
    /*
     var isLoaded = false;
     script.onreadystatechange = function () {
     if ((script.readyState == 'complete' || script.readyState == 'loaded') && !isLoaded) {
     if (callback)
     callback();
     }
     };
     */
    // TODO: make this cross-browser
    if (success_callback) {
        script.onload = function () {
            success_callback();
        };
    }

    if (error_callback) {
        script.onerror = function () {
            error_callback();
        };
    }

    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', url);
    var parent = document.body; //document.getElementsByTagName('head').item(0) || document.documentElement;
    parent.appendChild(script);
}

function loadScripts(scripts, success_callback, error_callback) {
    var counter = scripts.length;
    var i;
    var was_error = false;

    if (counter == 0) {
        success_callback();
        return;
    }

    var operation_complete = function () {
        if (was_error)
            error_callback();
        else
            success_callback();
    };

    var success = function () {
        if (--counter <= 0) {
            operation_complete();
        }
    };

    var error = function () {
        was_error = true;
        if (--counter <= 0) {
            operation_complete();
        }
    };

    for (i = counter - 1; i >= 0; i--) {
        // load all scripts asynchronously
        loadScript(scripts[i], success, error);
    }
}


self.load_binary = load_binary;
self.loadScript = loadScript;
self.loadScripts = loadScripts;
