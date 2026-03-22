import { useEffect, useState } from 'react';
import { useDetectionStore } from '@/stores/detectionStore';
import { useCameraStore } from '@/stores/cameraStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Calendar,
  Camera as CameraIcon,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';

export function Detections() {
  const { detections, fetchDetections, deleteDetection, clearAllDetections, loading } =
    useDetectionStore();
  const { cameras, fetchCameras } = useCameraStore();
  const [selectedCamera, setSelectedCamera] = useState<number | undefined>(undefined);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchCameras();
    fetchDetections();
  }, []);

  useEffect(() => {
    fetchDetections(selectedCamera);
  }, [selectedCamera]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getCameraName = (cameraId: number) => {
    const camera = cameras.find((c) => c.id === cameraId);
    return camera?.name || `Camera #${cameraId}`;
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete all detection logs?')) {
      await clearAllDetections();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Detection Logs</h2>
          <p className="text-muted-foreground">View and manage AI detection events</p>
        </div>
        <div className="flex gap-2">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedCamera || ''}
            onChange={(e) =>
              setSelectedCamera(e.target.value ? parseInt(e.target.value) : undefined)
            }
          >
            <option value="">All Cameras</option>
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.name}
              </option>
            ))}
          </select>
          <Button variant="destructive" onClick={handleClearAll} disabled={loading}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      {detections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No detections recorded</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {detections.map((detection) => (
            <Card key={detection.id} className="overflow-hidden">
              <div
                className="aspect-video bg-muted flex items-center justify-center cursor-pointer"
                onClick={() => setPreviewImage(detection.snapshot_path)}
              >
                {detection.snapshot_path ? (
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                ) : (
                  <CameraIcon className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{detection.detection_type}</CardTitle>
                  <span className="text-xs font-medium text-primary">
                    {(detection.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CameraIcon className="h-3 w-3" />
                  {getCameraName(detection.camera_id)}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(detection.detected_at)}
                </div>
                <div className="flex justify-end mt-2">
                  <Button variant="ghost" size="sm" onClick={() => deleteDetection(detection.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detection Snapshot</DialogTitle>
            <DialogDescription>
              {previewImage && detections.find((d) => d.snapshot_path === previewImage)
                ? getCameraName(detections.find((d) => d.snapshot_path === previewImage)!.camera_id)
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted rounded-lg aspect-video">
            <ImageIcon className="h-24 w-24 text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
