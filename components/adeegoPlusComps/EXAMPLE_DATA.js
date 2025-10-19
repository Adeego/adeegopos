/**
 * Example data structures for Adeego Plus
 * Use these as reference for backend implementation and testing
 */

// Example Subscription Object (Updated with multiple products and variants)
export const exampleSubscription = {
  _id: "507f1f77bcf86cd799439011",
  storeNo: "STORE001",
  customerId: "507f191e810c19729de860ea",
  customerName: "John Doe",
  customerPhone: "+252612345678",
  products: [
    {
      variantId: "507f191e810c19729de860eb",
      productId: "507f191e810c19729de860ea",
      productName: "Fresh Milk",
      variantName: "1L",
      unitPrice: 2.5,
      conversionFactor: 1
    },
    {
      variantId: "507f191e810c19729de860ec",
      productId: "507f191e810c19729de860ea",
      productName: "Fresh Milk",
      variantName: "500ml",
      unitPrice: 1.5,
      conversionFactor: 2
    }
  ],
  deliveryDays: [1, 3, 5], // Monday, Wednesday, Friday
  timeSlot: "morning", // or "evening"
  status: "active", // or "paused", "cancelled"
  createdAt: "2025-01-15T10:30:00.000Z",
  updatedAt: "2025-01-20T14:45:00.000Z",
  lastDelivery: "2025-02-05T09:15:00.000Z",
  nextDelivery: "2025-02-07T09:00:00.000Z"
};

// Example Subscriptions Array (for testing - updated with products array)
export const exampleSubscriptions = [
  {
    _id: "507f1f77bcf86cd799439011",
    storeNo: "STORE001",
    customerId: "507f191e810c19729de860ea",
    customerName: "John Doe",
    customerPhone: "+252612345678",
    products: [
      {
        variantId: "507f191e810c19729de860eb",
        productId: "507f191e810c19729de860ea",
        productName: "Fresh Milk",
        variantName: "1L",
        unitPrice: 2.5,
        conversionFactor: 1
      }
    ],
    deliveryDays: [1, 3, 5], // Mon, Wed, Fri
    timeSlot: "morning",
    status: "active",
    createdAt: "2025-01-15T10:30:00.000Z",
    updatedAt: null,
    lastDelivery: null,
    nextDelivery: null
  },
  {
    _id: "507f1f77bcf86cd799439012",
    storeNo: "STORE001",
    customerId: "507f191e810c19729de860ec",
    customerName: "Jane Smith",
    customerPhone: "+252612345679",
    products: [
      {
        variantId: "507f191e810c19729de860ed",
        productId: "507f191e810c19729de860ec",
        productName: "Fresh Bread",
        variantName: "Whole Wheat",
        unitPrice: 1.5,
        conversionFactor: 1
      },
      {
        variantId: "507f191e810c19729de860ee",
        productId: "507f191e810c19729de860ef",
        productName: "Butter",
        variantName: "200g",
        unitPrice: 3.0,
        conversionFactor: 1
      }
    ],
    deliveryDays: [0, 2, 4, 6], // Sun, Tue, Thu, Sat
    timeSlot: "evening",
    status: "active",
    createdAt: "2025-01-20T11:00:00.000Z",
    updatedAt: null,
    lastDelivery: "2025-02-04T16:45:00.000Z",
    nextDelivery: null
  },
  {
    _id: "507f1f77bcf86cd799439013",
    storeNo: "STORE001",
    customerId: "507f191e810c19729de860ee",
    customerName: "Ahmed Ali",
    customerPhone: "+252612345680",
    products: [
      {
        variantId: "507f191e810c19729de860ef",
        productId: "507f191e810c19729de860f0",
        productName: "Orange Juice",
        variantName: "500ml",
        unitPrice: 3.0,
        conversionFactor: 2
      }
    ],
    deliveryDays: [1, 2, 3, 4, 5], // Mon-Fri
    timeSlot: "morning",
    status: "paused",
    createdAt: "2025-01-10T09:15:00.000Z",
    updatedAt: "2025-02-01T10:20:00.000Z",
    lastDelivery: "2025-01-31T09:30:00.000Z",
    nextDelivery: null
  }
];

