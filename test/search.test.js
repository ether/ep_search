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
    if (request === 'ep_etherpad-lite/node_modules/log4js') {
      return {getLogger: () => ({warn: NO_OP})};
    }
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

const runSearch = async (plugin, query, ip = '127.0.0.1') => {
  let handler;
  plugin.registerRoute(null, {
    app: {
      get: (route, routeHandler) => {
        assert.equal(route, '/search');
        handler = routeHandler;
      },
    },
  }, NO_OP);

  return new Promise((resolve) => {
    const response = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({status: this.statusCode, body});
      },
    };
    handler({query: {query}, ip}, response);
  });
};

const expectSearchBody = async (plugin, query, ip) => {
  const {status, body} = await runSearch(plugin, query, ip);
  assert.equal(status, 200);
  return body;
};

const searchReturnsEveryMatchingPad = async () => {
  const {plugin} = loadPlugin({
    'pad:first': {atext: {text: 'needle in the first pad'}},
    'pad:second': {atext: {text: 'Needle in the second pad'}},
    'pad:third': {atext: {text: 'does not match'}},
  });

  assert.deepEqual(
      await expectSearchBody(plugin, 'needle', 'matching-ip'),
      ['pad:first', 'pad:second'],
  );
};

const emptySearchesShortCircuit = async () => {
  const {findKeysCalls, plugin} = loadPlugin({
    'pad:first': {atext: {text: 'needle in the first pad'}},
  });

  assert.deepEqual(await expectSearchBody(plugin, '', 'empty-ip'), []);
  assert.equal(findKeysCalls(), 0);
};

const rateLimitingReturns429 = async () => {
  const {plugin} = loadPlugin({
    'pad:first': {atext: {text: 'needle in the first pad'}},
  });

  for (let i = 0; i < 10; i++) {
    const {status} = await runSearch(plugin, 'needle', 'rate-limited-ip');
    assert.equal(status, 200);
  }

  const {status, body} = await runSearch(plugin, 'needle', 'rate-limited-ip');
  assert.equal(status, 429);
  assert.deepEqual(body, {error: 'Rate limit exceeded'});
};

(async () => {
  await searchReturnsEveryMatchingPad();
  await emptySearchesShortCircuit();
  await rateLimitingReturns429();
  console.log('search tests passed');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
