// Create a new message
function createMessage(db, messageData) {
  const message = {
    _id: messageData._id,
    sender: messageData.sender,
    recipient: messageData.recipient,
    content: messageData.content,
    subject: messageData.subject,
    timestamp: messageData.timestamp || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    type: "message",
    state: "Active"
  };
  return db
    .put(message)
    .then((response) => ({
      success: true,
      message: { _id: response.id, ...message },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get all messages
function getAllMessages(db) {
  return db
    .find({
      selector: { 
        type: "message",
        state: "Active",
        createdAt: { "$gt": null }
      },
      sort: [{ createdAt: "desc" }]
    })
    .then((result) => ({ success: true, messages: result.docs }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get a message by ID
function getMessageById(db, messageId) {
  return db
    .get(messageId)
    .then((message) => ({ success: true, message }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Update an existing message
function updateMessage(db, messageData) {
  const message = {
    _id: messageData._id,
    type: "message",
    state: "Active",
    ...messageData,
    updatedAt: new Date().toISOString()
  };
  return db
    .put(message)
    .then((response) => ({
      success: true,
      message: { _id: response.id, ...message },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Archive a message (soft delete)
function archiveMessage(db, messageId) {
  return db
    .get(messageId)
    .then((message) => {
      // Update the state field to "Inactive"
      message.state = "Inactive";
      return db.put(message);
    })
    .then(() => ({ success: true }))
    .catch((error) => ({ success: false, error: error.message }));
}

module.exports = {
  createMessage,
  getAllMessages,
  getMessageById,
  updateMessage,
  archiveMessage,
};
