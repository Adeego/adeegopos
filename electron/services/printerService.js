const { PosPrinter } = require('@plick/electron-pos-printer');

const printOptions = {
  preview: false,
  margin: '0 0 0 0',
  copies: 1,
  printerName: 'ADEEGO',
  timeOutPerLine: 400,
  pageSize: '80mm',
  silent: false
};

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleString();
}

function formatCurrency(amount) {
  if (typeof amount !== 'number') return '0.00';
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
}

function validateSaleData(sale) {
  if (!sale) throw new Error('Sale data is required');
  if (!sale._id) throw new Error('Sale ID is missing');
  if (!sale.items || !Array.isArray(sale.items)) throw new Error('Sale items are missing or invalid');
  if (typeof sale.totalAmount !== 'number') throw new Error('Invalid total amount');
  if (typeof sale.totalItems !== 'number') throw new Error('Invalid total items');
  return true;
}

async function printReceipt(sale) {
  try {
    // Validate sale data
    validateSaleData(sale);

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
        value: `Payment Method: ${sale.paymentMethod || 'N/A'}`,
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
          { type: 'text', value: item.name || 'Unknown Item' },
          { type: 'text', value: (item.quantity || 0).toString() },
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

    // Attempt to print
    await PosPrinter.print(printData, printOptions);
    return { success: true };
  } catch (error) {
    // Log the error but don't print it
    console.error('Printing error:', error.message);
    
    // Return a user-friendly error message
    return { 
      success: false, 
      error: 'Failed to print receipt. Please check printer connection and try again.'
    };
  }
}

module.exports = {
  printReceipt
};
