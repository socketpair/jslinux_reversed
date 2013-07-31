#!/bin/bash

kvm -kernel ~/src/linux/arch/i386/boot/bzImage -snapshot -hda hda.img -hdb hda.img -append 'root=/dev/hda console=ttyS0 notsc=1' -serial stdio -net none -M isapc -m 16
