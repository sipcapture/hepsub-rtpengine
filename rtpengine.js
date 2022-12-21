/*
 * HEP-PUBSUB Interface Controller
 * RTP:Engine Integration (metafile-based)
 * (C) 2020 QXIP BV
 */

try {
    var {
        backend: homerApiUri,
        debug: debug,
        rtpengine: {
            download: configDownloadEnabled,
            path: pathRecording,
        },
        service: settings,
        token: homerAuthToken
    } = require('./config.js');
} catch (e) {
    console.log('Could not find config.js', e);
    process.exit(1);
}

const LRU = require('lru');
// PCAP CACHE: MAX NUMBER OF PCAP LINKS todo Move to config
const cache = new LRU({max: 10000});
// TOKEN CACHE: SET EXPIRATION FOR DOWNLOAD LINKS todo Move to config
const tokens = new LRU({max: 100, maxAge: 300000});

const chokidar = require('chokidar');
const fs = require('fs');

const express = require('express');
const app = express();
const request = require('request');
const bodyParser = require('body-parser');
app.use(bodyParser.json());

const port = settings.port;
const debugActive = debug || false;

const uuidV1 = require('uuid/v1');
let agentUUID = uuidV1();
const ttl = settings.ttl;

// INDEXING Backend for RTPEngine Meta files
const watcher = chokidar.watch(pathRecording, {ignored: /^\./, persistent: true});
watcher
    .on('error', function (error) {
        console.error('directory watcher error:', error);
    })
    .on('add', function (path) {
        if (path.endsWith('.pcap')) {
            if (debugActive) {
                console.log('attempting to add', path, 'to index');
            }
            let index = {};
            index.pcap = path;
            try {
                index.cid = extractCallIDFromPCAP(index.pcap)
                // Get the file modification time of a PCAP into our file index
                let stats = fs.statSync(index.pcap);
                let dateNow = stats.mtime ? new Date(stats.mtime).getTime() : new Date().getTime();
                index.t_sec = Math.floor(dateNow / 1000);
                index.u_sec = (dateNow - (index.t_sec * 1000)) * 1000;
                if (debugActive) {
                    console.log('added call to index:', index);
                } else {
                    console.log('added call to index:', index.cid);
                }
                cache.set(index.cid, JSON.stringify(index));
            } catch (e) {
                console.log('failed to add', path, 'to index:', e);
            }
        } else {
            if (debugActive) {
                console.log('ignoring unmatched file type:', path);
            }
        }
    })
    .on('unlink', function (path) {
        // when files are removed from the filesystem we should also remove from our index/cache
        if (path.endsWith('.pcap')) {
            try {
                let cid = extractCallIDFromPCAP(path)
                cache.remove(cid);
                console.log('removed call from index due to file removal:', cid);
            } catch (e) {
                console.log('failed to remove file', path, 'from index. error:', e);
            }
        }
    });

// API SETTINGS
app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

// RTPEngine adds a suffix to call ID in the PCAP file name, extract the CID
const extractCallIDFromPCAP = function (path) {
    let cid = path.match(/\/([^\/]+)\/?\.pcap$/)[1];
    cid = decodeURIComponent(cid.substring(0, cid.lastIndexOf('-')));
    return cid;
}

