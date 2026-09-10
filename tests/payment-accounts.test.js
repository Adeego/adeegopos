const test = require('node:test');
const assert = require('node:assert/strict');
const accountService = require('../electron/services/finance/accountService');

test('New Sale receives Cash and M-Pesa in a stable order without finance data', async () => {
  let query;
  const db = {
    find: async (request) => {
      query = request;
      return {
        docs: [
          { _id: 'S1:mpesa', name: 'Mobile Till', accountNumber: 'S1002', accountType: 'Cashier', balance: 800 },
          { _id: 'S1:cash', name: 'Front Drawer', accountNumber: 'S1001', accountType: 'Cashier', balance: 500 },
          { _id: 'S1:other', name: 'Petty Cash', accountNumber: 'S1010', accountType: 'Cashier', balance: 100 },
        ],
      };
    },
  };

  const result = await accountService.getSalePaymentAccounts(db, { storeNo: 'S1' });

  assert.equal(result.success, true);
  assert.equal(query.limit, 9999);
  assert.deepEqual(result.accounts.map((account) => account._id), ['S1:cash', 'S1:mpesa']);
  assert.equal(Object.hasOwn(result.accounts[0], 'balance'), false);
});

test('all-account lookup does not silently stop at PouchDB default page size', async () => {
  let query;
  const db = {
    find: async (request) => {
      query = request;
      return { docs: [] };
    },
  };

  const result = await accountService.getAllAccounts(db, 'S1');

  assert.equal(result.success, true);
  assert.equal(query.limit, 9999);
});
