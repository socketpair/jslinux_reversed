/* 
 PC Emulator wrapper

 Copyright (c) 2012 Fabrice Bellard

 Redistribution or commercial use is prohibited without the author's
 permission.
 */
"use strict";

function test_typed_arrays() {
    return (window.Uint8Array &&
        window.Uint16Array &&
        window.Int32Array &&
        window.ArrayBuffer);
}

if (test_typed_arrays()) {
    include("cpux86-ta.js");
} else {
    include("cpux86-std.js");
}

include("clipboard.js");
include("cmos.js");
include("ide.js");
include("keyboard.js");
include("pic.js");
include("pit.js");
include("serial.js");
include("block_reader.js");
include("pcemulator.js");
