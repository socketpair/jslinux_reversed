"use strict";

function IDE_drive_ta_(Gh, Hh) {
    var Ih, Jh;
    this.ide_if = Gh;
    this.bs = Hh;
    Jh = Hh.get_sector_count();
    Ih = Jh / (16 * 63);
    if (Ih > 16383)Ih = 16383; else if (Ih < 2)Ih = 2;
    this.cylinders = Ih;
    this.heads = 16;
    this.sectors = 63;
    this.nb_sectors = Jh;
    this.mult_sectors = 128;
    this.feature = 0;
    this.error = 0;
    this.nsector = 0;
    this.sector = 0;
    this.lcyl = 0;
    this.hcyl = 0;
    this.select = 0xa0;
    this.status = 0x40 | 0x10;
    this.cmd = 0;
    this.io_buffer = malloc_ta_(128 * 512 + 4);
    this.data_index = 0;
    this.data_end = 0;
    this.end_transfer_func = this.transfer_stop.bind(this);
    this.req_nb_sectors = 0;
    this.io_nb_sectors = 0;
}
IDE_drive_ta_.prototype.identify = function () {
    function vh(wh, v) {
        xh[wh * 2] = v & 0xff;
        xh[wh * 2 + 1] = (v >> 8) & 0xff;
    }

    function yh(wh, na, rg) {
        var i, v;
        for (i = 0; i < rg; i++) {
            if (i < na.length) {
                v = na.charCodeAt(i) & 0xff;
            } else {
                v = 32;
            }
            xh[wh * 2 + (i ^ 1)] = v;
        }
    }

    var xh, i, zh;
    xh = this.io_buffer;
    for (i = 0; i < 512; i++)xh[i] = 0;
    vh(0, 0x0040);
    vh(1, this.cylinders);
    vh(3, this.heads);
    vh(4, 512 * this.sectors);
    vh(5, 512);
    vh(6, this.sectors);
    vh(20, 3);
    vh(21, 512);
    vh(22, 4);
    yh(27, "JSLinux HARDDISK", 40);
    vh(47, 0x8000 | 128);
    vh(48, 0);
    vh(49, 1 << 9);
    vh(51, 0x200);
    vh(52, 0x200);
    vh(54, this.cylinders);
    vh(55, this.heads);
    vh(56, this.sectors);
    zh = this.cylinders * this.heads * this.sectors;
    vh(57, zh);
    vh(58, zh >> 16);
    if (this.mult_sectors)vh(59, 0x100 | this.mult_sectors);
    vh(60, this.nb_sectors);
    vh(61, this.nb_sectors >> 16);
    vh(80, (1 << 1) | (1 << 2));
    vh(82, (1 << 14));
    vh(83, (1 << 14));
    vh(84, (1 << 14));
    vh(85, (1 << 14));
    vh(86, 0);
    vh(87, (1 << 14));
};
IDE_drive_ta_.prototype.set_signature = function () {
    this.select &= 0xf0;
    this.nsector = 1;
    this.sector = 1;
    this.lcyl = 0;
    this.hcyl = 0;
};
IDE_drive_ta_.prototype.abort_command = function () {
    this.status = 0x40 | 0x01;
    this.error = 0x04;
};
IDE_drive_ta_.prototype.set_irq = function () {
    if (!(this.cmd & 0x02)) {
        this.ide_if.set_irq_func(1);
    }
};
IDE_drive_ta_.prototype.transfer_start = function (cc, Ah) {
    this.end_transfer_func = Ah;
    this.data_index = 0;
    this.data_end = cc;
};
IDE_drive_ta_.prototype.transfer_stop = function () {
    this.end_transfer_func = this.transfer_stop.bind(this);
    this.data_index = 0;
    this.data_end = 0;
};
IDE_drive_ta_.prototype.get_sector = function () {
    var Bh;
    if (this.select & 0x40) {
        Bh = ((this.select & 0x0f) << 24) | (this.hcyl << 16) | (this.lcyl << 8) | this.sector;
    } else {
        Bh = ((this.hcyl << 8) | this.lcyl) * this.heads * this.sectors + (this.select & 0x0f) * this.sectors + (this.sector - 1);
    }
    return Bh;
};
IDE_drive_ta_.prototype.set_sector = function (Bh) {
    var Ch, r;
    if (this.select & 0x40) {
        this.select = (this.select & 0xf0) | ((Bh >> 24) & 0x0f);
        this.hcyl = (Bh >> 16) & 0xff;
        this.lcyl = (Bh >> 8) & 0xff;
        this.sector = Bh & 0xff;
    } else {
        Ch = Bh / (this.heads * this.sectors);
        r = Bh % (this.heads * this.sectors);
        this.hcyl = (Ch >> 8) & 0xff;
        this.lcyl = Ch & 0xff;
        this.select = (this.select & 0xf0) | ((r / this.sectors) & 0x0f);
        this.sector = (r % this.sectors) + 1;
    }
};
IDE_drive_ta_.prototype.sector_read = function () {
    var Bh, n, Qg;
    Bh = this.get_sector();
    n = this.nsector;
    if (n == 0)n = 256;
    if (n > this.req_nb_sectors)n = this.req_nb_sectors;
    this.io_nb_sectors = n;
    Qg = this.bs.read_async(Bh, this.io_buffer, n, this.sector_read_cb.bind(this));
    if (Qg < 0) {
        this.abort_command();
        this.set_irq();
    } else if (Qg == 0) {
        this.sector_read_cb();
    } else {
        this.status = 0x40 | 0x10 | 0x80;
        this.error = 0;
    }
};
IDE_drive_ta_.prototype.sector_read_cb = function () {
    var n, Dh;
    n = this.io_nb_sectors;
    this.set_sector(this.get_sector() + n);
    this.nsector = (this.nsector - n) & 0xff;
    if (this.nsector == 0)Dh = this.sector_read_cb_end.bind(this); else Dh = this.sector_read.bind(this);
    this.transfer_start(512 * n, Dh);
    this.set_irq();
    this.status = 0x40 | 0x10 | 0x08;
    this.error = 0;
};
IDE_drive_ta_.prototype.sector_read_cb_end = function () {
    this.status = 0x40 | 0x10;
    this.error = 0;
    this.transfer_stop();
};
IDE_drive_ta_.prototype.sector_write_cb1 = function () {
    var Bh, Qg;
    this.transfer_stop();
    Bh = this.get_sector();
    Qg = this.bs.write_async(Bh, this.io_buffer, this.io_nb_sectors, this.sector_write_cb2.bind(this));
    if (Qg < 0) {
        this.abort_command();
        this.set_irq();
    } else if (Qg == 0) {
        this.sector_write_cb2();
    } else {
        this.status = 0x40 | 0x10 | 0x80;
    }
};
IDE_drive_ta_.prototype.sector_write_cb2 = function () {
    var n;
    n = this.io_nb_sectors;
    this.set_sector(this.get_sector() + n);
    this.nsector = (this.nsector - n) & 0xff;
    if (this.nsector == 0) {
        this.status = 0x40 | 0x10;
    } else {
        n = this.nsector;
        if (n > this.req_nb_sectors)n = this.req_nb_sectors;
        this.io_nb_sectors = n;
        this.transfer_start(512 * n, this.sector_write_cb1.bind(this));
        this.status = 0x40 | 0x10 | 0x08;
    }
    this.set_irq();
};
IDE_drive_ta_.prototype.sector_write = function () {
    var n;
    n = this.nsector;
    if (n == 0)n = 256;
    if (n > this.req_nb_sectors)n = this.req_nb_sectors;
    this.io_nb_sectors = n;
    this.transfer_start(512 * n, this.sector_write_cb1.bind(this));
    this.status = 0x40 | 0x10 | 0x08;
};
IDE_drive_ta_.prototype.identify_cb = function () {
    this.transfer_stop();
    this.status = 0x40;
};
IDE_drive_ta_.prototype.exec_cmd = function (ga) {
    var n;
    switch (ga) {
        case 0xA1:
        case 0xEC:
            this.identify();
            this.status = 0x40 | 0x10 | 0x08;
            this.transfer_start(512, this.identify_cb.bind(this));
            this.set_irq();
            break;
        case 0x91:
        case 0x10:
            this.error = 0;
            this.status = 0x40 | 0x10;
            this.set_irq();
            break;
        case 0xC6:
            if (this.nsector > 128 || (this.nsector & (this.nsector - 1)) != 0) {
                this.abort_command();
            } else {
                this.mult_sectors = this.nsector;
                this.status = 0x40;
            }
            this.set_irq();
            break;
        case 0x20:
        case 0x21:
            this.req_nb_sectors = 1;
            this.sector_read();
            break;
        case 0x30:
        case 0x31:
            this.req_nb_sectors = 1;
            this.sector_write();
            break;
        case 0xC4:
            if (!this.mult_sectors) {
                this.abort_command();
                this.set_irq();
            } else {
                this.req_nb_sectors = this.mult_sectors;
                this.sector_read();
            }
            break;
        case 0xC5:
            if (!this.mult_sectors) {
                this.abort_command();
                this.set_irq();
            } else {
                this.req_nb_sectors = this.mult_sectors;
                this.sector_write();
            }
            break;
        case 0xF8:
            this.set_sector(this.nb_sectors - 1);
            this.status = 0x40;
            this.set_irq();
            break;
        default:
            this.abort_command();
            this.set_irq();
            break;
    }
};
function IDE_device_ta_(Og, fa, Kh, lh, Lh) {
    var i, Mh;
    this.set_irq_func = lh;
    this.drives = [];
    for (i = 0; i < 2; i++) {
        if (Lh[i]) {
            Mh = new IDE_drive_ta_(this, Lh[i]);
        } else {
            Mh = null;
        }
        this.drives[i] = Mh;
    }
    this.cur_drive = this.drives[0];
    Og.register_ioport_write(fa, 8, 1, this.ioport_write.bind(this));
    Og.register_ioport_read(fa, 8, 1, this.ioport_read.bind(this));
    if (Kh) {
        Og.register_ioport_read(Kh, 1, 1, this.status_read.bind(this));
        Og.register_ioport_write(Kh, 1, 1, this.cmd_write.bind(this));
    }
    Og.register_ioport_write(fa, 2, 2, this.data_writew.bind(this));
    Og.register_ioport_read(fa, 2, 2, this.data_readw.bind(this));
    Og.register_ioport_write(fa, 4, 4, this.data_writel.bind(this));
    Og.register_ioport_read(fa, 4, 4, this.data_readl.bind(this));
}
IDE_device_ta_.prototype.ioport_write = function (fa, ga) {
    var s = this.cur_drive;
    var Fh;
    fa &= 7;
    switch (fa) {
        case 0:
            break;
        case 1:
            if (s) {
                s.feature = ga;
            }
            break;
        case 2:
            if (s) {
                s.nsector = ga;
            }
            break;
        case 3:
            if (s) {
                s.sector = ga;
            }
            break;
        case 4:
            if (s) {
                s.lcyl = ga;
            }
            break;
        case 5:
            if (s) {
                s.hcyl = ga;
            }
            break;
        case 6:
            s = this.cur_drive = this.drives[(ga >> 4) & 1];
            if (s) {
                s.select = ga;
            }
            break;
        default:
        case 7:
            if (s) {
                s.exec_cmd(ga);
            }
            break;
    }
};
IDE_device_ta_.prototype.ioport_read = function (fa) {
    var s = this.cur_drive;
    var Qg;
    fa &= 7;
    if (!s) {
        Qg = 0xff;
    } else {
        switch (fa) {
            case 0:
                Qg = 0xff;
                break;
            case 1:
                Qg = s.error;
                break;
            case 2:
                Qg = s.nsector;
                break;
            case 3:
                Qg = s.sector;
                break;
            case 4:
                Qg = s.lcyl;
                break;
            case 5:
                Qg = s.hcyl;
                break;
            case 6:
                Qg = s.select;
                break;
            default:
            case 7:
                Qg = s.status;
                this.set_irq_func(0);
                break;
        }
    }
    return Qg;
};
IDE_device_ta_.prototype.status_read = function (fa) {
    var s = this.cur_drive;
    var Qg;
    if (s) {
        Qg = s.status;
    } else {
        Qg = 0;
    }
    return Qg;
};
IDE_device_ta_.prototype.cmd_write = function (fa, ga) {
    var i, s;
    if (!(this.cmd & 0x04) && (ga & 0x04)) {
        for (i = 0; i < 2; i++) {
            s = this.drives[i];
            if (s) {
                s.status = 0x80 | 0x10;
                s.error = 0x01;
            }
        }
    } else if ((this.cmd & 0x04) && !(ga & 0x04)) {
        for (i = 0; i < 2; i++) {
            s = this.drives[i];
            if (s) {
                s.status = 0x40 | 0x10;
                s.set_signature();
            }
        }
    }
    for (i = 0; i < 2; i++) {
        s = this.drives[i];
        if (s) {
            s.cmd = ga;
        }
    }
};
IDE_device_ta_.prototype.data_writew = function (fa, ga) {
    var s = this.cur_drive;
    var p, xh;
    if (!s)return;
    p = s.data_index;
    xh = s.io_buffer;
    xh[p] = ga & 0xff;
    xh[p + 1] = (ga >> 8) & 0xff;
    p += 2;
    s.data_index = p;
    if (p >= s.data_end)s.end_transfer_func();
};
IDE_device_ta_.prototype.data_readw = function (fa) {
    var s = this.cur_drive;
    var p, Qg, xh;
    if (!s) {
        Qg = 0;
    } else {
        p = s.data_index;
        xh = s.io_buffer;
        Qg = xh[p] | (xh[p + 1] << 8);
        p += 2;
        s.data_index = p;
        if (p >= s.data_end)s.end_transfer_func();
    }
    return Qg;
};
IDE_device_ta_.prototype.data_writel = function (fa, ga) {
    var s = this.cur_drive;
    var p, xh;
    if (!s)return;
    p = s.data_index;
    xh = s.io_buffer;
    xh[p] = ga & 0xff;
    xh[p + 1] = (ga >> 8) & 0xff;
    xh[p + 2] = (ga >> 16) & 0xff;
    xh[p + 3] = (ga >> 24) & 0xff;
    p += 4;
    s.data_index = p;
    if (p >= s.data_end)s.end_transfer_func();
};
IDE_device_ta_.prototype.data_readl = function (fa) {
    var s = this.cur_drive;
    var p, Qg, xh;
    if (!s) {
        Qg = 0;
    } else {
        p = s.data_index;
        xh = s.io_buffer;
        Qg = xh[p] | (xh[p + 1] << 8) | (xh[p + 2] << 16) | (xh[p + 3] << 24);
        p += 4;
        s.data_index = p;
        if (p >= s.data_end)s.end_transfer_func();
    }
    return Qg;
};
