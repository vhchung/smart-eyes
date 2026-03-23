const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

export interface Camera {
  id: number;
  name: string;
  stream_url: string;
  rtsp_url: string | null;
  enabled: boolean;
  roi_x: number;
  roi_y: number;
  roi_width: number;
  roi_height: number;
  detection_sensitivity: number;
}

export interface CameraCreate {
  name: string;
  stream_url: string;
  rtsp_url?: string;
  username?: string;
  password?: string;
  enabled?: boolean;
  roi_x?: number;
  roi_y?: number;
  roi_width?: number;
  roi_height?: number;
  detection_sensitivity?: number;
}

export interface DetectionLog {
  id: number;
  camera_id: number;
  detection_type: string;
  confidence: number;
  snapshot_path: string | null;
  description: string | null;
  detected_at: string;
}

export interface Settings {
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  ai_model_path: string;
  moondream_model_path: string;
  max_snapshots: number;
  batch_cleanup_percent: number;
}

export const api = {
  cameras: {
    list: () => fetchJson<Camera[]>('/cameras'),
    get: (id: number) => fetchJson<Camera>(`/cameras/${id}`),
    create: (data: CameraCreate) =>
      fetchJson<Camera>('/cameras', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<CameraCreate>) =>
      fetchJson<Camera>(`/cameras/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchJson<{ message: string }>(`/cameras/${id}`, { method: 'DELETE' }),
  },

  settings: {
    get: () => fetchJson<Settings>('/settings'),
    update: (data: Partial<Settings>) =>
      fetchJson<{ message: string }>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  detections: {
    list: (cameraId?: number) =>
      fetchJson<DetectionLog[]>(`/detections${cameraId ? `?camera_id=${cameraId}` : ''}`),
    delete: (id: number) =>
      fetchJson<{ message: string }>(`/detections/${id}`, { method: 'DELETE' }),
    deleteAll: () => fetchJson<{ message: string }>('/detections', { method: 'DELETE' }),
  },

  streaming: {
    getStreams: () => fetchJson<{ streams: string[] }>('/streaming/streams'),
    getWebRTC: (cameraId: string) =>
      fetchJson<{ camera_id: string; offer: string }>(`/streaming/webrtc/${cameraId}`),
    submitAnswer: (cameraId: string, answer: string) =>
      fetchJson<{ status: string }>(`/streaming/webrtc/${cameraId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ sdp: answer }),
      }),
    closeConnection: (cameraId: string) =>
      fetchJson<{ status: string }>(`/streaming/webrtc/${cameraId}`, { method: 'DELETE' }),
  },
};
