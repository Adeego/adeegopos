/**
 * Utility functions for Adeego Plus subscription management
 */

/**
 * Day of week constants
 */
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' }
];

/**
 * Time slot constants
 */
export const TIME_SLOTS = {
  morning: {
    value: 'morning',
    label: 'Morning',
    time: '9:00 AM - 11:00 AM',
    start: '09:00',
    end: '11:00'
  },
  evening: {
    value: 'evening',
    label: 'Evening',
    time: '6:00 PM - 8:00 PM',
    start: '18:00',
    end: '20:00'
  }
};

/**
 * Subscription status constants
 */
export const SUBSCRIPTION_STATUS = {
  active: {
    value: 'active',
    label: 'Active',
    color: 'green',
    variant: 'default'
  },
  paused: {
    value: 'paused',
    label: 'Paused',
    color: 'yellow',
    variant: 'secondary'
  },
  cancelled: {
    value: 'cancelled',
    label: 'Cancelled',
    color: 'red',
    variant: 'destructive'
  }
};

/**
 * Skip delivery reasons
 */
export const SKIP_REASONS = [
  { value: 'customer_request', label: 'Customer requested to skip' },
  { value: 'take_tomorrow', label: 'Customer wants it tomorrow' },
  { value: 'customer_not_available', label: 'Customer not available' },
  { value: 'product_unavailable', label: 'Product unavailable' }
];

/**
 * Convert array of day numbers to readable string
 * @param {number[]} days - Array of day numbers (0-6)
 * @param {boolean} short - Use short names (Sun, Mon, etc.)
 * @returns {string} Comma-separated day names
 */
export function formatDeliveryDays(days, short = false) {
  if (!days || days.length === 0) return 'No days selected';
  
  return days
    .sort((a, b) => a - b)
    .map(day => {
      const dayObj = DAYS_OF_WEEK.find(d => d.value === day);
      return short ? dayObj?.short : dayObj?.label;
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Get time slot display string
 * @param {string} timeSlot - 'morning' or 'evening'
 * @returns {string} Formatted time range
 */
export function formatTimeSlot(timeSlot) {
  return TIME_SLOTS[timeSlot]?.time || timeSlot;
}

/**
 * Get full time slot info
 * @param {string} timeSlot - 'morning' or 'evening'
 * @returns {object} Time slot object
 */
export function getTimeSlotInfo(timeSlot) {
  return TIME_SLOTS[timeSlot] || TIME_SLOTS.morning;
}

/**
 * Get status info
 * @param {string} status - 'active', 'paused', or 'cancelled'
 * @returns {object} Status object
 */
export function getStatusInfo(status) {
  return SUBSCRIPTION_STATUS[status] || SUBSCRIPTION_STATUS.active;
}

/**
 * Format date to readable string
 * @param {string} dateString - ISO date string
 * @param {boolean} includeTime - Include time in output
 * @returns {string} Formatted date
 */
export function formatDate(dateString, includeTime = false) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) return 'Invalid date';
  
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit'
    })
  };
  
  return date.toLocaleDateString('en-US', options);
}

/**
 * Check if a subscription has delivery today
 * @param {number[]} deliveryDays - Array of day numbers
 * @param {Date} date - Date to check (defaults to today)
 * @returns {boolean} True if delivery is scheduled
 */
export function hasDeliveryToday(deliveryDays, date = new Date()) {
  const dayOfWeek = date.getDay();
  return deliveryDays.includes(dayOfWeek);
}

/**
 * Get next delivery date
 * @param {number[]} deliveryDays - Array of day numbers
 * @param {Date} fromDate - Starting date (defaults to today)
 * @returns {Date} Next delivery date
 */
export function getNextDeliveryDate(deliveryDays, fromDate = new Date()) {
  if (!deliveryDays || deliveryDays.length === 0) return null;
  
  const sortedDays = [...deliveryDays].sort((a, b) => a - b);
  const currentDay = fromDate.getDay();
  
  // Find next day in the current week
  const nextDay = sortedDays.find(day => day > currentDay);
  
  if (nextDay !== undefined) {
    const daysUntil = nextDay - currentDay;
    const nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + daysUntil);
    return nextDate;
  }
  
  // If no day found in current week, get first day of next week
  const firstDay = sortedDays[0];
  const daysUntil = (7 - currentDay) + firstDay;
  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + daysUntil);
  return nextDate;
}

