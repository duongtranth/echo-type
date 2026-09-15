import type { Metadata, Viewport } from 'next';
import { Open_Sans, Poppins } from 'next/font/google';
import { AuthBootstrap } from '@/components/auth/auth-bootstrap';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const openSans = Open_Sans({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  variable: '--font-open-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EchoType — Learn English by Listening, Speaking, Reading & Writing',
  description:
    'Master English through immersive practice: listen to content, read aloud with speech recognition, and type with real-time feedback.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} ${openSans.variable}`}>
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        <TooltipProvider>
          <AuthBootstrap />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
