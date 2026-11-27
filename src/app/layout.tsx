import type { Metadata } from 'next';
import './globals.css';
import { HydratedMarker } from '@/components/hydrated';

export const metadata: Metadata = { title: { default: 'EventOS', template: '%s · EventOS' }, description: 'Quotations, bookings and crews for event management companies.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}<HydratedMarker /></body></html>);
}
