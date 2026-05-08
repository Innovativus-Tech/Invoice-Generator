'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
  Package,
  TrendingUp,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { role } = usePermissions();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/sales', label: 'Sales', icon: TrendingUp },
    { href: '/purchases', label: 'Purchases', icon: ShoppingCart },
    { href: '/invoices', label: 'Invoices', icon: FileText },
    { href: '/clients', label: 'Clients', icon: Users },
    { href: '/inventory', label: 'Inventory', icon: Package },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
  };

  const roleBadgeClass = role === 'owner'
    ? 'text-purple-200 bg-purple-500/20'
    : role === 'admin'
      ? 'text-blue-200 bg-blue-500/20'
      : 'text-gray-300 bg-white/10';

  return (
    <>
      {/* Mobile overlay */}
      <div className={cn(
        'fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity',
        collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
      )} onClick={() => setCollapsed(true)} />

      <aside
        className={cn(
          'fixed left-0 top-0 h-screen bg-[#1A1825] z-40 flex flex-col transition-all duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-60',
          'lg:relative'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
          <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-white font-semibold text-lg whitespace-nowrap overflow-hidden"
              >
                QuickInvoice
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className={cn('px-4 py-4 border-b border-white/10', collapsed && 'px-2')}>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-white font-bold text-[14pt] truncate">{user?.org_name || 'Organization'}</p>
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass}`}>
                  {role}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href.split('?')[0]);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5',
                  collapsed && 'justify-center px-0'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-2 pb-4 space-y-1">
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 w-full',
              collapsed && 'justify-center px-0'
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  Sign Out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-[#1A1825] border-2 border-border flex items-center justify-center text-gray-400 hover:text-white transition-colors hidden lg:flex"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>
    </>
  );
}
