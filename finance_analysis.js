const PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));

const dbPath = '/home/abdiaziz/.config/adeegopos/database/adeegopos';
const db = new PouchDB(dbPath, { adapter: 'leveldb' });

async function analyze() {
  try {
    const allDocs = await db.allDocs({ include_docs: true });

    // Range for January 2026
    const startOfJan = "2026-01-01T00:00:00.000Z";
    const endOfJan = "2026-01-31T23:59:59.999Z";

    let janSales = 0;
    let janSalesCount = 0;
    let janCOGS = 0;
    let janExpenses = 0;
    let janPaymentMethods = { CASH: 0, MPESA: 0, CREDIT: 0 };

    allDocs.rows.forEach(row => {
      const doc = row.doc;
      if (doc.state === 'Active' && doc.createdAt >= startOfJan && doc.createdAt <= endOfJan) {
        if (doc.type === 'sale') {
          janSalesCount++;
          janSales += Number(doc.totalAmount) || 0;
          janPaymentMethods[doc.paymentMethod] = (janPaymentMethods[doc.paymentMethod] || 0) + (Number(doc.totalAmount) || 0);
          
          (doc.items || []).forEach(item => {
            janCOGS += (Number(item.quantity) || 0) * (Number(item.buyPrice) || 0);
          });
        }
        if (doc.type === 'expense') {
          janExpenses += Number(doc.amount) || 0;
        }
      }
    });

    // 6. Check for Slack plugin
    let slackEnabled = false;
    allDocs.rows.forEach(row => {
      const doc = row.doc;
      if (doc._id === 'plugin:slack') {
         slackEnabled = true;
      }
    });
    console.log("Slack plugin found in DB:", slackEnabled);

  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}

analyze();
