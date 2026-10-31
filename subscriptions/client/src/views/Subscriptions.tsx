import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Pause,
  Play,
  RotateCw,
  XCircle,
  Clock,
  ChevronRight,
  X,
  CreditCard,
  FileText,
  Calendar,
  Layers,
  History,
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { NavTab } from '../components/Shell';

interface SubscriptionsProps {
  onNavigate: (tab: NavTab) => void;
}

export const Subscriptions: React.FC<SubscriptionsProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';

  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [healthFilter, setHealthFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Detail Modal
  const [selectedSubDetail, setSelectedSubDetail] = useState<any>(null);

  // New Subscription Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState<any>({
    customer_id: '',
    plan_id: '',
    start_date: new Date().toISOString().split('T')[0],
    expiration_date: '',
    payment_terms: 'NET30',
    renewal_policy: 'AUTO_RENEW',
    notes: ''
  });
  const [createLines, setCreateLines] = useState<any[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (healthFilter !== 'ALL') params.append('health', healthFilter);
      if (search) params.append('search', search);

      const res = await api.get(`/api/subscriptions?${params.toString()}`);
      setSubscriptions(res.subscriptions || []);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuxData = async () => {
    if (isCustomer) return;
    try {
      const [custRes, planRes, prodRes] = await Promise.all([
        api.get('/api/customers'),
        api.get('/api/plans'),
        api.get('/api/products')
      ]);
      setCustomers(custRes.customers || []);
      setPlans(planRes.plans || []);
      setProducts(prodRes.products || []);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, [statusFilter, healthFilter, search]);

  useEffect(() => {
    loadAuxData();
  }, []);

  const loadSubscriptionDetail = async (id: number) => {
    try {
      const res = await api.get(`/api/subscriptions/${id}`);
      setSelectedSubDetail(res);
    } catch (err: any) {
      alert(`Failed to load subscription: ${err.message}`);
    }
  };

  const handlePause = async (id: number) => {
    try {
      const res = await api.post(`/api/subscriptions/${id}/pause`, {});
      alert(res.message);
      loadSubscriptions();
      if (selectedSubDetail?.subscription?.id === id) loadSubscriptionDetail(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResume = async (id: number) => {
    try {
      const res = await api.post(`/api/subscriptions/${id}/resume`, {});
      alert(res.message);
      loadSubscriptions();
      if (selectedSubDetail?.subscription?.id === id) loadSubscriptionDetail(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRenew = async (id: number) => {
    try {
      const res = await api.post(`/api/subscriptions/${id}/renew`, {});
      alert(res.message);
      loadSubscriptions();
      if (selectedSubDetail?.subscription?.id === id) loadSubscriptionDetail(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleClose = async (id: number) => {
    if (!window.confirm('Are you sure you want to CLOSE this subscription? It will stop recurring billing.')) return;
    try {
      const res = await api.post(`/api/subscriptions/${id}/close`, {});
      alert(res.message);
      loadSubscriptions();
      if (selectedSubDetail?.subscription?.id === id) loadSubscriptionDetail(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenCreate = () => {
    const firstCust = customers[0]?.id || '';
    const firstPlan = plans[0]?.id || '';
    const firstProd = products[0];
    const defaultVar = firstProd?.variants?.[0];

    setCreateForm({
      customer_id: firstCust,
      plan_id: firstPlan,
      start_date: new Date().toISOString().split('T')[0],
      expiration_date: '',
      payment_terms: 'NET30',
      renewal_policy: 'AUTO_RENEW',
      notes: ''
    });

    setCreateLines([
      {
        product_id: firstProd?.id || '',
        variant_id: defaultVar?.id || null,
        description: firstProd?.name || 'Standard product',
        quantity: 1,
        unit_price: firstProd?.sales_price || 0,
        variant_adjustment: defaultVar?.price_adjustment || 0,
        tax_rate: firstProd?.tax_rate || 0,
        discount_amount: 0
      }
    ]);

    setFormError(null);
    setShowCreateModal(true);
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.post('/api/subscriptions', {
        ...createForm,
        lines: createLines
      });
      setShowCreateModal(false);
      loadSubscriptions();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create subscription');
    }
  };

  // Health Badge Renderer
  const renderHealthBadge = (health: string, reason?: string) => {
    switch (health) {
      case 'HEALTHY':
        return <span className="badge badge-active" title={reason}><ShieldCheck size={12} /> Healthy</span>;
      case 'RENEWAL_APPROACHING':
        return <span className="badge badge-expiring" title={reason}><Calendar size={12} /> Renewal Approaching</span>;
      case 'PAYMENT_OVERDUE':
        return <span className="badge badge-overdue" title={reason}><AlertTriangle size={12} /> Payment Overdue</span>;
      case 'PAUSED':
        return <span className="badge badge-paused" title={reason}><Pause size={12} /> Paused</span>;
      case 'EXPIRING':
        return <span className="badge badge-expiring" title={reason}><Clock size={12} /> Expiring</span>;
      case 'CLOSED':
        return <span className="badge badge-closed" title={reason}><XCircle size={12} /> Closed</span>;
      default:
        return <span className="badge badge-draft">{health}</span>;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Subscription Lifecycle Management</h1>
          <p className="page-description">
            Track operational health indicators, monitor automated renewals, and manage pause/resume/close state transitions.
          </p>
        </div>
        {!isCustomer && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <Plus size={16} /> New Subscription
            </button>
          </div>
        )}
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
              placeholder="Search by subscription #, customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
            >
              <option value="ALL">All Health Indicators</option>
              <option value="HEALTHY">Healthy</option>
              <option value="RENEWAL_APPROACHING">Renewal Approaching</option>
              <option value="PAYMENT_OVERDUE">Payment Overdue</option>
              <option value="PAUSED">Paused</option>
              <option value="EXPIRING">Expiring</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="EXPIRED">Expired</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Subscription #</th>
              <th>Customer</th>
              <th>Plan</th>
              <th>Cadence</th>
              <th>Next Billing</th>
              <th>Health Indicator</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '36px' }}>Loading subscriptions...</td></tr>
            ) : subscriptions.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>No subscriptions matching filters.</td></tr>
            ) : (
              subscriptions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong style={{ fontFamily: 'monospace' }}>{s.subscription_number}</strong>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.customer_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.customer_email}</div>
                  </td>
                  <td>{s.plan_name}</td>
                  <td>
                    <span className="badge badge-draft">{s.billing_interval}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.next_billing_date}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Expires: {s.expiration_date || 'Ongoing'}
                    </div>
                  </td>
                  <td>
                    {renderHealthBadge(s.health, s.health_reason)}
                  </td>
                  <td>
                    <span className={`badge badge-${s.status.toLowerCase()}`}>{s.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => loadSubscriptionDetail(s.id)}
                      >
                        Inspect
                      </button>
                      {!isCustomer && s.status === 'ACTIVE' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          title="Pause billing"
                          onClick={() => handlePause(s.id)}
                        >
                          <Pause size={13} />
                        </button>
                      )}
                      {!isCustomer && s.status === 'PAUSED' && (
                        <button
                          className="btn btn-sm btn-primary"
                          title="Resume active"
                          onClick={() => handleResume(s.id)}
                        >
                          <Play size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Subscription Timeline & Detailed Inspection Modal */}
      {selectedSubDetail && (
        <div className="modal-overlay" onClick={() => setSelectedSubDetail(null)}>
          <div className="modal-content" style={{ maxWidth: 840 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                  Subscription {selectedSubDetail.subscription.subscription_number}
                </h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Customer: <strong>{selectedSubDetail.subscription.customer_name}</strong> • Plan: {selectedSubDetail.subscription.plan_name}
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedSubDetail(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Health Banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {renderHealthBadge(selectedSubDetail.subscription.health, selectedSubDetail.subscription.health_reason)}
                  <span style={{ fontSize: 13, color: 'var(--text-body)' }}>{selectedSubDetail.subscription.health_reason}</span>
                </div>
                {!isCustomer && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {selectedSubDetail.subscription.status === 'ACTIVE' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => handlePause(selectedSubDetail.subscription.id)}>
                        <Pause size={13} /> Pause
                      </button>
                    )}
                    {selectedSubDetail.subscription.status === 'PAUSED' && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleResume(selectedSubDetail.subscription.id)}>
                        <Play size={13} /> Resume
                      </button>
                    )}
                    {selectedSubDetail.subscription.status !== 'CLOSED' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => handleRenew(selectedSubDetail.subscription.id)}>
                        <RotateCw size={13} /> Extend / Renew
                      </button>
                    )}
                    {selectedSubDetail.subscription.status !== 'CLOSED' && (
                      <button className="btn btn-sm btn-danger" onClick={() => handleClose(selectedSubDetail.subscription.id)}>
                        Close
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Contract Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 12, background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cadence</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{selectedSubDetail.subscription.billing_interval}</div>
                </div>
                <div style={{ padding: 12, background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Next Billing</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: 'var(--primary)' }}>{selectedSubDetail.subscription.next_billing_date}</div>
                </div>
                <div style={{ padding: 12, background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Expiration</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{selectedSubDetail.subscription.expiration_date || 'Indefinite'}</div>
                </div>
                <div style={{ padding: 12, background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Renewal Policy</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{selectedSubDetail.subscription.renewal_policy}</div>
                </div>
              </div>

              {/* Line Items */}
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Subscription Products & Services</h4>
              <table className="data-table" style={{ marginBottom: 24 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Recurring Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSubDetail.lines?.map((line: any) => (
                    <tr key={line.id}>
                      <td><strong>{line.product_name}</strong></td>
                      <td>{line.variant_name || 'Standard'}</td>
                      <td>{line.quantity}</td>
                      <td>${Number(line.unit_price).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>${Number(line.line_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Feature C: Subscription Timeline */}
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={16} color="var(--primary)" />
                Subscription Lifecycle Timeline
              </h4>
              <div className="timeline">
                {selectedSubDetail.timeline?.map((ev: any, idx: number) => (
                  <div key={idx} className="timeline-event">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-title">{ev.title}</div>
                      <div className="timeline-date">{ev.date}</div>
                      <div className="timeline-description">{ev.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedSubDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct New Subscription Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Create Direct Subscription</h3>
              <button className="icon-btn" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveSubscription}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, color: '#e11d48', fontSize: 13, marginBottom: 16 }}>
                    {formError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Customer *</label>
                  <select
                    className="form-control"
                    required
                    value={createForm.customer_id}
                    onChange={(e) => setCreateForm({ ...createForm, customer_id: Number(e.target.value) })}
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.customer_code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Subscription Plan *</label>
                  <select
                    className="form-control"
                    required
                    value={createForm.plan_id}
                    onChange={(e) => setCreateForm({ ...createForm, plan_id: Number(e.target.value) })}
                  >
                    <option value="">Select plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (${Number(p.billing_price).toFixed(2)} / {p.billing_interval})</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      required
                      className="form-control"
                      value={createForm.start_date}
                      onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiration Date (Optional)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={createForm.expiration_date}
                      onChange={(e) => setCreateForm({ ...createForm, expiration_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Payment Terms</label>
                    <select
                      className="form-control"
                      value={createForm.payment_terms}
                      onChange={(e) => setCreateForm({ ...createForm, payment_terms: e.target.value })}
                    >
                      <option value="NET30">NET 30</option>
                      <option value="NET15">NET 15</option>
                      <option value="DUE_ON_RECEIPT">Due on Receipt</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Renewal Policy</label>
                    <select
                      className="form-control"
                      value={createForm.renewal_policy}
                      onChange={(e) => setCreateForm({ ...createForm, renewal_policy: e.target.value })}
                    >
                      <option value="AUTO_RENEW">Auto-Renew on Expiry</option>
                      <option value="MANUAL">Manual Renewal Required</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Activate Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
