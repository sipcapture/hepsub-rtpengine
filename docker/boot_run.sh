#!/bin/bash
# OpenSIPS Docker bootstrap

MYSQL_PWD=${MYSQL_PWD:-"passwd"}
EXTERNAL_IP=$(cat /etc/public_ip.txt)
ADVERTISED_IP=${ADVERTISED_IP:-$EXTERNAL_IP}
ADVERTISED_PORT=${ADVERTISED_PORT:-"5060"}
ADVERTISED_RANGE_FIRST=${ADVERTISED_RANGE_FIRST:-"20000"}
ADVERTISED_RANGE_LAST=${ADVERTISED_RANGE_LAST:-"20100"}
WSS_PORT=${WSS_PORT:-"5061"}

HOST_IP=$(ip route get 8.8.8.8 | awk '{print $NF; exit}')

echo "Your IP : ${HOST_IP}"
echo "Public IP : ${EXTERNAL_IP}"
echo -e "Advertised IP:PORT : ${ADVERTISED_IP}:${ADVERTISED_PORT}\n\n"
echo -e "Advertised RTP Range : ${ADVERTISED_RANGE_FIRST}-${ADVERTISED_RANGE_LAST}\n\n"

# Starting MySQL
service mysql start

# Configure opensips.cfg
sed -i "s/advertised_address=.*/advertised_address=\"${ADVERTISED_IP}\"/g" /usr/local/etc/opensips/opensips.cfg
sed -i "s/listen=udp.*/listen=udp:${HOST_IP}:${ADVERTISED_PORT}/g" /usr/local/etc/opensips/opensips.cfg
sed -i "s/listen=ws.*/listen=ws:${HOST_IP}:${WSS_PORT}/g" /usr/local/etc/opensips/opensips.cfg

# Prepare RTPEngine modules
ln -s /lib/modules/$(uname -r) /lib/modules/4.19.0-12-amd64
mkdir -p /lib/modules/$(uname -r)/updates
dpkg -i /rtpengine/ngcp-rtpengine-kernel*.deb
dpkg -i /rtpengine/ngcp-rtpengine-iptables*.deb

mkdir /recording
# Starting RTPEngine process
echo 'del 0' > /proc/rtpengine/control || true
rtpengine-recording --config-file=/etc/rtpengine/rtpengine-recording.conf
rtpengine -p /var/run/rtpengine.pid --interface=$HOST_IP!$ADVERTISED_IP -n 127.0.0.1:60000 -c 127.0.0.1:60001 -m $ADVERTISED_RANGE_FIRST -M $ADVERTISED_RANGE_LAST -E -L 7 \
  --recording-method=proc \
  --recording-dir=/recording \
  --table=0

# Starting OpenSIPS process
/usr/local/sbin/opensips -c
/usr/local/sbin/opensipsctl start

HOMER_IP="${HOMER_IP:-127.0.0.1}"
HOMER_PORT="${HOMER_PORT:-80}"
PUBLIC_IP="${PUBLIC_IP:-127.0.0.1}"
HOMER_TOKEN="${HOMER_TOKEN:-XLzeFGVTeKKnkWszHgLDkhlYoEYdLKUyMpvHUcoIPBNjzFyLOlXhmWmljmXxcNiJbEKknptGFdNhQTIa}"

sed -i "s/HOMER_IP_HERE/$HOMER_IP/g" /app/config.js
sed -i "s/HOMER_PORT_HERE/$HOMER_PORT/g" /app/config.js
sed -i "s/LOCAL_IP_HERE/$PUBLIC_IP/g" /app/config.js
sed -i "s/HOMER_TOKEN_HERE/$HOMER_TOKEN/g" /app/config.js

echo "Starting HEPSUB Client"
cd /app
npm start
#npm start >> /var/log/syslog &
#
#rsyslogd -n
