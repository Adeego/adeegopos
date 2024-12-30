const escpos = require('escpos');

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}     ${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function formatCurrency(amount) {
  if (typeof amount !== 'number') return '$0.00';
  return `$${amount.toFixed(2)}`;
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

    // Get the printer instance from the main process
    const { printer, device } = global.printer;
    if (!printer || !device) {
      throw new Error('Printer not initialized');
    }

    return new Promise((resolve, reject) => {
      device.open(function(error) {
        if(error) {
          console.error('Error opening printer:', error);
          reject({ success: false, error: 'Failed to open printer connection' });
          return;
        }

        try {
          // Store header
          printer
            .font('a')
            .align('ct')
            .style('b')
            .size(1, 1)
            .text('ADEEGO POS')
            .size(0, 0)
            .style('normal')
            .text('123 Main St, Anytown, USA')
            .text(formatDate(sale.createdAt))
            .text('') // Empty line for spacing

          // Print items using table
          sale.items.forEach(item => {
            const quantity = item.quantity || 0;
            const name = item.name || 'Unknown Item';
            const total = formatCurrency(item.subtotal || 0);
            
            printer.tableCustom([
              { text: `${quantity} x ${name}`, width: 0.7, align: 'LEFT' },
              { text: total, width: 0.3, align: 'RIGHT' }
            ]);
          });

          // Print totals
          const tax = sale.totalAmount * 0.08; // 8% tax
          const subtotal = sale.totalAmount - tax;

          printer
            .text('') // Empty line for spacing
            .tableCustom([
              { text: 'Subtotal', width: 0.7, align: 'LEFT' },
              { text: formatCurrency(subtotal), width: 0.3, align: 'RIGHT' }
            ])
            .tableCustom([
              { text: 'Tax (8%)', width: 0.7, align: 'LEFT' },
              { text: formatCurrency(tax), width: 0.3, align: 'RIGHT' }
            ])
            .tableCustom([
              { text: 'Total', width: 0.7, align: 'LEFT' },
              { text: formatCurrency(sale.totalAmount), width: 0.3, align: 'RIGHT' }
            ])
            .text('') // Empty line for spacing
            .align('ct')
            .text('Thank you for shopping with us!')
            .text('Please come again')
            .text('') // Empty line for spacing
            .cut()
            .close();

          resolve({ success: true });
        } catch (printError) {
          console.error('Error during printing:', printError);
          reject({ success: false, error: 'Failed to print receipt' });
        }
      });
    });
  } catch (error) {
    console.error('Printing error:', error.message);
    return { 
      success: false, 
      error: 'Failed to print receipt. Please check printer connection and try again.'
    };
  }
}

module.exports = {
  printReceipt
};
