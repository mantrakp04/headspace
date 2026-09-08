import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
const font = DM_Sans({ variable: '--font-sunroom', subsets: ['latin'] });
export const metadata: Metadata = {
  title: 'Sunroom · A little space for your music',
  description:
    'Your Spotify music, with room to breathe. A personal player for finding your flow.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${font.variable} antialiased`}>{children}</body>
    </html>
  );
}
