# GMLib
A library with fundamental functions needed by most of my _Greasemonkey/Tampermonkey_ scripts.

It provides the following functions:
1. *cross-site request function*, that is not subject to CORS rules and leverages GM_xmlHttpRequest.
2. *TTL cache* so that you don't need to hammer sites with redundant requests, and allows the user script quickly access auxiliary data from other sites.
3. *QuerySelector alias* for the Firefix/Chrome built-in `$$` function, for reducing the boiler plate code otherwise needed when searching for DOM elements.

The library is kept to a minimum, containing only the absolute top set of functions I've re-implemented at least 5 times over the last 15 years. Any new function will only be added once I've noticed a clear pattern that the function is essential most of the time.

It's published to allow me to source it in new user scripts and save a lot of boiler plate typing.

## Function signatures

* `GMLib() -> {$$, GMXHR, Cache}`, returns an object with all contained functions that can be deconstructed (subset chosen) as needed by the user script: .
* `$$(cssExpr: String, [root: HTMLElement]) -> Array`, returns an array of zero or more matched DOM elements.
* `GMXHR`is a container (object) for a number of request functions. The request functions have the signatures:
  * `get(url: String) -> String`, returns a Promise yielding the HTML string content of the requested URL.
  * `getDoc(url: String) -> HTMLDocument`, returns a Promise yielding a DOM document of the requested URL. Suitable for extracting data from remote web pages.
  * `getJson(url: String) -> object`, returns a Promise yielding a deserialized JSON document (object) from the requested URL.
* `Cache(storageType: String, [ttl: Number]) -> cache`, returns an instance (function) of a cache backed by a particular storage. The valid storage types are `local` for _localStorage_ and `script` for GM/user script storage. The optional `ttl` argument is the number of seconds a cached item is valid. When ttl is omitted, the default cache duration is 2 days. The returned cache instance has the following signature:
  * `cache(key: String, f: [async] function) -> Any`, where `key` is a string associated with the cached value and `f` is a function that returns or yields the value that should be cached. When invoking the cache function, the provided `f` function will only be called if there is no non-expired value in the cache for the `key`. In all cases the return value of either `f` or a previous call to `f` with the same key will be returned by the cache call.

The cache can also be cleared entirely or partly by calling `clear([prefix])` on the cache function itself. The optional prefix allows for removal of only the cache entries which have the specified prefix. When prefix is omitted, all cached items are removed.

## Privileges
Depending on which features are used, different privileges need to be granted the user script.
The required privileges for the functions are listed below.

* `$$`: None.
* `GMXHR`: GM_xmlhttpRequest.
* `Cache('local')`: None
* `Cache('script')`: GM_setValue, GM_getValue, GM_deleteValue, GM_listValues.

## Usage

An encompassing example which uses the functions together in order to extract the aggregate review rating of Death Stranding from IMDB.
```javascript
// ==UserScript==
// @name         GMLib usage example
// @version      0.1
// @namespace    https://github.com/jojje/gmlib
// @require      https://raw.githubusercontent.com/jojje/gmlib/master/gmlib.js
// @match        https://some.site/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// ==/UserScript==

(async function() {
  'use strict';

  const {GMXHR, $$, Cache} = GMLib();

  async function fetchImdbRating(url) {
    const doc = await GMXHR.getDoc(url);
    const rating = $$('span[itemprop="ratingValue"]', doc)[0].textContent;
    return rating;
  }

  const url = 'https://www.imdb.com/title/tt5807606/';
  console.info( 'IMDB rating for Death Stranding:', await fetchImdbRating(url) );

  // Use with script cache (GM storage)
  const cache = Cache('script');

  console.info('== calling with cache ==');
  console.info( 'IMDB rating for Death Stranding:', await cache('some-key', () => fetchImdbRating(url)) );
  console.info( 'IMDB rating for Death Stranding:', await cache('some-key', () => fetchImdbRating(url)) );

  cache.clear();

  console.info('== call the cached function again and expect a cache miss ==');
  console.info( 'IMDB rating for Death Stranding:', await cache('some-key', () => fetchImdbRating(url)) );
})();
```

The corresponding console output:
```
[GMLib] GMXHR GET https://www.imdb.com/title/tt5807606/
IMDB rating for Death Stranding: 8.9

== calling with cache ==
[GMLib] Cache Miss for key "some-key", calling () => fetchImdbRating(url)
[GMLib] GMXHR GET https://www.imdb.com/title/tt5807606/
IMDB rating for Death Stranding: 8.9
IMDB rating for Death Stranding: 8.9

[GMLib] Cache: Clearing all cached items

== call the cached function again and expect a cache miss ==
[GMLib] Cache Miss for key "some-key", calling () => fetchImdbRating(url)
[GMLib] GMXHR GET https://www.imdb.com/title/tt5807606/
IMDB rating for Death Stranding: 8.9
```