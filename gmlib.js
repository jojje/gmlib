function GMLib() {
  'use strict';

  // Returns elements matching a provided CSS selector, within either the current document or
  // a provided root node. The returned value is an Array.
  // Same behavior as: https://developer.mozilla.org/en-US/docs/Tools/Web_Console/Helpers#$$
  const $$ = (cssExpr, root) => Array.from((root||document).querySelectorAll(cssExpr));

  function debug(...args) { console.debug('[GMLib]', ...args); }
  function warn(...args) {  console.warn('[GMLib]', ...args); }
  function error(...args) {  console.error('[GMLib]', ...args); }

  // Cross-site request object.
  // Requires granting the following in the script's metadata section:
  // @grant        GM_xmlhttpRequest
  const GMXHR = {
    // Makes a GET request to the specified *url* and returns a Promise yielding the response as a string.
    // Takes an optional set of headers specified as an object of HeaderName: Value pairs.
    get: async function(url, headers) {
      return new Promise(function(resolve, reject){
        debug('GMXHR GET', url);
        GM_xmlhttpRequest({
          method: 'GET',
          url: url,
          headers: headers || undefined,
          onload: function(response) {
            if(response.status >= 200 && response.status < 300) {
              resolve(response.responseText);
            } else {
              error('Failed to get: ', url, ' ('+ response.status +') ', response.statusText);
              reject(response.status);
            }
          }
        });
      });
    },

    // Makes a GET request for HTML content and returns a Promose yielding a DOM element of said document.
    getDoc: async function(url) {
      return this.get(url).then(function(html){
        let p = new DOMParser();
        return p.parseFromString(html, 'text/html');
      });
    },

    // Makes a GET request for JSON content and returns a Promose yielding a deserialized Javascript
    // object of said JSON content.
    getJson: async function(url) {
      const headers = {'Accept': 'application/json, text/plain, */*'};
      return this.get(url, headers).then(function(json){
        return JSON.parse(json);
      });
    }
  };

  // A cache that stores cached objects either in localStorage or in GM (user script) storage.
  // User script storage is not subjected to the volume restrictions of localStorage, and is private to the user script.
  // On the flip side the contents can't be accessed from the browser console, so makes prototyping during development a bit harder.
  //
  // Requires granting special privileges in the user metadata.
  // Add the following metadata lines so the cache can lifecycle it's objects:
  // @grant GM_setValue
  // @grant GM_getValue
  // @grant GM_deleteValue
  // @grant GM_listValues
  //
  // Choosing the backing storage is performed by specifying the name of the storage type upon instantiation of a cache instance.
  // The two supported types are identified by 'local' for local storage and 'script' for user script (GM) storage.
  // Example use:  const cache = Cache('script'); cache.set('key', 'value');
  //
  // Arguments:
  //  storageType: a string which is one of 'local' or 'script'
  //  ttl: number of seconds the items in the cache should be valid for. Past this lifetime, a new call to the function provided
  //       to the *cache* function will be made, and its result cached and returned.
  //  quiet: if set to a truthy value prevents debug logging.
  function Cache(storageType, ttl, quiet) {
    const TTL = (ttl || 3600 * 24 * 2) * 1000; // 2 days by default
    const NAMESPACE = 'gmlib|';
    if (quiet) debug = () => undefined;

    function siteStorage() {
      return {
        get: function(key)        { return localStorage[key];         },
        set: function(key, value) { localStorage[key] = value;        },
        delete: function(key)     { delete localStorage[key];         },
        keys: function()          { return Object.keys(localStorage); }
      };
    }
    function scriptStorage() {
      return {
        get: function(key)        { return GM_getValue(key);          },
        set: function(key, value) { return GM_setValue(key, value);   },
        delete: function(key)     { GM_deleteValue(key);              },
        keys: function()          { return GM_listValues();           }
      };
    }
    function chooseStorage() {
      if (storageType === 'local') return siteStorage();
      else if (storageType === 'script') return scriptStorage();
      else throw 'Invalid storage type! Valid options are "local" or "script"';
    }

    const storage = chooseStorage();

    // Returns a Promise yielding the result of the function *f* unless there is a non-expired value associated with the *key*.
    // In the latter case *f* will not be called and the value is returned directly from the cache.
    // Arguments:
    //   key: a string associated with a cached value.
    //   f: a function (sync or async) which returns either the value to be associated with the *key*, or a promise which yields said value.
    // Returns:
    //   A promise yielding either the cached value or the result of *f*.
    async function cache(key, f) {
      return new Promise(async resolve => {

        // If item is fresh and in cache, return cached value
        const itemJson = storage.get(NAMESPACE + key);
        if (itemJson) {
          const item = JSON.parse(itemJson);
          const since = new Date().getTime() - item.stored;
          const expired = since > TTL;
          if (!expired) {
            resolve(item.value);
            return;
          }
        }

        // Either not in cache or expired, so try to refresh
        debug(`Cache miss for key "${key}", calling`, f);
        let value = f();
        if(value instanceof Promise) value = await value;

        if (value !== undefined && value !== null) {
          storage.set(NAMESPACE + key, JSON.stringify({
            stored: new Date().getTime(),
            value: value
          }));
        } else {
          warn('Cache: WARNING Refusing to cache null or undefined return value of ', f);
        }
        resolve(value);
      });
    }

    cache.clear = function clear(prefix) {
      if (prefix) debug('Cache: Clearing all cached items with prefix:', prefix);
      else        debug('Cache: Clearing all cached items');
      const keyPrefix = NAMESPACE + (prefix||'');
      storage.keys().filter(k => k.startsWith(keyPrefix)).forEach(storage.delete);
    };

    return cache;
  }

  return {$$, GMXHR, Cache};
}