var config = {
  backend: "http://HOMER_IP_HERE:HOMER_PORT_HERE/api/v3/agent/subscribe",
  token: "HOMER_TOKEN_HERE",
  rtpengine: {
	"path" : "/recording",
        "download" : true,
        "insecure" : true
  },
  service: {
	"uuid": Math.random().toString(36).substring(7),
	"host":"LOCAL_IP_HERE",
	"port": 18088,
	"protocol": "http",
	"path": "/get",
	"type": "wav",
	"ttl": 300,
	"node": "rtpengine",
	"gid": 10
  },
  "debug": true
};

module.exports = config;
