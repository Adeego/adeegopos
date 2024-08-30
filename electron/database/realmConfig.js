const Realm = require('realm');
const path = require('path');
const { app } = require('electron');
const { CustomerSchema, ProductSchema, ProductVariantSchema, SupplierSchema, SaleSchema, SaleItemSchema } = require('./schemas');
const migrationFunction = require('./migrations');

const schemaVersion = 7;

async function initializeRealm() {
  try {
    const realm = await Realm.open({
      schema: [CustomerSchema, ProductSchema, ProductVariantSchema, SupplierSchema, SaleSchema, SaleItemSchema],
      schemaVersion: schemaVersion,
      path: path.join(app.getPath('userData'), 'myRealm.realm'),
      migration: migrationFunction,
    });
    console.log("Realm initialized successfully");
    return realm;
  } catch (error) {
    console.error("Failed to initialize Realm:", error);
    throw error;
  }
}

module.exports = { initializeRealm };
