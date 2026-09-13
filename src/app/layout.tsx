import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'AEGIS.AI // Predictive Cyber Defence & Future Attack Simulation',
  description:
    'SIH AI-Powered Predictive Cyber Defence Platform: Temporal Network State Transitions, K-Step Simulation, MITRE ATT&CK Mapping & Blockchain Evidence Logs.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="soc-grid-bg min-h-screen bg-cyber-950 text-cyber-100 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
