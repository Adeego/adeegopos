import create from 'zustand';

const useWsinfoStore = create((set) => ({
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
}));

export default useWsinfoStore;
