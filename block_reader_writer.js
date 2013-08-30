"use strict";

function BlockReaderWriter(sectors_count, malloc_fun, writefilename) {
    if (sectors_count <= 0) {
        throw "Invalid parameters";
    }

    this.nb_sectors = sectors_count;
    this.malloc_fun = malloc_fun;
    this.filewriter = undefined;
    this.writefilename = writefilename;
}

BlockReaderWriter.prototype.log = function () {
};

BlockReaderWriter.prototype.get_sector_count = function () {
    return this.nb_sectors;
};

BlockReaderWriter.prototype.initfs = function (cb) {
    var me = this;

    var onfserror = function (e) {
        var msg = '';
        switch (e.code) {
            case FileError.QUOTA_EXCEEDED_ERR:
                msg = 'QUOTA_EXCEEDED_ERR';
                break;
            case FileError.NOT_FOUND_ERR:
                msg = 'NOT_FOUND_ERR';
                break;
            case FileError.SECURITY_ERR:
                msg = 'SECURITY_ERR';
                break;
            case FileError.INVALID_MODIFICATION_ERR:
                msg = 'INVALID_MODIFICATION_ERR';
                break;
            case FileError.INVALID_STATE_ERR:
                msg = 'INVALID_STATE_ERR';
                break;
            default:
                msg = 'Unknown Error';
                break;
        }
        msg = 'fs error' + msg;
        me.log(msg);
        throw msg;
    };

    var completely_init_writer_and_call_cb = function (fileWriter) {
        me.log('setting up real file writing events handlers');
        fileWriter.onwriteend = function (e) {
            //me.log('Write completed.');
            me.write_sector_cb(0);
        };

        fileWriter.onerror = function (e) {
            me.log('Write failed: ' + e.toString());
            me.write_sector_cb(-1);
            // TODO: throw something...
        };

        me.fileWriter = fileWriter;

        me.log('Filesystem full initialized. Calling real action callback');
        cb();
    };

    var init_writer = function (fileWriter) {
        me.log('Initializing file writer');

        var max_file_size = me.nb_sectors * 512;

        //
        if (me.file.size >= max_file_size) {
            me.log('Backing store file have correct size, not chainging.');
            completely_init_writer_and_call_cb(fileWriter);
            return;
        }

        fileWriter.onerror = function (e) {
            me.log('file extending failed: ' + e.toString());
            //todo: throw something
        };
        fileWriter.onwriteend = function (e) {
            me.log('Extending backing store complete');
            completely_init_writer_and_call_cb(fileWriter);
        };
        // TODO: why truncate(max_file_size) does not work ?!
        me.log('Backing store file is not of correct size, extending file...');
        fileWriter.write(new Blob([new Uint8Array(max_file_size - me.file.size)]));
    };

    //TODO: implement choose (!)
    var reqfs = /* requestFileSystem || */ webkitRequestFileSystem;

    //TODO: webkit specific(!)

    // TODO: does not work in worker
    //webkitStorageInfo.requestQuota(PERSISTENT, 16 * 1024 * 1024, function (grantedbytes) {

    me.log('Requesting file system');
    reqfs(PERSISTENT, me.nb_sectors * 512, function (fs) {
        me.log('Filesystem got, getting file named', me.writefilename);
        fs.root.getFile(me.writefilename, {create: true}, function (fileEntry) {
            me.log('Filentry crated, creating file descriptor for reading');
            fileEntry.file(function (file) {
                me.file = file;
                me.log('file descriptor for reading created, createing filewriter');
                fileEntry.createWriter(init_writer, onfserror);
            }, onfserror);
        }, onfserror);
    }, onfserror);


};

BlockReaderWriter.prototype.read_async = function (sector_num, buf, sector_count, callback) {
    var me = this;

    //me.log('read_async called');

    if ((sector_num + sector_count) > me.nb_sectors) {
        me.log('Attempting to READ beyond of device');
        return -1;
    }

    if (!(buf instanceof Uint8Array)) {
        me.log('buf is not uint8array!!!');
        throw 'buf is not uint8array!!!';
    }

    var fun = function () {
        //me.log('Calling seek/read', sector_num, sector_count);
        var reader = new FileReader();

        reader.onloadend = function (e) {
            //me.log('read bunch complete, storing in buffer, calling callback...');
            if (reader.result.byteLength != sector_count * 512) {
                me.log('Internal error on read');
                throw 'Internal error on read';
            }
            buf.set(new Uint8Array(reader.result));
            callback(0);
        };

        reader.readAsArrayBuffer(me.file.slice(sector_num * 512, (sector_num + sector_count) * 512));
    };
    if (me.fileWriter) {
        //me.log('File writer was already initialized');
        fun();
    } else {
        me.log('Initializing filesystem');
        me.initfs(fun);
    }
    return 1; // not complete
};

BlockReaderWriter.prototype.write_async = function (sector_num, buf, sector_count, callback) {
    var me = this;

    //  me.log('write_async called');

    if ((sector_num + sector_count) > me.nb_sectors) {
        me.log('Attempting to WRITE beyond of device');
        return -1;
    }

    if (!(buf instanceof Uint8Array)) {
        me.log('buf is not uint8array!!!');
        throw 'buf is not uint8array!!!';
    }

    var fun = function () {
//        me.log('Calling seek/write', sector_num, sector_count);

        me.fileWriter.seek(sector_num * 512);
        // TODO: check for data copying (!)
        // TODO: buf.buffer.slice() ?
        me.write_sector_cb = callback;

        // deprecation warning here:
        //me.fileWriter.write(new Blob([buf.buffer.slice(0, sector_count * 512)], { type: "application/octet-binary"}));
        me.fileWriter.write(new Blob([buf.subarray(0, sector_count * 512)], { type: "application/octet-binary"}));
        // TODO: check data copying
    };
    if (me.fileWriter) {
        //me.log('File writer was already initialized');
        fun();
    } else {
        me.log('Initializing filesystem');
        me.initfs(fun);
    }
    return 1; // not complete
};


self.BlockReaderWriter = BlockReaderWriter;
