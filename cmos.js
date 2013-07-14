"use strict";

function cmos_convert(a) {
    return((a / 10) << 4) | (a % 10);
}
function CMOS(pc_emulator) {
    var cmos_data, now;
    cmos_data = pc_emulator.cpu.malloc(128);
    this.cmos_data = cmos_data;
    this.cmos_index = 0;
    now = new Date();
    cmos_data[0] = cmos_convert(now.getUTCSeconds());
    cmos_data[2] = cmos_convert(now.getUTCMinutes());
    cmos_data[4] = cmos_convert(now.getUTCHours());
    cmos_data[6] = cmos_convert(now.getUTCDay());
    cmos_data[7] = cmos_convert(now.getUTCDate());
    cmos_data[8] = cmos_convert(now.getUTCMonth() + 1);
    cmos_data[9] = cmos_convert(now.getUTCFullYear() % 100);
    cmos_data[10] = 0x26;
    cmos_data[11] = 0x02;
    cmos_data[12] = 0x00;
    cmos_data[13] = 0x80;
    cmos_data[0x14] = 0x02;
    pc_emulator.register_ioport_write(0x70, 2, 1, this.ioport_write.bind(this));
    pc_emulator.register_ioport_read(0x70, 2, 1, this.ioport_read.bind(this));
}
CMOS.prototype.ioport_write = function (io_port, byte_value) {
    if (io_port == 0x70) {
        this.cmos_index = byte_value & 0x7f;
    }
};
CMOS.prototype.ioport_read = function (io_port) {
    var retval;
    if (io_port == 0x70) {
        return 0xff;
    }

    retval = this.cmos_data[this.cmos_index];
    if (this.cmos_index == 10) {
        this.cmos_data[10] ^= 0x80;
    } else {
        if (this.cmos_index == 12) {
            this.cmos_data[12] = 0x00;
        }
    }
    return retval;
};
