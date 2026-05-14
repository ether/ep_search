'use strict';

// Main job is to check pads periodically for activity and notify owners
// when someone begins editing and when someone finishes.
const db = require('ep_etherpad-lite/node/db/DB').db;
const async = require('ep_etherpad-lite/node_modules/async');
const log4js = require('ep_etherpad-lite/node_modules/log4js');
const logger = log4js.getLogger('ep_search');

// Settings -- EDIT THESE IN settings.json not here..
// var pluginSettings = settings.ep_search;
// var checkFrequency = pluginSettings.checkFrequency || 60000; // 10 seconds
const SEARCH_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const SEARCH_MAX_REQUESTS_PER_WINDOW = 10;
const ipRequestCounts = {};

const checkRateLimit = (ip) => {
  const now = Date.now();
  if (!ipRequestCounts[ip] || now - ipRequestCounts[ip].windowStart > SEARCH_RATE_LIMIT_WINDOW_MS) {
    ipRequestCounts[ip] = {windowStart: now, count: 0};
  }
  ipRequestCounts[ip].count++;
  return ipRequestCounts[ip].count > SEARCH_MAX_REQUESTS_PER_WINDOW;
};

const ipCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of Object.entries(ipRequestCounts)) {
    if (now - data.windowStart > SEARCH_RATE_LIMIT_WINDOW_MS * 2) delete ipRequestCounts[ip];
  }
}, 5 * 60 * 1000);
ipCleanup.unref();

exports.registerRoute = (hookName, args, cb) => {
  args.app.get('/search', (req, res) => {
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    if (checkRateLimit(clientIp)) {
      logger.warn(`Search rate limit exceeded for ${clientIp}`);
      return res.status(429).json({error: 'Rate limit exceeded'});
    }

    const searchString = (req.query.query || '').toLowerCase();
    const result = [];

    if (!searchString) {
      return res.json(result);
    }

    db.findKeys('pad:*', '*:*:*', (err, pads) => { // get all pads
      async.forEachSeries(pads, (pad, callback) => {
        db.get(pad, (err, padData) => { // get the pad contents
          const padText = padData?.atext?.text || '';
          // does searchString exist in aText?
          if (padText.toLowerCase().indexOf(searchString) !== -1) {
            result.push(pad);
          }
          callback();
        });
      }, (err) => {
        res.json(result);
      });
    });
  });
  cb(null);
};
