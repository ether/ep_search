const eejs = require('ep_etherpad-lite/node/eejs');

exports.eejsBlock_indexWrapper = function (hook_name, args, cb) {
  args.content += eejs.require('ep_search/templates/search.html', {}, module);
  return cb();
};
