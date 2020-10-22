FROM debian:buster
MAINTAINER Igor Olhovskiy <igorolhovskiy@gmail.com>

ENV DEBIAN_FRONTEND noninteractive
ENV RTPENGINE_VERSION mr8.0
ENV BCG729_VERSION 1.0.4

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y git \
                dpkg-dev \
                cmake \
                unzip \
                wget \
                debhelper-compat \
                default-libmysqlclient-dev \
                gperf \
                iptables-dev \
                libavcodec-dev \
                libavfilter-dev \
                libavformat-dev \
                libavutil-dev \
                libbencode-perl \
                libcrypt-openssl-rsa-perl \
                libcrypt-rijndael-perl \
                libcurl4-openssl-dev \
                libdigest-crc-perl \
                libdigest-hmac-perl \
                libevent-dev libglib2.0-dev \
                libhiredis-dev libio-multiplex-perl \
                libio-socket-inet6-perl libiptc-dev \
                libjson-glib-dev libnet-interface-perl \
                libpcap0.8-dev \
                libpcre3-dev \
                libsocket6-perl \
                libspandsp-dev \
                libssl-dev \
                libswresample-dev \
                libsystemd-dev \
                libxmlrpc-core-c3-dev \
                markdown \
                curl \
                wget \
                zlib1g-dev && \
    cd /usr/src && \
    curl https://codeload.github.com/BelledonneCommunications/bcg729/tar.gz/$BCG729_VERSION > bcg729_$BCG729_VERSION.orig.tar.gz && \
    tar zxf bcg729_$BCG729_VERSION.orig.tar.gz && \
    cd bcg729-$BCG729_VERSION && \
    git clone https://github.com/ossobv/bcg729-deb.git debian && \
    dpkg-buildpackage -us -uc -sa && \
    cd /usr/src && \
    dpkg -i *.deb && \
    cd /usr/src && \
    git clone -b $RTPENGINE_VERSION https://github.com/sipwise/rtpengine.git && \
    cd rtpengine && \
    dpkg-buildpackage && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/deb && \
    mv /usr/src/*.deb /opt/deb



FROM debian:buster
MAINTAINER "Lorenzo Mangani <lorenzo.mangani@gmail.com>"
ENV RANDOM 01209184
USER root

RUN apt-get update && apt-get install -y sudo git make bison flex curl libssl-dev && \
    echo "default-mysql-server default-mysql-server/root_password password passwd" | sudo debconf-set-selections && \
    echo "default-mysql-server default-mysql-server/root_password_again password passwd" | sudo debconf-set-selections && \
    apt-get install -y default-mysql-server default-libmysqlclient-dev \
                       libncurses5 libncurses5-dev default-libmysqlclient-dev expect && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN curl ipinfo.io/ip > /etc/public_ip.txt

RUN git clone https://github.com/OpenSIPS/opensips.git -b 2.2 ~/opensips_2_2 && \
    sed -i 's/db_http db_mysql db_oracle/db_http db_oracle/g' ~/opensips_2_2/Makefile.conf.template && \
    cd ~/opensips_2_2 && \
    make all && make prefix=/usr/local install && \
    cd .. && rm -rf ~/opensips_2_2

COPY --from=0 /opt/deb /rtpengine

RUN export DEBIAN_FRONTEND=noninteractive && \
    apt update && apt-get install -qqy dpkg-dev debhelper libevent-dev iptables-dev libcurl4-openssl-dev libglib2.0-dev libhiredis-dev libpcre3-dev libssl-dev libxmlrpc-core-c3-dev markdown zlib1g-dev module-assistant dkms gettext \
    libavcodec-dev libavfilter-dev libavformat-dev libjson-glib-dev libpcap-dev nfs-common libspandsp2 \
    libbencode-perl libcrypt-rijndael-perl libdigest-hmac-perl libio-socket-inet6-perl libsocket6-perl netcat && \
    rm -rf /rtpengine/ngcp-rtpengine-kernel-source* && \
    dpkg -i /rtpengine/*.deb && \
    apt-get clean
    
RUN apt-get purge -y bison build-essential ca-certificates flex git m4 pkg-config curl  && \
    apt-get autoremove -y && \
    apt-get install -y rsyslog ngrep && \
    apt-get clean

COPY conf/opensipsctlrc /usr/local/etc/opensips/opensipsctlrc
COPY conf/opensips-rtpengine.cfg /usr/local/etc/opensips/opensips.cfg
COPY rtpengine/rtpengine-recording.conf /etc/rtpengine/rtpengine-recording.conf

COPY boot_run.sh /etc/boot_run.sh
RUN chown root.root /etc/boot_run.sh && chmod 700 /etc/boot_run.sh

RUN apt install -y curl git && \
    curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash - && \
    apt-get install -y nodejs && \
    cd /opt && git clone https://github.com/lmangani/hepsub-rtpengine /app && \
    cd /app && npm install

EXPOSE 5060/udp
EXPOSE 5060/tcp
EXPOSE 9060/udp
EXPOSE 9060/tcp
EXPOSE 6060/udp
EXPOSE 20000-20100/udp

ENTRYPOINT ["/etc/boot_run.sh"]
