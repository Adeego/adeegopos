import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { normalizeStaff } from '@/lib/rbac';

const useStaffStore = create(
  persist(
    (set) => ({
      staff: {
        _id: null,
        firstName: '',
        lastName: '',
        phone: '',
        role: '',
        roles: [],
        salary: null,
        storeNo: '',
        createdAt: null,
        updatedAt: null
      },
      addStaff: (staffData) => set({ staff: normalizeStaff(staffData) }),
      updateStaff: (updatedData) => set((state) => ({ staff: normalizeStaff({ ...state.staff, ...updatedData }) })),
      deleteStaff: () => set({
        staff: {
          _id: null,
          firstName: '',
          lastName: '',
          phone: '',
          role: '',
          roles: [],
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
