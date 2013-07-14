"use strict";

function CMOS_ta_(Og) {
    var Pg, d;
    Pg = Mg(128);
    this.cmos_data = Pg;
    this.cmos_index = 0;
    d = new Date();
    Pg[0] = Lg(d.getUTCSeconds());
    Pg[2] = Lg(d.getUTCMinutes());
    Pg[4] = Lg(d.getUTCHours());
    Pg[6] = Lg(d.getUTCDay());
    Pg[7] = Lg(d.getUTCDate());
    Pg[8] = Lg(d.getUTCMonth() + 1);
    Pg[9] = Lg(d.getUTCFullYear() % 100);
    Pg[10] = 0x26;
    Pg[11] = 0x02;
    Pg[12] = 0x00;
    Pg[13] = 0x80;
    Pg[0x14] = 0x02;
    Og.register_ioport_write(0x70, 2, 1, this.ioport_write.bind(this));
    Og.register_ioport_read(0x70, 2, 1, this.ioport_read.bind(this));
}
CMOS_ta_.prototype.ioport_write = function (fa, Kg) {
    if (fa == 0x70) {
        this.cmos_index = Kg & 0x7f;
    }
};
CMOS_ta_.prototype.ioport_read = function (fa) {
    var Qg;
    if (fa == 0x70) {
        return 0xff;
    } else {
        Qg = this.cmos_data[this.cmos_index];
        if (this.cmos_index == 10)this.cmos_data[10] ^= 0x80; else if (this.cmos_index == 12)this.cmos_data[12] = 0x00;
        return Qg;
    }
};
