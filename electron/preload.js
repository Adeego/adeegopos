const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    getOnlineStatus: () => ipcRenderer.invoke('get-online-status'),
    onOnlineStatusChanged: (callback) => {
        const subscription = (_event, status) => callback(status);
        ipcRenderer.on('online-status-changed', subscription);
        return () => {
            ipcRenderer.removeListener('online-status-changed', subscription);
        };
    },
    on: (channel, callback) => {
        ipcRenderer.on(channel, callback);
    },
    send: (channel, args) => {
        ipcRenderer.send(channel, args);
    },

    setAuthenticatedStaff: (staff) => ipcRenderer.invoke('set-authenticated-staff', staff),
    signInStaff: (phoneNumber, passcode, storeNo) => ipcRenderer.invoke('sign-in-staff', phoneNumber, passcode, storeNo),
    searchCustomers: (name, storeNo) => ipcRenderer.invoke('search-customers', name, storeNo),
    searchVariants: (searchTerm, storeNo) => ipcRenderer.invoke('search-variants', searchTerm, storeNo),
    searchProducts: (searchTerm, storeNo) => ipcRenderer.invoke('search-products', searchTerm, storeNo),
    searchCSS: (searchTerm, type, storeNo) => ipcRenderer.invoke('search-css', searchTerm, type, storeNo),
    restock: (task, ...args) => ipcRenderer.invoke('restock', task, ...args),
    openAIAuthStatus: () => ipcRenderer.invoke('openai-auth-status'),
    openAIAuthLogin: () => ipcRenderer.invoke('openai-auth-login'),
    openAIAuthLogout: () => ipcRenderer.invoke('openai-auth-logout'),
    aiAnalysis: (metrics, onData, onComplete, onError) => {
      const responseHandler = (_event, data) => {
        if (data.done) {
          onComplete();
          ipcRenderer.removeListener('aiAnalysis-data', responseHandler);
          ipcRenderer.removeListener('aiAnalysis-error', errorHandler);
        } else {
          onData(data.chunk);
        }
      };

      const errorHandler = (_event, error) => {
        onError(error);
        ipcRenderer.removeListener('aiAnalysis-data', responseHandler);
        ipcRenderer.removeListener('aiAnalysis-error', errorHandler);
      };

      ipcRenderer.on('aiAnalysis-data', responseHandler);
      ipcRenderer.on('aiAnalysis-error', errorHandler);
      ipcRenderer.send('aiAnalysis-start', metrics);
    },
    // AI Assistant
    aiAssistantChat: (sessionId, message, storeNo, storeContext, onChunk, onToolCall, onDone, onError) => {
      if (typeof storeContext === 'function') {
        onError = onDone;
        onDone = onToolCall;
        onToolCall = onChunk;
        onChunk = storeContext;
        storeContext = {};
      }
      const chunkHandler = (_event, data) => onChunk(data.chunk);
      const toolHandler = (_event, data) => onToolCall(data.toolName);
      const doneHandler = (_event, data) => {
        onDone();
        ipcRenderer.removeListener('ai-assistant-chunk', chunkHandler);
        ipcRenderer.removeListener('ai-assistant-tool', toolHandler);
        ipcRenderer.removeListener('ai-assistant-done', doneHandler);
        ipcRenderer.removeListener('ai-assistant-error', errorHandler);
      };
      const errorHandler = (_event, data) => {
        onError(data.error);
        ipcRenderer.removeListener('ai-assistant-chunk', chunkHandler);
        ipcRenderer.removeListener('ai-assistant-tool', toolHandler);
        ipcRenderer.removeListener('ai-assistant-done', doneHandler);
        ipcRenderer.removeListener('ai-assistant-error', errorHandler);
      };

      ipcRenderer.on('ai-assistant-chunk', chunkHandler);
      ipcRenderer.on('ai-assistant-tool', toolHandler);
      ipcRenderer.on('ai-assistant-done', doneHandler);
      ipcRenderer.on('ai-assistant-error', errorHandler);
      ipcRenderer.send('ai-assistant-chat', { sessionId, message, storeNo, storeContext });
    },
    aiAssistantClear: (sessionId) => ipcRenderer.invoke('ai-assistant-clear', sessionId),

    message: (sms, ...args) => ipcRenderer.invoke('message', sms, ...args),
    realmOperation: (operation, ...args) => ipcRenderer.invoke('realm-operation', operation, ...args),
    getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
    onSyncStatusChanged: (callback) => {
      const subscription = (_event, status) => callback(status);
      ipcRenderer.on('sync-status-changed', subscription);
      return () => {
        ipcRenderer.removeListener('sync-status-changed', subscription);
      };
    },

    onMessageCreated: (callback) => {
      const subscription = (_event, status) => callback(status);
      ipcRenderer.on('message-created', subscription);
      return () => {
        ipcRenderer.removeListener('message-created', subscription);
      };
    },

    onRestockTriggered: (callback) => {
      const subscription = (_event, productData) => callback(productData);
      ipcRenderer.on('restock-triggered', subscription);
      return () => {
        ipcRenderer.removeListener('restock-triggered', subscription);
      };
    },

    onRestockReportGenerated: (callback) => {
      const subscription = (_event, data) => callback(data);
      ipcRenderer.on('restock-report-generated', subscription);
      return () => {
        ipcRenderer.removeListener('restock-report-generated', subscription);
      };
    },

    // Auto-update methods
    // checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    // downloadUpdate: () => ipcRenderer.invoke('download-update'),
    // installUpdate: () => ipcRenderer.invoke('install-update'),
    // onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
    // onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
    // onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
    // onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
    // onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
    // onUpdateMessage: (callback) => ipcRenderer.on('update-message', callback),
});
