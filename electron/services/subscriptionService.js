/**
 * Subscription Service for Adeego Plus
 * Handles recurring delivery subscriptions with multiple product variants
 */

// Get all subscriptions for a store
function getAllSubscriptions(db, storeNo) {
  return db
    .find({
      selector: {
        type: "subscription",
        state: "Active",
        storeNo: storeNo
      }
    })
    .then((result) => {
      // Sort in JavaScript after fetching
      const sorted = result.docs.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA; // Descending order (newest first)
      });
      
      return {
        success: true,
        subscriptions: sorted
      };
    })
    .catch((error) => ({
      success: false,
      error: error.message
    }));
}

// Create a new subscription
async function addSubscription(db, subscriptionData) {
  try {
    const subscription = {
      _id: subscriptionData._id || `subscription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "subscription",
      state: "Active",
      storeNo: subscriptionData.storeNo,
      customerId: subscriptionData.customerId,
      customerName: subscriptionData.customerName,
      customerPhone: subscriptionData.customerPhone,
      products: subscriptionData.products.map(product => ({
        variantId: product.variantId,
        productId: product.productId,
        productName: product.productName,
        variantName: product.variantName,
        unitPrice: product.unitPrice,
        conversionFactor: product.conversionFactor
      })),
      deliveryDays: subscriptionData.deliveryDays,
      timeSlot: subscriptionData.timeSlot,
      status: subscriptionData.status || 'active',
      createdAt: subscriptionData.createdAt || new Date().toISOString(),
      updatedAt: null,
      lastDelivery: null,
      nextDelivery: null
    };

    const response = await db.put(subscription);

    return {
      success: true,
      subscription: { _id: response.id, ...subscription }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Update an existing subscription
async function updateSubscription(db, updateData) {
  try {
    // Get the existing subscription with its revision
    const existingSubscription = await db.get(updateData._id);

    // Prepare the updated subscription
    const updatedSubscription = {
      ...existingSubscription,
      _rev: existingSubscription._rev,
      customerId: updateData.customerId,
      customerName: updateData.customerName,
      customerPhone: updateData.customerPhone,
      products: updateData.products.map(product => ({
        variantId: product.variantId,
        productId: product.productId,
        productName: product.productName,
        variantName: product.variantName,
        unitPrice: product.unitPrice,
        conversionFactor: product.conversionFactor
      })),
      deliveryDays: updateData.deliveryDays,
      timeSlot: updateData.timeSlot,
      status: updateData.status,
      updatedAt: updateData.updatedAt || new Date().toISOString()
    };

    const response = await db.put(updatedSubscription);

    return {
      success: true,
      subscription: { _id: response.id, ...updatedSubscription }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Delete a subscription (soft delete by setting state to Inactive)
async function deleteSubscription(db, subscriptionId) {
  try {
    const subscription = await db.get(subscriptionId);
    
    subscription.state = "Inactive";
    subscription.status = "cancelled";
    subscription.updatedAt = new Date().toISOString();

    await db.put(subscription);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Get today's deliveries based on day of week
async function getTodayDeliveries(db, storeNo, dayOfWeek) {
  try {
    // Get all active subscriptions
    const result = await db.find({
      selector: {
        type: "subscription",
        state: "Active",
        status: "active",
        storeNo: storeNo
      }
    });

    // Filter subscriptions that have delivery today
    const todayDeliveries = result.docs.filter(subscription => 
      subscription.deliveryDays && subscription.deliveryDays.includes(dayOfWeek)
    );

    return {
      success: true,
      deliveries: todayDeliveries
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      deliveries: []
    };
  }
}

// Update delivery status (delivered or skipped)
async function updateDeliveryStatus(db, statusData) {
  try {
    const subscription = await db.get(statusData.subscriptionId);

    // Update the subscription's delivery tracking
    if (statusData.status === 'delivered') {
      subscription.lastDelivery = statusData.deliveryDate || new Date().toISOString();
    }

    // Optionally create a delivery history record
    if (statusData.status === 'delivered' || statusData.status === 'skipped') {
      const deliveryHistory = {
        _id: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: "deliveryHistory",
        subscriptionId: statusData.subscriptionId,
        storeNo: subscription.storeNo,
        customerId: subscription.customerId,
        deliveryDate: statusData.deliveryDate || statusData.skipDate || new Date().toISOString(),
        status: statusData.status,
        skipReason: statusData.skipReason || null,
        saleId: null,
        createdAt: new Date().toISOString()
      };

      // Save delivery history
      await db.put(deliveryHistory);
    }

    // Update the subscription
    await db.put(subscription);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Note: addSaleDraft has been removed
// Subscription deliveries now use the Zustand draft sales store (useDraftSalesStore)
// instead of saving to the database. This matches the POS system's draft functionality.

// Get subscription by ID
async function getSubscriptionById(db, subscriptionId) {
  try {
    const subscription = await db.get(subscriptionId);
    
    return {
      success: true,
      subscription
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Get all subscriptions for a specific customer
async function getCustomerSubscriptions(db, customerId, storeNo) {
  try {
    const result = await db.find({
      selector: {
        type: "subscription",
        state: "Active",
        customerId: customerId,
        storeNo: storeNo
      }
    });

    // Sort in JavaScript after fetching
    const sorted = result.docs.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA; // Descending order (newest first)
    });

    return {
      success: true,
      subscriptions: sorted
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Get delivery history for a subscription
async function getDeliveryHistory(db, subscriptionId) {
  try {
    const result = await db.find({
      selector: {
        type: "deliveryHistory",
        subscriptionId: subscriptionId
      }
    });

    // Sort in JavaScript after fetching
    const sorted = result.docs.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA; // Descending order (newest first)
    });

    return {
      success: true,
      history: sorted
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Get subscription statistics
async function getSubscriptionStats(db, storeNo) {
  try {
    const result = await db.find({
      selector: {
        type: "subscription",
        state: "Active",
        storeNo: storeNo
      }
    });

    const subscriptions = result.docs;
    const stats = {
      total: subscriptions.length,
      active: subscriptions.filter(s => s.status === 'active').length,
      paused: subscriptions.filter(s => s.status === 'paused').length,
      cancelled: subscriptions.filter(s => s.status === 'cancelled').length,
      totalWeeklyDeliveries: 0
    };

    // Calculate total weekly deliveries
    subscriptions.forEach(sub => {
      if (sub.status === 'active' && sub.deliveryDays) {
        stats.totalWeeklyDeliveries += sub.deliveryDays.length * (sub.products?.length || 0);
      }
    });

    return {
      success: true,
      stats
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Search subscriptions by customer name, phone, or product
async function searchSubscriptions(db, searchTerm, storeNo) {
  try {
    const result = await db.find({
      selector: {
        type: "subscription",
        state: "Active",
        storeNo: storeNo,
        $or: [
          { customerName: { $regex: new RegExp(searchTerm, 'i') } },
          { customerPhone: { $regex: new RegExp(searchTerm, 'i') } }
        ]
      }
    });

    return {
      success: true,
      subscriptions: result.docs
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  getAllSubscriptions,
  addSubscription,
  updateSubscription,
  deleteSubscription,
  getTodayDeliveries,
  updateDeliveryStatus,
  getSubscriptionById,
  getCustomerSubscriptions,
  getDeliveryHistory,
  getSubscriptionStats,
  searchSubscriptions
};
