import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Phone NAS Server Console',
  description: 'Self-hosted Android NAS, Terminal and Remote Management Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="bg-bg-base text-fg antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
