import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SplashScreen } from '@/components/SplashScreen';
import { Layout } from '@/pages/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Cameras } from '@/pages/Cameras';
import { Settings } from '@/pages/Settings';
import { Detections } from '@/pages/Detections';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <TooltipProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/cameras" element={<Cameras />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/detections" element={<Detections />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
