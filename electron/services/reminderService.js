function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildReminderId(storeNo, fallbackId) {
  const safeId = normalizeText(fallbackId).split(':').pop() || Date.now().toString();
  return `${storeNo}:reminder:${safeId}`;
}

function isOwnedReminder(reminder, payload) {
  return reminder
    && reminder.type === 'reminder'
    && reminder.storeNo === payload.storeNo
    && reminder.staffId === payload.staffId;
}

function sanitizeReminderInput(input = {}, existing = null) {
  const storeNo = normalizeText(input.storeNo || existing?.storeNo);
  const staffId = normalizeText(input.staffId || existing?.staffId);
  const title = normalizeText(input.title || existing?.title);
  const dueAt = normalizeDate(input.dueAt || existing?.dueAt);
  const snoozedUntil = input.snoozedUntil
    ? normalizeDate(input.snoozedUntil)
    : (input.snoozedUntil === null ? null : existing?.snoozedUntil || null);

  if (!storeNo) {
    throw new Error('Store number is required.');
  }

  if (!staffId) {
    throw new Error('Staff is required.');
  }

  if (!title) {
    throw new Error('Reminder title is required.');
  }

  if (!dueAt) {
    throw new Error('A valid reminder time is required.');
  }

  if (input.snoozedUntil && !snoozedUntil) {
    throw new Error('A valid snooze time is required.');
  }

  return {
    storeNo,
    staffId,
    title,
    dueAt,
    snoozedUntil,
    notes: normalizeText(input.notes ?? existing?.notes),
  };
}

async function getOwnedReminder(db, payload = {}) {
  const reminderId = normalizeText(payload.reminderId || payload._id);
  const storeNo = normalizeText(payload.storeNo);
  const staffId = normalizeText(payload.staffId);

  if (!reminderId || !storeNo || !staffId) {
    throw new Error('Reminder, store, and staff are required.');
  }

  const reminder = await db.get(reminderId);

  if (!isOwnedReminder(reminder, { storeNo, staffId })) {
    throw new Error('Reminder not found.');
  }

  return reminder;
}

async function createReminder(db, reminderData = {}) {
  try {
    const normalized = sanitizeReminderInput(reminderData);
    const createdAt = nowIso();
    const reminder = {
      _id: buildReminderId(normalized.storeNo, reminderData._id),
      type: 'reminder',
      state: 'Active',
      status: 'active',
      title: normalized.title,
      notes: normalized.notes,
      dueAt: normalized.dueAt,
      snoozedUntil: normalized.snoozedUntil,
      storeNo: normalized.storeNo,
      staffId: normalized.staffId,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
    };

    const response = await db.put(reminder);
    return { success: true, reminder: { ...reminder, _rev: response.rev } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getMyReminders(db, payload = {}) {
  try {
    const storeNo = normalizeText(payload.storeNo);
    const staffId = normalizeText(payload.staffId);

    if (!storeNo || !staffId) {
      throw new Error('Store and staff are required.');
    }

    const result = await db.allDocs({
      include_docs: true,
      startkey: `${storeNo}:reminder:`,
      endkey: `${storeNo}:reminder:\ufff0`,
    });

    const reminders = (result.rows || [])
      .map((row) => row.doc)
      .filter((doc) => isOwnedReminder(doc, { storeNo, staffId }) && doc.state === 'Active')
      .sort((a, b) => {
        const aTime = new Date(a.snoozedUntil || a.dueAt || a.createdAt).getTime();
        const bTime = new Date(b.snoozedUntil || b.dueAt || b.createdAt).getTime();
        return aTime - bTime;
      });

    return { success: true, reminders };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateReminder(db, reminderData = {}) {
  try {
    const existing = await getOwnedReminder(db, reminderData);

    if (existing.state !== 'Active') {
      throw new Error('Reminder not found.');
    }

    const normalized = sanitizeReminderInput(reminderData, existing);
    const updated = {
      ...existing,
      title: normalized.title,
      notes: normalized.notes,
      dueAt: normalized.dueAt,
      snoozedUntil: normalized.snoozedUntil,
      status: reminderData.status === 'done' ? 'done' : 'active',
      completedAt: reminderData.status === 'done' ? (existing.completedAt || nowIso()) : null,
      updatedAt: nowIso(),
    };

    const response = await db.put(updated);
    return { success: true, reminder: { ...updated, _rev: response.rev } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function completeReminder(db, payload = {}) {
  try {
    const reminder = await getOwnedReminder(db, payload);
    const updated = {
      ...reminder,
      status: 'done',
      snoozedUntil: null,
      completedAt: nowIso(),
      updatedAt: nowIso(),
    };

    const response = await db.put(updated);
    return { success: true, reminder: { ...updated, _rev: response.rev } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function archiveReminder(db, payload = {}) {
  try {
    const reminder = await getOwnedReminder(db, payload);
    const updated = {
      ...reminder,
      state: 'Inactive',
      updatedAt: nowIso(),
    };

    const response = await db.put(updated);
    return { success: true, reminder: { ...updated, _rev: response.rev } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function snoozeReminder(db, payload = {}) {
  try {
    const reminder = await getOwnedReminder(db, payload);
    const snoozedUntil = normalizeDate(payload.snoozedUntil);

    if (!snoozedUntil) {
      throw new Error('A valid snooze time is required.');
    }

    const updated = {
      ...reminder,
      status: 'active',
      snoozedUntil,
      completedAt: null,
      updatedAt: nowIso(),
    };

    const response = await db.put(updated);
    return { success: true, reminder: { ...updated, _rev: response.rev } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  createReminder,
  getMyReminders,
  updateReminder,
  completeReminder,
  archiveReminder,
  snoozeReminder,
};
