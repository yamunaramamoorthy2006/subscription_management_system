import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  RefreshCw,
  CreditCard,
  History,
  X,
  ExternalLink,
  Edit2,
  Archive,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../api/client';

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'subscriptions' | 'invoices' | 'quotations' | 'payments' | 'activity'>('subscriptions');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    billing_address: '',
    tax_id: '',
    customer_type: 'BUSINESS',
    internal_notes: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      const res = await api.get(`/api/customers?${params.toString()}`);
      setCustomers(res.customers || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, statusFilter]);

  const loadCustomerDetail = async (id: number) => {
    try {
      const res = await api.get(`/api/customers/${id}`);
      setCustomerDetail(res);
      setSelectedCustomerId(id);
    } catch (err) {
      alert('Failed to load customer details');
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/api/customers', createForm);
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        email: '',
        phone: '',
        billing_address: '',
        tax_id: '',
        customer_type: 'BUSINESS',
        internal_notes: ''
      });
      loadCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveCustomer = async (id: number) => {
    if (!window.confirm('Are you sure you want to archive this customer? Active subscriptions must be closed first.')) return;
    try {
      await api.del(`/api/customers/${id}`);
      setSelectedCustomerId(null);
      loadCustomers();
    } catch (err: any) {
      alert(`Archive failed: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Customer Management</h1>
          <p className="page-description">
            Maintain customer corporate profiles, billing addresses, tax identifiers, and relationship ledgers.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> New Customer
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 36 }}
              placeholder="Search by name, email, code or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Account Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Code</th>
              <th>Type</th>
              <th>Active Subscriptions</th>
              <th>Outstanding Balance</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px' }}>Loading customers...</td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No customer records found matching your filter criteria.
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.customer_code}</span>
                  </td>
                  <td>
                    <span className="badge badge-draft">{c.customer_type}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: c.active_subscriptions_count > 0 ? '#047857' : 'inherit' }}>
                      {c.active_subscriptions_count} active
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: Number(c.total_outstanding) > 0 ? '#e11d48' : '#047857' }}>
                      ${Number(c.total_outstanding).toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${c.status.toLowerCase()}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => loadCustomerDetail(c.id)}
                    >
                      View Ledger
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Detailed Ledger Modal */}
      {selectedCustomerId && customerDetail && (
        <div className="modal-overlay" onClick={() => setSelectedCustomerId(null)}>
          <div className="modal-content" style={{ maxWidth: 880 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{customerDetail.customer.name}</h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {customerDetail.customer.customer_code} • {customerDetail.customer.email} • {customerDetail.customer.phone || 'No phone'}
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedCustomerId(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Financial Summary Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Invoiced</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>${Number(customerDetail.financialSummary?.total_invoiced || 0).toFixed(2)}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: '#ecfdf5' }}>
                  <div style={{ fontSize: 11, color: '#047857', fontWeight: 700, textTransform: 'uppercase' }}>Paid</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#047857' }}>${Number(customerDetail.financialSummary?.total_paid || 0).toFixed(2)}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: '#fffbeb' }}>
                  <div style={{ fontSize: 11, color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>Outstanding</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#b45309' }}>${Number(customerDetail.financialSummary?.total_outstanding || 0).toFixed(2)}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: '#fff1f2' }}>
                  <div style={{ fontSize: 11, color: '#be123c', fontWeight: 700, textTransform: 'uppercase' }}>Overdue</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#be123c' }}>${Number(customerDetail.financialSummary?.total_overdue || 0).toFixed(2)}</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="tabs-nav">
                <button className={`tab-btn ${detailTab === 'subscriptions' ? 'active' : ''}`} onClick={() => setDetailTab('subscriptions')}>
                  Subscriptions ({customerDetail.subscriptions?.length || 0})
                </button>
                <button className={`tab-btn ${detailTab === 'invoices' ? 'active' : ''}`} onClick={() => setDetailTab('invoices')}>
                  Invoices ({customerDetail.invoices?.length || 0})
                </button>
                <button className={`tab-btn ${detailTab === 'quotations' ? 'active' : ''}`} onClick={() => setDetailTab('quotations')}>
                  Quotations ({customerDetail.quotations?.length || 0})
                </button>
                <button className={`tab-btn ${detailTab === 'payments' ? 'active' : ''}`} onClick={() => setDetailTab('payments')}>
                  Payments ({customerDetail.payments?.length || 0})
                </button>
                <button className={`tab-btn ${detailTab === 'activity' ? 'active' : ''}`} onClick={() => setDetailTab('activity')}>
                  Activity History
                </button>
              </div>

              {/* Subscriptions Tab */}
              {detailTab === 'subscriptions' && (
                <div>
                  {customerDetail.subscriptions?.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No subscriptions found for this customer.</p>
                  ) : (
                    customerDetail.subscriptions.map((s: any) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>
                        <div>
                          <strong>{s.subscription_number}</strong> — {s.plan_name} ({s.billing_interval})
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Next billing: {s.next_billing_date} • Expires: {s.expiration_date || 'Ongoing'}</div>
                        </div>
                        <span className={`badge badge-${s.status.toLowerCase()}`}>{s.status}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Invoices Tab */}
              {detailTab === 'invoices' && (
                <div>
                  {customerDetail.invoices?.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No invoices found for this customer.</p>
                  ) : (
                    customerDetail.invoices.map((inv: any) => (
                      <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>
                        <div>
                          <strong>{inv.invoice_number}</strong> — ${Number(inv.total_amount).toFixed(2)}
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date: {inv.invoice_date} • Due: {inv.due_date} • Due balance: ${Number(inv.amount_due).toFixed(2)}</div>
                        </div>
                        <span className={`badge badge-${inv.status.toLowerCase()}`}>{inv.status}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Quotations Tab */}
              {detailTab === 'quotations' && (
                <div>
                  {customerDetail.quotations?.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No quotations generated.</p>
                  ) : (
                    customerDetail.quotations.map((q: any) => (
                      <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>
                        <div>
                          <strong>{q.quotation_number}</strong> — Total: ${Number(q.grand_total).toFixed(2)}
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date: {q.quotation_date} • Valid until: {q.expiration_date}</div>
                        </div>
                        <span className={`badge badge-${q.status.toLowerCase()}`}>{q.status}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Payments Tab */}
              {detailTab === 'payments' && (
                <div>
                  {customerDetail.payments?.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No recorded payments.</p>
                  ) : (
                    customerDetail.payments.map((p: any) => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>
                        <div>
                          <strong>{p.payment_reference}</strong> — <span style={{ color: '#047857', fontWeight: 700 }}>${Number(p.amount).toFixed(2)}</span>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date: {p.payment_date} • Method: {p.payment_method} • Invoice: {p.invoice_number}</div>
                        </div>
                        <span className="badge badge-paid">SUCCESS</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Activity History Tab */}
              {detailTab === 'activity' && (
                <div className="timeline">
                  {customerDetail.activityLogs?.map((log: any) => (
                    <div key={log.id} className="timeline-event">
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-title">{log.action}</div>
                        <div className="timeline-date">{log.created_at} by {log.user_name || 'System'}</div>
                        {log.details_json && <div className="timeline-description">{log.details_json}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleArchiveCustomer(customerDetail.customer.id)}
              >
                <Archive size={14} /> Archive Customer
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedCustomerId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Add New Customer</h3>
              <button className="icon-btn" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, color: '#e11d48', fontSize: 13, marginBottom: 16 }}>
                    {formError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Customer or Company Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Acme Cloud Corp"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input
                      type="email"
                      required
                      className="form-control"
                      placeholder="billing@acme.com"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="+1 (555) 000-0000"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Customer Type</label>
                    <select
                      className="form-control"
                      value={createForm.customer_type}
                      onChange={(e) => setCreateForm({ ...createForm, customer_type: e.target.value })}
                    >
                      <option value="BUSINESS">Business (Enterprise / B2B)</option>
                      <option value="INDIVIDUAL">Individual / Consumer</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tax ID / VAT Reg</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="US-12345678"
                      value={createForm.tax_id}
                      onChange={(e) => setCreateForm({ ...createForm, tax_id: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Billing Address</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="Street, City, State, ZIP, Country"
                    value={createForm.billing_address}
                    onChange={(e) => setCreateForm({ ...createForm, billing_address: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Internal Operations Notes</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="Key account details, procurement terms, SLA constraints..."
                    value={createForm.internal_notes}
                    onChange={(e) => setCreateForm({ ...createForm, internal_notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Customer Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};