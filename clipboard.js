"use strict";

function jslinux_str2utf8(string) {
    var utftext = "";
    var n;
    var c;

    for (n = 0; n < string.length; n++) {

        c = string.charCodeAt(n);

        if (c < 128) {
            utftext += String.fromCharCode(c);
        }
        else if ((c > 127) && (c < 2048)) {
            utftext += String.fromCharCode((c >> 6) | 192);
            utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
            utftext += String.fromCharCode((c >> 12) | 224);
            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
            utftext += String.fromCharCode((c & 63) | 128);
        }

    }

    return utftext;
}


function jslinux_utf82str(utftext) {
    var string = "";
    var i = 0;
    var c = 0;
    var c1 = 0;
    var c2 = 0;
    var c3 = 0;

    while (i < utftext.length) {

        c = utftext.charCodeAt(i);

        if (c < 128) {
            string += String.fromCharCode(c);
            i++;
        }
        else if ((c > 191) && (c < 224)) {
            c2 = utftext.charCodeAt(i + 1);
            string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
            i += 2;
        }
        else {
            c2 = utftext.charCodeAt(i + 1);
            c3 = utftext.charCodeAt(i + 2);
            string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            i += 3;
        }

    }

    return string;
}


function ClipboardDevice(pc_emulator, io_port, read_func, write_func, get_boot_time) {
    pc_emulator.register_ioport_read(io_port, 16, 4, this.ioport_readl.bind(this));
    pc_emulator.register_ioport_write(io_port, 16, 4, this.ioport_writel.bind(this));
    pc_emulator.register_ioport_read(io_port + 8, 1, 1, this.ioport_readb.bind(this));
    pc_emulator.register_ioport_write(io_port + 8, 1, 1, this.ioport_writeb.bind(this));
    this.cur_pos = 0;
    this.doc_str = "";
    this.read_func = read_func;
    this.write_func = write_func;
    this.get_boot_time = get_boot_time;
}

ClipboardDevice.prototype.log = function () {
};

ClipboardDevice.prototype.ioport_writeb = function (io_port, byte_value) {
    this.doc_str += String.fromCharCode(byte_value);
};
ClipboardDevice.prototype.ioport_readb = function (io_port) {
    var doc_str, retval_byte;
    doc_str = this.doc_str;
    if (this.cur_pos < doc_str.length) {
        retval_byte = doc_str.charCodeAt(this.cur_pos) & 0xff;
    } else {
        retval_byte = 0;
    }
    this.cur_pos++;
    return retval_byte;
};
ClipboardDevice.prototype.ioport_writel = function (io_port, dword_value) {
    var text;
    io_port = (io_port >> 2) & 3;
    switch (io_port) {
        case 0:
            this.doc_str = this.doc_str.substr(0, dword_value >>> 0);
            break;
        case 1:
            this.cur_pos = dword_value >>> 0;
            break;
        case 2:
            text = String.fromCharCode(dword_value & 0xff) +
                String.fromCharCode((dword_value >> 8) & 0xff) +
                String.fromCharCode((dword_value >> 16) & 0xff) +
                String.fromCharCode((dword_value >> 24) & 0xff);
            this.doc_str += text;
            break;
        case 3:
            this.write_func(jslinux_utf82str(this.doc_str));
            break;
    }
};
ClipboardDevice.prototype.ioport_readl = function (io_port) {
    var retval_dword;
    io_port = (io_port >> 2) & 3;
    switch (io_port) {
        case 0:
            this.doc_str = jslinux_str2utf8(this.read_func());
            return this.doc_str.length >> 0;
        case 1:
            return this.cur_pos >> 0;
        case 2:
            retval_dword = this.ioport_readb(0);
            retval_dword |= this.ioport_readb(0) << 8;
            retval_dword |= this.ioport_readb(0) << 16;
            retval_dword |= this.ioport_readb(0) << 24;
            return retval_dword;
        default:
        case 3:
            if (this.get_boot_time) {
                return this.get_boot_time() >> 0;
            } else {
                return 0;
            }
    }
};

self.ClipboardDevice = ClipboardDevice;
