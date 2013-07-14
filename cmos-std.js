"use strict";

function CMOS_std(Pg) {
    var Qg, d;
    Qg = malloc_std(128);
    this.cmos_data = Qg;
    this.cmos_index = 0;
    d = new Date();
    Qg[0] = Mg(d.getUTCSeconds());
    Qg[2] = Mg(d.getUTCMinutes());
    Qg[4] = Mg(d.getUTCHours());
    Qg[6] = Mg(d.getUTCDay());
    Qg[7] = Mg(d.getUTCDate());
    Qg[8] = Mg(d.getUTCMonth() + 1);
    Qg[9] = Mg(d.getUTCFullYear() % 100);
    Qg[10] = 0x26;
    Qg[11] = 0x02;
    Qg[12] = 0x00;
    Qg[13] = 0x80;
    Qg[0x14] = 0x02;
    Pg.register_ioport_write(0x70, 2, 1, this.ioport_write.bind(this));
    Pg.register_ioport_read(0x70, 2, 1, this.ioport_read.bind(this));
}
CMOS_std.prototype.ioport_write = function (ia, Lg) {
    if (ia == 0x70) {
        this.cmos_index = Lg & 0x7f;
    }
};
CMOS_std.prototype.ioport_read = function (ia) {
    var Rg;
    if (ia == 0x70) {
        return 0xff;
    } else {
        Rg = this.cmos_data[this.cmos_index];
        if (this.cmos_index == 10)this.cmos_data[10] ^= 0x80; else if (this.cmos_index == 12)this.cmos_data[12] = 0x00;
        return Rg;
    }
};
