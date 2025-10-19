# 🚀 Adeego Plus - Quick Test Guide

## ⚡ Quick Start (2 Minutes)

### 1. Start Application
```bash
cd /home/abdiaziz/Development/STARTUPS/adeegopos
npm run dev
```

### 2. Navigate to Adeego Plus
- Login → Click "Adeego Plus" in sidebar (📅 CalendarClock icon)

### 3. Create Test Subscription
```
1. Click "Add Subscription"
2. Search customer (type name or phone)
3. Click "Add product variant..." 
4. Search and select products (can add multiple!)
5. Check delivery days (e.g., Mon, Wed, Fri)
6. Select time slot (Morning or Evening)
7. Click "Create Subscription"
```

### 4. Test Today's Deliveries
```
1. Create subscription with today's day included
2. View "Today's Deliveries" card
3. Click "Deliver" → Creates sale draft automatically
   OR
   Click "Skip" → Select reason
```

---

## 🎯 Test Checklist

### Basic CRUD
- [ ] Create subscription with 1 product
- [ ] Create subscription with multiple products
- [ ] Edit subscription (add/remove products)
- [ ] Delete subscription
- [ ] View subscription details

### Search & Filter
- [ ] Search customer by name
- [ ] Search customer by phone
- [ ] Search product by name
- [ ] Add multiple products to subscription
- [ ] Remove product from subscription
- [ ] Search subscriptions in table

### Delivery Processing
- [ ] View today's deliveries
- [ ] Mark delivery as delivered
- [ ] Verify sale draft created
- [ ] Skip delivery with reason
- [ ] Verify delivery history

### Edge Cases
- [ ] Empty search results
- [ ] No deliveries today
- [ ] Duplicate product prevention
- [ ] Subscription with no products (should show error)
- [ ] Update subscription status (Active/Paused/Cancelled)

---

## 🐛 Common Issues & Fixes

| Issue | Quick Fix |
|-------|-----------|
| Can't find customer | Check if customer exists in database |
| Products not searchable | Verify products are "Active" state |
| No today's deliveries | Check if subscription day matches today |
| Sale draft not created | Check console for errors |
| Subscription not saving | Verify all required fields filled |

---

## 📊 Test Data Examples

### Sample Subscription 1
```
Customer: John Doe (+252612345678)
Products: 
  - Fresh Milk (1L) - $2.50
  - Orange Juice (500ml) - $3.00
Days: Monday, Wednesday, Friday
Time: Morning (9-11 AM)
Status: Active
```

### Sample Subscription 2
```
Customer: Jane Smith (+252612345679)
Products:
  - Fresh Bread (Whole Wheat) - $1.50
  - Butter (200g) - $3.00
Days: Sunday, Tuesday, Thursday, Saturday
Time: Evening (4:30-5:30 PM)
Status: Active
```

---

## 🔍 Verify in Console

```javascript
// Check all subscriptions
const subs = await window.electronAPI.realmOperation('getAllSubscriptions', 'YOUR_STORE_NO');
console.log('Total Subscriptions:', subs.subscriptions.length);

// Check today's deliveries
const dayOfWeek = new Date().getDay();
const deliveries = await window.electronAPI.realmOperation('getTodayDeliveries', 'YOUR_STORE_NO', dayOfWeek);
console.log('Today\'s Deliveries:', deliveries.deliveries.length);

// Get subscription stats
const stats = await window.electronAPI.realmOperation('getSubscriptionStats', 'YOUR_STORE_NO');
console.log('Stats:', stats.stats);
```

---

## ✅ Success Criteria

**System Working Correctly When**:
- ✅ Can create subscriptions with multiple products
- ✅ Customer search works (name and phone)
- ✅ Product variant search works  
- ✅ Can add/remove products from subscription
- ✅ Today's deliveries filtered by day
- ✅ "Deliver" creates sale draft with all products
- ✅ "Skip" records reason correctly
- ✅ Edit updates subscription properly
- ✅ Delete removes subscription
- ✅ Search filters subscriptions

---

## 📞 If Something Breaks

1. **Check Browser Console** - Look for red errors
2. **Check Electron Console** - Terminal where you ran `npm run dev`
3. **Restart Application** - Close and run `npm run dev` again
4. **Clear Database Cache** - May need to recreate test data
5. **Verify Store Number** - Must match your logged-in store

---

## 🎉 Expected Results

After testing, you should have:
- Multiple subscriptions in the table
- Sale drafts in sales section (from deliveries)
- Delivery history records
- Searchable customer/product lists
- Today's deliveries showing correct subscriptions

---

**Happy Testing!** 🚀
