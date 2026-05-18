#!/usr/bin/env node
const PouchDB = require('pouchdb');
const DB_PATH = '/home/abdiaziz/.config/adeegopos/database/adeegopos';

// January 2026 UTC range (Nairobi UTC+3)
const JAN_START = '2025-12-31T21:00:00.000Z';
const JAN_END = '2026-01-31T20:59:59.999Z';

async function analyze() {
  console.log('January 2026 Analysis');
  const db = new PouchDB(DB_PATH, { adapter: 'leveldb' });
  
  try {
    const result = await db.allDocs({ include_docs: true, limit: 20000 });
    
    const sales = result.rows
      .map(r => r.doc)
      .filter(d => d.type === 'sale' && d.createdAt)
      .filter(d => {
        const dt = new Date(d.createdAt);
        return dt >= new Date(JAN_START) && dt <= new Date(JAN_END);
      });
    
    console.log('Sales found:', sales.length);
    
    if (sales.length === 0) {
      console.log('No January 2026 data found.');
      return;
    }
    
    const revenue = sales.reduce((s, d) => s + (Number(d.totalAmount) || 0), 0);
    const items = {};
    let units = 0;
    
    sales.forEach(sale => {
      (sale.items || []).forEach(i => {
        const name = i.productName || 'Unknown';
        const qty = i.quantity || 0;
        const rev = (i.price || 0) * qty;
        if (!items[name]) items[name] = { units: 0, revenue: 0 };
        items[name].units += qty;
        items[name].revenue += rev;
        units += qty;
      });
    });
    
    const top = Object.entries(items)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10);
    
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('      JANUARY 2026 SUMMARY            ');
    console.log('═══════════════════════════════════════');
    console.log(`Revenue:      KES ${revenue.toFixed(2)}`);
    console.log(`Transactions: ${sales.length}`);
    console.log(`Units:        ${units}`);
    console.log(`Avg Sale:     KES ${(revenue / sales.length).toFixed(2)}`);
    console.log('');
    console.log('TOP PRODUCTS:');
    top.forEach(([n, s], i) => {
      console.log(`${i+1}. ${n}: ${s.units} units, KES ${s.revenue.toFixed(2)}`);
    });
    console.log('═══════════════════════════════════════');
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await db.close();
  }
}

analyze();
