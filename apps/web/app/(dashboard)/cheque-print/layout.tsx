'use client';

import React from 'react';
import { Instrument_Serif, Sora } from 'next/font/google';
import '@/styles/cheque-print.css';

const display = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
});

const body = Sora({
  subsets: ['latin'],
  variable: '--font-body',
});

export default function ChequePrintDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} cheque-print-scope`}>
      {children}
    </div>
  );
}
