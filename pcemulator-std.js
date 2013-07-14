"use strict";

function Zg(Rf) {
    this.hard_irq = Rf;
}
function di() {
    return this.cycle_count;
}
function PCEmulator(ei) {
    var za, fi, gi, i, p;
    za = new CPU_X86();
    this.cpu = za;
    za.phys_mem_resize(ei.mem_size);
    this.init_ioports();
    this.register_ioport_write(0x80, 1, 1, this.ioport80_write);
    this.pic = new PIC_std(this, 0x20, 0xa0, Zg.bind(za));
    this.pit = new PIT_std(this, this.pic.set_irq.bind(this.pic, 0), di.bind(za));
    this.cmos = new CMOS_std(this);
    this.serial = new SerialPort_std(this, 0x3f8, this.pic.set_irq.bind(this.pic, 4), ei.serial_write);
    this.kbd = new Keyboard_std(this, this.reset.bind(this));
    this.reset_request = 0;
    gi = ["hda", "hdb"];
    fi = new Array();
    for (i = 0; i < gi.length; i++) {
        p = ei[gi[i]];
        fi[i] = null;
        if (p) {
            fi[i] = new BlockReader_std(p.url, p.block_size, p.nb_blocks);
        }
    }
    this.ide0 = new IDE_device_std(this, 0x1f0, 0x3f6, this.pic.set_irq.bind(this.pic, 14), fi);
    if (ei.clipboard_get && ei.clipboard_set) {
        this.jsclipboard = new ClipboardDevice_std(this, 0x3c0, ei.clipboard_get, ei.clipboard_set, ei.get_boot_time);
    }
    za.ld8_port = this.ld8_port.bind(this);
    za.ld16_port = this.ld16_port.bind(this);
    za.ld32_port = this.ld32_port.bind(this);
    za.st8_port = this.st8_port.bind(this);
    za.st16_port = this.st16_port.bind(this);
    za.st32_port = this.st32_port.bind(this);
    za.get_hard_intno = this.pic.get_hard_intno.bind(this.pic);
}
PCEmulator.prototype.load_binary = function (Ig, ka, Jg) {
    return this.cpu.load_binary(Ig, ka, Jg);
};
PCEmulator.prototype.start = function () {
    setTimeout(this.timer_func.bind(this), 10);
};
PCEmulator.prototype.timer_func = function () {
    var Oa, hi, ii, ji, ki, Pg, za;
    Pg = this;
    za = Pg.cpu;
    ii = za.cycle_count + 100000;
    ji = false;
    ki = false;
    li:while (za.cycle_count < ii) {
        Pg.serial.write_tx_fifo();
        Pg.pit.update_irq();
        Oa = za.exec(ii - za.cycle_count);
        if (Oa == 256) {
            if (Pg.reset_request) {
                ji = true;
                break;
            }
        } else if (Oa == 257) {
            ki = true;
            break;
        } else {
            ji = true;
            break;
        }
    }
    if (!ji) {
        if (ki) {
            setTimeout(this.timer_func.bind(this), 10);
        } else {
            setTimeout(this.timer_func.bind(this), 0);
        }
    }
};
PCEmulator.prototype.init_ioports = function () {
    var i, mi, ni;
    this.ioport_readb_table = new Array();
    this.ioport_writeb_table = new Array();
    this.ioport_readw_table = new Array();
    this.ioport_writew_table = new Array();
    this.ioport_readl_table = new Array();
    this.ioport_writel_table = new Array();
    mi = this.default_ioport_readw.bind(this);
    ni = this.default_ioport_writew.bind(this);
    for (i = 0; i < 1024; i++) {
        this.ioport_readb_table[i] = this.default_ioport_readb;
        this.ioport_writeb_table[i] = this.default_ioport_writeb;
        this.ioport_readw_table[i] = mi;
        this.ioport_writew_table[i] = ni;
        this.ioport_readl_table[i] = this.default_ioport_readl;
        this.ioport_writel_table[i] = this.default_ioport_writel;
    }
};
PCEmulator.prototype.default_ioport_readb = function (ag) {
    var ja;
    ja = 0xff;
    return ja;
};
PCEmulator.prototype.default_ioport_readw = function (ag) {
    var ja;
    ja = this.ioport_readb_table[ag](ag);
    ag = (ag + 1) & (1024 - 1);
    ja |= this.ioport_readb_table[ag](ag) << 8;
    return ja;
};
PCEmulator.prototype.default_ioport_readl = function (ag) {
    var ja;
    ja = -1;
    return ja;
};
PCEmulator.prototype.default_ioport_writeb = function (ag, ja) {
};
PCEmulator.prototype.default_ioport_writew = function (ag, ja) {
    this.ioport_writeb_table[ag](ag, ja & 0xff);
    ag = (ag + 1) & (1024 - 1);
    this.ioport_writeb_table[ag](ag, (ja >> 8) & 0xff);
};
PCEmulator.prototype.default_ioport_writel = function (ag, ja) {
};
PCEmulator.prototype.ld8_port = function (ag) {
    var ja;
    ja = this.ioport_readb_table[ag & (1024 - 1)](ag);
    return ja;
};
PCEmulator.prototype.ld16_port = function (ag) {
    var ja;
    ja = this.ioport_readw_table[ag & (1024 - 1)](ag);
    return ja;
};
PCEmulator.prototype.ld32_port = function (ag) {
    var ja;
    ja = this.ioport_readl_table[ag & (1024 - 1)](ag);
    return ja;
};
PCEmulator.prototype.st8_port = function (ag, ja) {
    this.ioport_writeb_table[ag & (1024 - 1)](ag, ja);
};
PCEmulator.prototype.st16_port = function (ag, ja) {
    this.ioport_writew_table[ag & (1024 - 1)](ag, ja);
};
PCEmulator.prototype.st32_port = function (ag, ja) {
    this.ioport_writel_table[ag & (1024 - 1)](ag, ja);
};
PCEmulator.prototype.register_ioport_read = function (start, sg, dc, Dh) {
    var i;
    switch (dc) {
        case 1:
            for (i = start; i < start + sg; i++) {
                this.ioport_readb_table[i] = Dh;
            }
            break;
        case 2:
            for (i = start; i < start + sg; i += 2) {
                this.ioport_readw_table[i] = Dh;
            }
            break;
        case 4:
            for (i = start; i < start + sg; i += 4) {
                this.ioport_readl_table[i] = Dh;
            }
            break;
    }
};
PCEmulator.prototype.register_ioport_write = function (start, sg, dc, Dh) {
    var i;
    switch (dc) {
        case 1:
            for (i = start; i < start + sg; i++) {
                this.ioport_writeb_table[i] = Dh;
            }
            break;
        case 2:
            for (i = start; i < start + sg; i += 2) {
                this.ioport_writew_table[i] = Dh;
            }
            break;
        case 4:
            for (i = start; i < start + sg; i += 4) {
                this.ioport_writel_table[i] = Dh;
            }
            break;
    }
};
PCEmulator.prototype.ioport80_write = function (ia, Lg) {
};
PCEmulator.prototype.reset = function () {
    this.request_request = 1;
};
