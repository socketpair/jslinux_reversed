"use strict";

function Yg(Qf) {
    this.hard_irq = Qf;
}
function di() {
    return this.cycle_count;
}
function PCEmulator(ei) {
    var wa, fi, gi, i, p;
    wa = new CPU_X86();
    this.cpu = wa;
    wa.phys_mem_resize(ei.mem_size);
    this.init_ioports();
    this.register_ioport_write(0x80, 1, 1, this.ioport80_write);
    this.pic = new PIC_ta_(this, 0x20, 0xa0, Yg.bind(wa));
    this.pit = new PIT_ta_(this, this.pic.set_irq.bind(this.pic, 0), di.bind(wa));
    this.cmos = new CMOS_ta_(this);
    this.serial = new SerialPort_ta_(this, 0x3f8, this.pic.set_irq.bind(this.pic, 4), ei.serial_write);
    this.kbd = new Keyboard_ta_(this, this.reset.bind(this));
    this.reset_request = 0;
    gi = ["hda", "hdb"];
    fi = new Array();
    for (i = 0; i < gi.length; i++) {
        p = ei[gi[i]];
        fi[i] = null;
        if (p) {
            fi[i] = new BlockReader_ta_(p.url, p.block_size, p.nb_blocks);
        }
    }
    this.ide0 = new IDE_device_ta_(this, 0x1f0, 0x3f6, this.pic.set_irq.bind(this.pic, 14), fi);
    if (ei.clipboard_get && ei.clipboard_set) {
        this.jsclipboard = new ClipboardDevice_ta_(this, 0x3c0, ei.clipboard_get, ei.clipboard_set, ei.get_boot_time);
    }
    wa.ld8_port = this.ld8_port.bind(this);
    wa.ld16_port = this.ld16_port.bind(this);
    wa.ld32_port = this.ld32_port.bind(this);
    wa.st8_port = this.st8_port.bind(this);
    wa.st16_port = this.st16_port.bind(this);
    wa.st32_port = this.st32_port.bind(this);
    wa.get_hard_intno = this.pic.get_hard_intno.bind(this.pic);
}
PCEmulator.prototype.load_binary = function (Hg, ha, Ig) {
    return this.cpu.load_binary(Hg, ha, Ig);
};
PCEmulator.prototype.start = function () {
    setTimeout(this.timer_func.bind(this), 10);
};
PCEmulator.prototype.timer_func = function () {
    var La, hi, ii, ji, ki, Og, wa;
    Og = this;
    wa = Og.cpu;
    ii = wa.cycle_count + 100000;
    ji = false;
    ki = false;
    li:while (wa.cycle_count < ii) {
        Og.serial.write_tx_fifo();
        Og.pit.update_irq();
        La = wa.exec(ii - wa.cycle_count);
        if (La == 256) {
            if (Og.reset_request) {
                ji = true;
                break;
            }
        } else if (La == 257) {
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
PCEmulator.prototype.default_ioport_readb = function (Zf) {
    var ga;
    ga = 0xff;
    return ga;
};
PCEmulator.prototype.default_ioport_readw = function (Zf) {
    var ga;
    ga = this.ioport_readb_table[Zf](Zf);
    Zf = (Zf + 1) & (1024 - 1);
    ga |= this.ioport_readb_table[Zf](Zf) << 8;
    return ga;
};
PCEmulator.prototype.default_ioport_readl = function (Zf) {
    var ga;
    ga = -1;
    return ga;
};
PCEmulator.prototype.default_ioport_writeb = function (Zf, ga) {
};
PCEmulator.prototype.default_ioport_writew = function (Zf, ga) {
    this.ioport_writeb_table[Zf](Zf, ga & 0xff);
    Zf = (Zf + 1) & (1024 - 1);
    this.ioport_writeb_table[Zf](Zf, (ga >> 8) & 0xff);
};
PCEmulator.prototype.default_ioport_writel = function (Zf, ga) {
};
PCEmulator.prototype.ld8_port = function (Zf) {
    var ga;
    ga = this.ioport_readb_table[Zf & (1024 - 1)](Zf);
    return ga;
};
PCEmulator.prototype.ld16_port = function (Zf) {
    var ga;
    ga = this.ioport_readw_table[Zf & (1024 - 1)](Zf);
    return ga;
};
PCEmulator.prototype.ld32_port = function (Zf) {
    var ga;
    ga = this.ioport_readl_table[Zf & (1024 - 1)](Zf);
    return ga;
};
PCEmulator.prototype.st8_port = function (Zf, ga) {
    this.ioport_writeb_table[Zf & (1024 - 1)](Zf, ga);
};
PCEmulator.prototype.st16_port = function (Zf, ga) {
    this.ioport_writew_table[Zf & (1024 - 1)](Zf, ga);
};
PCEmulator.prototype.st32_port = function (Zf, ga) {
    this.ioport_writel_table[Zf & (1024 - 1)](Zf, ga);
};
PCEmulator.prototype.register_ioport_read = function (start, rg, cc, Dh) {
    var i;
    switch (cc) {
        case 1:
            for (i = start; i < start + rg; i++) {
                this.ioport_readb_table[i] = Dh;
            }
            break;
        case 2:
            for (i = start; i < start + rg; i += 2) {
                this.ioport_readw_table[i] = Dh;
            }
            break;
        case 4:
            for (i = start; i < start + rg; i += 4) {
                this.ioport_readl_table[i] = Dh;
            }
            break;
    }
};
PCEmulator.prototype.register_ioport_write = function (start, rg, cc, Dh) {
    var i;
    switch (cc) {
        case 1:
            for (i = start; i < start + rg; i++) {
                this.ioport_writeb_table[i] = Dh;
            }
            break;
        case 2:
            for (i = start; i < start + rg; i += 2) {
                this.ioport_writew_table[i] = Dh;
            }
            break;
        case 4:
            for (i = start; i < start + rg; i += 4) {
                this.ioport_writel_table[i] = Dh;
            }
            break;
    }
};
PCEmulator.prototype.ioport80_write = function (fa, Kg) {
};
PCEmulator.prototype.reset = function () {
    this.request_request = 1;
};
