import React, { useState, useEffect } from 'react';
import {
  Home,
  RefreshCw,
  FileText,
  CreditCard,
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Save,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const CustomerPortal: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payments' | 'profile'>('overview');

  // Profile Form
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    billing_address: ''
  });
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const loadPortalData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/portal/summary');
      setData(res);
      if (res.customer) {
        setProfileForm({
          name: res.customer.name || '',
          phone: res.customer.phone || '',
          billing_address: res.customer.billing_address || ''
        });
      }
    } catch (err) {
      console.error('Failed to load customer portal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    try {
      await api.put('/api/portal/profile', profileForm);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      loadPortalData();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <RefreshCw size={32} className="spin-slow" style={{ margin: '0 auto 16px' }} />
        <p>Loading Customer Account Portal...</p>
      </div>
    );
  }

  const customer = data?.customer || {};
  const balances = data?.balances || {};
  const subscriptions = data?.subscriptions || [];
  const invoices = data?.invoices || [];
  const payments = data?.payments || [];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Customer Account Portal</h1>
          <p className="page-description">
            Welcome back, <strong>{customer.name}</strong> ({customer.customer_code}). Manage your active subscriptions, invoices, and profile.
          </p>
        </div>
      </div>

      {/* Account Metric Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 28 }}>
        <div className="stat-card emerald">
          <div className="stat-top">
            <span className="stat-label">Active Subscriptions</span>
            <div className="stat-icon-wrapper" style={{ color: '#047857' }}><RefreshCw size={18} /></div>
          </div>
          <div className="stat-value">{subscriptions.filter((s: any) => s.status === 'ACTIVE').length}</div>
          <div className="stat-subtext">Active recurring contracts</div>
        </div>

        <div className="stat-card amber">
          <div className="stat-top">
            <span className="stat-label">Outstanding Invoices</span>
            <div className="stat-icon-wrapper" style={{ color: '#b45309' }}><Clock size={18} /></div>
          </div>
          <div className="stat-value" style={{ color: Number(balances.outstanding_amount) > 0 ? '#b45309' : '#047857' }}>
            ${Number(balances.outstanding_amount || 0).toFixed(2)}
          </div>
          <div className="stat-subtext">Current amount due</div>
        </div>

        <div className="stat-card emerald">
          <div className="stat-top">
            <span className="stat-label">Total Settled</span>
            <div className="stat-icon-wrapper" style={{ color: '#047857' }}><CheckCircle2 size={18} /></div>
          </div>
          <div className="stat-value">${Number(balances.total_paid || 0).toFixed(2)}</div>
          <div className="stat-subtext">Lifetime payments processed</div>
        </div>
      </div>

      {/* Portal Tabs */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          My Subscriptions ({subscriptions.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          My Invoices ({invoices.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          Payment History ({payments.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Account Profile & Billing Address
        </button>
      </div>

      {/* Subscriptions Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          {subscriptions.length === 0 ? (
            <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              No subscriptions found for your account.
            </div>
          ) : (
            subscriptions.map((s: any) => (
              <div key={s.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span className="badge badge-draft" style={{ marginBottom: 6 }}>{s.billing_interval}</span>
                    <h3 style={{ fontSize: 17, fontWeight: 700 }}>{s.plan_name}</h3>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{s.subscription_number}</span>
                  </div>
                  <span className={`badge badge-${s.status.toLowerCase()}`}>{s.status}</span>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: 14, borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Next Billing Date:</span>
                    <strong>{s.next_billing_date}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Contract Expiration:</span>
                    <strong>{s.expiration_date || 'Continuous / Auto-Renew'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Recurring Rate:</span>
                    <strong style={{ color: 'var(--primary)' }}>${Number(s.recurring_total || s.billing_price).toFixed(2)}</strong>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Renewal policy: <strong>{s.renewal_policy}</strong>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Invoice Date</th>
                <th>Due Date</th>
                <th>Total Amount</th>
                <th>Amount Due</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '36px' }}>No invoices issued yet.</td></tr>
              ) : (
                invoices.map((inv: any) => (
                  <tr key={inv.id}>
                    <td><strong style={{ fontFamily: 'monospace' }}>{inv.invoice_number}</strong></td>
                    <td>{inv.invoice_date}</td>
                    <td>{inv.due_date}</td>
                    <td><strong>${Number(inv.total_amount).toFixed(2)}</strong></td>
                    <td>
                      <strong style={{ color: Number(inv.amount_due) > 0 ? '#be123c' : '#047857' }}>
                        ${Number(inv.amount_due).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <span className={`badge badge-${inv.status.toLowerCase()}`}>{inv.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => window.print()}>
                        <Printer size={13} /> Print
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt Reference</th>
                <th>Date</th>
                <th>Payment Method</th>
                <th>Invoice</th>
                <th style={{ textAlign: 'right' }}>Amount Paid</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '36px' }}>No payment receipts recorded yet.</td></tr>
              ) : (
                payments.map((p: any) => (
                  <tr key={p.id}>
                    <td><strong style={{ fontFamily: 'monospace' }}>{p.payment_reference}</strong></td>
                    <td>{p.payment_date}</td>
                    <td><span className="badge badge-draft">{p.payment_method.replace('_', ' ')}</span></td>
                    <td>{p.invoice_number}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                      ${Number(p.amount).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="card-header">
            <h2 className="card-title">
              <UserCheck size={18} color="var(--primary)" />
              Manage Billing Details
            </h2>
          </div>

          {saveSuccess && (
            <div style={{ padding: '10px 14px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, color: '#047857', fontSize: 13, marginBottom: 16 }}>
              Profile updated successfully.
            </div>
          )}

          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label className="form-label">Company / Account Name</label>
              <input
                type="text"
                required
                className="form-control"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-control"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Official Billing Address</label>
              <textarea
                rows={3}
                className="form-control"
                value={profileForm.billing_address}
                onChange={(e) => setProfileForm({ ...profileForm, billing_address: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">
                <Save size={15} /> Save Contact Details
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};