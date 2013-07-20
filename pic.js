"use strict";

function PIC_sub(pc_emulator, io_port) {
    pc_emulator.register_ioport_write(io_port, 2, 1, this.ioport_write.bind(this));
    pc_emulator.register_ioport_read(io_port, 2, 1, this.ioport_read.bind(this));
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
    var xc, priority2, priority1;
    xc = this.irr & ~this.imr;
    priority1 = this.get_priority(xc);
    if (priority1 < 0) {
        return -1;
    }
    priority2 = this.get_priority(this.isr);
    if (priority1 > priority2) {
        return priority1;
    } else {
        return -1;
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
PIC_sub.prototype.ioport_write = function (io_port, byte_value) {
    var Ug;
    io_port &= 1;
    if (io_port == 0) {
        if (byte_value & 0x10) {
            this.reset();
            this.init_state = 1;
            this.init4 = byte_value & 1;
            if (byte_value & 0x02) {
                throw "single mode not supported";
            }
            if (byte_value & 0x08) {
                throw "level sensitive irq not supported";
            }
        } else if (byte_value & 0x08) {
            if (byte_value & 0x02) {
                this.read_reg_select = byte_value & 1;
            }
            if (byte_value & 0x40) {
                this.special_mask = (byte_value >> 5) & 1;
            }
        } else {
            switch (byte_value) {
                case 0x00:
                case 0x80:
                    this.rotate_on_autoeoi = byte_value >> 7;
                    break;
                case 0x20:
                case 0xa0:
                    Ug = this.get_priority(this.isr);
                    if (Ug >= 0) {
                        this.isr &= ~(1 << ((Ug + this.priority_add) & 7));
                    }
                    if (byte_value == 0xa0) {
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
                    Ug = byte_value & 7;
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
                    this.priority_add = (byte_value + 1) & 7;
                    break;
                case 0xe0:
                case 0xe1:
                case 0xe2:
                case 0xe3:
                case 0xe4:
                case 0xe5:
                case 0xe6:
                case 0xe7:
                    Ug = byte_value & 7;
                    this.isr &= ~(1 << Ug);
                    this.priority_add = (Ug + 1) & 7;
                    break;
            }
        }
    } else {
        switch (this.init_state) {
            case 0:
                this.imr = byte_value;
                this.update_irq();
                break;
            case 1:
                this.irq_base = byte_value & 0xf8;
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
                this.auto_eoi = (byte_value >> 1) & 1;
                this.init_state = 0;
                break;
        }
    }
};
PIC_sub.prototype.ioport_read = function (io_port) {
    var ia, retval;
    ia = io_port & 1;
    if (ia == 0) {
        if (this.read_reg_select) {
            retval = this.isr;
        } else {
            retval = this.irr;
        }
    } else {
        retval = this.imr;
    }
    return retval;
};
function PIC(pc_emulator, pic1_port, pic2_port, cpu_set_irq) {
    this.pics = [];
    this.pics[0] = new PIC_sub(pc_emulator, pic1_port);
    this.pics[1] = new PIC_sub(pc_emulator, pic2_port);
    this.pics[0].elcr_mask = 0xf8;
    this.pics[1].elcr_mask = 0xde;
    this.irq_requested = 0;
    this.cpu_set_irq = cpu_set_irq;
    this.pics[0].update_irq = this.update_irq.bind(this);
    this.pics[1].update_irq = this.update_irq.bind(this);
}
PIC.prototype.update_irq = function () {
    var priority1, priority2;

    priority1 = this.pics[1].get_irq();
    if (priority1 >= 0) {
        this.pics[0].set_irq1(2, 1);
        this.pics[0].set_irq1(2, 0);
    }

    priority2 = this.pics[0].get_irq();
    if (priority2 >= 0) {
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
    var priority1, priority2, intno;
    priority1 = this.pics[0].get_irq();
    if (priority1 >= 0) {
        this.pics[0].intack(priority1);
        if (priority1 == 2) {
            priority2 = this.pics[1].get_irq();
            if (priority2 >= 0) {
                this.pics[1].intack(priority2);
            } else {
                priority2 = 7;
            }
            intno = this.pics[1].irq_base + priority2;
            priority1 = priority2 + 8;
        } else {
            intno = this.pics[0].irq_base + priority1;
        }
    } else {
        priority1 = 7;
        intno = this.pics[0].irq_base + priority1;
    }
    this.update_irq();
    return intno;
};

self.PIC = PIC;