/**
 * Calculate weekly frequency
 * @param {number[]} deliveryDays - Array of day numbers
 * @returns {number} Number of deliveries per week
 */
export function getWeeklyFrequency(deliveryDays) {
  return deliveryDays?.length || 0;
}

/**
 * Calculate estimated monthly deliveries
 * @param {number[]} deliveryDays - Array of day numbers
 * @returns {number} Approximate deliveries per month
 */
export function getMonthlyFrequency(deliveryDays) {
  const weeklyFrequency = getWeeklyFrequency(deliveryDays);
  return Math.round(weeklyFrequency * 4.33); // Average weeks per month
}

/**
 * Validate subscription data
 * @param {object} data - Subscription data to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateSubscription(data) {
  const errors = [];
  
  if (!data.customerId) {
    errors.push('Customer is required');
  }
  
  if (!data.productId) {
    errors.push('Product is required');
  }
  
  if (!data.deliveryDays || data.deliveryDays.length === 0) {
    errors.push('At least one delivery day is required');
  }
  
  if (!data.timeSlot || !TIME_SLOTS[data.timeSlot]) {
    errors.push('Valid time slot is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate subscription summary text
 * @param {object} subscription - Subscription object
 * @returns {string} Human-readable summary
 */
export function generateSubscriptionSummary(subscription) {
  const days = formatDeliveryDays(subscription.deliveryDays, true);
  const time = formatTimeSlot(subscription.timeSlot);
  const frequency = getWeeklyFrequency(subscription.deliveryDays);
  
  return `${subscription.productName} - ${frequency}x per week (${days}) at ${time}`;
}

/**
 * Filter subscriptions by status
 * @param {object[]} subscriptions - Array of subscriptions
 * @param {string} status - Status to filter by
 * @returns {object[]} Filtered subscriptions
 */
export function filterByStatus(subscriptions, status) {
  if (!status) return subscriptions;
  return subscriptions.filter(sub => sub.status === status);
}

/**
 * Filter subscriptions by time slot
 * @param {object[]} subscriptions - Array of subscriptions
 * @param {string} timeSlot - Time slot to filter by
 * @returns {object[]} Filtered subscriptions
 */
export function filterByTimeSlot(subscriptions, timeSlot) {
  if (!timeSlot) return subscriptions;
  return subscriptions.filter(sub => sub.timeSlot === timeSlot);
}

/**
 * Get subscriptions for a specific day
 * @param {object[]} subscriptions - Array of subscriptions
 * @param {number} dayOfWeek - Day number (0-6)
 * @returns {object[]} Filtered subscriptions
 */
export function getSubscriptionsForDay(subscriptions, dayOfWeek) {
  return subscriptions.filter(sub => 
    sub.deliveryDays.includes(dayOfWeek) && 
    sub.status === 'active'
  );
}

/**
 * Sort subscriptions by next delivery date
 * @param {object[]} subscriptions - Array of subscriptions
 * @returns {object[]} Sorted subscriptions
 */
export function sortByNextDelivery(subscriptions) {
  return [...subscriptions].sort((a, b) => {
    const nextA = getNextDeliveryDate(a.deliveryDays);
    const nextB = getNextDeliveryDate(b.deliveryDays);
    
    if (!nextA && !nextB) return 0;
    if (!nextA) return 1;
    if (!nextB) return -1;
    
    return nextA - nextB;
  });
}

/**
 * Calculate subscription statistics
 * @param {object[]} subscriptions - Array of subscriptions
 * @returns {object} Statistics object
 */
export function calculateStats(subscriptions) {
  const total = subscriptions.length;
  const active = subscriptions.filter(s => s.status === 'active').length;
  const paused = subscriptions.filter(s => s.status === 'paused').length;
  const cancelled = subscriptions.filter(s => s.status === 'cancelled').length;
  
  const totalWeeklyDeliveries = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, sub) => sum + getWeeklyFrequency(sub.deliveryDays), 0);
  
  return {
    total,
    active,
    paused,
    cancelled,
    totalWeeklyDeliveries,
    totalMonthlyDeliveries: Math.round(totalWeeklyDeliveries * 4.33)
  };
}
