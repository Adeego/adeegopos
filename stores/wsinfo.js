import create from 'zustand';
import { persist } from 'zustand/middleware';

const useWsinfoStore = create(
  persist(
    (set) => ({
  wsinfo: {
    _id: null,
    name: '',
    phone: '',
    location: '',
    subscription: '',
    plan: '',
    manager: ''
  },
  addWsinfo: (wsinfoData) => set({ wsinfo: wsinfoData }),
  updateWsinfo: (updatedData) => set((state) => ({ wsinfo: { ...state.wsinfo, ...updatedData } })),
  deleteWsinfo: () => set({ wsinfo: { _id: null, name: '', phone: '', location: '', subscription: '', plan: '', manager: '' } })
    }),
    {
      name: 'wsinfo-storage', // unique name
      getStorage: () => localStorage, // (optional) by default, 'localStorage' is used
    }
  )
);

export default useWsinfoStore;
