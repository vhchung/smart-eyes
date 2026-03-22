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
import { CameraCreate } from '@/lib/api';

export function Cameras() {
  const { cameras, fetchCameras, addCamera, updateCamera, removeCamera, loading } =
    useCameraStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [roiDialogOpen, setRoiDialogOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<number | null>(null);

  const [formData, setFormData] = useState<CameraCreate>({
    name: '',
    stream_url: '',
    rtsp_url: '',
    username: '',
    password: '',
    enabled: true,
    roi_x: 0,
    roi_y: 0,
    roi_width: 0,
    roi_height: 0,
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
        roi_x: camera.roi_x,
        roi_y: camera.roi_y,
        roi_width: camera.roi_width,
        roi_height: camera.roi_height,
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
        roi_x: 0,
        roi_y: 0,
        roi_width: 0,
        roi_height: 0,
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

  const handleROI = (cameraId: number) => {
    setSelectedCamera(cameraId);
    const camera = cameras.find((c) => c.id === cameraId);
    if (camera) {
      setFormData((prev) => ({
        ...prev,
        roi_x: camera.roi_x,
        roi_y: camera.roi_y,
        roi_width: camera.roi_width,
        roi_height: camera.roi_height,
      }));
    }
    setRoiDialogOpen(true);
  };

  const handleSaveROI = async () => {
    if (selectedCamera) {
      await updateCamera(selectedCamera, {
        roi_x: formData.roi_x,
        roi_y: formData.roi_y,
        roi_width: formData.roi_width,
        roi_height: formData.roi_height,
      });
    }
    setRoiDialogOpen(false);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Region of Interest (ROI)</DialogTitle>
            <DialogDescription>
              Set the region of interest for {cameras.find((c) => c.id === selectedCamera)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roi_x">X Position</Label>
                <Input
                  id="roi_x"
                  type="number"
                  value={formData.roi_x}
                  onChange={(e) =>
                    setFormData({ ...formData, roi_x: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roi_y">Y Position</Label>
                <Input
                  id="roi_y"
                  type="number"
                  value={formData.roi_y}
                  onChange={(e) =>
                    setFormData({ ...formData, roi_y: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roi_width">Width</Label>
                <Input
                  id="roi_width"
                  type="number"
                  value={formData.roi_width}
                  onChange={(e) =>
                    setFormData({ ...formData, roi_width: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roi_height">Height</Label>
                <Input
                  id="roi_height"
                  type="number"
                  value={formData.roi_height}
                  onChange={(e) =>
                    setFormData({ ...formData, roi_height: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoiDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveROI} disabled={loading}>
              Save ROI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
