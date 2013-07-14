function SerialPort_std(Pg, ia, mh, nh) {
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
    this.set_irq_func = mh;
    this.write_func = nh;
    this.tx_fifo = "";
    this.rx_fifo = "";
    Pg.register_ioport_write(0x3f8, 8, 1, this.ioport_write.bind(this));
    Pg.register_ioport_read(0x3f8, 8, 1, this.ioport_read.bind(this));
}
SerialPort_std.prototype.update_irq = function () {
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
SerialPort_std.prototype.write_tx_fifo = function () {
    if (this.tx_fifo != "") {
        this.write_func(this.tx_fifo);
        this.tx_fifo = "";
        this.lsr |= 0x20;
        this.lsr |= 0x40;
        this.update_irq();
    }
};
SerialPort_std.prototype.ioport_write = function (ia, ja) {
    ia &= 7;
    switch (ia) {
        default:
        case 0:
            if (this.lcr & 0x80) {
                this.divider = (this.divider & 0xff00) | ja;
            } else {
                if (this.fcr & 0x01) {
                    this.tx_fifo += String.fromCharCode(ja);
                    this.lsr &= ~0x20;
                    this.update_irq();
                    if (this.tx_fifo.length >= 16) {
                        this.write_tx_fifo();
                    }
                } else {
                    this.lsr &= ~0x20;
                    this.update_irq();
                    this.write_func(String.fromCharCode(ja));
                    this.lsr |= 0x20;
                    this.lsr |= 0x40;
                    this.update_irq();
                }
            }
            break;
        case 1:
            if (this.lcr & 0x80) {
                this.divider = (this.divider & 0x00ff) | (ja << 8);
            } else {
                this.ier = ja;
                this.update_irq();
            }
            break;
        case 2:
            if ((this.fcr ^ ja) & 0x01) {
                ja |= 0x04 | 0x02;
            }
            if (ja & 0x04)this.tx_fifo = "";
            if (ja & 0x02)this.rx_fifo = "";
            this.fcr = ja & 0x01;
            break;
        case 3:
            this.lcr = ja;
            break;
        case 4:
            this.mcr = ja;
            break;
        case 5:
            break;
        case 6:
            this.msr = ja;
            break;
        case 7:
            this.scr = ja;
            break;
    }
};
SerialPort_std.prototype.ioport_read = function (ia) {
    var Rg;
    ia &= 7;
    switch (ia) {
        default:
        case 0:
            if (this.lcr & 0x80) {
                Rg = this.divider & 0xff;
            } else {
                Rg = this.rbr;
                this.lsr &= ~(0x01 | 0x10);
                this.update_irq();
                this.send_char_from_fifo();
            }
            break;
        case 1:
            if (this.lcr & 0x80) {
                Rg = (this.divider >> 8) & 0xff;
            } else {
                Rg = this.ier;
            }
            break;
        case 2:
            Rg = this.iir;
            if (this.fcr & 0x01)Rg |= 0xC0;
            break;
        case 3:
            Rg = this.lcr;
            break;
        case 4:
            Rg = this.mcr;
            break;
        case 5:
            Rg = this.lsr;
            break;
        case 6:
            Rg = this.msr;
            break;
        case 7:
            Rg = this.scr;
            break;
    }
    return Rg;
};
SerialPort_std.prototype.send_break = function () {
    this.rbr = 0;
    this.lsr |= 0x10 | 0x01;
    this.update_irq();
};
SerialPort_std.prototype.send_char = function (oh) {
    this.rbr = oh;
    this.lsr |= 0x01;
    this.update_irq();
};
SerialPort_std.prototype.send_char_from_fifo = function () {
    var ph;
    ph = this.rx_fifo;
    if (ph != "" && !(this.lsr & 0x01)) {
        this.send_char(ph.charCodeAt(0));
        this.rx_fifo = ph.substr(1, ph.length - 1);
    }
};
SerialPort_std.prototype.send_chars = function (qa) {
    this.rx_fifo += qa;
    this.send_char_from_fifo();
};
