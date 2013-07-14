"use strict";

// TODO: http://www.lammertbies.nl/comm/info/serial-uart.html

function SerialPort(pc_emulator, address, set_irq_func, emulname) {
    this.divider = 0;
    this.rbr = 0;
    this.ier = 0;
    this.iir = 0x01;

    // DLAB=0
    this.lcr = 0;

    this.mcr = 0;

    // Line status register
    // '0b1100000'
    /*
     0	Data available = 1
     1	Overrun error = 2
     2	Parity error = 4
     3	Framing error = 8
     4	Break signal received = 0x10
     5	THR is empty = 0x20
     6	THR is empty, and line is idle = 0x40
     7	Errornous data in FIFO = 0x80
     */
    // "THR is empty" and  "THR is empty, and line is idle"
    this.lsr = 0x40 | 0x20;
    this.name = emulname;

    /*
     0	change in Clear to send
     1	change in Data set ready
     2	trailing edge Ring indicator
     3	change in Carrier detect
     4	Clear to send = 0x10
     5	Data set ready = 0x20
     6	Ring indicator = 0x40
     7	Carrier detect = 0x80
     */
    // set Carrier-detect
    this.msr = 0x80 | 0x10;

    this.scr = 0;
    this.fcr = 0;
    this.set_irq_func = set_irq_func;
    this.write_func = function() {}; // TODO: STUB
    this.tx_fifo = ""; // guest -> wire
    this.rx_fifo = ""; // wire -> guest
    this.baseaddr = address;
    pc_emulator.register_ioport_write(address, 8, 1, this.ioport_write.bind(this));
    pc_emulator.register_ioport_read(address, 8, 1, this.ioport_read.bind(this));
}

SerialPort.prototype.debug = function() {
    if (this.baseaddr != 0x2f8)
        return;
    console.log(this.name, arguments);
};

SerialPort.prototype.update_irq = function () {
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
SerialPort.prototype.write_tx_fifo = function () {
    if (this.tx_fifo != "") {
        this.write_func(this.tx_fifo);
        this.tx_fifo = "";
        this.lsr |= 0x20;
        this.lsr |= 0x40;
        this.update_irq();
    }
};
SerialPort.prototype.ioport_write = function (address, byte_value) {
    var DLAB = 0x80;

    switch (address & 7) {
        //default:
        case 0:
            if (this.lcr & DLAB) {
                // DLL divisor latch LSB
                this.divider = (this.divider & 0xff00) | byte_value;
                break;
            }

            //write ti BASE+0, DLAB=0
            // THR transmitter holding
            if (this.fcr & 0x01) {
                // if FIFO enabled
                this.tx_fifo += String.fromCharCode(byte_value);
                this.lsr &= ~0x20;
                this.update_irq();
                if (this.tx_fifo.length >= 16) {
                    this.write_tx_fifo();
                }
            } else {
                // if FIFO disabled
                this.lsr &= ~0x20;
                this.update_irq();
                this.write_func(String.fromCharCode(byte_value));
                this.lsr |= 0x20;
                this.lsr |= 0x40;
                this.update_irq();
            }

            break;
        case 1:
            if (this.lcr & DLAB) {
                // DLM divisor latch MSB
                this.divider = (this.divider & 0x00ff) | (byte_value << 8);
                break;
            }

            // IER interrupt enable
            this.ier = byte_value;
            this.update_irq();
            break;
        case 2:
            // FCR FIFO control
            if ((this.fcr ^ byte_value) & 0x01) {
                // if fifo state changed, set "Clear receive FIFO" and "Clear transmit FIFO" also.
                byte_value |= 0x04 | 0x02;
            }
            if (byte_value & 0x04) {
                this.tx_fifo = "";
            }
            if (byte_value & 0x02) {
                this.rx_fifo = "";
            }
            this.fcr = byte_value & 0x01;
            break;
        case 3:
            // LCR line control
            this.lcr = byte_value;
            break;
        case 4:
            // MCR modem control
            this.mcr = byte_value;
            break;
        case 5:
            this.debug('Factory UART test is not implemented');
            break;
        case 6:
            this.debug('Unknown UART write operation BASE+6');
            break;
        case 7:
            // SCR scratch
            this.scr = byte_value;
            break;
    }
};
SerialPort.prototype.ioport_read = function (port_offset) {
    var returned_byte_value, DLAB = 0x80;
    port_offset &= 7;
    switch (port_offset) {
        //default:
        case 0:
            if (this.lcr & DLAB) {
                returned_byte_value = this.divider & 0xff;
            } else {
                returned_byte_value = this.rbr;
                this.lsr &= ~(0x01 | 0x10);
                this.update_irq();
                this.send_char_from_fifo();
            }
            break;
        case 1:
            if (this.lcr & DLAB) {
                // DLM divisor latch MSB
                returned_byte_value = (this.divider >> 8) & 0xff;
            } else {
                // IER interrupt enable
                returned_byte_value = this.ier;
            }
            break;
        case 2:
            // IIR interrupt identification
            returned_byte_value = this.iir;
            if (this.fcr & 0x01) {
                // if FIFO enabled, mark in iir that FIFO enabled
                returned_byte_value |= 0xc0;
            }
            break;
        case 3:
            returned_byte_value = this.lcr;
            break;
        case 4:
            returned_byte_value = this.mcr;
            break;
        case 5:
            returned_byte_value = this.lsr;
            break;
        case 6:
            returned_byte_value = this.msr;
            break;
        case 7:
            returned_byte_value = this.scr;
            break;
    }
    return returned_byte_value;
};
SerialPort.prototype.send_break = function () {
    this.rbr = 0;
    this.lsr |= 0x10 | 0x01;
    this.update_irq();
};
SerialPort.prototype.send_char = function (byte_value) {
    this.rbr = byte_value;
    this.lsr |= 0x01;
    this.update_irq();
};
SerialPort.prototype.send_char_from_fifo = function () {
    var rx_fifo = this.rx_fifo;

    if (rx_fifo != "" && !(this.lsr & 0x01)) {
        this.send_char(rx_fifo.charCodeAt(0));
        this.rx_fifo = rx_fifo.substr(1, rx_fifo.length - 1);
    }
};
SerialPort.prototype.send_chars = function (str) {
    this.rx_fifo += str;
    this.send_char_from_fifo();
};
