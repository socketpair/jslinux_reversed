"use strict";

function IDE_drive(Gh, Hh, malloc_fun) {
    var cylinders, sectors;
    this.ide_if = Gh;
    this.bs = Hh;
    sectors = Hh.get_sector_count();
    cylinders = sectors / (16 * 63);
    if (cylinders > 16383) {
        cylinders = 16383;
    } else {
        if (cylinders < 2) {
            cylinders = 2;
        }
    }
    this.cylinders = cylinders;
    this.heads = 16;
    this.sectors = 63;
    this.nb_sectors = sectors;
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
    this.io_buffer = malloc_fun(128 * 512 + 4);
    this.data_index = 0;
    this.data_end = 0;
    this.end_transfer_func = this.transfer_stop.bind(this);
    this.req_nb_sectors = 0;
    this.io_nb_sectors = 0;
}
IDE_drive.prototype.identify = function () {
    function store_word(word_index, word_value) {
        io_buffer[word_index * 2] = word_value & 0xff;
        io_buffer[word_index * 2 + 1] = (word_value >> 8) & 0xff;
    }

    function store_string(word_index, string, byte_count) {
        var i, byte_value;
        for (i = 0; i < byte_count; i++) {
            if (i < string.length) {
                byte_value = string.charCodeAt(i) & 0xff;
            } else {
                byte_value = 32;
            }
            io_buffer[word_index * 2 + (i ^ 1)] = byte_value;
        }
    }

    var io_buffer, i, lba_sectors;
    io_buffer = this.io_buffer;
    for (i = 0; i < 512; i++)
        io_buffer[i] = 0;
    store_word(0, 0x0040);
    store_word(1, this.cylinders);
    store_word(3, this.heads);
    store_word(4, 512 * this.sectors);
    store_word(5, 512);
    store_word(6, this.sectors);
    store_word(20, 3);
    store_word(21, 512);
    store_word(22, 4);
    store_string(27, "JSLinux HARDDISK", 40);
    store_word(47, 0x8000 | 128);
    store_word(48, 0);
    store_word(49, 1 << 9);
    store_word(51, 0x200);
    store_word(52, 0x200);
    store_word(54, this.cylinders);
    store_word(55, this.heads);
    store_word(56, this.sectors);
    lba_sectors = this.cylinders * this.heads * this.sectors;
    store_word(57, lba_sectors);
    store_word(58, lba_sectors >> 16);
    if (this.mult_sectors)
        store_word(59, 0x100 | this.mult_sectors);
    store_word(60, this.nb_sectors);
    store_word(61, this.nb_sectors >> 16);
    store_word(80, (1 << 1) | (1 << 2));
    store_word(82, (1 << 14));
    store_word(83, (1 << 14));
    store_word(84, (1 << 14));
    store_word(85, (1 << 14));
    store_word(86, 0);
    store_word(87, (1 << 14));
};
IDE_drive.prototype.set_signature = function () {
    this.select &= 0xf0;
    this.nsector = 1;
    this.sector = 1;
    this.lcyl = 0;
    this.hcyl = 0;
};
IDE_drive.prototype.abort_command = function () {
    this.status = 0x40 | 0x01;
    this.error = 0x04;
};
IDE_drive.prototype.set_irq = function () {
    if (!(this.cmd & 0x02)) {
        this.ide_if.set_irq_func(1);
    }
};
IDE_drive.prototype.transfer_start = function (byte_count, callback) {
    this.end_transfer_func = callback;
    this.data_index = 0;
    this.data_end = byte_count;
};
IDE_drive.prototype.transfer_stop = function () {
    this.end_transfer_func = this.transfer_stop.bind(this);
    this.data_index = 0;
    this.data_end = 0;
};
IDE_drive.prototype.get_sector = function () {
    var retval;
    if (this.select & 0x40) {
        retval = ((this.select & 0x0f) << 24) | (this.hcyl << 16) | (this.lcyl << 8) | this.sector;
    } else {
        retval = ((this.hcyl << 8) | this.lcyl) * this.heads * this.sectors + (this.select & 0x0f) * this.sectors + (this.sector - 1);
    }
    return retval;
};
IDE_drive.prototype.set_sector = function (sector_number) {
    var cylinders, sector;
    if (this.select & 0x40) {
        this.select = (this.select & 0xf0) | ((sector_number >> 24) & 0x0f);
        this.hcyl = (sector_number >> 16) & 0xff;
        this.lcyl = (sector_number >> 8) & 0xff;
        this.sector = sector_number & 0xff;
    } else {
        cylinders = sector_number / (this.heads * this.sectors);
        sector = sector_number % (this.heads * this.sectors);
        this.hcyl = (cylinders >> 8) & 0xff;
        this.lcyl = cylinders & 0xff;
        this.select = (this.select & 0xf0) | ((sector / this.sectors) & 0x0f);
        this.sector = (sector % this.sectors) + 1;
    }
};
IDE_drive.prototype.sector_read = function () {
    var sector_num, n, Rg;
    sector_num = this.get_sector();
    n = this.nsector;
    if (n == 0)
        n = 256;
    if (n > this.req_nb_sectors)
        n = this.req_nb_sectors;
    this.io_nb_sectors = n;

    Rg = this.bs.read_async(sector_num, this.io_buffer, n, this.sector_read_cb.bind(this));
    if (Rg < 0) {
        this.abort_command();
        this.set_irq();
    } else if (Rg == 0) {
        this.sector_read_cb();
    } else {
        this.status = 0x40 | 0x10 | 0x80;
        this.error = 0;
    }
};
IDE_drive.prototype.sector_read_cb = function () {
    var sector_count, callback;
    sector_count = this.io_nb_sectors;
    this.set_sector(this.get_sector() + sector_count);
    this.nsector = (this.nsector - sector_count) & 0xff;
    if (this.nsector == 0)
        callback = this.sector_read_cb_end.bind(this);
    else
        callback = this.sector_read.bind(this);
    this.transfer_start(512 * sector_count, callback);
    this.set_irq();
    this.status = 0x40 | 0x10 | 0x08;
    this.error = 0;
};
IDE_drive.prototype.sector_read_cb_end = function () {
    this.status = 0x40 | 0x10;
    this.error = 0;
    this.transfer_stop();
};
IDE_drive.prototype.sector_write_cb1 = function () {
    var sector_num, Rg;
    this.transfer_stop();
    sector_num = this.get_sector();
    Rg = this.bs.write_async(sector_num, this.io_buffer, this.io_nb_sectors, this.sector_write_cb2.bind(this));
    if (Rg < 0) {
        this.abort_command();
        this.set_irq();
    } else if (Rg == 0) {
        this.sector_write_cb2();
    } else {
        this.status = 0x40 | 0x10 | 0x80;
    }
};

