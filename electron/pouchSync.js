const PouchDB = require("pouchdb");
PouchDB.plugin(require("pouchdb-find"));

const COUCHDB_URL = "http://admin:adeego2027@127.0.0.1:5984/wholesalers";

function openPouchDB(storeNo) {
  const localDB = new PouchDB(storeNo);

  // Define the index fields for products
  const productIndexFields = ['name', 'state', 'type'];
  // Define the index fields for customers
  const customerIndexFields = ['name', 'phoneNumber', 'state', 'type', 'createdAt'];

  // Check if the product index already exists
  localDB.getIndexes().then((result) => {
    const productIndexExists = result.indexes.some(index => 
      index.def && index.def.fields && index.def.fields.length === productIndexFields.length &&
      index.def.fields.every((field, i) => field === productIndexFields[i])
    );

    if (!productIndexExists) {
      // Create the product index if it does not exist
      return localDB.createIndex({
        index: {
          fields: productIndexFields
        }
      }).then(() => {
        console.log('Product index created successfully');
      }).catch((error) => {
        console.error('Error creating product index:', error);
      });
    } else {
      console.log('Product index already exists');
    }
  }).catch((error) => {
    console.error('Error checking product indexes:', error);
  });

  // Check if the customer index already exists
  localDB.getIndexes().then((result) => {
    const customerIndexExists = result.indexes.some(index => 
      index.def && index.def.fields && index.def.fields.length === customerIndexFields.length &&
      index.def.fields.every((field, i) => field === customerIndexFields[i])
    );

    if (!customerIndexExists) {
      // Create the customer index if it does not exist
      return localDB.createIndex({
        index: {
          fields: customerIndexFields
        }
      }).then(() => {
        console.log('Customer index created successfully');
      }).catch((error) => {
        console.error('Error creating customer index:', error);
      });
    } else {
      console.log('Customer index already exists');
    }
  }).catch((error) => {
    console.error('Error checking customer indexes:', error);
  });

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
