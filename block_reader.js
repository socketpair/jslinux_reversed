"use strict";

function BlockReader(url, block_size_kb, block_count, malloc_fun) {
    if (url.indexOf("%d") < 0) {
        throw "Invalid URL";
    }
    if (block_count <= 0 || block_size_kb <= 0) {
        throw "Invalid parameters";
    }
    this.block_sectors = block_size_kb * 2;
    this.nb_sectors = this.block_sectors * block_count;
    this.url = url;
    this.max_cache_size = Math.max(1, Math.ceil(2536 / block_size_kb));
    this.cache = [];
    this.sector_num = 0;
    this.sector_index = 0;
    this.sector_count = 0;
    this.sector_buf = null;
    this.sector_cb = null;
    this.malloc_fun = malloc_fun;
}
BlockReader.prototype.get_sector_count = function () {
    return this.nb_sectors;
};
BlockReader.prototype.get_time = function () {
    return (+new Date());
};
BlockReader.prototype.get_cached_block = function (block_number) {
    var cache_item, i, cache = this.cache;
    for (i = 0; i < cache.length; i++) {
        cache_item = cache[i];
        if (cache_item.block_num == block_number) {
            return cache_item;
        }
    }
    return null;
};
BlockReader.prototype.new_cached_block = function (block_number) {
    var cache_item1, cache_item2, i, j, time, cache = this.cache;
    cache_item1 = {};
    cache_item1.block_num = block_number;
    cache_item1.time = this.get_time();
    if (cache.length < this.max_cache_size) {
        j = cache.length;
    } else {
        for (i = 0; i < cache.length; i++) {
            cache_item2 = cache[i];
            if (i == 0 || cache_item2.time < time) {
                time = cache_item2.time;
                j = i;
            }
        }
    }
    cache[j] = cache_item1;
    return cache_item1;
};
BlockReader.prototype.get_url = function (base_url, block_number) {
    var _d_index, block_num_str;
    block_num_str = block_number.toString();
    while (block_num_str.length < 9) {
        block_num_str = "0" + block_num_str;
    }
    _d_index = base_url.indexOf("%d");
    return base_url.substr(0, _d_index) + block_num_str + base_url.substring(_d_index + 2, base_url.length);
};
BlockReader.prototype.read_async_cb = function (Vh) {
    var block_number, l, we, cache_block, i, Wh, sector_buf, Yh, cache_buf;
    var ai, Ig;
    while (this.sector_index < this.sector_count) {
        block_number = Math.floor(this.sector_num / this.block_sectors);
        cache_block = this.get_cached_block(block_number);
        if (cache_block) {
            we = this.sector_num - block_number * this.block_sectors;
            l = Math.min(this.sector_count - this.sector_index, this.block_sectors - we);
            Wh = l * 512;
            sector_buf = this.sector_buf;
            Yh = this.sector_index * 512;
            cache_buf = cache_block.buf;
            ai = we * 512;
            for (i = 0; i < Wh; i++) {
                sector_buf[i + Yh] = cache_buf[i + ai];
            }
            this.sector_index += l;
            this.sector_num += l;
        } else {
            Ig = this.get_url(this.url, block_number);
            load_binary(Ig, this.read_async_cb2.bind(this));
            return;
        }
    }
    this.sector_buf = null;
    if (!Vh) {
        this.sector_cb(0);
    }
};
BlockReader.prototype.add_block = function (block_number, data, data_len) {
    var cache_item, buffer, i;
    cache_item = this.new_cached_block(block_number);
    buffer = cache_item.buf = this.malloc_fun(this.block_sectors * 512);
    if (typeof data == "string") {
        for (i = 0; i < data_len; i++) {
            buffer[i] = data.charCodeAt(i) & 0xff;
        }
    } else {
        for (i = 0; i < data_len; i++) {
            buffer[i] = data[i];
        }
    }
};
BlockReader.prototype.read_async_cb2 = function (data, data_len) {
    var block_number;

    if (data_len < 0 || data_len != (this.block_sectors * 512)) {
        this.sector_cb(-1);
        return;
    }

    block_number = Math.floor(this.sector_num / this.block_sectors);
    this.add_block(block_number, data, data_len);
    this.read_async_cb(false);

};
BlockReader.prototype.read_async = function (sector_num, buf, sector_count, callback) {
    if ((sector_num + sector_count) > this.nb_sectors) {
        return-1;
    }
    this.sector_num = sector_num;
    this.sector_buf = buf;
    this.sector_index = 0;
    this.sector_count = sector_count;
    this.sector_cb = callback;
    this.read_async_cb(true);
    if (this.sector_index >= this.sector_count) {
        return 0;
    } else {
        return 1;
    }
};
BlockReader.prototype.preload = function (block_array, callback) {
    var i, url, block_number;
    if (block_array.length == 0) {
        setTimeout(callback, 0);
        return;
    }

    this.preload_cb2 = callback;
    this.preload_count = block_array.length;

    for (i = 0; i < block_array.length; i++) {
        block_number = block_array[i];
        url = this.get_url(this.url, block_number);
        load_binary(url, this.preload_cb.bind(this, block_number));
    }

};
BlockReader.prototype.preload_cb = function (block_number, data, data_len) {
    if (data_len < 0) {
        return;
    }
    this.add_block(block_number, data, data_len);
    this.preload_count--;
    if (this.preload_count == 0) {
        this.preload_cb2(0);
    }
};
BlockReader.prototype.write_async = function (sector_num, buf, sector_count, callback) {
    return -1;
};

self.BlockReader = BlockReader;
