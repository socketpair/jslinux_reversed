"use strict";

function Keyboard_ta_(Og, qh) {
    Og.register_ioport_read(0x64, 1, 1, this.read_status.bind(this));
    Og.register_ioport_write(0x64, 1, 1, this.write_command.bind(this));
    this.reset_request = qh;
}
Keyboard_ta_.prototype.read_status = function (fa) {
    return 0;
};
Keyboard_ta_.prototype.write_command = function (fa, ga) {
    switch (ga) {
        case 0xfe:
            this.reset_request();
            break;
        default:
            break;
    }
};
