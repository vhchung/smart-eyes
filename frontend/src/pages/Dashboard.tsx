import { useEffect } from 'react';
import { useCameraStore } from '@/stores/cameraStore';
import { useDetectionStore } from '@/stores/detectionStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, AlertTriangle, Activity, HardDrive } from 'lucide-react';

export function Dashboard() {
  const { cameras, fetchCameras } = useCameraStore();
  const { detections, fetchDetections } = useDetectionStore();

  useEffect(() => {
    fetchCameras();
    fetchDetections();
  }, []);

  const enabledCameras = cameras.filter((c) => c.enabled).length;
  const recentDetections = detections.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">AI Security Monitoring System</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cameras</CardTitle>
            <Camera className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cameras.length}</div>
            <p className="text-xs text-muted-foreground">{enabledCameras} enabled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Detections</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{detections.length}</div>
            <p className="text-xs text-muted-foreground">Total detection events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Online</div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">Snapshot storage usage</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Camera Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {cameras.length === 0 ? (
              <p className="text-muted-foreground">No cameras configured</p>
            ) : (
              <ul className="space-y-2">
                {cameras.map((camera) => (
                  <li
                    key={camera.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted"
                  >
                    <span className="font-medium">{camera.name}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        camera.enabled
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-muted-foreground/20 text-muted-foreground'
                      }`}
                    >
                      {camera.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Detections</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDetections.length === 0 ? (
              <p className="text-muted-foreground">No detections recorded</p>
            ) : (
              <ul className="space-y-2">
                {recentDetections.map((detection) => (
                  <li
                    key={detection.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted"
                  >
                    <div>
                      <span className="font-medium">{detection.detection_type}</span>
                      <p className="text-xs text-muted-foreground">Camera #{detection.camera_id}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(detection.confidence * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
