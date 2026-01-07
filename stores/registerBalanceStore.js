import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const getDefaultBalances = () => ({
  cash: { opening: 0, closing: 0 },
  mpesa: { 
    phone: { opening: 0, closing: 0 },
    till: { opening: 0, closing: 0 }
  }
});

const useRegisterBalanceStore = create(
  persist(
    (set, get) => ({
      yesterday: getDefaultBalances(),
      today: getDefaultBalances(),
      createdAt: null,
      editHistory: [], // Array of { timestamp, editedBy, action, details }
      isSaved: false,

      // Update local state (anyone can do this - it's just UI state)
      setOpeningBalance: (method, subMethod, value) => set((state) => {
        // Ensure today has proper structure
        const today = {
          cash: state.today?.cash || { opening: 0, closing: 0 },
          mpesa: {
            phone: state.today?.mpesa?.phone || { opening: 0, closing: 0 },
            till: state.today?.mpesa?.till || { opening: 0, closing: 0 }
          }
        };

        if (method === 'cash') {
          return {
            today: {
              ...today,
              cash: { ...today.cash, opening: parseFloat(value) || 0 }
            }
          };
        } else if (method === 'mpesa' && subMethod) {
          return {
            today: {
              ...today,
              mpesa: {
                ...today.mpesa,
                [subMethod]: { ...today.mpesa[subMethod], opening: parseFloat(value) || 0 }
              }
            }
          };
        }
        return state;
      }),

      setClosingBalance: (method, subMethod, value) => set((state) => {
        // Ensure today has proper structure
        const today = {
          cash: state.today?.cash || { opening: 0, closing: 0 },
          mpesa: {
            phone: state.today?.mpesa?.phone || { opening: 0, closing: 0 },
            till: state.today?.mpesa?.till || { opening: 0, closing: 0 }
          }
        };

        if (method === 'cash') {
          return {
            today: {
              ...today,
              cash: { ...today.cash, closing: parseFloat(value) || 0 }
            }
          };
        } else if (method === 'mpesa' && subMethod) {
          return {
            today: {
              ...today,
              mpesa: {
                ...today.mpesa,
                [subMethod]: { ...today.mpesa[subMethod], closing: parseFloat(value) || 0 }
              }
            }
          };
        }
        return state;
      }),

      // Admin-only: Save balances (creates initial record)
      saveBalances: (adminName) => {
        const state = get();
        const now = new Date().toISOString();
        
        set({
          createdAt: state.createdAt || now,
          isSaved: true,
          editHistory: [
            ...(state.editHistory || []),
            {
              timestamp: now,
              editedBy: adminName,
              action: state.createdAt ? 'EDIT' : 'CREATE',
              details: `Saved register balances`
            }
          ]
        });
        return { success: true };
      },

      // Admin-only: Carry forward today's closing to yesterday (for new day)
      carryForward: (adminName) => {
        const state = get();
        const now = new Date().toISOString();
        
        // Ensure proper structure with null checks
        const cashClosing = state.today?.cash?.closing || 0;
        const phoneClosing = state.today?.mpesa?.phone?.closing || 0;
        const tillClosing = state.today?.mpesa?.till?.closing || 0;
        
        const currentToday = {
          cash: state.today?.cash || { opening: 0, closing: 0 },
          mpesa: {
            phone: state.today?.mpesa?.phone || { opening: 0, closing: 0 },
            till: state.today?.mpesa?.till || { opening: 0, closing: 0 }
          }
        };
        
        set({
          yesterday: currentToday,
          today: {
            cash: { opening: cashClosing, closing: 0 },
            mpesa: {
              phone: { opening: phoneClosing, closing: 0 },
              till: { opening: tillClosing, closing: 0 }
            }
          },
          isSaved: true,
          editHistory: [
            ...(state.editHistory || []),
            {
              timestamp: now,
              editedBy: adminName,
              action: 'CARRY_FORWARD',
              details: 'Started new day - carried forward closing balances'
            }
          ]
        });
        return { success: true };
      },

      // Admin-only: Reset all balances
      resetBalances: (adminName) => {
        const now = new Date().toISOString();
        
        set({
          yesterday: getDefaultBalances(),
          today: getDefaultBalances(),
          createdAt: null,
          isSaved: false,
          editHistory: [{
            timestamp: now,
            editedBy: adminName,
            action: 'DELETE',
            details: 'Reset all register balances'
          }]
        });
        return { success: true };
      },

      // Get M-Pesa totals (combined phone + till)
      getMpesaOpening: () => {
        const state = get();
        return (state.today.mpesa?.phone?.opening || 0) + (state.today.mpesa?.till?.opening || 0);
      },

      getMpesaClosing: () => {
        const state = get();
        return (state.today.mpesa?.phone?.closing || 0) + (state.today.mpesa?.till?.closing || 0);
      },

      // Get total opening balance
      getTotalOpening: () => {
        const state = get();
        const mpesaOpening = (state.today.mpesa?.phone?.opening || 0) + (state.today.mpesa?.till?.opening || 0);
        return (state.today.cash?.opening || 0) + mpesaOpening;
      },

      // Get total closing balance
      getTotalClosing: () => {
        const state = get();
        const mpesaClosing = (state.today.mpesa?.phone?.closing || 0) + (state.today.mpesa?.till?.closing || 0);
        return (state.today.cash?.closing || 0) + mpesaClosing;
      },

      // Get yesterday's total closing
      getYesterdayTotalClosing: () => {
        const state = get();
        const mpesaClosing = (state.yesterday.mpesa?.phone?.closing || 0) + (state.yesterday.mpesa?.till?.closing || 0);
        return (state.yesterday.cash?.closing || 0) + mpesaClosing;
      }
    }),
    {
      name: 'register-balance-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useRegisterBalanceStore;
