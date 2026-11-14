'use client';
import { useEffect } from 'react';
/** Marks the page as interactive (used by automated tests to wait until the page has loaded). */
export function HydratedMarker() {
  useEffect(() => { document.documentElement.dataset.hydrated = '1'; }, []);
  return null;
}
