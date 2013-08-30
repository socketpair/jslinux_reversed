#!/bin/bash

set -e -u

if false; then
    sudo debootstrap \
        --variant=minbase \
        --include=psmisc,mini-httpd,net-tools,iproute,iputils-ping,procps,netcat-openbsd,telnet,iptables,wget,tcpdump,curl,gdb,binutils,gcc,libc6-dev,lsof,strace \
        --exclude=locales,aptitude,gnupg,cron,udev,tasksel,rsyslog,groff-base,manpages,gpgv,man-db,apt,debian-archive-keyring,sysv-rc,sysvinit,insserv,python2.6 \
        --arch i386 \
        squeeze squeeze \
        'http://mirror.yandex.ru/debian'
fi

IMAGE_SIZE=120 # megabytes
#icount=`find squeeze | wc -l`
INODE_COUNT=7000

rm -f hda.img
fallocate --length=${IMAGE_SIZE}M hda.img
mke2fs -F -q -m 0 -N $INODE_COUNT hda.img

ddd=/tmp/outimage
mkdir -p $ddd

echo 'root:qwe' | sudo chroot squeeze chpasswd
sudo unshare -m -- bash -c "
set -x -e -u
mount -n -o loop hda.img -t ext2 $ddd
tar -C squeeze \
    --exclude='./var/cache*' \
    --exclude='./usr/share/locale*' \
    --exclude='./usr/share/zoneinfo*' \
    --exclude='./usr/share/doc*' \
    --exclude='./usr/share/man*' \
    --exclude='./usr/share/info*' \
    --exclude='./var/lib/apt*' \
    -c . | tar -C $ddd -x

cat show_boot_time.c | chroot $ddd gcc -m32 -xc -s -Os - -o /usr/bin/show_boot_time

rm -f $ddd/sbin/init;
cp -f init.sh $ddd/sbin/init
rm -rf $ddd/root
ln -s /tmp/root $ddd/root

rm -rf $ddd/var/run
ln -s /tmp     $ddd/var/run

:>| $ddd/etc/resolv.conf
rm -f $ddd/etc/mtab
ln -s /proc/mounts $ddd/etc/mtab
mknod $ddd/dev/ppp c 108 0
mknod $ddd/dev/clipboard c 10 250
mknod $ddd/dev/ttyS0 c 4 64
mknod $ddd/dev/ttyS1 c 4 65
mknod $ddd/dev/ttyS2 c 4 66
mknod $ddd/dev/ttyS3 c 4 67
mknod $ddd/dev/hda b 3 0
mknod $ddd/dev/hdb b 3 64
mknod $ddd/dev/hdb1 b 3 65

echo -e '#!/bin/sh\necho \$* > /dev/clipboard\n' > $ddd/bin/answer
chmod a+x $ddd/bin/answer
df -h $ddd/
"
rm -rf $ddd
make splitted
