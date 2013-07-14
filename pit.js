"use strict";

function PIT_channel(dh) {
    this.count = 0;
    this.latched_count = 0;
    this.rw_state = 0;
    this.mode = 0;
    this.bcd = 0;
    this.gate = 0;
    this.count_load_time = 0;
    this.get_ticks = dh;
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
    var d, gh;
    d = this.get_time() - this.count_load_time;
    switch (this.mode) {
        case 0:
            gh = (d >= this.count) >> 0;
            break;
        case 1:
            gh = (d < this.count) >> 0;
            break;
        case 2:
            if ((d % this.count) == 0 && d != 0) {
                gh = 1;
            } else {
                gh = 0;
            }
            break;
        case 3:
            gh = ((d % this.count) < (this.count >> 1)) >> 0;
            break;
        case 4:
        case 5:
            gh = (d == this.count) >> 0;
            break;
        default: /* same as 0 */
            gh = (d >= this.count) >> 0;
            break;

    }
    return gh;
};
PIT_channel.prototype.get_next_transition_time = function () {
    var d, hh, base, ih;
    d = this.get_time() - this.count_load_time;
    switch (this.mode) {

        case 0:
        case 1:
            if (d < this.count) {
                hh = this.count;
            } else {
                return-1;
            }
            break;
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
        default: /* same as 0 */
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

function PIT(Pg, ch, dh) {
    var s, i;
    this.pit_channels = [];
    for (i = 0; i < 3; i++) {
        s = new PIT_channel(dh);
        this.pit_channels[i] = s;
        s.mode = 3;
        s.gate = (i != 2) >> 0;
        s.pit_load_count(0);
    }
    this.speaker_data_on = 0;
    this.set_irq = ch;
    Pg.register_ioport_write(0x40, 4, 1, this.ioport_write.bind(this));
    Pg.register_ioport_read(0x40, 3, 1, this.ioport_read.bind(this));
    Pg.register_ioport_read(0x61, 1, 1, this.speaker_ioport_read.bind(this));
    Pg.register_ioport_write(0x61, 1, 1, this.speaker_ioport_write.bind(this));
}
PIT.prototype.ioport_write = function (ia, ja) {
    var jh, kh, s;
    ia &= 3;
    if (ia == 3) {
        jh = ja >> 6;
        if (jh == 3) {
            return;
        }
        s = this.pit_channels[jh];
        kh = (ja >> 4) & 3;
        switch (kh) {
            case 0:
                s.latched_count = s.pit_get_count();
                s.rw_state = 4;
                break;
            default:
                s.mode = (ja >> 1) & 7;
                s.bcd = ja & 1;
                s.rw_state = kh - 1;
                break;
        }
    } else {
        s = this.pit_channels[ia];
        switch (s.rw_state) {
            case 0:
                s.pit_load_count(ja);
                break;
            case 1:
                s.pit_load_count(ja << 8);
                break;
            case 2:
            case 3:
                if (s.rw_state & 1) {
                    s.pit_load_count((s.latched_count & 0xff) | (ja << 8));
                } else {
                    s.latched_count = ja;
                }
                s.rw_state ^= 1;
                break;
        }
    }
};
PIT.prototype.ioport_read = function (ia) {
    var Rg, pa, s;
    ia &= 3;
    s = this.pit_channels[ia];
    switch (s.rw_state) {
        case 0:
        case 1:
        case 2:
        case 3:
            pa = s.pit_get_count();
            if (s.rw_state & 1) {
                Rg = (pa >> 8) & 0xff;
            } else {
                Rg = pa & 0xff;
            }
            if (s.rw_state & 2) {
                s.rw_state ^= 1;
            }
            break;
        /*
         case 4:
         case 5:
         */
        default:
            if (s.rw_state & 1) {
                Rg = s.latched_count >> 8;
            } else {
                Rg = s.latched_count & 0xff;
            }
            s.rw_state ^= 1;
            break;
    }
    return Rg;
};
PIT.prototype.speaker_ioport_write = function (ia, ja) {
    this.speaker_data_on = (ja >> 1) & 1;
    this.pit_channels[2].gate = ja & 1;
};
PIT.prototype.speaker_ioport_read = function (ia) {
    var gh, s, ja;
    s = this.pit_channels[2];
    gh = s.pit_get_out();
    ja = (this.speaker_data_on << 1) | s.gate | (gh << 5);
    return ja;
};
PIT.prototype.update_irq = function () {
    this.set_irq(1);
    this.set_irq(0);
};
