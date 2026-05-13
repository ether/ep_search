'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'index.js');
const NO_OP = () => {};

const loadPlugin = (pads) => {
  let findKeysCalls = 0;
  const fakeDb = {
    findKeys: (key, pattern, callback) => {
      findKeysCalls++;
      callback(null, Object.keys(pads));
    },
    get: (pad, callback) => callback(null, pads[pad]),
  };
  const fakeAsync = {
    forEachSeries: (items, iterator, done) => {
      let itemIndex = 0;
      const next = (err) => {
        if (err != null || itemIndex >= items.length) return done(err);
        iterator(items[itemIndex++], next);
      };
      next();
    },
  };

  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'ep_etherpad-lite/node/db/DB') return {db: fakeDb};
    if (request === 'ep_etherpad-lite/node_modules/async') return fakeAsync;
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[indexPath];
  const plugin = require(indexPath);
  Module._load = originalLoad;

  return {
    findKeysCalls: () => findKeysCalls,
    plugin,
  };
};

const runSearch = async (plugin, query) => {
  let handler;
  plugin.registerRoute(null, {
    app: {
      get: (route, routeHandler) => {
        assert.equal(route, '/search');
        handler = routeHandler;
      },
    },
  }, NO_OP);

  return await new Promise((resolve) => {
    handler({query: {query}}, {
      json: (body) => resolve(body),
    });
  });
};

const searchReturnsEveryMatchingPad = async () => {
  const {plugin} = loadPlugin({
    'pad:first': {atext: {text: 'needle in the first pad'}},
    'pad:second': {atext: {text: 'Needle in the second pad'}},
    'pad:third': {atext: {text: 'does not match'}},
  });

  assert.deepEqual(await runSearch(plugin, 'needle'), ['pad:first', 'pad:second']);
};

const emptySearchesShortCircuit = async () => {
  const {findKeysCalls, plugin} = loadPlugin({
    'pad:first': {atext: {text: 'needle in the first pad'}},
  });

  assert.deepEqual(await runSearch(plugin, ''), []);
  assert.equal(findKeysCalls(), 0);
};

(async () => {
  await searchReturnsEveryMatchingPad();
  await emptySearchesShortCircuit();
  console.log('search tests passed');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
