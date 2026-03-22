import { create } from 'zustand';
import { api, Camera, CameraCreate } from '@/lib/api';

interface CameraState {
  cameras: Camera[];
  loading: boolean;
  error: string | null;
  fetchCameras: () => Promise<void>;
  addCamera: (data: CameraCreate) => Promise<void>;
  updateCamera: (id: number, data: Partial<CameraCreate>) => Promise<void>;
  removeCamera: (id: number) => Promise<void>;
}

export const useCameraStore = create<CameraState>((set) => ({
  cameras: [],
  loading: false,
  error: null,

  fetchCameras: async () => {
    set({ loading: true, error: null });
    try {
      const cameras = await api.cameras.list();
      set({ cameras, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  addCamera: async (data) => {
    set({ loading: true, error: null });
    try {
      const camera = await api.cameras.create(data);
      set((state) => ({ cameras: [...state.cameras, camera], loading: false }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateCamera: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const camera = await api.cameras.update(id, data);
      set((state) => ({
        cameras: state.cameras.map((c) => (c.id === id ? camera : c)),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  removeCamera: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.cameras.delete(id);
      set((state) => ({
        cameras: state.cameras.filter((c) => c.id !== id),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
}));
