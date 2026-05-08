'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, FileText, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import type { DashboardStats } from '@/types';

interface StatsCardsProps {
  stats: DashboardStats | undefined;
  loading: boolean;
  currency?: string;
}

export function StatsCards({ stats, loading, currency = 'USD' }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue, currency),
      icon: DollarSign,
      trend: stats.revenueTrend,
      color: 'from-primary to-purple-400',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      title: 'Paid Invoices',
      value: String(stats.paidCount),
      icon: FileText,
      trend: null,
      color: 'from-green-500 to-emerald-400',
      iconBg: 'bg-green-50 dark:bg-green-900/30',
      iconColor: 'text-green-600',
    },
    {
      title: 'Pending Amount',
      value: formatCurrency(stats.pendingAmount, currency),
      icon: Clock,
      trend: null,
      color: 'from-yellow-500 to-amber-400',
      iconBg: 'bg-yellow-50 dark:bg-yellow-900/30',
      iconColor: 'text-yellow-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
          >
            <Card className="group hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-text-2">{card.title}</span>
                <div className={`h-9 w-9 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-text-1">{card.value}</p>
              {card.trend !== null && (
                <div className={`flex items-center gap-1 mt-1 text-xs ${card.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {card.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{card.trend >= 0 ? '+' : ''}{card.trend}% vs last month</span>
                </div>
              )}
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
