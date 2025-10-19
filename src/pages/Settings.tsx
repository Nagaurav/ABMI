import { useState, useEffect } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Volume2, Bell, Mail, Moon, Sun } from 'lucide-react';
import { getUserSettings, updateUserSettings, type UserSettings } from '@/lib/settings';

const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'created_at' | 'updated_at'> = {
  theme: 'light',
  language: 'en',
  sound_effects: true,
  notifications_enabled: true,
  email_notifications: true,
};

const Settings = () => {
  const { toast } = useToast();
  const user = useUser();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Omit<UserSettings, 'id' | 'created_at' | 'updated_at'>>(DEFAULT_SETTINGS);
  const [formData, setFormData] = useState<Partial<Omit<UserSettings, 'id' | 'created_at' | 'updated_at'>>>({});

  // Fetch user settings on mount
  useEffect(() => {
    if (user?.id) {
      fetchSettings();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch user settings
  const fetchSettings = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      const settings = await getUserSettings(user.id);
      setSettings(settings);
      
      // Apply theme
      document.documentElement.classList.toggle('dark', settings.theme === 'dark');
      
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('Failed to load settings');
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save settings
  const saveSettings = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to save settings',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      
      // Update settings in the database
      const updatedSettings = await updateUserSettings(user.id, formData);
      
      // Update local state
      setSettings(updatedSettings);
      
      // Apply theme if it was changed
      if (formData.theme !== undefined) {
        document.documentElement.classList.toggle('dark', formData.theme === 'dark');
      }

      // Reset form data
      setFormData({});
      
      toast({
        title: 'Success',
        description: 'Settings saved successfully',
      });
      
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = (formData.theme ?? settings.theme) === 'light' ? 'dark' : 'light';
    setFormData(prev => ({
      ...prev,
      theme: newTheme
    }));
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Toggle boolean settings
  const toggleSetting = (key: keyof Omit<UserSettings, 'id' | 'created_at' | 'updated_at' | 'theme' | 'language'>) => {
    setFormData(prev => ({
      ...prev,
      [key]: !(prev[key] ?? settings[key])
    }));
  };

  // Check for changes
  const hasChanges = Object.keys(formData).length > 0 && 
    Object.entries(formData).some(([key, value]) => {
      return value !== settings[key as keyof typeof settings];
    });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-lg font-medium">Loading your settings...</p>
          <p className="text-sm text-muted-foreground">This will just take a moment</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-destructive">Error Loading Settings</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={fetchSettings} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>
        <Button 
          onClick={saveSettings} 
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : 'Save Changes'}
        </Button>
      </div>

      {/* Theme Settings */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-6">Appearance</h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(formData.theme ?? settings.theme) === 'dark' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
              <div>
                <h3 className="font-medium">Theme</h3>
                <p className="text-sm text-muted-foreground">
                  {(formData.theme ?? settings.theme) === 'dark' ? 'Dark' : 'Light'} theme
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                (formData.theme ?? settings.theme) === 'dark' 
                  ? 'bg-primary' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
              aria-label="Toggle dark mode"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  (formData.theme ?? settings.theme) === 'dark' 
                    ? 'translate-x-6' 
                    : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Sound Settings */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-6">Sound</h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-5 w-5" />
              <div>
                <h3 className="font-medium">Sound Effects</h3>
                <p className="text-sm text-muted-foreground">
                  {(formData.sound_effects ?? settings.sound_effects) ? 'On' : 'Off'}
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting('sound_effects')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                (formData.sound_effects ?? settings.sound_effects)
                  ? 'bg-primary' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
              aria-label="Toggle sound effects"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  (formData.sound_effects ?? settings.sound_effects)
                    ? 'translate-x-6' 
                    : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-6">Notifications</h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5" />
              <div>
                <h3 className="font-medium">Push Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  {(formData.notifications_enabled ?? settings.notifications_enabled) ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting('notifications_enabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                (formData.notifications_enabled ?? settings.notifications_enabled)
                  ? 'bg-primary' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
              aria-label="Toggle notifications"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  (formData.notifications_enabled ?? settings.notifications_enabled)
                    ? 'translate-x-6' 
                    : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5" />
              <div>
                <h3 className="font-medium">Email Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  {(formData.email_notifications ?? settings.email_notifications) ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting('email_notifications')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                (formData.email_notifications ?? settings.email_notifications)
                  ? 'bg-primary' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
              aria-label="Toggle email notifications"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  (formData.email_notifications ?? settings.email_notifications)
                    ? 'translate-x-6' 
                    : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;