import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DrawLess — one line, shortest ink wins',
  description: 'A daily physics puzzle. Draw one line. Shortest ink wins.',
  themeColor: '#3346D3'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#E4E9EA', fontFamily: '-apple-system, Segoe UI, Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
