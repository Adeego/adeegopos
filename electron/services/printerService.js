const escpos = require('escpos');

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}     ${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function formatCurrency(amount) {
  if (typeof amount !== 'number') return 'Ksh 0.00';
  return 'Ksh ' + amount.toFixed(2);
}

function validateSaleData(sale) {
  if (!sale) throw new Error('Sale data is required');
  if (!sale._id) throw new Error('Sale ID is missing');
  if (!sale.items || !Array.isArray(sale.items)) throw new Error('Sale items are missing or invalid');
  if (typeof sale.totalAmount !== 'number') throw new Error('Invalid total amount');
  if (typeof sale.totalItems !== 'number') throw new Error('Invalid total items');
  return true;
}

const printQueue = [];
let isPrinting = false;

async function processPrintQueue() {
  if (isPrinting || printQueue.length === 0) {
    return;
  }

  isPrinting = true;
  const sale = printQueue.shift();

  try {
    // Validate sale data
    validateSaleData(sale);

    const { printer: globalPrinter, device: globalDevice } = global.printer;
    if (!globalPrinter || !globalDevice) {
      throw new Error('Printer not initialized');
    }

    const device = new escpos.Network(globalDevice.address, globalDevice.port);
    const printer = new escpos.Printer(device);

    await new Promise((resolve, reject) => {
      device.open(function(error) {
        if (error) {
          console.error('Error opening printer:', error);
          reject(new Error('Failed to open printer connection'));
          return;
        }

        try {
          // Store header
          printer
            .font('a')
            .align('ct')
            .style('b')
            .size(1, 1)
            .text('ADEEGO MART')
            .size(0, 0)
            .style('normal')
            .text('NAIROBI WEST, NAIROBI, KE')
            .text(formatDate(sale.createdAt))
            .text(`Payment: ${sale.paymentMethod || ''}`)
            .text(`Served By: ${sale.servedBy || ''}`)
            .text(''); // Empty line for spacing

          //- Divider
          printer.text('--------------------------------');

          // Print items using table
          printer.font('b'); // Use smaller font for items
          sale.items.forEach(item => {
            const quantity = item.quantity || 0;
            const name = item.name || 'Unknown Item';
            const total = formatCurrency(item.subtotal || 0);

            printer.tableCustom([
              { text: `${quantity} x ${name}`, width: 0.7, align: 'LEFT' },
              { text: total, width: 0.3, align: 'RIGHT' }
            ]);
          });
          printer.font('a'); // Reset font

          //- Divider
          printer.text('--------------------------------');

          // Print totals
          printer
            .text('') // Empty line for spacing
            .tableCustom([
              { text: 'Total', width: 0.7, align: 'LEFT' },
              { text: formatCurrency(sale.totalAmount), width: 0.3, align: 'RIGHT' }
            ])
            .tableCustom([
              { text: 'Items', width: 0.7, align: 'LEFT' },
              { text: String(sale.totalItems || 0), width: 0.3, align: 'RIGHT' }
            ])
            .tableCustom([
              { text: 'Discount', width: 0.7, align: 'LEFT' },
              { text: formatCurrency(sale.totalDiscount || 0), width: 0.3, align: 'RIGHT' }
            ]);

          if (typeof sale.amountPaid === 'number') {
            printer.tableCustom([
              { text: 'Paid', width: 0.7, align: 'LEFT' },
              { text: formatCurrency(sale.amountPaid), width: 0.3, align: 'RIGHT' }
            ]);
          }
          if (typeof sale.change === 'number') {
            printer.tableCustom([
              { text: 'Change', width: 0.7, align: 'LEFT' },
              { text: formatCurrency(sale.change), width: 0.3, align: 'RIGHT' }
            ]);
          }

          //- Divider
          printer.text('--------------------------------');

          printer
            .text('') // Empty line for spacing
            .align('ct')
            .text('Thank you for shopping with us!')
            .text('Please come again')
            .text('') // Empty line for spacing
            .cut()
            .flush();

          device.close(() => {
            console.log(`Successfully printed receipt for sale: ${sale._id}`);
            resolve();
          });

        } catch (printError) {
          console.error('Error during printing:', printError);
          device.close(() => {
            reject(new Error('Failed to print receipt'));
          });
        }
      });
    });
  } catch (error) {
    console.error(`Printing error for sale ${sale._id}:`, error.message);
  } finally {
    isPrinting = false;
    // Process the next item in the queue
    processPrintQueue();
  }
}

function printReceipt(sale) {
  try {
    validateSaleData(sale);
    printQueue.push(sale);
    processPrintQueue();
    return Promise.resolve({ success: true, message: 'Receipt queued for printing.' });
  } catch (error) {
    console.error('Error queueing receipt:', error.message);
    return Promise.reject({ success: false, error: 'Failed to queue receipt for printing.' });
  }
}

module.exports = {
  printReceipt
};
