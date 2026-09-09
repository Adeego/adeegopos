const escpos = require('escpos');

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}     ${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function formatNumber(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatCurrency(amount) {
  return `Ksh ${(typeof amount === 'number' ? amount : 0).toFixed(2)}`;
}

function formatPaymentMethod(sale = {}) {
  if (sale.paymentMethod !== 'HYBRID' || !Array.isArray(sale.paymentBreakdown)) return sale.paymentMethod || '';
  return sale.paymentBreakdown.map((payment) => `${payment.method} ${formatCurrency(Number(payment.amount) || 0)}`).join(' + ');
}

function validateSaleData(sale) {
  if (!sale) throw new Error('Sale data is required');
  if (!sale._id) throw new Error('Sale ID is missing');
  if (!Array.isArray(sale.items)) throw new Error('Sale items are missing or invalid');
  if (typeof sale.totalAmount !== 'number') throw new Error('Invalid total amount');
  if (typeof sale.totalItems !== 'number') throw new Error('Invalid total items');
}

function validateAuditData(audit) {
  if (!audit?._id || audit.type !== 'stock-audit') throw new Error('Valid stock audit data is required');
  if (!Array.isArray(audit.items)) throw new Error('Stock audit items are missing or invalid');
  if (!audit.auditDate || !audit.storeNo) throw new Error('Stock audit date and store are required');
}

function renderSale(printer, sale) {
  printer.font('a').align('ct').style('b').size(1, 1)
    .text('ADEEGO MART').text('TELL: 0725970724').text('TILL NO: 4386994')
    .size(0, 0).style('normal').text('SOUTH B, NAIROBI, KE')
    .text(formatDate(sale.createdAt)).text(`Payment: ${formatPaymentMethod(sale)}`)
    .text(`Served By: ${sale.servedBy || ''}`).text('').text('--------------------------------------').font('a');
  sale.items.forEach((item) => {
    printer.tableCustom([
      { text: `${item.quantity || 0} x ${item.name || 'Unknown Item'}`, width: 0.7, align: 'LEFT' },
      { text: formatCurrency(item.subtotal || 0), width: 0.3, align: 'RIGHT' },
    ]).text('');
  });
  printer.text('--------------------------------------').text('')
    .tableCustom([{ text: 'Total', width: 0.7, align: 'LEFT' }, { text: formatCurrency(sale.totalAmount), width: 0.3, align: 'RIGHT' }])
    .tableCustom([{ text: 'Txn Cost', width: 0.7, align: 'LEFT' }, { text: formatCurrency(Number(sale.transactionCost) || 0), width: 0.3, align: 'RIGHT' }])
    .tableCustom([{ text: 'Items', width: 0.7, align: 'LEFT' }, { text: String(sale.totalItems || 0), width: 0.3, align: 'RIGHT' }]);
  if (typeof sale.amountPaid === 'number') printer.tableCustom([{ text: 'Paid', width: 0.7, align: 'LEFT' }, { text: formatCurrency(sale.amountPaid), width: 0.3, align: 'RIGHT' }]);
  if (typeof sale.change === 'number') printer.tableCustom([{ text: 'Change', width: 0.7, align: 'LEFT' }, { text: formatCurrency(sale.change), width: 0.3, align: 'RIGHT' }]);
  printer.text('--------------------------------').text('').align('ct')
    .text('Thank you for shopping with us!').text('Please come again').text('').cut();
}

function renderAuditSheet(printer, audit, kind) {
  const physical = kind === 'physical';
  printer.font('a').align('ct').style('b').size(1, 1)
    .text(physical ? 'PHYSICAL COUNT SHEET' : 'SYSTEM STOCK SHEET')
    .size(0, 0).style('normal')
    .text(`Store: ${audit.storeNo}`)
    .text(`Sales date: ${audit.auditDate}`)
    .text(`Generated: ${formatDate(new Date())}`)
    .text(`Audit: ${audit._id}`)
    .text('--------------------------------------')
    .tableCustom([
      { text: 'ITEM', width: 0.58, align: 'LEFT' },
      { text: 'SOLD', width: 0.17, align: 'RIGHT' },
      { text: physical ? 'ACTUAL' : 'APP', width: 0.25, align: 'RIGHT' },
    ])
    .text('--------------------------------------');
  if (audit.items.length === 0) printer.align('ct').text('No net items sold on this date.').align('lt');
  audit.items.forEach((item) => {
    printer.tableCustom([
      { text: item.productName || 'Unknown product', width: 0.58, align: 'LEFT' },
      { text: formatNumber(item.netSoldQuantity), width: 0.17, align: 'RIGHT' },
      { text: physical ? '________' : formatNumber(item.systemStock), width: 0.25, align: 'RIGHT' },
    ]).text('');
  });
  printer.text('--------------------------------------').text('')
    .text(physical ? 'Counted by: ______________________' : 'Prepared by: _____________________')
    .text('Signature:  ______________________')
    .text('Time:       ______________________')
    .text('').cut();
}

const printQueue = [];
let isPrinting = false;

function openAndPrint(render) {
  return new Promise((resolve, reject) => {
    const configured = global.printer;
    if (!configured?.printer || !configured?.device) {
      reject(new Error('Printer not initialized'));
      return;
    }
    const device = new escpos.Network(configured.device.address, configured.device.port);
    const printer = new escpos.Printer(device);
    device.open((error) => {
      if (error) {
        reject(new Error('Failed to open printer connection'));
        return;
      }
      try {
        render(printer);
        printer.flush();
        device.close(() => resolve());
      } catch (printError) {
        device.close(() => reject(new Error(`Failed to print: ${printError.message}`)));
      }
    });
  });
}

async function processPrintQueue() {
  if (isPrinting || printQueue.length === 0) return;
  isPrinting = true;
  const job = printQueue.shift();
  try {
    await openAndPrint(job.render);
    job.resolve({ success: true, message: job.message });
  } catch (error) {
    console.error('[Printer]', error.message);
    job.resolve({ success: false, error: error.message });
  } finally {
    isPrinting = false;
    processPrintQueue();
  }
}

function enqueue(render, message) {
  return new Promise((resolve) => {
    printQueue.push({ render, message, resolve });
    processPrintQueue();
  });
}

function printReceipt(sale) {
  try {
    validateSaleData(sale);
    return enqueue((printer) => renderSale(printer, sale), 'Receipt printed.');
  } catch (error) {
    return Promise.resolve({ success: false, error: error.message });
  }
}

function printAuditSheets(audit) {
  try {
    validateAuditData(audit);
    return enqueue((printer) => {
      renderAuditSheet(printer, audit, 'system');
      renderAuditSheet(printer, audit, 'physical');
    }, 'System stock and physical count sheets printed.');
  } catch (error) {
    return Promise.resolve({ success: false, error: error.message });
  }
}

module.exports = { printAuditSheets, printReceipt, renderAuditSheet, validateAuditData };
