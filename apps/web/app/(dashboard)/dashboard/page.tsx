'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Users, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { RecentInvoices } from '@/components/dashboard/recent-invoices';
import { Card } from '@/components/ui/card';
import { useDashboardStats, useSettings } from '@/hooks/use-settings';
import { useInvoices } from '@/hooks/use-invoices';
import { usePermissions } from '@/hooks/use-permissions';

export default function DashboardPage() {
  const router = useRouter();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices({ limit: 5 });
  const { data: settings } = useSettings();
  const { can } = usePermissions();

  const quickActions = [
    can('invoices', 'create') ? { label: 'New Invoice', icon: Plus, href: '/invoices/new', color: 'bg-primary text-white hover:bg-primary/90' } : null,
    can('clients', 'create') ? { label: 'Add Client', icon: Users, href: '/clients', color: 'bg-surface text-text-1 border border-border hover:bg-border/30 dark:bg-card dark:hover:bg-border/30' } : null,
    { label: 'View Reports', icon: BarChart3, href: '/dashboard', color: 'bg-surface text-text-1 border border-border hover:bg-border/30 dark:bg-card dark:hover:bg-border/30' },
  ].filter(Boolean) as { label: string; icon: typeof Plus; href: string; color: string }[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's your business overview."
      />

      {/* Stats */}
      <StatsCards stats={stats || undefined} loading={statsLoading} currency={settings?.currency} />

      {/* Charts + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <Card>
            <h3 className="text-lg font-semibold text-text-1 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              {quickActions.map((action, i) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.3 }}
                    onClick={() => router.push(action.href)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${action.color}`}
                  >
                    <Icon className="h-5 w-5" />
                    {action.label}
                  </motion.button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Invoices */}
      <RecentInvoices invoices={invoicesData?.invoices} loading={invoicesLoading} />
    </div>
  );
}
