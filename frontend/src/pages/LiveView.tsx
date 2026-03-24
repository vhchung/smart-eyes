import { useEffect, useRef, useState, useCallback } from 'react';
import { api, Camera } from '@/lib/api';
import {
  createWebSocketConnection,
  closeWebSocketConnection,
  WebSocketConnection,
} from '@/lib/websocket';
import { Video, X, Play, Square } from 'lucide-react';

interface CameraConnection {
  camera: Camera;
  wsConnection: WebSocketConnection | null;
  status: 'connecting' | 'connected' | 'error' | 'closed';
  error?: string;
  imageData?: string;
}

export function LiveView() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [connections, setConnections] = useState<Map<number, CameraConnection>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<number | null>(null);
  const imgRefs = useRef<Map<number, HTMLImageElement>>(new Map());

  const fetchCameras = useCallback(async () => {
    try {
      const cameraList = await api.cameras.list();
      // Use rtsp_url if available, otherwise fall back to stream_url
      const enabledCameras = cameraList.filter((c) => c.enabled && (c.rtsp_url || c.stream_url));
      setCameras(enabledCameras);
      return enabledCameras;
    } catch (error) {
      console.error('Failed to fetch cameras:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectCamera = useCallback((cameraId: number) => {
    setConnections((prev) => {
      const updated = new Map(prev);
      const conn = updated.get(cameraId);
      if (conn && conn.wsConnection) {
        closeWebSocketConnection(conn.wsConnection);
        updated.set(cameraId, { ...conn, status: 'closed', wsConnection: null });
      }
      return updated;
    });
  }, []);

  const connectCamera = useCallback((camera: Camera) => {
    // Set initial connecting state
    setConnections((prev) => {
      const updated = new Map(prev);
      updated.set(camera.id, {
        camera,
        wsConnection: null,
        status: 'connecting',
      });
      return updated;
    });

    const handleFrame = (imageData: string) => {
      setConnections((prev) => {
        const updated = new Map(prev);
        const conn = updated.get(camera.id);
        if (conn) {
          conn.imageData = imageData;
          conn.status = 'connected';
        }
        return updated;
      });
    };

    const handleError = (error: Error) => {
      console.error(`Error for camera ${camera.id}:`, error);
      setConnections((prev) => {
        const updated = new Map(prev);
        const conn = updated.get(camera.id);
        if (conn) {
          conn.status = 'error';
          conn.error = error.message;
        }
        return updated;
      });
    };

    const handleClose = () => {
      setConnections((prev) => {
        const updated = new Map(prev);
        const conn = updated.get(camera.id);
        if (conn) {
          conn.status = 'closed';
        }
        return updated;
      });
    };

    createWebSocketConnection(String(camera.id), handleFrame, handleError, handleClose)
      .then((wsConn) => {
        if (wsConn) {
          setConnections((prev) => {
            const updated = new Map(prev);
            const conn = updated.get(camera.id);
            if (conn) {
              conn.wsConnection = wsConn;
            }
            return updated;
          });
        }
      })
      .catch((error) => {
        handleError(error);
      });
  }, []);

  const handleCameraClick = useCallback(
    (cameraId: number) => {
      if (selectedCamera === cameraId) {
        // Already selected, do nothing or toggle off
        return;
      }

      // Close all other camera connections
      connections.forEach((_, id) => {
        if (id !== cameraId) {
          disconnectCamera(id);
        }
      });

      setSelectedCamera(cameraId);

      // Connect to the selected camera if not already connected
      const conn = connections.get(cameraId);
      if (!conn || !conn.wsConnection || conn.status === 'closed' || conn.status === 'error') {
        const camera = cameras.find((c) => c.id === cameraId);
        if (camera) {
          connectCamera(camera);
        }
      }
    },
    [selectedCamera, connections, cameras, disconnectCamera, connectCamera]
  );

  const handleStopStream = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectedCamera !== null) {
        disconnectCamera(selectedCamera);
        setSelectedCamera(null);
      }
    },
    [selectedCamera, disconnectCamera]
  );

  const handleStopStreamForCamera = useCallback(
    (cameraId: number) => {
      disconnectCamera(cameraId);
    },
    [disconnectCamera]
  );

  const handlePlayCamera = useCallback(
    (cameraId: number) => {
      const camera = cameras.find((c) => c.id === cameraId);
      if (camera) {
        connectCamera(camera);
        setSelectedCamera(cameraId);
      }
    },
    [cameras, connectCamera]
  );

  const handleBackToGrid = useCallback(() => {
    setSelectedCamera(null);
  }, []);

  useEffect(() => {
    fetchCameras();

    return () => {
      // Cleanup all connections on unmount
      connections.forEach((_, cameraId) => {
        disconnectCamera(cameraId);
      });
    };
  }, []); // Only run once on mount

  // Handle image element ref assignment and image update
  const setImgRef = useCallback((cameraId: number, el: HTMLImageElement | null) => {
    if (el) {
      imgRefs.current.set(cameraId, el);
    } else {
      imgRefs.current.delete(cameraId);
    }
  }, []);

  // Update image src when imageData changes
  useEffect(() => {
    connections.forEach((conn, cameraId) => {
      const imgEl = imgRefs.current.get(cameraId);
      if (imgEl && conn.imageData) {
        imgEl.src = `data:image/jpeg;base64,${conn.imageData}`;
      }
    });
  }, [connections]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading cameras...</p>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Video className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">No cameras available for live streaming.</p>
        <p className="text-sm text-muted-foreground">
          Add a camera with an RTSP URL to start streaming.
        </p>
      </div>
    );
  }

  // Full screen view for selected camera
  if (selectedCamera !== null) {
    const camera = cameras.find((c) => c.id === selectedCamera);
    const conn = connections.get(selectedCamera);

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBackToGrid}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Play className="h-4 w-4" />
            Back to Grid
          </button>
          <h2 className="text-xl font-bold">{camera?.name}</h2>
          <button
            onClick={handleStopStream}
            className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 ml-auto"
          >
            <X className="h-4 w-4" />
            Stop
          </button>
        </div>
        <div className="flex-1 bg-black rounded-lg overflow-hidden relative">
          <img
            ref={(el) => setImgRef(selectedCamera, el)}
            alt={camera?.name}
            className="w-full h-full object-contain"
          />
          {conn?.status === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white">Connecting...</div>
            </div>
          )}
          {conn?.status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-red-400">{conn.error || 'Connection failed'}</div>
            </div>
          )}
          {conn?.status === 'closed' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white">Stream stopped</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid view
  const gridCols = Math.min(cameras.length, 3);
  const gridRows = Math.ceil(cameras.length / gridCols);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Live View</h2>
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        }}
      >
        {cameras.map((camera) => {
          const conn = connections.get(camera.id);
          const isConnected = conn?.status === 'connected' || conn?.status === 'connecting';
          return (
            <div
              key={camera.id}
              className="relative aspect-video bg-black rounded-lg overflow-hidden"
            >
              <img
                ref={(el) => setImgRef(camera.id, el)}
                alt={camera.name}
                className="w-full h-full object-cover"
              />
              {/* Camera name overlay */}
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-2 z-10">
                <span className="text-white text-sm font-medium">{camera.name}</span>
              </div>
              {/* Play/Stop button */}
              <button
                onClick={() =>
                  isConnected ? handleStopStreamForCamera(camera.id) : handlePlayCamera(camera.id)
                }
                className={`absolute bottom-2 right-2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                  isConnected
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {isConnected ? (
                  <>
                    <Square className="h-3 w-3" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    Play
                  </>
                )}
              </button>
              {/* Status indicator */}
              {conn?.status === 'connecting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-white text-sm">Connecting...</div>
                </div>
              )}
              {conn?.status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-red-400 text-sm text-center p-2">
                    {conn.error || 'Connection failed'}
                  </div>
                </div>
              )}
              {!conn && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-white text-sm">Not playing</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
