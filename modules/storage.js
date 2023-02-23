const set = window.browser ?
  item => browser.storage.sync.set(item) :
  item => new Promise(resolve => chrome.storage.sync.set(item, resolve));

const get = window.browser ?
  key => browser.storage.sync.get(key) :
  key => new Promise(resolve => chrome.storage.sync.get(key, resolve));

/**
 * Get and item from Chrome storage and execute a callback function on it
 * @param {String} item
 * @param {Function} fn
 */
function gotchem(item, fn) {
  get([item]).then(r => {
    fn(r?.[item]);
  });
}

export default {
  set,
  get,
  gotchem,
};

export { gotchem };
