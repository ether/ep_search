'use strict';

// Main job is to check pads periodically for activity and notify owners
// when someone begins editing and when someone finishes.
const db = require('ep_etherpad-lite/node/db/DB');

// Settings -- EDIT THESE IN settings.json not here..
// var pluginSettings = settings.ep_search;
// var checkFrequency = pluginSettings.checkFrequency || 60000; // 10 seconds

exports.registerRoute = (hookName, args, cb) => {
  args.app.get('/search', async (req, res) => {
    const searchString = req.query.query;
    const result = {};

    try {
      // ueberdb2 v6 is promise-only; the legacy callback-style API silently
      // ignores callbacks and only returns a Promise, so previously this
      // handler hung forever.
      const pads = await db.findKeys('pad:*', '*:*:*');
      for (const pad of pads) {
        const padData = await db.get(pad);
        const padText = (padData && padData.atext && padData.atext.text) || '';
        if (padText.toLowerCase().indexOf(searchString.toLowerCase()) !== -1) {
          result.pad = pad;
        }
      }
      res.send(JSON.stringify(result));
    } catch (err) {
      console.error('ep_search /search failed:', err);
      res.status(500).send(JSON.stringify({error: err.message || String(err)}));
    }
  });
  cb(null);
};