// Homer UI provides a download link when the PCAP lookup was successful, process these download requests
const processDownload = function (req, res) {
    try {
        let data = req.body;
        if (debugActive) {
            console.log('processing download request', JSON.stringify(data), req.url);
        }
        // SECURE: backend should provide a valid token to proceed
        if (data.data.__hep__ && data.data.__hep__[0].token) {
            // valid tokens live in cache
            let pcapPath = tokens.get(data.data.__hep__[0].token);
            if (!pcapPath) {
                console.log('token validation failed');
                res.sendStatus(401);
                return;
            }
            // check file exists and return it
            let stats = fs.statSync(pcapPath);
            if (stats) {
                res.download(pcapPath);
            }
        } else {
            res.sendStatus(404);
        }
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
}

// API metadata & PCAP retrieval - Homer will call this with a call ID
app.post('/get/:action', async function (req, res) {
    // Example request:
    //    {
    //      data: {
    //        sid: [ '101394311-3879497848-1392324686@example.com' ],
    //        source_ip: [
    //          '1.2.3.4',
    //          '2.2.2.2',
    //        ]
    //        "__hep__": [{    <<< present for download requests
    //            "token": "6838ee50-817d-11ed-b83f-57bc29d00545", <<< auth token
    //            "type": "download",
    //            "uuid": "01a8d7a0-812c-11ed-b83f-57bc29d00545"   <<< hepsub agent id
    //        }],
    //      },
    //      fromts: 1670508449000,
    //      tots: 1670509549000
    //    }
    try {
        // valid actions = download / pcap
        switch (req.params.action) {
            case 'download': {
                if (!configDownloadEnabled) {
                    res.sendStatus(500);
                } else {
                    processDownload(req, res);
                }
                return;
            }
            case 'pcap': {
                // check cache for pcap on this host
                let data = req.body;
                if (debugActive) {
                    console.log('incoming pcap lookup request', JSON.stringify(data));
                }
                if (!data.data || !data.data.sid) {
                    res.sendStatus(500);
                    return;
                }

                let found = false;
                let apiResponse = {};

                await Promise.all(data.data.sid.map(async (cid) => {
                    let cached = cache.get(cid);
                    if (cached) {
                        found = true;
                        if (debugActive) {
                            console.log('found Index in Cache', cid, cached);
                        }
                        let cacheData = JSON.parse(cached)
                        if (!cacheData || !cacheData.pcap) {
                            console.log('failed to load metadata from cache, even though object was matched. cache data:', cacheData);
                            return;
                        }
                        apiResponse[cid] = cacheData;
                        apiResponse[cid]['__hep__'] = {};
                        apiResponse[cid]['__hep__'].token = uuidV1(); // generate new access token for download authentication
                        apiResponse[cid]['__hep__'].type = "download";
                        apiResponse[cid]['__hep__'].uuid = agentUUID;
                        // each time we generate a HEP object with a download option, cache the UUID as an access token for the download
                        if (debugActive) {
                            console.log('storing pcap path', cacheData.pcap, 'against token', apiResponse[cid]['__hep__'].token);
                        }
                        tokens.set(apiResponse[cid]['__hep__'].token, cacheData.pcap);
                    }
                }));

                if (found === false) {
                    console.log('404 pcap not found.');
                    res.sendStatus(404);
                    return;
                }

                console.log('200 pcap found.', apiResponse);
                res.send(apiResponse)

                return;
            }
            default: {
                console.log('404 method not allowed.');
                res.sendStatus(405);
                return;
            }
        }
    } catch (e) {
        console.error('pcap lookup failed with error: ', e);
    }
})

app.listen(port, () => console.log('API Server started', port))

// Call the Homer API to register this application for HEP PUB-SUB hooks
const refreshSubscription = function () {
    try {
        settings.uuid = agentUUID;

        let requestOptions = {
            url: homerApiUri,
            method: 'POST',
            json: settings,
            headers: {
                'Auth-Token': homerAuthToken
            }
        }

        if (debugActive) {
            console.log("body:", JSON.stringify(requestOptions));
        }

        request(requestOptions, function (error, response, body) {
            if (!error && (response.statusCode === 200 || response.statusCode === 201)) {
                if (debugActive) {
                    console.log("hepsub session refreshed. response:", body)
                }
            } else {
                if (debugActive) {
                    if (body && body.message) {
                        console.log('hepsub session refresh. error: ', error, 'body:', body.message);
                    } else {
                        console.log('homer subscription error: ', error);
                    }
                }
            }
        });
    } catch (e) {
        console.error('homer subscription failed with error: ', e);
    }
}

// Register with Homer on application start. optional: reregister after 90% session TTL
refreshSubscription();
if (ttl) {
    setInterval(function () {
        refreshSubscription()
    }, (.9 * ttl) * 1000);
}
