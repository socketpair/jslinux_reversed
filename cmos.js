"use strict";

function cmos_convert(a) {
    return((a / 10) << 4) | (a % 10);
}
function CMOS(emulator) {
    var Qg, d;
    Qg = emulator.cpu.malloc(128);
    this.cmos_data = Qg;
    this.cmos_index = 0;
    d = new Date();
    Qg[0] = cmos_convert(d.getUTCSeconds());
    Qg[2] = cmos_convert(d.getUTCMinutes());
    Qg[4] = cmos_convert(d.getUTCHours());
    Qg[6] = cmos_convert(d.getUTCDay());
    Qg[7] = cmos_convert(d.getUTCDate());
    Qg[8] = cmos_convert(d.getUTCMonth() + 1);
    Qg[9] = cmos_convert(d.getUTCFullYear() % 100);
    Qg[10] = 0x26;
    Qg[11] = 0x02;
    Qg[12] = 0x00;
    Qg[13] = 0x80;
    Qg[0x14] = 0x02;
    emulator.register_ioport_write(0x70, 2, 1, this.ioport_write.bind(this));
    emulator.register_ioport_read(0x70, 2, 1, this.ioport_read.bind(this));
}
CMOS.prototype.ioport_write = function (ia, Lg) {
    if (ia == 0x70) {
        this.cmos_index = Lg & 0x7f;
    }
};
CMOS.prototype.ioport_read = function (ia) {
    var Rg;
    if (ia == 0x70) {
        return 0xff;
    }

    Rg = this.cmos_data[this.cmos_index];
    if (this.cmos_index == 10) {
        this.cmos_data[10] ^= 0x80;
    } else {
        if (this.cmos_index == 12) {
            this.cmos_data[12] = 0x00;
        }
    }
    return Rg;
};
