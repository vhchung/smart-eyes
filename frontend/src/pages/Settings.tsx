import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Settings as SettingsIcon, Bot, HardDrive } from 'lucide-react';
import { useState } from 'react';

export function Settings() {
  const { settings, fetchSettings, updateSettings, loading } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState({
    telegram_bot_token: '',
    telegram_chat_id: '',
    max_snapshots: 500,
    batch_cleanup_percent: 0.1,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        telegram_bot_token: settings.telegram_bot_token || '',
        telegram_chat_id: settings.telegram_chat_id || '',
        max_snapshots: settings.max_snapshots,
        batch_cleanup_percent: settings.batch_cleanup_percent,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    await updateSettings(localSettings);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Configure your security system</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Telegram Notifications
            </CardTitle>
            <CardDescription>Configure Telegram bot for alerts and notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bot_token">Bot Token</Label>
              <Input
                id="bot_token"
                type="password"
                value={localSettings.telegram_bot_token}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, telegram_bot_token: e.target.value })
                }
                placeholder="123456:ABC-DEF..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chat_id">Chat ID</Label>
              <Input
                id="chat_id"
                value={localSettings.telegram_chat_id}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, telegram_chat_id: e.target.value })
                }
                placeholder="123456789"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage Settings
            </CardTitle>
            <CardDescription>Manage snapshot storage and cleanup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Max Snapshots: {localSettings.max_snapshots}</Label>
              <Slider
                value={[localSettings.max_snapshots]}
                onValueChange={([v]) => setLocalSettings({ ...localSettings, max_snapshots: v })}
                min={100}
                max={2000}
                step={100}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Batch Cleanup: {(localSettings.batch_cleanup_percent * 100).toFixed(0)}%
              </Label>
              <Slider
                value={[localSettings.batch_cleanup_percent * 100]}
                onValueChange={([v]) =>
                  setLocalSettings({ ...localSettings, batch_cleanup_percent: v / 100 })
                }
                min={5}
                max={50}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                When limit is reached, {(localSettings.batch_cleanup_percent * 100).toFixed(0)}% of
                oldest snapshots will be removed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={loading}>
        <SettingsIcon className="h-4 w-4 mr-2" />
        Save Settings
      </Button>
    </div>
  );
}
