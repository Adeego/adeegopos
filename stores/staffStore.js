import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useStaffStore = create(
  persist(
    (set) => ({
      staff: {
        _id: null,
        firstName: '',
        lastName: '',
        phone: '',
        role: '',
        salary: null,
        storeNo: '',
        createdAt: null,
        updatedAt: null
      },
      addStaff: (staffData) => set({ staff: staffData }),
      updateStaff: (updatedData) => set((state) => ({ staff: { ...state.staff, ...updatedData } })),
      deleteStaff: () => set({
        staff: {
          _id: null,
          firstName: '',
          lastName: '',
          phone: '',
          role: '',
          salary: null,
          createdAt: null,
          updatedAt: null
        }
      }),
      isAuthenticated: () => {
        const state = useStaffStore.getState();
        return state.staff._id !== null;
      }
    }),
    {
      name: 'staff-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useStaffStore;
