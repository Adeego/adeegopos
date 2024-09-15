const Realm = require('realm');
const {
  WholeSalerSchema,
  CustomerSchema,
  ProductSchema,
  ProductVariantSchema,
  SupplierSchema,
  SaleItemSchema,
  SaleSchema,
  StaffSchema
} = require('./database/schemas');

const APP_ID = 'adeegopos-zhwkaqj';

async function getRealmApp() {
  let app;
  try {
    app = Realm.App.getApp(APP_ID);
  } catch (error) {
    app = new Realm.App({ id: APP_ID });
  }
  return app;
}

async function authenticateUser() {
  const app = await getRealmApp();
  if (!app.currentUser) {
    // For this example, we'll use anonymous authentication
    // In a real app, you'd want to use a more secure method
    await app.logIn(Realm.Credentials.anonymous());
  }
  return app.currentUser;
}

async function openRealmWithSync() {
  const user = await authenticateUser();
  const config = {
    schema: [
      WholeSalerSchema,
      CustomerSchema,
      ProductSchema,
      ProductVariantSchema,
      SupplierSchema,
      SaleItemSchema,
      SaleSchema,
      StaffSchema
    ],
    sync: {
      user: user,
      flexible: true,
      newRealmFileBehavior: {
        type: 'downloadBeforeOpen',
        timeOut: 60000, // 60 seconds timeout for initial download
        timeOutBehavior: 'openLocalRealm',
      },
      existingRealmFileBehavior: {
        type: 'openImmediately',
        timeOutBehavior: 'openLocalRealm',
      },
      clientReset: {
        mode: 'recoverOrDiscardUnsyncedChanges',
      },
      initialSubscriptions: {
        update: (subs, realm) => {
          // Add subscriptions for each object type
          [
            WholeSalerSchema,
            CustomerSchema,
            ProductSchema,
            ProductVariantSchema,
            SupplierSchema,
            SaleItemSchema,
            SaleSchema,
            StaffSchema
          ].forEach(schema => {
            subs.add(realm.objects(schema.name));
          });
        },
        rerunOnOpen: true,
      },
    },
  };

  try {
    const realm = await Realm.open(config);
    console.log('Realm opened successfully with sync');
    return realm;
  } catch (error) {
    console.error('Failed to open Realm with sync:', error);
    throw error;
  }
}

module.exports = {
  openRealmWithSync,
};
