const Realm = require('realm');

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

async function openRealmWithSync(schemas) {
  const user = await authenticateUser();
  const config = {
    schema: schemas,
    sync: {
      user: user,
      flexible: true,
      initialSubscriptions: {
        update: (subs, realm) => {
          // Add subscriptions for each object type
          schemas.forEach(schema => {
            subs.add(realm.objects(schema.name));
          });
        },
      },
    },
  };
  return Realm.open(config);
}

module.exports = {
  openRealmWithSync,
};