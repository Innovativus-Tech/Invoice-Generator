'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Moon, Sun, Menu, Eye, CheckCircle, AlertCircle, Settings, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { SearchBar } from '@/components/layout/search-bar';
import { useAuth } from '@/hooks/use-auth';
import { 
  useNotifications, 
  useUnreadCount, 
  useMarkRead, 
  useMarkAllRead,
  type Notification 
} from '@/hooks/use-notifications';

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, logout } = useAuth();

  const { data: notifications, isLoading: isLoadingNotifs } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Close notifications dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    if (isNotificationsOpen || isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen, isUserMenuOpen]);

  // When dropdown opens, we rely on React Query cache or re-fetch automatically based on hook config
  // but useNotifications is standard useQuery which will refetch on mount.

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.is_read) {
      markRead.mutate(notif.id);
    }
    setIsNotificationsOpen(false);
    if (notif.invoice_id) {
      router.push(`/invoices/${notif.invoice_id}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invoice_viewed':
        return (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
            <Eye className="w-4 h-4" />
          </div>
        );
      case 'payment_received':
        return (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-500">
            <CheckCircle className="w-4 h-4" />
          </div>
        );
      case 'invoice_overdue':
        return (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
            <AlertCircle className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-500">
            <Bell className="w-4 h-4" />
          </div>
        );
    }
  };

  const roleBadgeClass = user?.role === 'owner'
    ? 'bg-purple-100 text-purple-700'
    : user?.role === 'admin'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-600';

  const initials = (user?.full_name || user?.email || 'U').slice(0, 1).toUpperCase();

  return (
    <header className="h-16 border-b border-border bg-white dark:bg-card flex items-center justify-between px-6 sticky top-0 z-20">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-text-2 hover:text-text-1 hover:bg-surface transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <SearchBar />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {user && (
          <div className="hidden md:flex items-center gap-2 pr-2">
            <span className="text-sm text-text-2">{user.org_name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass}`}>
              {user.role}
            </span>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-text-2 hover:text-text-1 hover:bg-surface transition-colors dark:hover:bg-border/30"
          suppressHydrationWarning
        >
          {mounted ? (theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />) : <div className="h-5 w-5" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 rounded-lg text-text-2 hover:text-text-1 hover:bg-surface transition-colors dark:hover:bg-border/30"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-[360px] max-h-[480px] bg-white dark:bg-card border border-border rounded-xl shadow-lg z-50 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-text-1">Notifications</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={() => markAllRead.mutate()}
                    className="text-sm text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              
              <div className="overflow-y-auto max-h-[420px]">
                {isLoadingNotifs ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse flex gap-3">
                        <div className="w-8 h-8 bg-border/40 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-border/40 rounded w-1/2" />
                          <div className="h-3 bg-border/40 rounded w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications && notifications.length > 0 ? (
                  <div className="divide-y divide-border">
                    {notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-surface dark:hover:bg-border/30 ${
                          !notif.is_read ? 'bg-primary/5 dark:bg-primary/10' : ''
                        }`}
                      >
                        {getNotificationIcon(notif.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium text-[13px] text-text-1 truncate">
                              {notif.title}
                            </span>
                            <span className="text-[11px] text-text-2 shrink-0">
                              {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-[12px] text-text-2 line-clamp-2">
                            {notif.message}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-text-2">
                    <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="relative" ref={userMenuRef}>
          <div onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
            <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface transition-colors dark:hover:bg-border/30">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center">
                <span className="text-xs font-semibold text-white">{initials}</span>
              </div>
            </button>
          </div>
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-lg border border-border bg-white shadow-lg z-50 overflow-hidden dark:bg-card">
              <div className="p-4 border-b border-border">
                <p className="font-semibold text-text-1 truncate">{user?.full_name || 'User'}</p>
                <p className="text-sm text-text-2 truncate">{user?.email}</p>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClass}`}>
                  {user?.role || 'staff'}
                </span>
                <p className="text-xs text-text-2 mt-2">{user?.org_name}</p>
              </div>
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  router.push('/settings');
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-text-1 hover:bg-surface dark:hover:bg-border/30"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-danger hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-border"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
