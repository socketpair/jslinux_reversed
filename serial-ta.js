function SerialPort_ta_(Og, fa, lh, mh) {
    this.divider = 0;
    this.rbr = 0;
    this.ier = 0;
    this.iir = 0x01;
    this.lcr = 0;
    this.mcr;
    this.lsr = 0x40 | 0x20;
    this.msr = 0;
    this.scr = 0;
    this.fcr = 0;
    this.set_irq_func = lh;
    this.write_func = mh;
    this.tx_fifo = "";
    this.rx_fifo = "";
    Og.register_ioport_write(0x3f8, 8, 1, this.ioport_write.bind(this));
    Og.register_ioport_read(0x3f8, 8, 1, this.ioport_read.bind(this));
}
SerialPort_ta_.prototype.update_irq = function () {
    if ((this.lsr & 0x01) && (this.ier & 0x01)) {
        this.iir = 0x04;
    } else if ((this.lsr & 0x20) && (this.ier & 0x02)) {
        this.iir = 0x02;
    } else {
        this.iir = 0x01;
    }
    if (this.iir != 0x01) {
        this.set_irq_func(1);
    } else {
        this.set_irq_func(0);
    }
};
SerialPort_ta_.prototype.write_tx_fifo = function () {
    if (this.tx_fifo != "") {
        this.write_func(this.tx_fifo);
        this.tx_fifo = "";
        this.lsr |= 0x20;
        this.lsr |= 0x40;
        this.update_irq();
    }
};
SerialPort_ta_.prototype.ioport_write = function (fa, ga) {
    fa &= 7;
    switch (fa) {
        default:
        case 0:
            if (this.lcr & 0x80) {
                this.divider = (this.divider & 0xff00) | ga;
            } else {
                if (this.fcr & 0x01) {
                    this.tx_fifo += String.fromCharCode(ga);
                    this.lsr &= ~0x20;
                    this.update_irq();
                    if (this.tx_fifo.length >= 16) {
                        this.write_tx_fifo();
                    }
                } else {
                    this.lsr &= ~0x20;
                    this.update_irq();
                    this.write_func(String.fromCharCode(ga));
                    this.lsr |= 0x20;
                    this.lsr |= 0x40;
                    this.update_irq();
                }
            }
            break;
        case 1:
            if (this.lcr & 0x80) {
                this.divider = (this.divider & 0x00ff) | (ga << 8);
            } else {
                this.ier = ga;
                this.update_irq();
            }
            break;
        case 2:
            if ((this.fcr ^ ga) & 0x01) {
                ga |= 0x04 | 0x02;
            }
            if (ga & 0x04)this.tx_fifo = "";
            if (ga & 0x02)this.rx_fifo = "";
            this.fcr = ga & 0x01;
            break;
        case 3:
            this.lcr = ga;
            break;
        case 4:
            this.mcr = ga;
            break;
        case 5:
            break;
        case 6:
            this.msr = ga;
            break;
        case 7:
            this.scr = ga;
            break;
    }
};
SerialPort_ta_.prototype.ioport_read = function (fa) {
    var Qg;
    fa &= 7;
    switch (fa) {
        default:
        case 0:
            if (this.lcr & 0x80) {
                Qg = this.divider & 0xff;
            } else {
                Qg = this.rbr;
                this.lsr &= ~(0x01 | 0x10);
                this.update_irq();
                this.send_char_from_fifo();
            }
            break;
        case 1:
            if (this.lcr & 0x80) {
                Qg = (this.divider >> 8) & 0xff;
            } else {
                Qg = this.ier;
            }
            break;
        case 2:
            Qg = this.iir;
            if (this.fcr & 0x01)Qg |= 0xC0;
            break;
        case 3:
            Qg = this.lcr;
            break;
        case 4:
            Qg = this.mcr;
            break;
        case 5:
            Qg = this.lsr;
            break;
        case 6:
            Qg = this.msr;
            break;
        case 7:
            Qg = this.scr;
            break;
    }
    return Qg;
};
SerialPort_ta_.prototype.send_break = function () {
    this.rbr = 0;
    this.lsr |= 0x10 | 0x01;
    this.update_irq();
};
SerialPort_ta_.prototype.send_char = function (nh) {
    this.rbr = nh;
    this.lsr |= 0x01;
    this.update_irq();
};
SerialPort_ta_.prototype.send_char_from_fifo = function () {
    var oh;
    oh = this.rx_fifo;
    if (oh != "" && !(this.lsr & 0x01)) {
        this.send_char(oh.charCodeAt(0));
        this.rx_fifo = oh.substr(1, oh.length - 1);
    }
};
SerialPort_ta_.prototype.send_chars = function (na) {
    this.rx_fifo += na;
    this.send_char_from_fifo();
};
