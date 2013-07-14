function ClipboardDevice_std(Pg, ag, th, nh, uh) {
    Pg.register_ioport_read(ag, 16, 4, this.ioport_readl.bind(this));
    Pg.register_ioport_write(ag, 16, 4, this.ioport_writel.bind(this));
    Pg.register_ioport_read(ag + 8, 1, 1, this.ioport_readb.bind(this));
    Pg.register_ioport_write(ag + 8, 1, 1, this.ioport_writeb.bind(this));
    this.cur_pos = 0;
    this.doc_str = "";
    this.read_func = th;
    this.write_func = nh;
    this.get_boot_time = uh;
}
ClipboardDevice_std.prototype.ioport_writeb = function (ia, ja) {
    this.doc_str += String.fromCharCode(ja);
};
ClipboardDevice_std.prototype.ioport_readb = function (ia) {
    var c, qa, ja;
    qa = this.doc_str;
    if (this.cur_pos < qa.length) {
        ja = qa.charCodeAt(this.cur_pos) & 0xff;
    } else {
        ja = 0;
    }
    this.cur_pos++;
    return ja;
};
ClipboardDevice_std.prototype.ioport_writel = function (ia, ja) {
    var qa;
    ia = (ia >> 2) & 3;
    switch (ia) {
        case 0:
            this.doc_str = this.doc_str.substr(0, ja >>> 0);
            break;
        case 1:
            return this.cur_pos = ja >>> 0;
        case 2:
            qa = String.fromCharCode(ja & 0xff) + String.fromCharCode((ja >> 8) & 0xff) + String.fromCharCode((ja >> 16) & 0xff) + String.fromCharCode((ja >> 24) & 0xff);
            this.doc_str += qa;
            break;
        case 3:
            this.write_func(this.doc_str);
    }
};
ClipboardDevice_std.prototype.ioport_readl = function (ia) {
    var ja;
    ia = (ia >> 2) & 3;
    switch (ia) {
        case 0:
            this.doc_str = this.read_func();
            return this.doc_str.length >> 0;
        case 1:
            return this.cur_pos >> 0;
        case 2:
            ja = this.ioport_readb(0);
            ja |= this.ioport_readb(0) << 8;
            ja |= this.ioport_readb(0) << 16;
            ja |= this.ioport_readb(0) << 24;
            return ja;
        case 3:
            if (this.get_boot_time)return this.get_boot_time() >> 0; else return 0;
    }
};
