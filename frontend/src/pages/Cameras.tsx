import { useEffect, useState } from 'react';
import { useCameraStore } from '@/stores/cameraStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Camera, Plus, Pencil, Trash2, Eye } from 'lucide-react';
import { CameraCreate, api } from '@/lib/api';
import { PolygonCanvas } from '@/components/PolygonCanvas';

export function Cameras() {
  const { cameras, fetchCameras, addCamera, updateCamera, removeCamera, loading } =
    useCameraStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [roiDialogOpen, setRoiDialogOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<number | null>(null);
  const [snapshotImage, setSnapshotImage] = useState<string | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [roiPolygon, setRoiPolygon] = useState<Array<{ x: number; y: number }>>([]);

  const [formData, setFormData] = useState<CameraCreate>({
    name: '',
    stream_url: '',
    rtsp_url: '',
    username: '',
    password: '',
    enabled: true,
    detection_enabled: true,
    notification_enabled: true,
    roi_x: 0,
    roi_y: 0,
    roi_width: 0,
    roi_height: 0,
    roi_polygon: null,
    detection_sensitivity: 0.5,
  });

  useEffect(() => {
    fetchCameras();
  }, []);

  const handleOpenDialog = (camera?: (typeof cameras)[0]) => {
    if (camera) {
      setEditingId(camera.id);
      setFormData({
        name: camera.name,
        stream_url: camera.stream_url,
        rtsp_url: camera.rtsp_url || '',
        enabled: camera.enabled,
        detection_enabled: camera.detection_enabled,
        notification_enabled: camera.notification_enabled,
        roi_x: camera.roi_x,
        roi_y: camera.roi_y,
        roi_width: camera.roi_width,
        roi_height: camera.roi_height,
        roi_polygon: camera.roi_polygon,
        detection_sensitivity: camera.detection_sensitivity,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        stream_url: '',
        rtsp_url: '',
        username: '',
        password: '',
        enabled: true,
        detection_enabled: true,
        notification_enabled: true,
        roi_x: 0,
        roi_y: 0,
        roi_width: 0,
        roi_height: 0,
        roi_polygon: null,
        detection_sensitivity: 0.5,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (editingId) {
      await updateCamera(editingId, formData);
    } else {
      await addCamera(formData);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this camera?')) {
      await removeCamera(id);
    }
  };

  const handleROI = async (cameraId: number) => {
    setSelectedCamera(cameraId);
    const camera = cameras.find((c) => c.id === cameraId);
    if (camera) {
      setRoiPolygon(camera.roi_polygon || []);
      setLoadingSnapshot(true);
      try {
        const snapshot = await api.cameras.getSnapshot(cameraId);
        setSnapshotImage(`data:image/jpeg;base64,${snapshot.image}`);
      } catch (err) {
        console.error('Failed to load snapshot:', err);
        setSnapshotImage(null);
      } finally {
        setLoadingSnapshot(false);
      }
    }
    setRoiDialogOpen(true);
  };

  const handleClearPolygon = () => {
    setRoiPolygon([]);
  };

  const handleSaveROI = async () => {
    if (selectedCamera) {
      await updateCamera(selectedCamera, {
        roi_polygon: roiPolygon.length >= 3 ? roiPolygon : null,
      });
    }
    setRoiDialogOpen(false);
    setSnapshotImage(null);
    setRoiPolygon([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cameras</h2>
          <p className="text-muted-foreground">Manage your security cameras</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Camera
        </Button>
      </div>

      {cameras.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Camera className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No cameras configured</p>
            <Button className="mt-4" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Camera
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cameras.map((camera) => (
            <Card key={camera.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{camera.name}</CardTitle>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    camera.enabled
                      ? 'bg-green-500/20 text-green-500'
                      : 'bg-muted-foreground/20 text-muted-foreground'
                  }`}
                >
                  {camera.enabled ? 'Active' : 'Disabled'}
                </span>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
                  <span className={camera.detection_enabled ? 'text-green-500' : ''}>
                    Detection: {camera.detection_enabled ? 'ON' : 'OFF'}
                  </span>
                  <span className={camera.notification_enabled ? 'text-green-500' : ''}>
                    Notify: {camera.notification_enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-4 truncate">{camera.stream_url}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenDialog(camera)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleROI(camera.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(camera.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Camera' : 'Add Camera'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update camera settings' : 'Configure a new security camera'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stream_url">Stream URL</Label>
                <Input
                  id="stream_url"
                  value={formData.stream_url}
                  onChange={(e) => setFormData({ ...formData, stream_url: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rtsp_url">RTSP URL (optional)</Label>
                <Input
                  id="rtsp_url"
                  value={formData.rtsp_url}
                  onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enabled">Enabled</Label>
                <div className="pt-2">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="detection_enabled">Person Detection</Label>
                <div className="pt-2">
                  <Switch
                    id="detection_enabled"
                    checked={formData.detection_enabled ?? true}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, detection_enabled: checked })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notification_enabled">Notifications</Label>
                <div className="pt-2">
                  <Switch
                    id="notification_enabled"
                    checked={formData.notification_enabled ?? true}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, notification_enabled: checked })
                    }
                  />
                </div>
              </div>
            </div>
            {!editingId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username (optional)</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password (optional)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>
                Detection Sensitivity: {((formData.detection_sensitivity ?? 0.5) * 100).toFixed(0)}%
              </Label>
              <Slider
                value={[(formData.detection_sensitivity ?? 0.5) * 100]}
                onValueChange={([v]) =>
                  setFormData({ ...formData, detection_sensitivity: v / 100 })
                }
                max={100}
                step={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {editingId ? 'Save Changes' : 'Add Camera'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roiDialogOpen} onOpenChange={setRoiDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Region of Interest (ROI)</DialogTitle>
            <DialogDescription>
              Draw a polygon on the camera frame to define the detection zone for{' '}
              {cameras.find((c) => c.id === selectedCamera)?.name}. Click to add points,
              double-click on a point to remove it (minimum 3 points required).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingSnapshot ? (
              <div className="flex items-center justify-center h-64 bg-muted rounded-md">
                <p className="text-muted-foreground">Loading camera snapshot...</p>
              </div>
            ) : snapshotImage ? (
              <PolygonCanvas
                imageUrl={snapshotImage}
                polygon={roiPolygon}
                onPolygonChange={setRoiPolygon}
              />
            ) : (
              <div className="flex items-center justify-center h-64 bg-muted rounded-md">
                <p className="text-muted-foreground">
                  Failed to load snapshot. Make sure the camera is enabled and streaming.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {roiPolygon.length < 3
                ? `Add ${3 - roiPolygon.length} more point${3 - roiPolygon.length > 1 ? 's' : ''} to create a polygon`
                : `${roiPolygon.length} points defined`}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearPolygon}
              disabled={roiPolygon.length === 0}
            >
              Clear Polygon
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoiDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveROI} disabled={loading || roiPolygon.length < 3}>
              Save ROI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
