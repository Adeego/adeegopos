# Backend Implementation Guide for Adeego Plus

## Overview
This document outlines the required backend operations for the Adeego Plus subscription management system.

## Database Schema

### 1. Subscriptions Collection

```javascript
const SubscriptionSchema = {
  name: 'Subscription',
  properties: {
    _id: 'objectId',
    storeNo: 'string',
    customerId: 'objectId',
    customerName: 'string',
    customerPhone: 'string',
    products: {
      type: 'list',
      objectType: 'SubscriptionProduct'
    },
    deliveryDays: 'int[]',  // Array of 0-6 (Sunday-Saturday)
    timeSlot: 'string',     // 'morning' or 'evening'
    status: 'string',       // 'active', 'paused', 'cancelled'
    createdAt: 'string',    // ISO date string
    updatedAt: 'string?',   // ISO date string
    lastDelivery: 'string?', // ISO date string
    nextDelivery: 'string?'  // ISO date string
  },
  primaryKey: '_id'
};

const SubscriptionProductSchema = {
  name: 'SubscriptionProduct',
  embedded: true,
  properties: {
    variantId: 'objectId',      // Product variant ID
    productId: 'objectId',      // Base product ID
    productName: 'string',      // Base product name
    variantName: 'string',      // Variant name (e.g., "1L", "500ml")
    unitPrice: 'double',        // Price for this variant
    conversionFactor: 'int'     // Conversion factor for variant
  }
};
```

### 2. Delivery History Collection (Optional but recommended)

```javascript
const DeliveryHistorySchema = {
  name: 'DeliveryHistory',
  properties: {
    _id: 'objectId',
    subscriptionId: 'objectId',
    storeNo: 'string',
    customerId: 'objectId',
    productId: 'objectId',
    deliveryDate: 'string',  // ISO date string
    status: 'string',        // 'delivered', 'skipped'
    skipReason: 'string?',   // Only if skipped
    saleId: 'objectId?',     // Only if delivered
    createdAt: 'string'      // ISO date string
  },
  primaryKey: '_id'
};
```

## Required Electron IPC Operations

Add these operations to your Realm handler in the Electron main process:

**Note**: The system now uses **searchable components** for customers and product variants, similar to the POS product search.

### 1. getAllSubscriptions

```javascript
case 'getAllSubscriptions':
  const storeNo = args;
  const subscriptions = realm.objects('Subscription')
    .filtered('storeNo == $0', storeNo)
    .sorted('createdAt', true);
  
  return {
    success: true,
    subscriptions: Array.from(subscriptions).map(s => ({
      _id: s._id.toString(),
      storeNo: s.storeNo,
      customerId: s.customerId.toString(),
      customerName: s.customerName,
      customerPhone: s.customerPhone,
      productId: s.productId.toString(),
      productName: s.productName,
      productPrice: s.productPrice,
      deliveryDays: Array.from(s.deliveryDays),
      timeSlot: s.timeSlot,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      lastDelivery: s.lastDelivery,
      nextDelivery: s.nextDelivery
    }))
  };
```

### 2. addSubscription

```javascript
case 'addSubscription':
  const subscriptionData = args;
  
  realm.write(() => {
    realm.create('Subscription', {
      _id: new Realm.BSON.ObjectId(),
      storeNo: subscriptionData.storeNo,
      customerId: new Realm.BSON.ObjectId(subscriptionData.customerId),
      customerName: subscriptionData.customerName,
      customerPhone: subscriptionData.customerPhone,
      products: subscriptionData.products.map(p => ({
        variantId: new Realm.BSON.ObjectId(p.variantId),
        productId: new Realm.BSON.ObjectId(p.productId),
        productName: p.productName,
        variantName: p.variantName,
        unitPrice: p.unitPrice,
        conversionFactor: p.conversionFactor
      })),
      deliveryDays: subscriptionData.deliveryDays,
      timeSlot: subscriptionData.timeSlot,
      status: subscriptionData.status,
      createdAt: subscriptionData.createdAt,
      updatedAt: null,
      lastDelivery: null,
      nextDelivery: null
    });
  });
  
  return { success: true };
```

### 3. updateSubscription

```javascript
case 'updateSubscription':
  const updateData = args;
  const subscriptionToUpdate = realm.objectForPrimaryKey(
    'Subscription', 
    new Realm.BSON.ObjectId(updateData._id)
  );
  
  if (!subscriptionToUpdate) {
    return { success: false, error: 'Subscription not found' };
  }
  
  realm.write(() => {
    subscriptionToUpdate.customerId = new Realm.BSON.ObjectId(updateData.customerId);
    subscriptionToUpdate.customerName = updateData.customerName;
    subscriptionToUpdate.customerPhone = updateData.customerPhone;
    
    // Clear and update products list
    subscriptionToUpdate.products = updateData.products.map(p => ({
      variantId: new Realm.BSON.ObjectId(p.variantId),
      productId: new Realm.BSON.ObjectId(p.productId),
      productName: p.productName,
      variantName: p.variantName,
      unitPrice: p.unitPrice,
      conversionFactor: p.conversionFactor
    }));
    
    subscriptionToUpdate.deliveryDays = updateData.deliveryDays;
    subscriptionToUpdate.timeSlot = updateData.timeSlot;
    subscriptionToUpdate.status = updateData.status;
    subscriptionToUpdate.updatedAt = updateData.updatedAt;
  });
  
  return { success: true };
```

### 4. deleteSubscription

