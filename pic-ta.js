function PIC_sub_ta_(Og, Zf) {
    Og.register_ioport_write(Zf, 2, 1, this.ioport_write.bind(this));
    Og.register_ioport_read(Zf, 2, 1, this.ioport_read.bind(this));
    this.reset();
}
PIC_sub_ta_.prototype.reset = function () {
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
PIC_sub_ta_.prototype.set_irq1 = function (Sg, Qf) {
    var wc;
    wc = 1 << Sg;
    if (Qf) {
        if ((this.last_irr & wc) == 0)this.irr |= wc;
        this.last_irr |= wc;
    } else {
        this.last_irr &= ~wc;
    }
};
PIC_sub_ta_.prototype.get_priority = function (wc) {
    var Tg;
    if (wc == 0)return-1;
    Tg = 7;
    while ((wc & (1 << ((Tg + this.priority_add) & 7))) == 0)Tg--;
    return Tg;
};
PIC_sub_ta_.prototype.get_irq = function () {
    var wc, Ug, Tg;
    wc = this.irr & ~this.imr;
    Tg = this.get_priority(wc);
    if (Tg < 0)return-1;
    Ug = this.get_priority(this.isr);
    if (Tg > Ug) {
        return Tg;
    } else {
        return-1;
    }
};
PIC_sub_ta_.prototype.intack = function (Sg) {
    if (this.auto_eoi) {
        if (this.rotate_on_auto_eoi)this.priority_add = (Sg + 1) & 7;
    } else {
        this.isr |= (1 << Sg);
    }
    if (!(this.elcr & (1 << Sg)))this.irr &= ~(1 << Sg);
};
PIC_sub_ta_.prototype.ioport_write = function (fa, ga) {
    var Tg;
    fa &= 1;
    if (fa == 0) {
        if (ga & 0x10) {
            this.reset();
            this.init_state = 1;
            this.init4 = ga & 1;
            if (ga & 0x02)throw"single mode not supported";
            if (ga & 0x08)throw"level sensitive irq not supported";
        } else if (ga & 0x08) {
            if (ga & 0x02)this.read_reg_select = ga & 1;
            if (ga & 0x40)this.special_mask = (ga >> 5) & 1;
        } else {
            switch (ga) {
                case 0x00:
                case 0x80:
                    this.rotate_on_autoeoi = ga >> 7;
                    break;
                case 0x20:
                case 0xa0:
                    Tg = this.get_priority(this.isr);
                    if (Tg >= 0) {
                        this.isr &= ~(1 << ((Tg + this.priority_add) & 7));
                    }
                    if (ga == 0xa0)this.priority_add = (this.priority_add + 1) & 7;
                    break;
                case 0x60:
                case 0x61:
                case 0x62:
                case 0x63:
                case 0x64:
                case 0x65:
                case 0x66:
                case 0x67:
                    Tg = ga & 7;
                    this.isr &= ~(1 << Tg);
                    break;
                case 0xc0:
                case 0xc1:
                case 0xc2:
                case 0xc3:
                case 0xc4:
                case 0xc5:
                case 0xc6:
                case 0xc7:
                    this.priority_add = (ga + 1) & 7;
                    break;
                case 0xe0:
                case 0xe1:
                case 0xe2:
                case 0xe3:
                case 0xe4:
                case 0xe5:
                case 0xe6:
                case 0xe7:
                    Tg = ga & 7;
                    this.isr &= ~(1 << Tg);
                    this.priority_add = (Tg + 1) & 7;
                    break;
            }
        }
    } else {
        switch (this.init_state) {
            case 0:
                this.imr = ga;
                this.update_irq();
                break;
            case 1:
                this.irq_base = ga & 0xf8;
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
                this.auto_eoi = (ga >> 1) & 1;
                this.init_state = 0;
                break;
        }
    }
};
PIC_sub_ta_.prototype.ioport_read = function (Vg) {
    var fa, Qg;
    fa = Vg & 1;
    if (fa == 0) {
        if (this.read_reg_select)Qg = this.isr; else Qg = this.irr;
    } else {
        Qg = this.imr;
    }
    return Qg;
};
function PIC_ta_(Og, Xg, Vg, Yg) {
    this.pics = new Array();
    this.pics[0] = new PIC_sub_ta_(Og, Xg);
    this.pics[1] = new PIC_sub_ta_(Og, Vg);
    this.pics[0].elcr_mask = 0xf8;
    this.pics[1].elcr_mask = 0xde;
    this.irq_requested = 0;
    this.cpu_set_irq = Yg;
    this.pics[0].update_irq = this.update_irq.bind(this);
    this.pics[1].update_irq = this.update_irq.bind(this);
}
PIC_ta_.prototype.update_irq = function () {
    var Zg, Sg;
    Zg = this.pics[1].get_irq();
    if (Zg >= 0) {
        this.pics[0].set_irq1(2, 1);
        this.pics[0].set_irq1(2, 0);
    }
    Sg = this.pics[0].get_irq();
    if (Sg >= 0) {
        this.cpu_set_irq(1);
    } else {
        this.cpu_set_irq(0);
    }
};
PIC_ta_.prototype.set_irq = function (Sg, Qf) {
    this.pics[Sg >> 3].set_irq1(Sg & 7, Qf);
    this.update_irq();
};
PIC_ta_.prototype.get_hard_intno = function () {
    var Sg, Zg, intno;
    Sg = this.pics[0].get_irq();
    if (Sg >= 0) {
        this.pics[0].intack(Sg);
        if (Sg == 2) {
            Zg = this.pics[1].get_irq();
            if (Zg >= 0) {
                this.pics[1].intack(Zg);
            } else {
                Zg = 7;
            }
            intno = this.pics[1].irq_base + Zg;
            Sg = Zg + 8;
        } else {
            intno = this.pics[0].irq_base + Sg;
        }
    } else {
        Sg = 7;
        intno = this.pics[0].irq_base + Sg;
    }
    this.update_irq();
    return intno;
};
