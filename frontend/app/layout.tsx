import type { Metadata } from 'next';
import './style.css';
export const metadata: Metadata = { title: 'ZENBEE · Automation Studio', description: 'Your creative command center for cartoon series, stories and episode schedules.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
