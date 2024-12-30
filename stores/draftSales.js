import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useDraftSalesStore = create(
  persist(
    (set, get) => ({
      drafts: [],
      
      // Add a new draft sale
      addDraft: (saleData) => {
        const drafts = get().drafts;
        const newDraft = {
          id: Date.now().toString(), // Unique ID for the draft
          createdAt: new Date().toISOString(),
          ...saleData
        };
        set({ drafts: [...drafts, newDraft] });
      },

      // Remove a draft sale
      removeDraft: (draftId) => {
        const drafts = get().drafts;
        set({ drafts: drafts.filter(draft => draft.id !== draftId) });
      },

      // Get all draft sales
      getDrafts: () => get().drafts,

      // Clear all drafts
      clearDrafts: () => set({ drafts: [] }),
    }),
    {
      name: 'draft-sales-storage', // unique name for localStorage
    }
  )
);

export default useDraftSalesStore;
