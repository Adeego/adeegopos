import { create } from 'zustand';
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
        Manager: ''
      },
      addWsinfo: (wsinfoData) => set({ wsinfo: wsinfoData }),
      updateWsinfo: (updatedData) => set((state) => ({ wsinfo: { ...state.wsinfo, ...updatedData } })),
      deleteWsinfo: () => set({ wsinfo: { _id: null, name: '', phone: '', location: '', subscription: '', plan: '', Manager: '' } })
    }),
    {
      name: 'wsinfo-storage',
      getStorage: () => localStorage,
    }
  )
);

export default useWsinfoStore;
