import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'F.R.I.D.A.Y. — Voice Browser Agent',
  description: 'Speak a command. Watch a cloud browser execute it. Hear the result.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
