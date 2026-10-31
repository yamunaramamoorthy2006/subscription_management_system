import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  DollarSign,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  FileText,
  CreditCard,
  Users,
  Play,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  Download
} from 'lucide-react';
import { api } from '../api/client';
import { NavTab } from '../components/Shell';

interface OverviewProps {
  onNavigate: (tab: NavTab) => void;
}

export const Overview: React.FC<OverviewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [billingRunning, setBillingRunning] = useState<boolean>(false);
  const [billingResult, setBillingResult] = useState<any>(null);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/api/reports/dashboard');
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRunBilling = async () => {
    setBillingRunning(true);
    setBillingResult(null);
    try {
      const res = await api.post('/api/billing/run', {});
      setBillingResult(res);
      fetchDashboardData();
    } catch (err: any) {
      alert(`Billing run failed: ${err.message}`);
    } finally {
      setBillingRunning(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <RefreshCw size={32} className="spin-slow" style={{ margin: '0 auto 16px' }} />
        <p>Loading Subscription Control Center...</p>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const ops = data?.todaysOperations || {};
  const analytics = data?.analytics || {};

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Subscription Control Center</h1>
          <p className="page-description">
            Live lifecycle operations, recurring billing status, and revenue intelligence for Brightloop Software.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={() => window.open('/api/reports/export-csv?type=invoices', '_blank')}
          >
            <Download size={15} />
            Export Invoices CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={handleRunBilling}
            disabled={billingRunning}
          >
            <Play size={15} />
            {billingRunning ? 'Processing Billing...' : 'Run Recurring Billing'}
          </button>
        </div>
      </div>

      {/* Billing Run Flash Result Alert */}
      {billingResult && (
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: 'var(--radius-md)',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 color="#047857" size={20} />
            <div>
              <strong style={{ color: '#047857' }}>Billing Run Completed:</strong>{' '}
              <span style={{ color: '#065f46' }}>
                Evaluated {billingResult.eligibleCount} subscription(s). Generated{' '}
                <strong>{billingResult.invoicesCreated} invoice(s)</strong>, skipped {billingResult.skippedCount}.
              </span>
            </div>
          </div>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onNavigate('invoices')}
          >
            View Invoices
          </button>
        </div>
      )}

      {/* KPI Metrics Grid */}
      <div className="stats-grid">
        {/* Active Subscriptions */}
        <div className="stat-card emerald">
          <div className="stat-top">
            <span className="stat-label">Active Subscriptions</span>
            <div className="stat-icon-wrapper" style={{ color: '#10b981' }}>
              <RefreshCw size={18} />
            </div>
          </div>
          <div className="stat-value">{metrics.activeSubscriptions}</div>
          <div className="stat-subtext">
            <span>{metrics.totalSubscriptions} total subscriptions configured</span>
          </div>
        </div>

        {/* Cash Collected */}
        <div className="stat-card emerald">
          <div className="stat-top">
            <span className="stat-label">Collected Revenue</span>
            <div className="stat-icon-wrapper" style={{ color: '#059669' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className="stat-value">${Number(metrics.revenueCollected).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="stat-subtext">
            <span>From verified recorded payments</span>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="stat-card amber">
          <div className="stat-top">
            <span className="stat-label">Outstanding Receivables</span>
            <div className="stat-icon-wrapper" style={{ color: '#d97706' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-value">${Number(metrics.outstandingReceivables).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="stat-subtext">
            <span>Pending payment on confirmed invoices</span>
          </div>
        </div>

        {/* Overdue Invoices */}
        <div className="stat-card rose">
          <div className="stat-top">
            <span className="stat-label">Overdue Balance</span>
            <div className="stat-icon-wrapper" style={{ color: '#e11d48' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#e11d48' }}>
            ${Number(metrics.overdueReceivables).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-subtext">
            <span style={{ color: '#e11d48', fontWeight: 600 }}>Past configured due date</span>
          </div>
        </div>

        {/* Upcoming Renewals */}
        <div className="stat-card violet">
          <div className="stat-top">
            <span className="stat-label">Renewals in 14 Days</span>
            <div className="stat-icon-wrapper" style={{ color: '#8b5cf6' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div className="stat-value">{metrics.upcomingRenewals}</div>
          <div className="stat-subtext">
            <span>Active subscriptions due for renewal</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Action Center & Visual Analytics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24, marginBottom: 28 }}>
        {/* Today's Operations Action Panel */}
        <div className="action-center-panel">
          <div className="action-center-header">
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 2 }}>
                Today's Operations
              </h2>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Prioritized items requiring immediate attention or review
              </p>
            </div>
            <span className="badge badge-expiring">
              {(ops.overdueInvoices?.length || 0) + (ops.renewingSoon?.length || 0) + (ops.draftInvoices?.length || 0)} Action Items
            </span>
          </div>

          <div className="action-items-list">
            {/* 1. Overdue Invoices */}
            {ops.overdueInvoices?.map((inv: any) => (
              <div key={`inv-${inv.id}`} className="action-item-row">
                <div className="action-left">
                  <span className="action-badge urgent">Overdue</span>
                  <div>
                    <div className="action-title">
                      Invoice {inv.invoice_number} — ${Number(inv.amount_due).toFixed(2)} overdue
                    </div>
                    <div className="action-desc">
                      {inv.customer_name} • Due since {inv.due_date}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => onNavigate('invoices')}
                >
                  Record Payment <ChevronRight size={14} />
                </button>
              </div>
            ))}

            {/* 2. Subscriptions renewing soon */}
            {ops.renewingSoon?.map((sub: any) => (
              <div key={`sub-${sub.id}`} className="action-item-row">
                <div className="action-left">
                  <span className="action-badge warning">Renew Soon</span>
                  <div>
                    <div className="action-title">
                      {sub.subscription_number} — {sub.plan_name}
                    </div>
                    <div className="action-desc">
                      {sub.customer_name} • Billing date: {sub.next_billing_date}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => onNavigate('subscriptions')}
                >
                  Inspect <ChevronRight size={14} />
                </button>
              </div>
            ))}

            {/* 3. Draft Invoices awaiting confirmation */}
            {ops.draftInvoices?.map((draft: any) => (
              <div key={`draft-${draft.id}`} className="action-item-row">
                <div className="action-left">
                  <span className="action-badge info">Draft Inv</span>
                  <div>
                    <div className="action-title">
                      {draft.invoice_number} (${Number(draft.total_amount).toFixed(2)})
                    </div>
                    <div className="action-desc">
                      {draft.customer_name} • Awaiting confirmation
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => onNavigate('invoices')}
                >
                  Confirm <ChevronRight size={14} />
                </button>
              </div>
            ))}

            {/* Empty state if all items cleared */}
            {!ops.overdueInvoices?.length && !ops.renewingSoon?.length && !ops.draftInvoices?.length && (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontWeight: 600 }}>All priority operational tasks cleared!</p>
                <span style={{ fontSize: 12 }}>No overdue invoices or pending renewals requiring intervention.</span>
              </div>
            )}
          </div>
        </div>

        {/* Real Revenue & Subscription Breakdown Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <TrendingUp size={18} color="var(--primary)" />
                Revenue Analytics & Collection
              </h2>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Monthly cash collected via payments</span>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => onNavigate('reports')}
            >
              Full Reports <ArrowUpRight size={14} />
            </button>
          </div>

          {/* Responsive SVG Bar Chart for Monthly Collected Cash */}
          <div style={{ marginTop: 12 }}>
            {analytics.monthlyRevenue && analytics.monthlyRevenue.length > 0 ? (
              <div style={{ height: 210, display: 'flex', alignItems: 'flex-end', gap: 18, padding: '16px 8px 30px', borderBottom: '1px solid var(--border-subtle)', position: 'relative' }}>
                {analytics.monthlyRevenue.map((rev: any, i: number) => {
                  const maxVal = Math.max(...analytics.monthlyRevenue.map((r: any) => Number(r.collected)), 5000);
                  const heightPercent = Math.max(15, Math.round((Number(rev.collected) / maxVal) * 160));
                  return (
                    <div
                      key={rev.month || i}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative'
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>
                        ${Math.round(Number(rev.collected))}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 54,
                          height: heightPercent,
                          borderRadius: '6px 6px 0 0',
                          background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
                          boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)'
                        }}
                      />
                      <span style={{ position: 'absolute', bottom: -24, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {rev.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                No payment history recorded yet.
              </div>
            )}
          </div>

          {/* Quick Distribution Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 32 }}>
            <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Subscription Health
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: '4px 0' }}>
                {Math.round(((metrics.activeSubscriptions || 0) / Math.max(1, metrics.totalSubscriptions || 1)) * 100)}%
              </div>
              <span style={{ fontSize: 12, color: '#059669' }}>Active vs total portfolio</span>
            </div>

            <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Collection Efficiency
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: '4px 0' }}>
                {Math.round(((metrics.revenueCollected || 0) / Math.max(1, metrics.totalInvoiced || 1)) * 100)}%
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cash received vs total invoiced</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
