LD=ld -m elf_i386
CC=gcc -m32
CFLAGS= -O2 -Wall -fno-builtin -fno-stack-protector #-march=i386
HOST_CFLAGS=-O2 -Wall
# modify to set the kernel path
KERNEL_PATH=../../linux
BINPATH=../bin

all: linuxstart.bin kernel splitted

linuxstart.out: linuxstart_head.o linuxstart.o libc.o
	$(LD) -o $@ -N -Ttext 0x00010000 $^

linuxstart.bin: linuxstart.out
	objcopy -O binary $< $@
	mkdir -p $(BINPATH)
	cp -f $@ $(BINPATH)/$@

%.o: %.c
	$(CC) $(CFLAGS)  -c -o $@ $<

%.o: %.S
	$(CC) -m32 -D__ASSEMBLY__ -c -o $@ $<

# target to generate kernel
kernel:
	make ARCH=i386 -C $(KERNEL_PATH) -j4
	mkdir -p $(BINPATH)
	objcopy -O binary $(KERNEL_PATH)/vmlinux $(BINPATH)/vmlinux26.bin

splitted: hda.img
	split --bytes=65536 --numeric-suffixes --suffix-length=9 $< hda
	mkdir -p $(BINPATH)
	rm -f $(BINPATH)/hda0*
	mv -f hda0* $(BINPATH)/

clean:
	rm -f linuxstart.bin linuxstart.out *.o *~ 
