import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
        storeNo: '',
        defaultCustId: '',
        ends: null,
        createdAt: null,
        updatedAt: null
      },
      addWsinfo: (wsinfoData) => set({ wsinfo: wsinfoData }),
      updateWsinfo: (updatedData) => set((state) => ({ wsinfo: { ...state.wsinfo, ...updatedData } })),
      deleteWsinfo: () => set({ wsinfo: { _id: null, name: '', phone: '', location: '', subscription: '', plan: '', ends: null, createdAt: null, updatedAt: null } })
    }),
    {
      name: 'wsinfo-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useWsinfoStore;
