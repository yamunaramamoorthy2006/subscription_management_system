import React, { useState } from 'react';
import { AuthProvider, useAuth, DEMO_CREDENTIALS, UserRole } from './context/AuthContext';
import { Shell, NavTab } from './components/Shell';
import { Overview } from './views/Overview';
import { Customers } from './views/Customers';
import { Products } from './views/Products';
import { Plans } from './views/Plans';
import { Quotations } from './views/Quotations';
import { Subscriptions } from './views/Subscriptions';
import { Invoices } from './views/Invoices';
import { Payments } from './views/Payments';
import { Discounts } from './views/Discounts';
import { Reports } from './views/Reports';
import { Settings } from './views/Settings';
import { CustomerPortal } from './views/CustomerPortal';
import { RefreshCw, Shield, Key, ArrowRight, UserCheck, CheckCircle2, Lock, X } from 'lucide-react';
import { api } from './api/client';

const AppContent: React.FC = () => {
  const { user, loading, login, switchRole } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');

  // Custom login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Password reset state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devResetNotice, setDevResetNotice] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
        <div className="brand-icon" style={{ width: 48, height: 48, marginBottom: 16 }}>
          <RefreshCw size={28} className="spin-slow" />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
          Initializing Subscription OS...
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Brightloop Software Enterprise Platform
        </p>
      </div>
    );
  }

  // Not logged in: Show Authentication & Demo Persona Switcher
  if (!user) {
    const handleLoginSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      setSubmitting(true);
      try {
        await login(email, password);
      } catch (err: any) {
        setLoginError(err.message || 'Login failed. Please check credentials.');
      } finally {
        setSubmitting(false);
      }
    };

    const handleRequestReset = async () => {
      setResetError(null);
      try {
        const res = await api.post('/api/auth/reset-password-request', { email: resetEmail });
        setDevResetNotice(res.devResetCode ? `Development Reset Code: ${res.devResetCode}` : res.message);
        if (res.devResetCode) setResetCode(res.devResetCode);
      } catch (err: any) {
        setResetError(err.message);
      }
    };

    const handleConfirmReset = async (e: React.FormEvent) => {
      e.preventDefault();
      setResetError(null);
      try {
        const res = await api.post('/api/auth/reset-password', {
          email: resetEmail,
          resetCode,
          newPassword
        });
        setResetSuccess(res.message);
        setTimeout(() => {
          setShowResetModal(false);
          setResetSuccess(null);
        }, 2000);
      } catch (err: any) {
        setResetError(err.message);
      }
    };

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)', padding: 20 }}>
        <div style={{ maxWidth: 460, width: '100%' }}>
          {/* Brand Card */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div className="brand-icon" style={{ width: 54, height: 54, margin: '0 auto 14px' }}>
              <RefreshCw size={30} />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
              Subscription OS
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
              Brightloop Software Intelligent Management Platform
            </p>
          </div>

          <div className="card" style={{ padding: 32, boxShadow: 'var(--shadow-xl)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
              Sign In to Your Workspace
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Select a demo persona or authenticate with your account credentials.
            </p>

            {/* Quick Demo Access Bar */}
            <div style={{ marginBottom: 24, padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Fast Hackathon Evaluation Switcher:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(['ADMIN', 'STAFF', 'CUSTOMER'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ justifyContent: 'space-between', padding: '8px 12px' }}
                    onClick={async () => {
                      await switchRole(r);
                      setCurrentTab(r === 'CUSTOMER' ? 'portal' : 'overview');
                    }}
                  >
                    <span>{DEMO_CREDENTIALS[r].title}</span>
                    <ArrowRight size={13} color="var(--primary)" />
                  </button>
                ))}
              </div>
            </div>

            {loginError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, color: '#e11d48', fontSize: 13, marginBottom: 16 }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@brightloop.io"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Password</label>
                  <button
                    type="button"
                    style={{ fontSize: 12, border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer' }}
                    onClick={() => {
                      setResetEmail(email || 'admin@brightloop.io');
                      setShowResetModal(true);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={submitting}>
                {submitting ? 'Verifying...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        {/* Development Mode Password Reset Modal */}
        {showResetModal && (
          <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
            <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Reset Password (Dev Mode)</h3>
                <button className="icon-btn" onClick={() => setShowResetModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleConfirmReset}>
                <div className="modal-body">
                  <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 12.5, color: 'var(--text-body)', marginBottom: 16 }}>
                    External SMTP is disabled. Click "Generate Dev Code" to test the secure reset mechanism.
                  </div>

                  {resetError && (
                    <div style={{ padding: '8px 12px', background: '#fff1f2', color: '#e11d48', fontSize: 13, borderRadius: 6, marginBottom: 12 }}>
                      {resetError}
                    </div>
                  )}

                  {resetSuccess && (
                    <div style={{ padding: '8px 12px', background: '#ecfdf5', color: '#047857', fontSize: 13, borderRadius: 6, marginBottom: 12 }}>
                      {resetSuccess}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Account Email</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="email"
                        required
                        className="form-control"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                      />
                      <button type="button" className="btn btn-sm btn-secondary" onClick={handleRequestReset}>
                        Get Code
                      </button>
                    </div>
                  </div>

                  {devResetNotice && (
                    <div style={{ padding: 10, background: '#eef2ff', color: 'var(--primary)', fontWeight: 600, fontSize: 13, borderRadius: 6, marginBottom: 12 }}>
                      {devResetNotice}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Reset Token / Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. A9B2X1"
                      className="form-control"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">New Password (&gt;8 chars, 1 uppercase, 1 lowercase, 1 symbol)</label>
                    <input
                      type="password"
                      required
                      placeholder="e.g. NewPassword2026!"
                      className="form-control"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowResetModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Logged in: Render persistent app shell with role-aware tab navigation
  return (
    <Shell
      currentTab={currentTab}
      onSelectTab={(tab) => {
        // Enforce RBAC navigation
        if (user.role === 'CUSTOMER' && !['portal', 'subscriptions', 'invoices', 'payments'].includes(tab)) {
          setCurrentTab('portal');
        } else if (user.role === 'STAFF' && tab === 'settings') {
          setCurrentTab('overview');
        } else {
          setCurrentTab(tab);
        }
      }}
    >
      {/* View routing */}
      {currentTab === 'overview' && <Overview onNavigate={setCurrentTab} />}
      {currentTab === 'customers' && <Customers />}
      {currentTab === 'products' && <Products />}
      {currentTab === 'plans' && <Plans />}
      {currentTab === 'quotations' && <Quotations onNavigate={setCurrentTab} />}
      {currentTab === 'subscriptions' && <Subscriptions onNavigate={setCurrentTab} />}
      {currentTab === 'invoices' && <Invoices onNavigate={setCurrentTab} />}
      {currentTab === 'payments' && <Payments />}
      {currentTab === 'discounts' && <Discounts />}
      {currentTab === 'reports' && <Reports />}
      {currentTab === 'settings' && <Settings />}
      {currentTab === 'portal' && <CustomerPortal />}
    </Shell>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
