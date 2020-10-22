/*
 * HEP-PUBSUB Interface Controller
 * RTP:Engine Integration (metafile-based)
 * (C) 2020 QXIP BV
 */

try {
  var config = require('./config.js');
} catch(e) { console.log('Missing config!',e); process.exit(1); }

var LRU = require('lru');
var cache = new LRU({ max: 1000 });
var tokens = new LRU({ max: 100, maxAge: 30000 });

const chokidar = require('chokidar');
const fs = require('fs');

var express = require('express');
const app = express();
const util = require('util')
const request = require('request');
var bodyParser = require("body-parser");
app.use(bodyParser.json());

var port = config.service.port;
var debug = config.debug || false;

const requestPromise = util.promisify(request);

// INDEXING Bakend for RTPEngine Meta files
const watcher = chokidar.watch('/recording', {ignored: /^\./, persistent: true });
watcher
    .on('error', function(error) {console.error('Error happened', error);})
    .on('add', function(path) {
		if (debug) console.log('File', path, 'has been added');
		if (path.endsWith('.pcap')){
			var index = {};
			index.pcap = path;
			try { index.cid = path.match(/\/([^\/]+)\/?\.pcap$/)[1].split('-')[0]; } catch(e) { console.log(e); }
			var stats = fs.statSync(index.pcap);
			var datenow = stats.mtime ? new Date(stats.mtime).getTime() : new Date().getTime();
			index.t_sec = Math.floor( datenow / 1000);
			index.u_sec = ( datenow - (index.t_sec*1000))*1000;
			if (debug) console.log('PCAP Hit!', index);
			cache.set(index.cid, JSON.stringify(index));
		} else {
			if (debug) console.log('unmatched type/path', path);
		}
    })
    // .on('change', function(path) {console.log('File', path, 'has been changed'); })
    .on('unlink', function(path) { if (debug) console.log('File', path, 'has been removed. Indexing!');
	   if(path.includes('rtpengine-meta')){
                	var index = {}; // Recording Object
			index.meta = path;
                	index.meta = index.meta.replace(/tmp\//i, 'metadata/');
                	index.meta = index.meta.replace(/\.tmp/i, '.txt');
                	index.pcap = path;
                	index.pcap = index.pcap.replace(/tmp\/rtpengine-meta-/i, 'pcaps/');
                	index.pcap = index.pcap.replace(/\.tmp/i, '.pcap');

			try { index.cid = path.match(/\/([^\/]+)\/?\.tmp$/)[1].split('-')[2]; } catch(e) { index.cid = false; }
			var stats = fs.statSync(index.pcap);
			var datenow = stats.mtime ? new Date(stats.mtime).getTime() : new Date().getTime();
			index.t_sec = Math.floor( datenow / 1000);
			index.u_sec = ( datenow - (index.t_sec*1000))*1000;
			if (debug) console.log('Meta Hit!', index);
			cache.set(index.cid, JSON.stringify(index));
	   }
    });


// API SETTINGS
app.all('*', function(req, res, next) {
   res.header("Access-Control-Allow-Origin", "*");
   res.header("Access-Control-Allow-Headers", "X-Requested-With");
   next();
});

// HEP Post Paths
app.post('/get/:id', async function (req, res) {
  try {
	  var apiresponse = {};
	  var data = req.body;
	  if (debug) console.log('NEW API POST REQ', JSON.stringify(data));
	  // API ban relay
	  if (data.data.sid) {
	    await Promise.all(data.data.sid.map(async (cid) => {
	    	var cached = cache.get(cid);
	    	if (cached) {
                        if (debug) console.log('Found Index in Cache',cid,cached);
			apiresponse[cid] = JSON.parse(cached) || cached;
		}
	    }));
            if (debug) console.log('API RESPONSE',apiresponse);
	    apiresponse.token = uuidv1();
	    tokens.set(apiresponse.token, cid);
	    res.send(apiresponse)
	  } else { res.sendStatus(500); }
  } catch(e) { console.error(e) }
})


// DOWNLOAD API
if (config.rtpengine.download) {
  if (config.rtpengine.insecure) {
    // THIS IS INSECURE - USE FOR TESTING OR AT YOUR OWN RISK!
    app.all('/recording/pcaps/:file', async function (req, res) {
    try {
	var data = req.body;
	if (debug) console.log('NEW DOWNLOAD REQ', JSON.stringify(data), req.params.file, req.url);
  	if(req.params.file){
		var fullPath = req.url || req.params.file;
		var stats = fs.statSync(fullPath);
		if (stats) { res.download(fullPath, req.params.file); }
	} else { res.sendStatus(404); }
    } catch(e) { console.error(e); res.sendStatus(500); }
    });
  } else {
    // THIS IS LESS INSECURE = REQUIRES BACK A TEMPORARY TOKEN PROVIDED WITH THE ORIGINAL API RESPONSE
    app.post('/recording/pcaps/:file', async function (req, res) {
    try {
	var data = req.body;
	if (debug) console.log('NEW DOWNLOAD REQ', JSON.stringify(data), req.params.file, req.url);
	// INSECURE: backend should provide an auth token to proceed in the JSON body
  	if(req.params.file && data.token){
		// validate ephemeral token
		var token = tokens.get(data.token);
		if (!token) { res.sendStatus(401); return; }
		var fullPath = req.url || req.params.file;
		var stats = fs.statSync(fullPath);
		if (stats) { res.download(fullPath, req.params.file); }
	} else { res.sendStatus(404); }
    } catch(e) { console.error(e); res.sendStatus(500); }
    });

  }
}

app.listen(port, () => console.log('API Server started',port))


// HEP PUBSUB Hooks
var api = config.backend;
const uuidv1 = require('uuid/v1');
var uuid = uuidv1();
var ttl = config.service.ttl;
var token = config.token;

var publish = function(){
  try {
    var settings = config.service;
    settings.uuid = uuid;
    const data = JSON.stringify(settings)
    const options = {
        url: api,
        method: 'POST',
        json: settings,
        headers: {
          'Auth-Token': token
        }
    }

    if (debug) console.log("Body:", JSON.stringify(options));

    request(options, function (error, response, body) {
        if (!error && (response.statusCode == 200 || response.statusCode == 201)) {
            if (debug) {
                console.log("RESPONSE API:", body) // Print the shortened url.
            }
        } else {
            if (debug) {
                if(body && body.message) console.log('REGISTER API ERROR: ', body.message);
                else console.log('REGISTER UNKNOWN ERROR: ', error);
            }
        }
    });

  } catch(e) { console.error(e) }
}

/* REGISTER SERVICE w/ TTL REFRESH */
if (ttl) {
	publish();
	/* REGISTER LOOP */
	setInterval(function() {
	   publish()
	}, (.9 * ttl)*1000 );
}

/* END */