IDE_drive.prototype.sector_write_cb2 = function () {
    var sectors;
    sectors = this.io_nb_sectors;
    this.set_sector(this.get_sector() + sectors);
    this.nsector = (this.nsector - sectors) & 0xff;
    if (this.nsector == 0) {
        this.status = 0x40 | 0x10;
    } else {
        sectors = this.nsector;
        if (sectors > this.req_nb_sectors)
            sectors = this.req_nb_sectors;
        this.io_nb_sectors = sectors;
        this.transfer_start(512 * sectors, this.sector_write_cb1.bind(this));
        this.status = 0x40 | 0x10 | 0x08;
    }
    this.set_irq();
};

IDE_drive.prototype.sector_write = function () {
    var sectors;
    sectors = this.nsector;
    if (sectors == 0)
        sectors = 256;
    if (sectors > this.req_nb_sectors)
        sectors = this.req_nb_sectors;
    this.io_nb_sectors = sectors;
    this.transfer_start(512 * sectors, this.sector_write_cb1.bind(this));
    this.status = 0x40 | 0x10 | 0x08;
};

IDE_drive.prototype.identify_cb = function () {
    this.transfer_stop();
    this.status = 0x40;
};

IDE_drive.prototype.exec_cmd = function (byte_command) {
    switch (byte_command) {
        case 0xA1: // ATA_CMD_IDENTIFY_PACKET
        case 0xEC: // ATA_CMD_IDENTIFY
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
        case 0x20: // ATA_CMD_READ_PIO
        case 0x21:
            this.req_nb_sectors = 1;
            this.sector_read();
            break;
        case 0x30: //ATA_CMD_WRITE_PIO
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
function IDE_device(pc_emulator, io_port1, io_port2, set_irq_func, block_readers, malloc_fun) {
    var i, drive;
    this.set_irq_func = set_irq_func;
    this.drives = [];
    for (i = 0; i < 2; i++) {
        if (block_readers[i]) {
            drive = new IDE_drive(this, block_readers[i], malloc_fun);
        } else {
            drive = null;
        }
        this.drives[i] = drive;
    }
    this.cur_drive = this.drives[0];
    pc_emulator.register_ioport_write(io_port1, 8, 1, this.ioport_write.bind(this));
    pc_emulator.register_ioport_read(io_port1, 8, 1, this.ioport_read.bind(this));
    if (io_port2) {
        pc_emulator.register_ioport_read(io_port2, 1, 1, this.status_read.bind(this));
        pc_emulator.register_ioport_write(io_port2, 1, 1, this.cmd_write.bind(this));
    }
    pc_emulator.register_ioport_write(io_port1, 2, 2, this.data_writew.bind(this));
    pc_emulator.register_ioport_read(io_port1, 2, 2, this.data_readw.bind(this));
    pc_emulator.register_ioport_write(io_port1, 4, 4, this.data_writel.bind(this));
    pc_emulator.register_ioport_read(io_port1, 4, 4, this.data_readl.bind(this));
}
IDE_device.prototype.ioport_write = function (io_port, byte_value) {
    var current_drive = this.cur_drive;

    switch (io_port & 7) {
        case 0:
            break;
        case 1:
            if (current_drive) {
                current_drive.feature = byte_value;
            }
            break;
        case 2:
            if (current_drive) {
                current_drive.nsector = byte_value;
            }
            break;
        case 3:
            if (current_drive) {
                current_drive.sector = byte_value;
            }
            break;
        case 4:
            if (current_drive) {
                current_drive.lcyl = byte_value;
            }
            break;
        case 5:
            if (current_drive) {
                current_drive.hcyl = byte_value;
            }
            break;
        case 6:
            current_drive = this.cur_drive = this.drives[(byte_value >> 4) & 1];
            if (current_drive) {
                current_drive.select = byte_value;
            }
            break;
        case 7:
            if (current_drive) {
                current_drive.exec_cmd(byte_value);
            }
            break;
    }
};
IDE_device.prototype.ioport_read = function (io_port) {
    var current_drive = this.cur_drive;
    var retval;

    if (!current_drive)
        return 0xff;

    switch (io_port & 7) {
        case 0:
            retval = 0xff;
            break;
        case 1:
            retval = current_drive.error;
            break;
        case 2:
            retval = current_drive.nsector;
            break;
        case 3:
            retval = current_drive.sector;
            break;
        case 4:
            retval = current_drive.lcyl;
            break;
        case 5:
            retval = current_drive.hcyl;
            break;
        case 6:
            retval = current_drive.select;
            break;
        case 7:
            retval = current_drive.status;
            this.set_irq_func(0);
            break;
    }

    return retval;
};
IDE_device.prototype.status_read = function (io_port) {
    var current_drive = this.cur_drive;
    var status;
    if (current_drive) {
        status = current_drive.status;
    } else {
        status = 0;
    }
    return status;
};

IDE_device.prototype.cmd_write = function (io_port, byte_value) {
    var i, drive;
    if (!(this.cmd & 0x04) && (byte_value & 0x04)) {
        for (i = 0; i < 2; i++) {
            drive = this.drives[i];
            if (drive) {
                drive.status = 0x80 | 0x10;
                drive.error = 0x01;
            }
        }
    } else if ((this.cmd & 0x04) && !(byte_value & 0x04)) {
        for (i = 0; i < 2; i++) {
            drive = this.drives[i];
            if (drive) {
                drive.status = 0x40 | 0x10;
                drive.set_signature();
            }
        }
    }

    for (i = 0; i < 2; i++) {
        drive = this.drives[i];
        if (drive) {
            drive.cmd = byte_value;
        }
    }
};

IDE_device.prototype.data_writew = function (io_port, word_value) {
    var current_drive = this.cur_drive;
    var p, fa;
    if (!current_drive)
        return;
    p = current_drive.data_index;
    fa = current_drive.io_buffer;
    fa[p] = word_value & 0xff;
    fa[p + 1] = (word_value >> 8) & 0xff;
    p += 2;
    current_drive.data_index = p;
    if (p >= current_drive.data_end)
        current_drive.end_transfer_func();
};

IDE_device.prototype.data_readw = function (io_port) {
    var current_drive = this.cur_drive;
    var data_index, retval, io_buffer;
    if (!current_drive)
        return 0;

    data_index = current_drive.data_index;
    io_buffer = current_drive.io_buffer;
    retval = io_buffer[data_index] | (io_buffer[data_index + 1] << 8);
    data_index += 2;
    current_drive.data_index = data_index;

    if (data_index >= current_drive.data_end)
        current_drive.end_transfer_func();

    return retval;
};

IDE_device.prototype.data_writel = function (io_port, dword_value) {
    var current_drive = this.cur_drive;
    var data_index, io_buffer;
    if (!current_drive)
        return;
    data_index = current_drive.data_index;
    io_buffer = current_drive.io_buffer;
    io_buffer[data_index] = dword_value & 0xff;
    io_buffer[data_index + 1] = (dword_value >> 8) & 0xff;
    io_buffer[data_index + 2] = (dword_value >> 16) & 0xff;
    io_buffer[data_index + 3] = (dword_value >> 24) & 0xff;
    data_index += 4;
    current_drive.data_index = data_index;
    if (data_index >= current_drive.data_end)
        current_drive.end_transfer_func();
};

IDE_device.prototype.data_readl = function (io_port) {
    var current_drive = this.cur_drive;
    var data_index, retval, io_buffer;

    if (!current_drive)
        return 0;

    data_index = current_drive.data_index;
    io_buffer = current_drive.io_buffer;
    retval = io_buffer[data_index] | (io_buffer[data_index + 1] << 8) | (io_buffer[data_index + 2] << 16) | (io_buffer[data_index + 3] << 24);
    data_index += 4;
    current_drive.data_index = data_index;
    if (data_index >= current_drive.data_end)
        current_drive.end_transfer_func();

    return retval;
};

self.IDE_device = IDE_device;