// Example Customer Object (for reference)
export const exampleCustomer = {
  _id: "507f191e810c19729de860ea",
  name: "John Doe",
  phoneNumber: "+252612345678",
  address: "123 Main Street, Mogadishu",
  email: "john.doe@example.com",
  credit: 0,
  totalPurchases: 150.00,
  storeNo: "STORE001",
  createdAt: "2024-12-01T10:00:00.000Z"
};

// Example Product Object (for reference)
export const exampleProduct = {
  _id: "507f191e810c19729de860eb",
  name: "Fresh Milk (1L)",
  price: 2.5,
  cost: 1.8,
  quantity: 100,
  category: "Dairy",
  barcode: "1234567890123",
  storeNo: "STORE001",
  createdAt: "2024-11-15T08:00:00.000Z"
};

// Example Sale Draft Object (created on delivery)
export const exampleSaleDraft = {
  _id: "507f1f77bcf86cd799439020",
  storeNo: "STORE001",
  customerId: "507f191e810c19729de860ea",
  customerName: "John Doe",
  items: [
    {
      productId: "507f191e810c19729de860eb",
      productName: "Fresh Milk (1L)",
      price: 2.5,
      quantity: 1
    }
  ],
  totalAmount: 2.5,
  status: "draft",
  source: "adeegoplus",
  subscriptionId: "507f1f77bcf86cd799439011",
  createdAt: "2025-02-10T09:15:00.000Z"
};

// Example Delivery History Object (optional)
export const exampleDeliveryHistory = {
  _id: "507f1f77bcf86cd799439030",
  subscriptionId: "507f1f77bcf86cd799439011",
  storeNo: "STORE001",
  customerId: "507f191e810c19729de860ea",
  productId: "507f191e810c19729de860eb",
  deliveryDate: "2025-02-10T09:15:00.000Z",
  status: "delivered", // or "skipped"
  skipReason: null, // or "customer_request", etc.
  saleId: "507f1f77bcf86cd799439020",
  createdAt: "2025-02-10T09:15:00.000Z"
};

// Example Today's Deliveries Response
export const exampleTodayDeliveries = {
  success: true,
  deliveries: [
    {
      _id: "507f1f77bcf86cd799439011",
      storeNo: "STORE001",
      customerId: "507f191e810c19729de860ea",
      customerName: "John Doe",
      customerPhone: "+252612345678",
      productId: "507f191e810c19729de860eb",
      productName: "Fresh Milk (1L)",
      productPrice: 2.5,
      deliveryDays: [1, 3, 5],
      timeSlot: "morning",
      status: "active"
    }
  ]
};

// Example Backend Operation Responses

export const backendResponses = {
  // Success response for getAllSubscriptions
  getAllSubscriptions: {
    success: true,
    subscriptions: exampleSubscriptions
  },
  
  // Success response for addSubscription
  addSubscription: {
    success: true,
    subscription: exampleSubscription
  },
  
  // Success response for updateSubscription
  updateSubscription: {
    success: true
  },
  
  // Success response for deleteSubscription
  deleteSubscription: {
    success: true
  },
  
  // Success response for getTodayDeliveries
  getTodayDeliveries: {
    success: true,
    deliveries: exampleTodayDeliveries.deliveries
  },
  
  // Success response for updateDeliveryStatus
  updateDeliveryStatus: {
    success: true
  },
  
  // Success response for addSaleDraft
  addSaleDraft: {
    success: true,
    saleId: "507f1f77bcf86cd799439020"
  },
  
  // Error response example
  error: {
    success: false,
    error: "Subscription not found"
  }
};

// Form data structure for creating subscription
export const createSubscriptionFormData = {
  customerId: "507f191e810c19729de860ea",
  productId: "507f191e810c19729de860eb",
  deliveryDays: [1, 3, 5], // Must be array of numbers 0-6
  timeSlot: "morning", // Must be "morning" or "evening"
  status: "active" // Must be "active", "paused", or "cancelled"
};

// Form data structure for updating subscription
export const updateSubscriptionFormData = {
  _id: "507f1f77bcf86cd799439011", // Required for update
  customerId: "507f191e810c19729de860ea",
  productId: "507f191e810c19729de860eb",
  deliveryDays: [1, 3, 5],
  timeSlot: "morning",
  status: "active"
};

