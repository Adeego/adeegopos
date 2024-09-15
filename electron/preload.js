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
    searchProducts: (searchTerm) => ipcRenderer.invoke('search-products', searchTerm),
    realmOperation: (operation, ...args) => ipcRenderer.invoke('realm-operation', operation, ...args),
    getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
    onSyncStatusChanged: (callback) => {
      const subscription = (_event, status) => callback(status);
      ipcRenderer.on('sync-status-changed', subscription);
      return () => {
        ipcRenderer.removeListener('sync-status-changed', subscription);
      };
    },
});
