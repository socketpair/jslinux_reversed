#!/bin/bash

kvm -kernel ~/src/linux/arch/i386/boot/bzImage -snapshot -hda hda.img -append 'root=/dev/hda console=ttyS0' -serial stdio
