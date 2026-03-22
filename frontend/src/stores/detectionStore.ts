import { create } from 'zustand';
import { api, DetectionLog } from '@/lib/api';

interface DetectionState {
  detections: DetectionLog[];
  loading: boolean;
  error: string | null;
  fetchDetections: (cameraId?: number) => Promise<void>;
  deleteDetection: (id: number) => Promise<void>;
  clearAllDetections: () => Promise<void>;
}

export const useDetectionStore = create<DetectionState>((set) => ({
  detections: [],
  loading: false,
  error: null,

  fetchDetections: async (cameraId) => {
    set({ loading: true, error: null });
    try {
      const detections = await api.detections.list(cameraId);
      set({ detections, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  deleteDetection: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.detections.delete(id);
      set((state) => ({
        detections: state.detections.filter((d) => d.id !== id),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clearAllDetections: async () => {
    set({ loading: true, error: null });
    try {
      await api.detections.deleteAll();
      set({ detections: [], loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
}));
