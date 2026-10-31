import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Calendar,
  DollarSign,
  Users,
  Edit2,
  Archive,
  X
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const Plans: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [intervalFilter, setIntervalFilter] = useState<string>('ALL');

  // Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    billing_interval: 'MONTHLY',
    billing_price: 199.0,
    minimum_quantity: 1,
    start_date: '',
    end_date: '',
    auto_close_on_expiry: 0,
    allow_early_closure: 1,
    allow_pause: 1,
    renewal_policy: 'AUTO_RENEW'
  });
  const [formError, setFormError] = useState<string | null>(null);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/plans?${intervalFilter !== 'ALL' ? `interval=${intervalFilter}` : ''}`);
      setPlans(res.plans || []);
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [intervalFilter]);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setForm({
      code: `PLAN-${Date.now().toString().slice(-4)}`,
      name: '',
      description: '',
      billing_interval: 'MONTHLY',
      billing_price: 199.0,
      minimum_quantity: 1,
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      auto_close_on_expiry: 0,
      allow_early_closure: 1,
      allow_pause: 1,
      renewal_policy: 'AUTO_RENEW'
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (editingPlan) {
        await api.put(`/api/plans/${editingPlan.id}`, form);
      } else {
        await api.post('/api/plans', form);
      }
      setShowModal(false);
      loadPlans();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save plan');
    }
  };

  const handleArchive = async (id: number) => {
    if (!window.confirm('Archive this subscription plan? Existing active subscriptions will retain their contract terms.')) return;
    try {
      await api.del(`/api/plans/${id}`);
      loadPlans();
    } catch (err: any) {
      alert(`Archive failed: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Subscription Plans</h1>
          <p className="page-description">
            Design recurring billing templates with customizable cadences, auto-renewal policies, and lifecycle permissions.
          </p>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <Plus size={16} /> New Subscription Plan
            </button>
          </div>
        )}
      </div>

      {/* Interval Filter */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Filter size={16} color="var(--text-muted)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>Billing Cadence:</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {['ALL', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].map((interval) => (
              <button
                key={interval}
                className={`btn btn-sm ${intervalFilter === interval ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIntervalFilter(interval)}
              >
                {interval === 'ALL' ? 'All Intervals' : interval}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>Loading subscription plans...</div>
        ) : plans.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            No subscription plans found matching cadence.
          </div>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span className="badge badge-paused" style={{ marginBottom: 6 }}>{p.billing_interval}</span>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>{p.name}</h3>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.code}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>
                      ${Number(p.billing_price).toFixed(2)}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>per {p.billing_interval.toLowerCase().replace('ly', '')}</span>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-body)', marginBottom: 18 }}>
                  {p.description || 'Configured recurring service template.'}
                </p>

                {/* Policy Attributes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 18 }}>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Renewal:</span>{' '}
                    <strong>{p.renewal_policy}</strong>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Subscribers:</span>{' '}
                    <strong style={{ color: '#047857' }}>{p.active_subscriptions_count} active</strong>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Allow Pause:</span>{' '}
                    <strong>{p.allow_pause ? 'Yes' : 'No'}</strong>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Early Closure:</span>{' '}
                    <strong>{p.allow_early_closure ? 'Permitted' : 'Locked'}</strong>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                <span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setEditingPlan(p);
                        setForm({
                          code: p.code,
                          name: p.name,
                          description: p.description,
                          billing_interval: p.billing_interval,
                          billing_price: p.billing_price,
                          minimum_quantity: p.minimum_quantity,
                          start_date: p.start_date || '',
                          end_date: p.end_date || '',
                          auto_close_on_expiry: p.auto_close_on_expiry,
                          allow_early_closure: p.allow_early_closure,
                          allow_pause: p.allow_pause,
                          renewal_policy: p.renewal_policy
                        });
                        setShowModal(true);
                      }}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      style={{ color: '#e11d48' }}
                      onClick={() => handleArchive(p.id)}
                    >
                      <Archive size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Plan Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                {editingPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
              </h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSavePlan}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, color: '#e11d48', fontSize: 13, marginBottom: 16 }}>
                    {formError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Plan Code *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Billing Interval</label>
                    <select
                      className="form-control"
                      value={form.billing_interval}
                      onChange={(e) => setForm({ ...form, billing_interval: e.target.value })}
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Plan Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Enterprise Multi-Region Cloud"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Billing Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="form-control"
                      value={form.billing_price}
                      onChange={(e) => setForm({ ...form, billing_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Renewal Policy</label>
                    <select
                      className="form-control"
                      value={form.renewal_policy}
                      onChange={(e) => setForm({ ...form, renewal_policy: e.target.value })}
                    >
                      <option value="AUTO_RENEW">Auto-Renew on Expiry</option>
                      <option value="MANUAL">Manual Renewal Required</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.allow_pause === 1}
                      onChange={(e) => setForm({ ...form, allow_pause: e.target.checked ? 1 : 0 })}
                    />
                    Allow Pause of Subscriptions
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.allow_early_closure === 1}
                      onChange={(e) => setForm({ ...form, allow_early_closure: e.target.checked ? 1 : 0 })}
                    />
                    Allow Early Closure
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
