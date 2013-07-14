"use strict";

function ClipboardDevice_ta_(Og, Zf, sh, mh, th) {
    Og.register_ioport_read(Zf, 16, 4, this.ioport_readl.bind(this));
    Og.register_ioport_write(Zf, 16, 4, this.ioport_writel.bind(this));
    Og.register_ioport_read(Zf + 8, 1, 1, this.ioport_readb.bind(this));
    Og.register_ioport_write(Zf + 8, 1, 1, this.ioport_writeb.bind(this));
    this.cur_pos = 0;
    this.doc_str = "";
    this.read_func = sh;
    this.write_func = mh;
    this.get_boot_time = th;
}
ClipboardDevice_ta_.prototype.ioport_writeb = function (fa, ga) {
    this.doc_str += String.fromCharCode(ga);
};
ClipboardDevice_ta_.prototype.ioport_readb = function (fa) {
    var c, na, ga;
    na = this.doc_str;
    if (this.cur_pos < na.length) {
        ga = na.charCodeAt(this.cur_pos) & 0xff;
    } else {
        ga = 0;
    }
    this.cur_pos++;
    return ga;
};
ClipboardDevice_ta_.prototype.ioport_writel = function (fa, ga) {
    var na;
    fa = (fa >> 2) & 3;
    switch (fa) {
        case 0:
            this.doc_str = this.doc_str.substr(0, ga >>> 0);
            break;
        case 1:
            return this.cur_pos = ga >>> 0;
        case 2:
            na = String.fromCharCode(ga & 0xff) + String.fromCharCode((ga >> 8) & 0xff) + String.fromCharCode((ga >> 16) & 0xff) + String.fromCharCode((ga >> 24) & 0xff);
            this.doc_str += na;
            break;
        case 3:
            this.write_func(this.doc_str);
    }
};
ClipboardDevice_ta_.prototype.ioport_readl = function (fa) {
    var ga;
    fa = (fa >> 2) & 3;
    switch (fa) {
        case 0:
            this.doc_str = this.read_func();
            return this.doc_str.length >> 0;
        case 1:
            return this.cur_pos >> 0;
        case 2:
            ga = this.ioport_readb(0);
            ga |= this.ioport_readb(0) << 8;
            ga |= this.ioport_readb(0) << 16;
            ga |= this.ioport_readb(0) << 24;
            return ga;
        case 3:
            if (this.get_boot_time)return this.get_boot_time() >> 0; else return 0;
    }
};
