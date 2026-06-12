import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { SocketProvider } from '@/hooks/useSocket';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'RoomZero | Privacy-First Real-Time Social Playground',
  description:
    'Connect instantly with friends or strangers using temporary links. Play Scribble, Story Builder, and Never Have I Ever, share self-destructing media, and video call under complete mutual consent.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${outfit.variable} antialiased`}>
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
