const { PosPrinter } = require('@plick/electron-pos-printer');

const printOptions = {
  preview: false,
  margin: '0 0 0 0',
  copies: 1,
  printerName: 'XP-80C', // Change this to match your printer name
  timeOutPerLine: 400,
  pageSize: '80mm',
  silent: true
};

function formatDate(date) {
  return new Date(date).toLocaleString();
}

function formatCurrency(amount) {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
}

async function printReceipt(sale) {
  const printData = [
    {
      type: 'text',
      value: 'ADEEGO POS',
      style: { fontWeight: '700', textAlign: 'center', fontSize: '24px' }
    },
    {
      type: 'text',
      value: '--------------------------------',
      style: { textAlign: 'center' }
    },
    {
      type: 'text',
      value: `Sale ID: ${sale._id}`,
      style: { fontSize: '12px' }
    },
    {
      type: 'text',
      value: `Date: ${formatDate(sale.createdAt)}`,
      style: { fontSize: '12px' }
    },
    {
      type: 'text',
      value: `Payment Method: ${sale.paymentMethod}`,
      style: { fontSize: '12px' }
    },
    {
      type: 'text',
      value: '--------------------------------',
      style: { textAlign: 'center' }
    },
    {
      type: 'table',
      style: { border: '1px solid #ddd' },
      tableHeader: [
        { type: 'text', value: 'Item' },
        { type: 'text', value: 'Qty' },
        { type: 'text', value: 'Price' },
        { type: 'text', value: 'Total' }
      ],
      tableBody: sale.items.map(item => [
        { type: 'text', value: item.name },
        { type: 'text', value: item.quantity.toString() },
        { type: 'text', value: formatCurrency(item.unitPrice) },
        { type: 'text', value: formatCurrency(item.subtotal) }
      ]),
      tableFooter: [
        [
          { type: 'text', value: 'Total Items:' },
          { type: 'text', value: sale.totalItems.toString() },
          { type: 'text', value: 'Total:' },
          { type: 'text', value: formatCurrency(sale.totalAmount) }
        ]
      ],
      tableHeaderStyle: { backgroundColor: '#000', color: 'white' },
      tableBodyStyle: { border: '0.5px solid #ddd' },
      tableFooterStyle: { backgroundColor: '#000', color: 'white' }
    },
    {
      type: 'text',
      value: '--------------------------------',
      style: { textAlign: 'center' }
    },
    {
      type: 'text',
      value: 'Thank you for your business!',
      style: { textAlign: 'center', fontWeight: '700', fontSize: '14px' }
    },
    {
      type: 'text',
      value: 'Please come again',
      style: { textAlign: 'center', fontSize: '12px' }
    }
  ];

  try {
    await PosPrinter.print(printData, printOptions);
    return { success: true };
  } catch (error) {
    console.error('Printing error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  printReceipt
};
