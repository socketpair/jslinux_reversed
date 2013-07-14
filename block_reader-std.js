"use strict";

function BlockReader_std(Ig, Oh, Ph) {
    if (Ig.indexOf("%d") < 0)throw"Invalid URL";
    if (Ph <= 0 || Oh <= 0)throw"Invalid parameters";
    this.block_sectors = Oh * 2;
    this.nb_sectors = this.block_sectors * Ph;
    this.url = Ig;
    this.max_cache_size = Math.max(1, Math.ceil(2536 / Oh));
    this.cache = new Array();
    this.sector_num = 0;
    this.sector_index = 0;
    this.sector_count = 0;
    this.sector_buf = null;
    this.sector_cb = null;
}
BlockReader_std.prototype.get_sector_count = function () {
    return this.nb_sectors;
};
BlockReader_std.prototype.get_time = function () {
    return+new Date();
};
BlockReader_std.prototype.get_cached_block = function (Qh) {
    var Rh, i, Sh = this.cache;
    for (i = 0; i < Sh.length; i++) {
        Rh = Sh[i];
        if (Rh.block_num == Qh)return Rh;
    }
    return null;
};
BlockReader_std.prototype.new_cached_block = function (Qh) {
    var Rh, Th, i, j, Uh, Sh = this.cache;
    Rh = new Object();
    Rh.block_num = Qh;
    Rh.time = this.get_time();
    if (Sh.length < this.max_cache_size) {
        j = Sh.length;
    } else {
        for (i = 0; i < Sh.length; i++) {
            Th = Sh[i];
            if (i == 0 || Th.time < Uh) {
                Uh = Th.time;
                j = i;
            }
        }
    }
    Sh[j] = Rh;
    return Rh;
};
BlockReader_std.prototype.get_url = function (Ig, Qh) {
    var p, s;
    s = Qh.toString();
    while (s.length < 9)s = "0" + s;
    p = Ig.indexOf("%d");
    return Ig.substr(0, p) + s + Ig.substring(p + 2, Ig.length);
};
BlockReader_std.prototype.read_async_cb = function (Vh) {
    var Qh, l, we, Rh, i, Wh, Xh, Yh, Zh;
    var ai, Ig;
    while (this.sector_index < this.sector_count) {
        Qh = Math.floor(this.sector_num / this.block_sectors);
        Rh = this.get_cached_block(Qh);
        if (Rh) {
            we = this.sector_num - Qh * this.block_sectors;
            l = Math.min(this.sector_count - this.sector_index, this.block_sectors - we);
            Wh = l * 512;
            Xh = this.sector_buf;
            Yh = this.sector_index * 512;
            Zh = Rh.buf;
            ai = we * 512;
            for (i = 0; i < Wh; i++) {
                Xh[i + Yh] = Zh[i + ai];
            }
            this.sector_index += l;
            this.sector_num += l;
        } else {
            Ig = this.get_url(this.url, Qh);
            load_binary(Ig, this.read_async_cb2.bind(this));
            return;
        }
    }
    this.sector_buf = null;
    if (!Vh) {
        this.sector_cb(0);
    }
};
BlockReader_std.prototype.add_block = function (Qh, Lg, sg) {
    var Rh, bi, i;
    Rh = this.new_cached_block(Qh);
    bi = Rh.buf = Ng(this.block_sectors * 512);
    if (typeof Lg == "string") {
        for (i = 0; i < sg; i++)bi[i] = Lg.charCodeAt(i) & 0xff;
    } else {
        for (i = 0; i < sg; i++)bi[i] = Lg[i];
    }
};
BlockReader_std.prototype.read_async_cb2 = function (Lg, sg) {
    var Qh;
    if (sg < 0 || sg != (this.block_sectors * 512)) {
        this.sector_cb(-1);
    } else {
        Qh = Math.floor(this.sector_num / this.block_sectors);
        this.add_block(Qh, Lg, sg);
        this.read_async_cb(false);
    }
};
BlockReader_std.prototype.read_async = function (Bh, bi, n, ci) {
    if ((Bh + n) > this.nb_sectors)return-1;
    this.sector_num = Bh;
    this.sector_buf = bi;
    this.sector_index = 0;
    this.sector_count = n;
    this.sector_cb = ci;
    this.read_async_cb(true);
    if (this.sector_index >= this.sector_count) {
        return 0;
    } else {
        return 1;
    }
};
BlockReader_std.prototype.preload = function (fa, Jg) {
    var i, Ig, Qh;
    if (fa.length == 0) {
        setTimeout(Jg, 0);
    } else {
        this.preload_cb2 = Jg;
        this.preload_count = fa.length;
        for (i = 0; i < fa.length; i++) {
            Qh = fa[i];
            Ig = this.get_url(this.url, Qh);
            load_binary(Ig, this.preload_cb.bind(this, Qh));
        }
    }
};
BlockReader_std.prototype.preload_cb = function (Qh, Lg, sg) {
    if (sg < 0) {
    } else {
        this.add_block(Qh, Lg, sg);
        this.preload_count--;
        if (this.preload_count == 0) {
            this.preload_cb2(0);
        }
    }
};
BlockReader_std.prototype.write_async = function (Bh, bi, n, ci) {
    return-1;
};
