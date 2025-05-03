import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Minecraft Bot Dashboard',
  description: 'Control and monitor your Minecraft bot',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-gray-100">
          {children}
        </main>
      </body>
    </html>
  );
} 