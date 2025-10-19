# Adeego Plus - Subscription Management System

## Overview
Adeego Plus is a recurring delivery subscription system that allows customers to schedule automatic weekly product deliveries. Orders are automatically added to the sales draft on delivery days.

## Features

### 1. Subscription Management
- **Create Subscriptions**: Add new recurring delivery subscriptions for customers
- **Edit Subscriptions**: Modify existing subscriptions (product, days, time slots, status)
- **Delete Subscriptions**: Remove subscriptions permanently
- **Status Management**: Active, Paused, or Cancelled subscriptions

### 2. Delivery Scheduling
- **Weekly Schedule**: Select multiple days of the week for deliveries
- **Time Slots**:
  - Morning: 9:00 AM - 11:00 AM
  - Evening: 6:00 PM - 8:00 PM
- **Automatic Processing**: Deliveries are tracked and can be processed on scheduled days

### 3. Today's Deliveries
- **View Today's Schedule**: See all deliveries scheduled for the current day
- **Mark as Delivered**: Automatically adds order to sales draft
- **Skip Delivery**: Skip today's delivery with reason tracking
  - Customer requested to skip
  - Customer wants it tomorrow
  - Customer not available
  - Product unavailable

## Components

### Main Components
1. **subscriptionTable.js** - Main table view of all subscriptions
2. **addSubscription.js** - Dialog for creating new subscriptions
3. **editSubscription.js** - Dialog for editing existing subscriptions
4. **deleteSubscription.js** - Confirmation dialog for deleting subscriptions
5. **todayDeliveries.js** - Card showing today's scheduled deliveries

## Database Schema

### Subscription Collection
```javascript
{
  _id: ObjectId,
  storeNo: String,
  customerId: ObjectId,
  customerName: String,
  customerPhone: String,
  productId: ObjectId,
  productName: String,
  productPrice: Number,
  deliveryDays: [Number], // 0-6 (Sunday-Saturday)
  timeSlot: String, // 'morning' or 'evening'
  status: String, // 'active', 'paused', 'cancelled'
  createdAt: ISOString,
  updatedAt: ISOString,
  lastDelivery: ISOString,
  nextDelivery: ISOString
}
```

### Delivery History (Optional)
```javascript
{
  _id: ObjectId,
  subscriptionId: ObjectId,
  storeNo: String,
  customerId: ObjectId,
  deliveryDate: ISOString,
  status: String, // 'delivered', 'skipped'
  skipReason: String, // if skipped
  saleId: ObjectId, // if delivered
  createdAt: ISOString
}
```

## Required Backend Operations

### electronAPI.realmOperation Methods

1. **getAllSubscriptions**
   - Input: `storeNo`
   - Output: `{ success: Boolean, subscriptions: Array }`

2. **addSubscription**
   - Input: Subscription object
   - Output: `{ success: Boolean, subscription: Object }`

3. **updateSubscription**
   - Input: Subscription object with _id
   - Output: `{ success: Boolean }`

4. **deleteSubscription**
   - Input: `subscriptionId`
   - Output: `{ success: Boolean }`

5. **getTodayDeliveries**
   - Input: `{ storeNo, dayOfWeek }`
   - Output: `{ success: Boolean, deliveries: Array }`

6. **updateDeliveryStatus**
   - Input: `{ subscriptionId, status, deliveryDate?, skipReason?, skipDate? }`
   - Output: `{ success: Boolean }`

7. **addSaleDraft**
   - Input: Sale draft object
   - Output: `{ success: Boolean, sale: Object }`

## Workflow

### Creating a Subscription
1. User clicks "Add Subscription"
2. Selects customer from dropdown
3. Selects product from dropdown
4. Checks delivery days (one or more)
5. Selects time slot (morning or evening)
6. Submits form
7. Subscription is created with "active" status

### Processing Daily Deliveries
1. System shows all active subscriptions for current day
2. Staff can:
   - Mark as delivered → Creates sale draft entry
   - Skip delivery → Records skip reason and date

### Managing Subscriptions
- Edit: Update any subscription details or change status
- Pause: Set status to "paused" to temporarily stop deliveries
- Cancel: Set status to "cancelled" to end subscription
- Delete: Permanently remove subscription

## Installation Notes

1. Ensure all shadcn/ui components are installed:
   - button, card, dialog, dropdown-menu, table
   - input, label, select, checkbox, radio-group
   - badge, alert-dialog, scroll-area, toast

2. Backend must implement the required realm operations

3. Customer and Product data must be available in the database

## Future Enhancements

- Delivery history tracking
- Customer portal to manage their own subscriptions
- Automated notifications for upcoming deliveries
- Payment integration for subscription billing
- Analytics dashboard for subscription metrics
- Bulk subscription management
