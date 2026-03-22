import { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    const steps = [
      { progress: 20, status: 'Loading models...' },
      { progress: 40, status: 'Connecting to cameras...' },
      { progress: 60, status: 'Initializing AI engine...' },
      { progress: 80, status: 'Starting WebRTC server...' },
      { progress: 100, status: 'Ready!' },
    ];

    let currentStep = 0;

    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].progress);
        setStatus(steps[currentStep].status);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 500);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8 w-64">
        <div className="relative">
          <Eye className="h-24 w-24 text-primary animate-pulse" />
          <div className="absolute inset-0 h-24 w-24 bg-primary/20 rounded-full blur-xl animate-pulse" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Smart Eyes</h1>
          <p className="text-sm text-muted-foreground">AI Security Server</p>
        </div>

        <div className="w-full space-y-2">
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground">{status}</p>
        </div>

        <p className="text-xs text-muted-foreground">v3.0.0</p>
      </div>
    </div>
  );
}
