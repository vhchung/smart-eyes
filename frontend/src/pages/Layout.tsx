import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Camera, Settings, AlertCircle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/cameras', label: 'Cameras', icon: Camera },
  { href: '/live', label: 'Live', icon: Play },
  { href: '/detections', label: 'Detections', icon: AlertCircle },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold">Smart Eyes</h1>
          <p className="text-sm text-muted-foreground">AI Security Server</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t">
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
