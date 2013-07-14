"use strict";

function PIC_sub(Pg, ag) {
    Pg.register_ioport_write(ag, 2, 1, this.ioport_write.bind(this));
    Pg.register_ioport_read(ag, 2, 1, this.ioport_read.bind(this));
    this.reset();
}
PIC_sub.prototype.reset = function () {
    this.last_irr = 0;
    this.irr = 0;
    this.imr = 0;
    this.isr = 0;
    this.priority_add = 0;
    this.irq_base = 0;
    this.read_reg_select = 0;
    this.special_mask = 0;
    this.init_state = 0;
    this.auto_eoi = 0;
    this.rotate_on_autoeoi = 0;
    this.init4 = 0;
    this.elcr = 0;
    this.elcr_mask = 0;
};
PIC_sub.prototype.set_irq1 = function (Tg, Rf) {
    var xc;
    xc = 1 << Tg;
    if (Rf) {
        if ((this.last_irr & xc) == 0) {
            this.irr |= xc;
        }
        this.last_irr |= xc;
    } else {
        this.last_irr &= ~xc;
    }
};
PIC_sub.prototype.get_priority = function (xc) {
    var Ug;
    if (xc == 0) {
        return-1;
    }
    Ug = 7;
    while ((xc & (1 << ((Ug + this.priority_add) & 7))) == 0) {
        Ug--;
    }
    return Ug;
};
PIC_sub.prototype.get_irq = function () {
    var xc, Vg, Ug;
    xc = this.irr & ~this.imr;
    Ug = this.get_priority(xc);
    if (Ug < 0) {
        return-1;
    }
    Vg = this.get_priority(this.isr);
    if (Ug > Vg) {
        return Ug;
    } else {
        return-1;
    }
};
PIC_sub.prototype.intack = function (Tg) {
    if (this.auto_eoi) {
        if (this.rotate_on_auto_eoi) {
            this.priority_add = (Tg + 1) & 7;
        }
    } else {
        this.isr |= (1 << Tg);
    }
    if (!(this.elcr & (1 << Tg))) {
        this.irr &= ~(1 << Tg);
    }
};
PIC_sub.prototype.ioport_write = function (ia, ja) {
    var Ug;
    ia &= 1;
    if (ia == 0) {
        if (ja & 0x10) {
            this.reset();
            this.init_state = 1;
            this.init4 = ja & 1;
            if (ja & 0x02) {
                throw"single mode not supported";
            }
            if (ja & 0x08) {
                throw"level sensitive irq not supported";
            }
        } else if (ja & 0x08) {
            if (ja & 0x02) {
                this.read_reg_select = ja & 1;
            }
            if (ja & 0x40) {
                this.special_mask = (ja >> 5) & 1;
            }
        } else {
            switch (ja) {
                case 0x00:
                case 0x80:
                    this.rotate_on_autoeoi = ja >> 7;
                    break;
                case 0x20:
                case 0xa0:
                    Ug = this.get_priority(this.isr);
                    if (Ug >= 0) {
                        this.isr &= ~(1 << ((Ug + this.priority_add) & 7));
                    }
                    if (ja == 0xa0) {
                        this.priority_add = (this.priority_add + 1) & 7;
                    }
                    break;
                case 0x60:
                case 0x61:
                case 0x62:
                case 0x63:
                case 0x64:
                case 0x65:
                case 0x66:
                case 0x67:
                    Ug = ja & 7;
                    this.isr &= ~(1 << Ug);
                    break;
                case 0xc0:
                case 0xc1:
                case 0xc2:
                case 0xc3:
                case 0xc4:
                case 0xc5:
                case 0xc6:
                case 0xc7:
                    this.priority_add = (ja + 1) & 7;
                    break;
                case 0xe0:
                case 0xe1:
                case 0xe2:
                case 0xe3:
                case 0xe4:
                case 0xe5:
                case 0xe6:
                case 0xe7:
                    Ug = ja & 7;
                    this.isr &= ~(1 << Ug);
                    this.priority_add = (Ug + 1) & 7;
                    break;
            }
        }
    } else {
        switch (this.init_state) {
            case 0:
                this.imr = ja;
                this.update_irq();
                break;
            case 1:
                this.irq_base = ja & 0xf8;
                this.init_state = 2;
                break;
            case 2:
                if (this.init4) {
                    this.init_state = 3;
                } else {
                    this.init_state = 0;
                }
                break;
            case 3:
                this.auto_eoi = (ja >> 1) & 1;
                this.init_state = 0;
                break;
        }
    }
};
PIC_sub.prototype.ioport_read = function (Wg) {
    var ia, Rg;
    ia = Wg & 1;
    if (ia == 0) {
        if (this.read_reg_select) {
            Rg = this.isr;
        } else {
            Rg = this.irr;
        }
    } else {
        Rg = this.imr;
    }
    return Rg;
};
function PIC(Pg, Yg, Wg, Zg) {
    this.pics = [];
    this.pics[0] = new PIC_sub(Pg, Yg);
    this.pics[1] = new PIC_sub(Pg, Wg);
    this.pics[0].elcr_mask = 0xf8;
    this.pics[1].elcr_mask = 0xde;
    this.irq_requested = 0;
    this.cpu_set_irq = Zg;
    this.pics[0].update_irq = this.update_irq.bind(this);
    this.pics[1].update_irq = this.update_irq.bind(this);
}
PIC.prototype.update_irq = function () {
    var ah, Tg;
    ah = this.pics[1].get_irq();
    if (ah >= 0) {
        this.pics[0].set_irq1(2, 1);
        this.pics[0].set_irq1(2, 0);
    }
    Tg = this.pics[0].get_irq();
    if (Tg >= 0) {
        this.cpu_set_irq(1);
    } else {
        this.cpu_set_irq(0);
    }
};
PIC.prototype.set_irq = function (Tg, Rf) {
    this.pics[Tg >> 3].set_irq1(Tg & 7, Rf);
    this.update_irq();
};
PIC.prototype.get_hard_intno = function () {
    var Tg, ah, intno;
    Tg = this.pics[0].get_irq();
    if (Tg >= 0) {
        this.pics[0].intack(Tg);
        if (Tg == 2) {
            ah = this.pics[1].get_irq();
            if (ah >= 0) {
                this.pics[1].intack(ah);
            } else {
                ah = 7;
            }
            intno = this.pics[1].irq_base + ah;
            Tg = ah + 8;
        } else {
            intno = this.pics[0].irq_base + Tg;
        }
    } else {
        Tg = 7;
        intno = this.pics[0].irq_base + Tg;
    }
    this.update_irq();
    return intno;
};
