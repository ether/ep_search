// Main job is to check pads periodically for activity and notify owners when someone begins editing and when someone finishes. 
var db = require('ep_etherpad-lite/node/db/DB').db;
var async = require('ep_etherpad-lite/node_modules/async');

// Settings -- EDIT THESE IN settings.json not here..
// var pluginSettings = settings.ep_search;
// var checkFrequency = pluginSettings.checkFrequency || 60000; // 10 seconds

exports.registerRoute = function (hook_name, args, cb) {

  args.app.get('/search', function(req, res) {

    var searchString = req.query["query"];
    var result = {};

    db.findKeys("pad:*", "*:*:*", function(err, pads){ // get all pads

      async.forEachSeries(pads, function(pad, callback){

        db.get(pad, function(err, padData){ // get the pad contents
          var padText = padData.atext.text || "";
          // does searchString exist in aText?
          if (padText.toLowerCase().indexOf(searchString) !== -1) {
            result.pad = pad;
          }
          callback();
        });
       
      }, function(err){
        res.send(JSON.stringify(result));
      });

    });

  });

};
