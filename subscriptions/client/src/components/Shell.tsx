import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  Layers,
  FileCheck,
  RefreshCw,
  FileText,
  CreditCard,
  Percent,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  LogOut,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
  Home
} from 'lucide-react';
import { useAuth, UserRole } from '../context/AuthContext';
import { api } from '../api/client';

export type NavTab =
  | 'overview'
  | 'customers'
  | 'products'
  | 'plans'
  | 'quotations'
  | 'subscriptions'
  | 'invoices'
  | 'payments'
  | 'discounts'
  | 'reports'
  | 'settings'
  | 'portal';

interface ShellProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ currentTab, onSelectTab, children }) => {
  const { user, logout, switchRole } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Fetch notifications
  const loadNotifications = async () => {
    try {
      const res = await api.get('/api/search/notifications');
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle global search
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const delay = setTimeout(async () => {
        try {
          const res = await api.get(`/api/search?q=${encodeURIComponent(searchQuery)}`);
          setSearchResults(res);
          setShowSearchDropdown(true);
        } catch (err) {
          // ignore
        }
      }, 250);
      return () => clearTimeout(delay);
    } else {
      setSearchResults(null);
      setShowSearchDropdown(false);
    }
  }, [searchQuery]);

  const markAllNotificationsRead = async () => {
    try {
      await api.post('/api/search/notifications/mark-read', {});
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (err) {
      // ignore
    }
  };

  // RBAC Navigation items
  const isCustomer = user?.role === 'CUSTOMER';
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = user?.role === 'STAFF';

  const navItems = isCustomer
    ? [
        { id: 'portal' as NavTab, label: 'Customer Portal', icon: Home, badge: 'Active' },
        { id: 'subscriptions' as NavTab, label: 'My Subscriptions', icon: RefreshCw },
        { id: 'invoices' as NavTab, label: 'My Invoices', icon: FileText },
        { id: 'payments' as NavTab, label: 'My Payment Receipts', icon: CreditCard }
      ]
    : [
        { id: 'overview' as NavTab, label: 'Overview', icon: LayoutDashboard },
        { id: 'customers' as NavTab, label: 'Customers', icon: Users },
        { id: 'products' as NavTab, label: 'Products & Variants', icon: Package },
        { id: 'plans' as NavTab, label: 'Subscription Plans', icon: Layers },
        { id: 'quotations' as NavTab, label: 'Quotations', icon: FileCheck },
        { id: 'subscriptions' as NavTab, label: 'Subscriptions', icon: RefreshCw },
        { id: 'invoices' as NavTab, label: 'Invoices', icon: FileText },
        { id: 'payments' as NavTab, label: 'Payments', icon: CreditCard },
        { id: 'discounts' as NavTab, label: 'Discounts', icon: Percent },
        { id: 'reports' as NavTab, label: 'Reports', icon: BarChart3 },
        ...(isAdmin ? [{ id: 'settings' as NavTab, label: 'Settings', icon: Settings }] : [])
      ];

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-wrapper">
            <div className="brand-icon">
              <RefreshCw size={22} className="spin-slow" />
            </div>
            {!collapsed && (
              <div className="brand-text">
                <span className="brand-title">Subscription OS</span>
                <span className="brand-subtitle">Brightloop Software</span>
              </div>
            )}
          </div>
          <button
            className="icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="nav-section">
          {!collapsed && <div className="nav-label">Main Navigation</div>}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <div
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="icon" />
                {!collapsed && <span>{item.label}</span>}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer: System Status */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
            {!collapsed && <span>Enterprise Engine Online</span>}
          </div>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="main-wrapper">
        {/* Top Header Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="search-container">
              <Search className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder={isCustomer ? 'Search my invoices, subscriptions...' : 'Global search customers, subscriptions, invoices, products...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
              />

              {/* Search Results Dropdown */}
              {showSearchDropdown && searchResults && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-xl)',
                    padding: '12px 16px',
                    zIndex: 50,
                    maxHeight: 380,
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Search Results
                    </span>
                    <button
                      style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer' }}
                      onClick={() => setShowSearchDropdown(false)}
                    >
                      Close
                    </button>
                  </div>

                  {/* Customers */}
                  {searchResults.customers?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginBottom: 4 }}>Customers</div>
                      {searchResults.customers.map((c: any) => (
                        <div
                          key={c.id}
                          style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                          className="action-item-row"
                          onClick={() => {
                            onSelectTab('customers');
                            setShowSearchDropdown(false);
                          }}
                        >
                          <strong>{c.name}</strong> <span style={{ color: 'var(--text-muted)' }}>({c.customer_code})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Subscriptions */}
                  {searchResults.subscriptions?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginBottom: 4 }}>Subscriptions</div>
                      {searchResults.subscriptions.map((s: any) => (
                        <div
                          key={s.id}
                          style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                          className="action-item-row"
                          onClick={() => {
                            onSelectTab('subscriptions');
                            setShowSearchDropdown(false);
                          }}
                        >
                          <strong>{s.subscription_number}</strong> — {s.customer_name} ({s.status})
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Invoices */}
                  {searchResults.invoices?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginBottom: 4 }}>Invoices</div>
                      {searchResults.invoices.map((i: any) => (
                        <div
                          key={i.id}
                          style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                          className="action-item-row"
                          onClick={() => {
                            onSelectTab('invoices');
                            setShowSearchDropdown(false);
                          }}
                        >
                          <strong>{i.invoice_number}</strong> — ${Number(i.total_amount).toFixed(2)} ({i.status})
                        </div>
                      ))}
                    </div>
                  )}

                  {(!searchResults.customers?.length && !searchResults.subscriptions?.length && !searchResults.invoices?.length) && (
                    <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                      No matching records found for "{searchQuery}".
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="topbar-right">
            {/* Quick Interactive Role Switcher */}
            <div className="role-badge-selector" title="Switch user role to test permissions">
              <span style={{ fontSize: 11, fontWeight: 700, padding: '0 8px', color: 'var(--text-muted)' }}>Role:</span>
              <button
                className={`role-pill ${isAdmin ? 'active' : ''}`}
                onClick={() => {
                  switchRole('ADMIN');
                  onSelectTab('overview');
                }}
              >
                ADMIN
              </button>
              <button
                className={`role-pill ${isStaff ? 'active' : ''}`}
                onClick={() => {
                  switchRole('STAFF');
                  onSelectTab('overview');
                }}
              >
                STAFF
              </button>
              <button
                className={`role-pill ${isCustomer ? 'active' : ''}`}
                onClick={() => {
                  switchRole('CUSTOMER');
                  onSelectTab('portal');
                }}
              >
                CUSTOMER
              </button>
            </div>

            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                className="icon-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="badge-dot" />}
              </button>

              {/* Notification Slideout Panel */}
              {showNotifications && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 360,
                    backgroundColor: '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-xl)',
                    padding: 0,
                    zIndex: 60,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-subtle)'
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>Notifications ({unreadCount} new)</span>
                    {unreadCount > 0 && (
                      <button
                        style={{ fontSize: 11.5, border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                        onClick={markAllNotificationsRead}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        No notifications at this time.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: '12px 18px',
                            borderBottom: '1px solid var(--border-subtle)',
                            backgroundColor: n.is_read ? '#ffffff' : '#f8fafc',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            if (n.link) {
                              const tab = n.link.replace('/', '') as NavTab;
                              if (tab) onSelectTab(tab);
                            }
                            setShowNotifications(false);
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            {n.type === 'ALERT' && <ShieldAlert size={14} color="#e11d48" />}
                            {n.type === 'WARNING' && <AlertTriangle size={14} color="#d97706" />}
                            {n.type === 'SUCCESS' && <CheckCircle2 size={14} color="#16a34a" />}
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)' }}>{n.title}</span>
                          </div>
                          <p style={{ fontSize: 12, color: 'var(--text-body)', margin: 0 }}>{n.message}</p>
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{n.created_at}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Badge */}
            <div className="user-profile-badge" onClick={logout} title="Click to log out">
              <div className="avatar">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-info-text">
                <span className="user-name">{user?.name || 'Authorized User'}</span>
                <span className="user-role-label">{user?.role}</span>
              </div>
              <LogOut size={14} color="var(--text-muted)" style={{ marginLeft: 4 }} />
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="page-container">
          {children}
        </main>
      </div>
    </div>
  );
};
