'use strict';

// Main job is to check pads periodically for activity and notify owners
// when someone begins editing and when someone finishes.
const db = require('ep_etherpad-lite/node/db/DB').db;
const async = require('ep_etherpad-lite/node_modules/async');

// Settings -- EDIT THESE IN settings.json not here..
// var pluginSettings = settings.ep_search;
// var checkFrequency = pluginSettings.checkFrequency || 60000; // 10 seconds

exports.registerRoute = (hookName, args, cb) => {
  args.app.get('/search', (req, res) => {
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
