import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  CreditCard,
  Layers,
  Users,
  Percent,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api/client';

export const Reports: React.FC = () => {
  const [reportData, setReportData] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [detailedRes, dashRes] = await Promise.all([
        api.get('/api/reports/detailed'),
        api.get('/api/reports/dashboard')
      ]);
      setReportData(detailedRes);
      setDashboardData(dashRes);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const metrics = dashboardData?.metrics || {};

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Financial Reporting & Intelligence</h1>
          <p className="page-description">
            Audit-reconciled statements distinguishing invoiced accrual revenue, realized cash collections, and outstanding receivables.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={() => window.open('/api/reports/export-csv?type=payments', '_blank')}
          >
            <Download size={15} /> Export Payments CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={() => window.open('/api/reports/export-csv?type=invoices', '_blank')}
          >
            <Download size={15} /> Export Invoices CSV
          </button>
        </div>
      </div>

      {/* Financial Core Distinction Metric Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18, marginBottom: 28 }}>
        {/* Total Invoiced */}
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Total Invoiced (Accrual)</span>
            <div className="stat-icon-wrapper"><DollarSign size={18} /></div>
          </div>
          <div className="stat-value">${Number(metrics.totalInvoiced || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="stat-subtext">All confirmed non-cancelled invoices</div>
        </div>

        {/* Realized Cash Collected */}
        <div className="stat-card emerald">
          <div className="stat-top">
            <span className="stat-label">Collected Cash (Realized)</span>
            <div className="stat-icon-wrapper" style={{ color: '#047857' }}><CheckCircle2 size={18} /></div>
          </div>
          <div className="stat-value" style={{ color: '#047857' }}>
            ${Number(metrics.revenueCollected || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-subtext">Verified payments deposited</div>
        </div>

        {/* Outstanding Receivables */}
        <div className="stat-card amber">
          <div className="stat-top">
            <span className="stat-label">Outstanding Receivables</span>
            <div className="stat-icon-wrapper" style={{ color: '#b45309' }}><Clock size={18} /></div>
          </div>
          <div className="stat-value" style={{ color: '#b45309' }}>
            ${Number(metrics.outstandingReceivables || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-subtext">Unsettled active invoice balance</div>
        </div>

        {/* Overdue Receivables */}
        <div className="stat-card rose">
          <div className="stat-top">
            <span className="stat-label">Overdue Aging Balance</span>
            <div className="stat-icon-wrapper" style={{ color: '#be123c' }}><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-value" style={{ color: '#be123c' }}>
            ${Number(metrics.overdueReceivables || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-subtext">Balance past formal contract due date</div>
        </div>
      </div>

      {/* Two Column Grid: Payment Method Breakdown & Plan Revenue Contribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24, marginBottom: 28 }}>
        {/* Payment Methods */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <CreditCard size={18} color="var(--primary)" />
              Payment Methods Breakdown
            </h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment Method</th>
                <th>Transactions</th>
                <th style={{ textAlign: 'right' }}>Total Collected</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.paymentMethods?.map((pm: any, idx: number) => (
                <tr key={idx}>
                  <td><strong>{pm.payment_method.replace('_', ' ')}</strong></td>
                  <td>{pm.transaction_count} cleared</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                    ${Number(pm.total_collected).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recurring Plan Contribution */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Layers size={18} color="var(--primary)" />
              Plan Revenue Contribution
            </h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan Name</th>
                <th>Cadence</th>
                <th>Subscribers</th>
                <th style={{ textAlign: 'right' }}>Recurring Run-Rate</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.planBreakdown?.map((plan: any) => (
                <tr key={plan.id}>
                  <td><strong>{plan.name}</strong></td>
                  <td><span className="badge badge-draft">{plan.billing_interval}</span></td>
                  <td>{plan.active_subscribers} active</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                    ${Number(plan.estimated_recurring_value || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Revenue Summary Table */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Users size={18} color="var(--primary)" />
              Customer Accounts Revenue Ledger
            </h2>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Comparison of total invoiced, payments collected, and balance due per account</span>
          </div>
        </div>

        <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Code</th>
                <th>Subscriptions</th>
                <th>Total Invoiced</th>
                <th>Paid Amount</th>
                <th style={{ textAlign: 'right' }}>Balance Due</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.customerBreakdown?.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>
                  </td>
                  <td><span style={{ fontFamily: 'monospace' }}>{c.customer_code}</span></td>
                  <td>{c.subscription_count}</td>
                  <td>${Number(c.total_invoiced).toFixed(2)}</td>
                  <td><strong style={{ color: '#047857' }}>${Number(c.total_paid).toFixed(2)}</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: Number(c.balance_due) > 0 ? '#e11d48' : 'inherit' }}>
                    ${Number(c.balance_due).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
