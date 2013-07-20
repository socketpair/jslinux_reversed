"use strict";

function Keyboard(pc_emulator, reset_request) {
    pc_emulator.register_ioport_read(0x64, 1, 1, this.read_status.bind(this));
    pc_emulator.register_ioport_write(0x64, 1, 1, this.write_command.bind(this));
    this.reset_request = reset_request;
}
Keyboard.prototype.read_status = function (io_port) {
    return 0;
};
Keyboard.prototype.write_command = function (io_port, byte_value) {
    switch (byte_value) {
        case 0xfe:
            this.reset_request();
            break;
        default:
            break;
    }
};

self.Keyboard = Keyboard;
