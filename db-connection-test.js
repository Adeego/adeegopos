#!/usr/bin/env node
const PouchDB = require('pouchdb');
const DB_PATH = '/home/abdiaziz/.config/adeegopos/database/adeegopos';

async function testConnection() {
  console.log('🔌 Testing AdeegoPOS DB connection...\n');
  
  try {
    const db = new PouchDB(DB_PATH, { adapter: 'leveldb' });
    
    // Get document count
    const result = await db.allDocs({ limit: 0 });
    const totalDocs = result.total_rows;
    
    // Get one sample doc to verify structure
    const sample = await db.allDocs({ include_docs: true, limit: 1 });
    const hasDocs = sample.rows.length > 0;
    
    console.log('✅ CONNECTION SUCCESSFUL\n');
    console.log(`📊 Total documents: ${totalDocs}`);
    console.log(`📄 Sample doc exists: ${hasDocs ? 'Yes' : 'No'}`);
    
    if (hasDocs && sample.rows[0].doc) {
      const doc = sample.rows[0].doc;
      console.log(`📝 Sample doc type: ${doc.type || 'N/A'}`);
      console.log(`🆔 Sample doc _id: ${doc._id || 'N/A'}`);
    }
    
    await db.close();
    console.log('\n🔒 Connection closed cleanly.');
    
  } catch (error) {
    console.error('❌ CONNECTION FAILED\n');
    console.error(`Error: ${error.message}`);
    console.error(`Code: ${error.code || 'N/A'}`);
    process.exit(1);
  }
}

testConnection();
