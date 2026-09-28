import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "AEGIS - Attack-stage forecasting",
  description: "Forecasts how a host's attack stage will evolve from network-flow features (CIC-IDS2017-trained world model).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans"><Shell>{children}</Shell></body>
    </html>
  );
}
