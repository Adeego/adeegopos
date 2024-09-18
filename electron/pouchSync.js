const PouchDB = require("pouchdb");
PouchDB.plugin(require("pouchdb-find"));

const COUCHDB_URL = "http://admin:adeego2027@127.0.0.1:5984/wholesalers";

function openPouchDB(storeNo) {
  const localDB = new PouchDB(storeNo, { auto_compaction: true });

  // const remoteDB = new PouchDB(`${COUCHDB_URL}?partition=${storeNo}`);

  localDB
    .sync(`${COUCHDB_URL}?partition=${storeNo}`, {
      live: true,
      retry: true,
    })
    .on("change", function (info) {
      console.log("Sync change:", info);
    })
    .on("error", function (err) {
      console.error("Sync error:", err);
    });

  return localDB;
}

module.exports = {
  openPouchDB,
};
