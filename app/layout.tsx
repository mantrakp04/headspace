import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
const font = DM_Sans({ variable: '--font-sunroom', subsets: ['latin'] });
export const metadata: Metadata = {
  title: 'Headspace — Your music. In a different headspace.',
  description:
    'The original lime-green Windows Media Player skin, brought back to life on macOS with Spotify, visualizations, and built-in updates.',
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
