const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    on: (channel, callback) => {
        ipcRenderer.on(channel, callback);
    },
    send: (channel, args) => {
        ipcRenderer.send(channel, args);
    },

    // Added this new method for Realm operations
    searchCustomers: (name) => ipcRenderer.invoke('search-customers', name),
    searchProducts: (searchTerm) => ipcRenderer.invoke('search-products', searchTerm),
    realmOperation: (operation, ...args) => ipcRenderer.invoke('realm-operation', operation, ...args)
});