"use strict";

function Keyboard_std(Pg, rh) {
    Pg.register_ioport_read(0x64, 1, 1, this.read_status.bind(this));
    Pg.register_ioport_write(0x64, 1, 1, this.write_command.bind(this));
    this.reset_request = rh;
}
Keyboard_std.prototype.read_status = function (ia) {
    return 0;
};
Keyboard_std.prototype.write_command = function (ia, ja) {
    switch (ja) {
        case 0xfe:
            this.reset_request();
            break;
        default:
            break;
    }
};
