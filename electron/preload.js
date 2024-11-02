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

    signInStaff: (phoneNumber, passcode) => ipcRenderer.invoke('sign-in-staff', phoneNumber, passcode),
    searchCustomers: (name) => ipcRenderer.invoke('search-customers', name),
    searchVariants: (searchTerm) => ipcRenderer.invoke('search-variants', searchTerm),
    searchProducts: (searchTerm) => ipcRenderer.invoke('search-products', searchTerm),
    searchCSS: (searchTerm, type) => ipcRenderer.invoke('search-css', searchTerm, type),
    realmOperation: (operation, ...args) => ipcRenderer.invoke('realm-operation', operation, ...args),
    getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
    onSyncStatusChanged: (callback) => {
      const subscription = (_event, status) => callback(status);
      ipcRenderer.on('sync-status-changed', subscription);
      return () => {
        ipcRenderer.removeListener('sync-status-changed', subscription);
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
