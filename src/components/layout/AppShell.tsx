'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { DemoFlowBanner } from './DemoFlowBanner';
import { CyberToastProvider } from '../ui/CyberToast';
import { CyberEnvironment } from '../3d/CyberEnvironment';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const isLanding = pathname === '/';

  if (isLanding) {
    return (
      <CyberToastProvider>
        <div className="min-h-screen bg-[#060a10] text-cyber-100 font-sans antialiased selection:bg-cyan-500 selection:text-cyber-950 overflow-x-hidden">
          {children}
        </div>
      </CyberToastProvider>
    );
  }

  return (
    <CyberToastProvider>
      <div className="min-h-screen bg-[#060a10] text-cyber-100 flex overflow-x-hidden font-sans antialiased selection:bg-cyan-500 selection:text-cyber-950 relative">
        {/* Shared 3D Cyber Universe Ambient Layer for all 9 screens */}
        <CyberEnvironment />

        {/* Fixed Left Sidebar with glassmorphic transparency */}
        <div className="relative z-20">
          <Sidebar />
        </div>

        {/* Main Content Area over the 3D space */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <TopNav />
          <DemoFlowBanner />
          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </CyberToastProvider>
  );
};
