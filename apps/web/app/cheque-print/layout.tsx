'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Instrument_Serif, Sora } from 'next/font/google';
import './cheque-print.css';

const display = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
});

const body = Sora({
  subsets: ['latin'],
  variable: '--font-body',
});

export default function ChequePrintLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  React.useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  return (
    <div
      className={`${display.variable} ${body.variable} cheque-print-scope app-atmosphere flex min-h-screen flex-col antialiased`}
    >
      {children}
    </div>
  );
}
