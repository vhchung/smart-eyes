import { api } from './api';

export interface WebSocketConnection {
  cameraId: string;
  ws: WebSocket;
  onFrame: (imageData: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

const WS_BASE = `ws://${window.location.host}`;

export async function createWebSocketConnection(
  cameraId: string,
  onFrame: (imageData: string) => void,
  onError: (error: Error) => void,
  onClose: () => void
): Promise<WebSocketConnection | null> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/streaming/ws/${cameraId}`);

    const connection: WebSocketConnection = {
      cameraId,
      ws,
      onFrame,
      onError,
      onClose,
    };

    ws.onopen = () => {
      console.log(`WebSocket connected for camera ${cameraId}`);
      resolve(connection);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'frame') {
          connection.onFrame(data.data); // Base64 image data
        } else if (data.error) {
          connection.onError(new Error(data.error));
        }
      } catch (e) {
        console.error(`Error parsing WebSocket message for camera ${cameraId}:`, e);
      }
    };

    ws.onerror = (event) => {
      console.error(`WebSocket error for camera ${cameraId}:`, event);
      connection.onError(new Error('WebSocket connection failed'));
      reject(new Error('WebSocket connection failed'));
    };

    ws.onclose = () => {
      console.log(`WebSocket closed for camera ${cameraId}`);
      connection.onClose();
    };

    // Timeout after 10 seconds
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }
    }, 10000);
  });
}

export function closeWebSocketConnection(connection: WebSocketConnection | null): void {
  if (!connection) return;
  connection.ws.close();
}
