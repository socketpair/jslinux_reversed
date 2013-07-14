/* 
 Linux launcher

 Copyright (c) 2011-2012 Fabrice Bellard

 Redistribution or commercial use is prohibited without the author's
 permission.
 */
"use strict";

function jslinux(clipboard_get, clipboard_set, terminal_container, emulname) {
    var pc, boot_start_time, start_addr = 0x10000, mem_size = 16 * 1024 * 1024;

    function start2(ret) {
        if (ret < 0) {
            alert("kernel loading failed");
            return;
        }
        pc.load_binary("bin/linuxstart.bin", start_addr, start3);
    }

    // TODO: automate calculation of preload list...
    function start3(ret) {
        var block_list;
        if (ret < 0)
            return;
        block_list = [ 0, 7, 3, 643, 720, 256, 336, 644, 781, 387, 464, 475, 131, 589, 468, 472, 474, 776, 777, 778, 779, 465, 466, 473, 467, 469, 470, 512, 592, 471, 691, 697, 708, 792, 775, 769 ];
        pc.ide0.drives[0].bs.preload(block_list, start4);
    }

    function start4(ret) {
        var cmdline_addr;

        if (ret < 0) {
            alert("Linux starter load failed");
            return;
        }
        /* set the Linux kernel command line */
        cmdline_addr = 0xf800;
        pc.cpu.write_string(cmdline_addr, "console=ttyS0 root=/dev/hda ro init=/sbin/init notsc=1 hdb=none");

        pc.cpu.eip = start_addr;
        pc.cpu.regs[0] = mem_size;
        /* eax */
        pc.cpu.regs[3] = 0;
        /* ebx = initrd_size (no longer used) */
        pc.cpu.regs[1] = cmdline_addr;
        /* ecx */

        boot_start_time = (+new Date());

        pc.start();
    }

    function get_boot_time() {
        return (+new Date()) - boot_start_time;
    }



    var term, params = {};

    params.mem_size = mem_size;
    params.clipboard_get = clipboard_get;
    params.clipboard_set = clipboard_set;
    params.get_boot_time = get_boot_time;
    params.hda = {  "url": "bin/hda%d", "nb_blocks": 912, "block_size": 64};
    params.emulname = emulname;
    pc = new PCEmulator(params);
    term = new Term(80, 30, function (str) {
        // keyboard -> guest
        pc.com1.send_chars(str);
    });
    term.open(terminal_container);
    // guest -> terminal
    pc.com1.write_func = term.write.bind(term);

    pc.load_binary("bin/vmlinux26.bin", 0x00100000, start2);

    return pc;
}