// Mark as delivered payload
export const markAsDeliveredPayload = {
  // First: Create sale draft
  saleData: {
    storeNo: "STORE001",
    customerId: "507f191e810c19729de860ea",
    customerName: "John Doe",
    items: [
      {
        productId: "507f191e810c19729de860eb",
        productName: "Fresh Milk (1L)",
        price: 2.5,
        quantity: 1
      }
    ],
    totalAmount: 2.5,
    status: "draft",
    source: "adeegoplus",
    subscriptionId: "507f1f77bcf86cd799439011",
    createdAt: new Date().toISOString()
  },
  
  // Then: Update delivery status
  deliveryStatus: {
    subscriptionId: "507f1f77bcf86cd799439011",
    status: "delivered",
    deliveryDate: new Date().toISOString()
  }
};

// Skip delivery payload
export const skipDeliveryPayload = {
  subscriptionId: "507f1f77bcf86cd799439011",
  status: "skipped",
  skipReason: "customer_request", // or other skip reason
  skipDate: new Date().toISOString()
};

// Testing scenarios
export const testScenarios = {
  scenario1: {
    description: "Create a basic subscription for milk delivery 3 times a week",
    customerId: "507f191e810c19729de860ea",
    customerName: "John Doe",
    productId: "507f191e810c19729de860eb",
    productName: "Fresh Milk (1L)",
    deliveryDays: [1, 3, 5], // Mon, Wed, Fri
    timeSlot: "morning",
    expected: "Subscription created successfully"
  },
  
  scenario2: {
    description: "Edit subscription to change delivery days",
    subscriptionId: "507f1f77bcf86cd799439011",
    newDeliveryDays: [0, 2, 4, 6], // Sun, Tue, Thu, Sat
    newTimeSlot: "evening",
    expected: "Subscription updated successfully"
  },
  
  scenario3: {
    description: "Mark today's delivery as delivered",
    subscriptionId: "507f1f77bcf86cd799439011",
    action: "deliver",
    expected: "Sale draft created and delivery marked as delivered"
  },
  
  scenario4: {
    description: "Skip today's delivery with reason",
    subscriptionId: "507f1f77bcf86cd799439011",
    action: "skip",
    reason: "customer_request",
    expected: "Delivery skipped successfully"
  },
  
  scenario5: {
    description: "Pause a subscription temporarily",
    subscriptionId: "507f1f77bcf86cd799439011",
    newStatus: "paused",
    expected: "Subscription paused, no future deliveries until resumed"
  },
  
  scenario6: {
    description: "Delete a subscription permanently",
    subscriptionId: "507f1f77bcf86cd799439011",
    expected: "Subscription deleted successfully"
  }
};

// Validation examples
export const validationExamples = {
  valid: {
    customerId: "507f191e810c19729de860ea",
    productId: "507f191e810c19729de860eb",
    deliveryDays: [1, 3, 5],
    timeSlot: "morning",
    status: "active"
  },
  
  invalidNoDays: {
    customerId: "507f191e810c19729de860ea",
    productId: "507f191e810c19729de860eb",
    deliveryDays: [], // ERROR: Empty array
    timeSlot: "morning",
    status: "active"
  },
  
  invalidTimeSlot: {
    customerId: "507f191e810c19729de860ea",
    productId: "507f191e810c19729de860eb",
    deliveryDays: [1, 3, 5],
    timeSlot: "afternoon", // ERROR: Invalid time slot
    status: "active"
  },
  
  invalidStatus: {
    customerId: "507f191e810c19729de860ea",
    productId: "507f191e810c19729de860eb",
    deliveryDays: [1, 3, 5],
    timeSlot: "morning",
    status: "pending" // ERROR: Invalid status
  }
};

export default {
  exampleSubscription,
  exampleSubscriptions,
  exampleCustomer,
  exampleProduct,
  exampleSaleDraft,
  exampleDeliveryHistory,
  exampleTodayDeliveries,
  backendResponses,
  createSubscriptionFormData,
  updateSubscriptionFormData,
  markAsDeliveredPayload,
  skipDeliveryPayload,
  testScenarios,
  validationExamples
};
