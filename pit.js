"use strict";

function PIT_channel(get_ticks) {
    this.count = 0;
    this.latched_count = 0;
    this.rw_state = 0;
    this.mode = 0;
    this.bcd = 0;
    this.gate = 0;
    this.count_load_time = 0;
    this.get_ticks = get_ticks;
    this.pit_time_unit = 1193182 / 2000000;
}
PIT_channel.prototype.get_time = function () {
    return Math.floor(this.get_ticks() * this.pit_time_unit);
};
PIT_channel.prototype.pit_get_count = function () {
    var d, fh;
    d = this.get_time() - this.count_load_time;
    switch (this.mode) {
        case 0:
        case 1:
        case 4:
        case 5:
            fh = (this.count - d) & 0xffff;
            break;
        default:
            fh = this.count - (d % this.count);
            break;
    }
    return fh;
};
PIT_channel.prototype.pit_get_out = function () {
    var d, retval;
    d = this.get_time() - this.count_load_time;
    switch (this.mode) {
        case 1:
            retval = (d < this.count) >> 0;
            break;
        case 2:
            if ((d % this.count) == 0 && d != 0) {
                retval = 1;
            } else {
                retval = 0;
            }
            break;
        case 3:
            retval = ((d % this.count) < (this.count >> 1)) >> 0;
            break;
        case 4:
        case 5:
            retval = (d == this.count) >> 0;
            break;
        case 0:
        default: /* same as 0 */
            retval = (d >= this.count) >> 0;
            break;
    }
    return retval;
};
PIT_channel.prototype.get_next_transition_time = function () {
    var d, hh, base, ih;
    d = this.get_time() - this.count_load_time;
    switch (this.mode) {

        case 2:
            base = (d / this.count) * this.count;
            if ((d - base) == 0 && d != 0) {
                hh = base + this.count;
            } else {
                hh = base + this.count + 1;
            }
            break;
        case 3:
            base = (d / this.count) * this.count;
            ih = ((this.count + 1) >> 1);
            if ((d - base) < ih) {
                hh = base + ih;
            } else {
                hh = base + this.count;
            }
            break;
        case 4:
        case 5:
            if (d < this.count) {
                hh = this.count;
            }
            else {
                if (d == this.count) {
                    hh = this.count + 1;
                }
                else {
                    return-1;
                }
            }
            break;
        case 0:
        case 1:
        default:
            if (d < this.count) {
                hh = this.count;
            } else {
                return-1;
            }
            break;
    }
    hh = this.count_load_time + hh;
    return hh;
};
PIT_channel.prototype.pit_load_count = function (ja) {
    if (ja == 0) {
        ja = 0x10000;
    }
    this.count_load_time = this.get_time();
    this.count = ja;
};

function PIT(pc_emulator, set_irq_func, get_ticks) {
    var channel, i;
    this.pit_channels = [];
    for (i = 0; i < 3; i++) {
        channel = new PIT_channel(get_ticks);
        this.pit_channels[i] = channel;
        channel.mode = 3;
        channel.gate = (i != 2) >> 0;
        channel.pit_load_count(0);
    }
    this.speaker_data_on = 0;
    this.set_irq = set_irq_func;
    pc_emulator.register_ioport_write(0x40, 4, 1, this.ioport_write.bind(this));
    pc_emulator.register_ioport_read(0x40, 3, 1, this.ioport_read.bind(this));
    pc_emulator.register_ioport_read(0x61, 1, 1, this.speaker_ioport_read.bind(this));
    pc_emulator.register_ioport_write(0x61, 1, 1, this.speaker_ioport_write.bind(this));
}
PIT.prototype.ioport_write = function (io_port, byte_value) {
    var channel_index, kh, channel;
    io_port &= 3;
    if (io_port == 3) {
        channel_index = byte_value >> 6;
        if (channel_index == 3) {
            return;
        }
        channel = this.pit_channels[channel_index];
        kh = (byte_value >> 4) & 3;
        switch (kh) {
            case 0:
                channel.latched_count = channel.pit_get_count();
                channel.rw_state = 4;
                break;
            default:
                channel.mode = (byte_value >> 1) & 7;
                channel.bcd = byte_value & 1;
                channel.rw_state = kh - 1;
                break;
        }
    } else {
        channel = this.pit_channels[io_port];
        switch (channel.rw_state) {
            case 0:
                channel.pit_load_count(byte_value);
                break;
            case 1:
                channel.pit_load_count(byte_value << 8);
                break;
            case 2:
            case 3:
                if (channel.rw_state & 1) {
                    channel.pit_load_count((channel.latched_count & 0xff) | (byte_value << 8));
                } else {
                    channel.latched_count = byte_value;
                }
                channel.rw_state ^= 1;
                break;
        }
    }
};
PIT.prototype.ioport_read = function (io_port) {
    var retval, count, channel;
    io_port &= 3;
    channel = this.pit_channels[io_port];
    switch (channel.rw_state) {
        case 0:
        case 1:
        case 2:
        case 3:
            count = channel.pit_get_count();
            if (channel.rw_state & 1) {
                retval = (count >> 8) & 0xff;
            } else {
                retval = count & 0xff;
            }
            if (channel.rw_state & 2) {
                channel.rw_state ^= 1;
            }
            break;
        /*
         case 4:
         case 5:
         */
        default:
            if (channel.rw_state & 1) {
                retval = channel.latched_count >> 8;
            } else {
                retval = channel.latched_count & 0xff;
            }
            channel.rw_state ^= 1;
            break;
    }
    return retval;
};

PIT.prototype.speaker_ioport_write = function (io_port, byte_value) {
    this.speaker_data_on = (byte_value >> 1) & 1;
    this.pit_channels[2].gate = byte_value & 1;
};

PIT.prototype.speaker_ioport_read = function (io_port) {
    var gh, channel, retval;
    channel = this.pit_channels[2];
    gh = channel.pit_get_out();
    retval = (this.speaker_data_on << 1) | channel.gate | (gh << 5);
    return retval;
};
PIT.prototype.update_irq = function () {
    this.set_irq(1);
    this.set_irq(0);
};
