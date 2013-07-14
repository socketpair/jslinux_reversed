function PIT_ta_(Og, bh, ch) {
    var s, i;
    this.pit_channels = new Array();
    for (i = 0; i < 3; i++) {
        s = new PIT_channel_ta_(ch);
        this.pit_channels[i] = s;
        s.mode = 3;
        s.gate = (i != 2) >> 0;
        s.pit_load_count(0);
    }
    this.speaker_data_on = 0;
    this.set_irq = bh;
    Og.register_ioport_write(0x40, 4, 1, this.ioport_write.bind(this));
    Og.register_ioport_read(0x40, 3, 1, this.ioport_read.bind(this));
    Og.register_ioport_read(0x61, 1, 1, this.speaker_ioport_read.bind(this));
    Og.register_ioport_write(0x61, 1, 1, this.speaker_ioport_write.bind(this));
}
function PIT_channel_ta_(ch) {
    this.count = 0;
    this.latched_count = 0;
    this.rw_state = 0;
    this.mode = 0;
    this.bcd = 0;
    this.gate = 0;
    this.count_load_time = 0;
    this.get_ticks = ch;
    this.pit_time_unit = 1193182 / 2000000;
}
PIT_channel_ta_.prototype.get_time = function () {
    return Math.floor(this.get_ticks() * this.pit_time_unit);
};
PIT_channel_ta_.prototype.pit_get_count = function () {
    var d, eh;
    d = this.get_time() - this.count_load_time;
    switch (this.mode) {
        case 0:
        case 1:
        case 4:
        case 5:
            eh = (this.count - d) & 0xffff;
            break;
        default:
            eh = this.count - (d % this.count);
            break;
    }
    return eh;
};
PIT_channel_ta_.prototype.pit_get_out = function () {
    var d, fh;
    d = this.get_time() - this.count_load_time;
    switch (this.mode) {
        default:
        case 0:
            fh = (d >= this.count) >> 0;
            break;
        case 1:
            fh = (d < this.count) >> 0;
            break;
        case 2:
            if ((d % this.count) == 0 && d != 0)fh = 1; else fh = 0;
            break;
        case 3:
            fh = ((d % this.count) < (this.count >> 1)) >> 0;
            break;
        case 4:
        case 5:
            fh = (d == this.count) >> 0;
            break;
    }
    return fh;
};
PIT_channel_ta_.prototype.get_next_transition_time = function () {
    var d, gh, base, hh;
    d = this.get_time() - this.count_load_time;
    switch (this.mode) {
        default:
        case 0:
        case 1:
            if (d < this.count)gh = this.count; else return-1;
            break;
        case 2:
            base = (d / this.count) * this.count;
            if ((d - base) == 0 && d != 0)gh = base + this.count; else gh = base + this.count + 1;
            break;
        case 3:
            base = (d / this.count) * this.count;
            hh = ((this.count + 1) >> 1);
            if ((d - base) < hh)gh = base + hh; else gh = base + this.count;
            break;
        case 4:
        case 5:
            if (d < this.count)gh = this.count; else if (d == this.count)gh = this.count + 1; else return-1;
            break;
    }
    gh = this.count_load_time + gh;
    return gh;
};
PIT_channel_ta_.prototype.pit_load_count = function (ga) {
    if (ga == 0)ga = 0x10000;
    this.count_load_time = this.get_time();
    this.count = ga;
};
PIT_ta_.prototype.ioport_write = function (fa, ga) {
    var ih, jh, s;
    fa &= 3;
    if (fa == 3) {
        ih = ga >> 6;
        if (ih == 3)return;
        s = this.pit_channels[ih];
        jh = (ga >> 4) & 3;
        switch (jh) {
            case 0:
                s.latched_count = s.pit_get_count();
                s.rw_state = 4;
                break;
            default:
                s.mode = (ga >> 1) & 7;
                s.bcd = ga & 1;
                s.rw_state = jh - 1 + 0;
                break;
        }
    } else {
        s = this.pit_channels[fa];
        switch (s.rw_state) {
            case 0:
                s.pit_load_count(ga);
                break;
            case 1:
                s.pit_load_count(ga << 8);
                break;
            case 2:
            case 3:
                if (s.rw_state & 1) {
                    s.pit_load_count((s.latched_count & 0xff) | (ga << 8));
                } else {
                    s.latched_count = ga;
                }
                s.rw_state ^= 1;
                break;
        }
    }
};
PIT_ta_.prototype.ioport_read = function (fa) {
    var Qg, ma, s;
    fa &= 3;
    s = this.pit_channels[fa];
    switch (s.rw_state) {
        case 0:
        case 1:
        case 2:
        case 3:
            ma = s.pit_get_count();
            if (s.rw_state & 1)Qg = (ma >> 8) & 0xff; else Qg = ma & 0xff;
            if (s.rw_state & 2)s.rw_state ^= 1;
            break;
        default:
        case 4:
        case 5:
            if (s.rw_state & 1)Qg = s.latched_count >> 8; else Qg = s.latched_count & 0xff;
            s.rw_state ^= 1;
            break;
    }
    return Qg;
};
PIT_ta_.prototype.speaker_ioport_write = function (fa, ga) {
    this.speaker_data_on = (ga >> 1) & 1;
    this.pit_channels[2].gate = ga & 1;
};
PIT_ta_.prototype.speaker_ioport_read = function (fa) {
    var fh, s, ga;
    s = this.pit_channels[2];
    fh = s.pit_get_out();
    ga = (this.speaker_data_on << 1) | s.gate | (fh << 5);
    return ga;
};
PIT_ta_.prototype.update_irq = function () {
    this.set_irq(1);
    this.set_irq(0);
};