```javascript
case 'deleteSubscription':
  const subscriptionId = args;
  const subscriptionToDelete = realm.objectForPrimaryKey(
    'Subscription',
    new Realm.BSON.ObjectId(subscriptionId)
  );
  
  if (!subscriptionToDelete) {
    return { success: false, error: 'Subscription not found' };
  }
  
  realm.write(() => {
    realm.delete(subscriptionToDelete);
  });
  
  return { success: true };
```

### 5. getTodayDeliveries

```javascript
case 'getTodayDeliveries':
  const { storeNo, dayOfWeek } = args;
  
  // Get all active subscriptions for this store
  const allSubscriptions = realm.objects('Subscription')
    .filtered('storeNo == $0 AND status == "active"', storeNo);
  
  // Filter by day of week (client-side filtering since Realm queries don't support array contains)
  const todayDeliveries = Array.from(allSubscriptions)
    .filter(sub => sub.deliveryDays.includes(dayOfWeek))
    .map(s => ({
      _id: s._id.toString(),
      storeNo: s.storeNo,
      customerId: s.customerId.toString(),
      customerName: s.customerName,
      customerPhone: s.customerPhone,
      productId: s.productId.toString(),
      productName: s.productName,
      productPrice: s.productPrice,
      deliveryDays: Array.from(s.deliveryDays),
      timeSlot: s.timeSlot,
      status: s.status
    }));
  
  return {
    success: true,
    deliveries: todayDeliveries
  };
```

### 6. updateDeliveryStatus

```javascript
case 'updateDeliveryStatus':
  const { subscriptionId, status, deliveryDate, skipReason, skipDate } = args;
  
  const subscription = realm.objectForPrimaryKey(
    'Subscription',
    new Realm.BSON.ObjectId(subscriptionId)
  );
  
  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }
  
  realm.write(() => {
    if (status === 'delivered') {
      subscription.lastDelivery = deliveryDate;
      subscription.updatedAt = new Date().toISOString();
    }
    
    // Optionally create delivery history record
    realm.create('DeliveryHistory', {
      _id: new Realm.BSON.ObjectId(),
      subscriptionId: subscription._id,
      storeNo: subscription.storeNo,
      customerId: subscription.customerId,
      productId: subscription.productId,
      deliveryDate: deliveryDate || skipDate,
      status: status,
      skipReason: skipReason || null,
      saleId: null, // Will be updated when sale is created
      createdAt: new Date().toISOString()
    });
  });
  
  return { success: true };
```

### 7. addSaleDraft

This operation should integrate with your existing sales system. Example:

```javascript
case 'addSaleDraft':
  const saleData = args;
  
  realm.write(() => {
    const sale = realm.create('Sale', {
      _id: new Realm.BSON.ObjectId(),
      storeNo: saleData.storeNo,
      customerId: new Realm.BSON.ObjectId(saleData.customerId),
      customerName: saleData.customerName,
      items: saleData.items.map(item => ({
        productId: new Realm.BSON.ObjectId(item.productId),
        productName: item.productName,
        price: item.price,
        quantity: item.quantity
      })),
      totalAmount: saleData.totalAmount,
      status: saleData.status, // 'draft'
      source: saleData.source,  // 'adeegoplus'
      subscriptionId: new Realm.BSON.ObjectId(saleData.subscriptionId),
      createdAt: saleData.createdAt
    });
    
    return { success: true, saleId: sale._id.toString() };
  });
```

### 8. searchCustomers (New)

This operation is used by the customer search component:

```javascript
case 'searchCustomers':
  const { searchTerm, storeNo } = args;
  
  const customers = realm.objects('Customer')
    .filtered('storeNo == $0 AND (name CONTAINS[c] $1 OR phoneNumber CONTAINS $1)', storeNo, searchTerm);
  
  return {
    success: true,
    customers: Array.from(customers).map(c => ({
      _id: c._id.toString(),
      name: c.name,
      phoneNumber: c.phoneNumber,
      address: c.address,
      email: c.email
    }))
  };
```

**Note**: The `getAllVariants` and `searchVariants` operations already exist in your `productService.js` and are used by the product variant search component.

## Electron Main Process Setup

In your main Electron file (e.g., `electron/main.js`), ensure the IPC handler includes these operations:

```javascript
ipcMain.handle('realm-operation', async (event, operation, args) => {
  const realm = await getRealm(); // Your realm instance getter
  
  try {
    switch (operation) {
      case 'getAllSubscriptions':
        // Implementation here
        break;
      case 'addSubscription':
        // Implementation here
        break;
      // ... other cases
      default:
        return { success: false, error: 'Unknown operation' };
    }
  } catch (error) {
    console.error('Realm operation error:', error);
    return { success: false, error: error.message };
  }
});
```

## Testing Checklist

- [ ] Create a subscription
- [ ] View all subscriptions
- [ ] Edit a subscription
- [ ] Delete a subscription
- [ ] View today's deliveries
- [ ] Mark delivery as delivered (creates sale draft)
- [ ] Skip a delivery with reason
- [ ] Change subscription status (active/paused/cancelled)
- [ ] Verify subscriptions only show for correct store
- [ ] Test with multiple delivery days
- [ ] Test both time slots (morning/evening)

## Notes

1. **Date Handling**: All dates should be stored as ISO strings for consistency
2. **ObjectId Conversion**: Remember to convert string IDs to ObjectId when querying
3. **Array Filtering**: Realm doesn't support array contains in queries, so filter delivery days in JavaScript
4. **Transaction Safety**: Always wrap write operations in `realm.write()`
5. **Error Handling**: Return meaningful error messages for debugging

## Future Enhancements

- Automatic delivery processing (cron job or scheduled task)
- Push notifications for upcoming deliveries
- Delivery analytics and reporting
- Customer self-service portal
- Integration with payment systems for subscription billing
