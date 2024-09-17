const Store = require('electron-store');

const store = new Store();

module.exports = {
  getStoreNo: () => store.get('storeNo', ''),
  setStoreNo: (storeNo) => store.set('storeNo', storeNo),
};
const Store = require('electron-store');

const store = new Store();

module.exports = {
  getStoreNo: () => store.get('storeNo', ''),
  setStoreNo: (storeNo) => store.set('storeNo', storeNo),
};
