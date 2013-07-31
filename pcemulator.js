"use strict";

function cpu_set_irq(state) {
    this.hard_irq = state;
}
function get_ticks() {
    return this.cycle_count;
}
function PCEmulator(parameters) {
    var cpu, block_readers, hdd_names, i, p;
    cpu = new CPU_X86();
    this.cpu = cpu;
    cpu.phys_mem_resize(parameters.mem_size);
    this.init_ioports();
    this.register_ioport_write(0x80, 1, 1, this.ioport80_write);
    this.pic = new PIC(this, 0x20, 0xa0, cpu_set_irq.bind(cpu));
    this.pit = new PIT(this, this.pic.set_irq.bind(this.pic, 0), get_ticks.bind(cpu));
    this.cmos = new CMOS(this);
    /*
     * Most PC-compatible systems in the 1980s and 1990s had one or two ports, with communication interfaces defined like this:
     COM1: I/O port 0x3F8, IRQ 4
     COM2: I/O port 0x2F8, IRQ 3
     COM3: I/O port 0x3E8, IRQ 4
     COM4: I/O port 0x2E8, IRQ 3
     * */
    this.com1 = new SerialPort(this, 0x3f8, this.pic.set_irq.bind(this.pic, 4), parameters.emulname);
    this.com2 = new SerialPort(this, 0x2f8, this.pic.set_irq.bind(this.pic, 3), parameters.emulname);

    this.kbd = new Keyboard(this, this.reset.bind(this));
    this.reset_request = 0;
    hdd_names = ["hda", "hdb"];
    block_readers = [];
    for (i = 0; i < hdd_names.length; i++) {
        p = parameters[hdd_names[i]];
        block_readers[i] = null;
        if (p) {
            block_readers[i] = new BlockReader(p.url, p.block_size, p.nb_blocks, cpu.malloc);
        }
    }
    this.ide0 = new IDE_device(this, 0x1f0, 0x3f6, this.pic.set_irq.bind(this.pic, 14), block_readers, cpu.malloc);
    if (parameters.clipboard_get && parameters.clipboard_set) {
        this.jsclipboard = new ClipboardDevice(this, 0x3c0, parameters.clipboard_get, parameters.clipboard_set, parameters.get_boot_time);
    }
    cpu.ld8_port = this.ld8_port.bind(this);
    cpu.ld16_port = this.ld16_port.bind(this);
    cpu.ld32_port = this.ld32_port.bind(this);
    cpu.st8_port = this.st8_port.bind(this);
    cpu.st16_port = this.st16_port.bind(this);
    cpu.st32_port = this.st32_port.bind(this);
    cpu.get_hard_intno = this.pic.get_hard_intno.bind(this.pic);
}
PCEmulator.prototype.load_binary = function (url, address, callback) {
    return this.cpu.load_binary(url, address, callback);
};
PCEmulator.prototype.start = function () {
    setTimeout(this.timer_func.bind(this), 10);
};
PCEmulator.prototype.timer_func = function () {
    var Oa, ii, ji, ki, this_, cpu;
    this_ = this;
    cpu = this_.cpu;
    ii = cpu.cycle_count + 100000;
    ji = false;
    ki = false;
    while (cpu.cycle_count < ii) {
        this_.com1.write_tx_fifo();
        this_.com2.write_tx_fifo();
        this_.pit.update_irq();
        Oa = cpu.exec(ii - cpu.cycle_count);
        if (Oa == 256) {
            if (this_.reset_request) {
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
    this.ioport_readb_table = [];
    this.ioport_writeb_table = [];
    this.ioport_readw_table = [];
    this.ioport_writew_table = [];
    this.ioport_readl_table = [];
    this.ioport_writel_table = [];
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
PCEmulator.prototype.default_ioport_readb = function (io_port) {
    return 0xff;
};
PCEmulator.prototype.default_ioport_readw = function (io_port) {
    var retval_word;
    retval_word = this.ioport_readb_table[io_port](io_port);

    io_port = (io_port + 1) & (1024 - 1);

    retval_word |= this.ioport_readb_table[io_port](io_port) << 8;

    return retval_word;
};
PCEmulator.prototype.default_ioport_readl = function (io_port) {
    return -1;
};
PCEmulator.prototype.default_ioport_writeb = function (io_port, byte_value) {
};
PCEmulator.prototype.default_ioport_writew = function (io_port, word_value) {
    this.ioport_writeb_table[io_port](io_port, word_value & 0xff);
    io_port = (io_port + 1) & (1024 - 1);
    this.ioport_writeb_table[io_port](io_port, (word_value >> 8) & 0xff);
};
PCEmulator.prototype.default_ioport_writel = function (io_port, dwrod_value) {
};

PCEmulator.prototype.ld8_port = function (io_port) {
    var ja;
    ja = this.ioport_readb_table[io_port & (1024 - 1)](io_port);
    return ja;
};
PCEmulator.prototype.ld16_port = function (io_port) {
    var ja;
    ja = this.ioport_readw_table[io_port & (1024 - 1)](io_port);
    return ja;
};
PCEmulator.prototype.ld32_port = function (io_port) {
    var ja;
    ja = this.ioport_readl_table[io_port & (1024 - 1)](io_port);
    return ja;
};
PCEmulator.prototype.st8_port = function (io_port, byte_value) {
    this.ioport_writeb_table[io_port & (1024 - 1)](io_port, byte_value);
};
PCEmulator.prototype.st16_port = function (io_port, word_value) {
    this.ioport_writew_table[io_port & (1024 - 1)](io_port, word_value);
};
PCEmulator.prototype.st32_port = function (io_port, dword_value) {
    this.ioport_writel_table[io_port & (1024 - 1)](io_port, dword_value);
};

PCEmulator.prototype.register_ioport_read = function (start_io_port, count, op_size, func) {
    var i;
    switch (op_size) {
        case 1:
            for (i = start_io_port; i < start_io_port + count; i++) {
                this.ioport_readb_table[i] = func;
            }
            break;
        case 2:
            for (i = start_io_port; i < start_io_port + count; i += 2) {
                this.ioport_readw_table[i] = func;
            }
            break;
        case 4:
            for (i = start_io_port; i < start_io_port + count; i += 4) {
                this.ioport_readl_table[i] = func;
            }
            break;
    }
};
PCEmulator.prototype.register_ioport_write = function (start_io_port, count, op_size, func) {
    var i;
    switch (op_size) {
        case 1:
            for (i = start_io_port; i < start_io_port + count; i++) {
                this.ioport_writeb_table[i] = func;
            }
            break;
        case 2:
            for (i = start_io_port; i < start_io_port + count; i += 2) {
                this.ioport_writew_table[i] = func;
            }
            break;
        case 4:
            for (i = start_io_port; i < start_io_port + count; i += 4) {
                this.ioport_writel_table[i] = func;
            }
            break;
    }
};
PCEmulator.prototype.ioport80_write = function (io_port, byte_value) {
};

PCEmulator.prototype.reset = function () {
    this.reset_request = 1;
};
