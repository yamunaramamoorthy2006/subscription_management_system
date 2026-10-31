import React, { useState, useEffect } from 'react';
import {
  Percent,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Tag,
  Calendar,
  AlertCircle,
  X,
  Play
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const Discounts: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Test Validator Sandbox
  const [testCode, setTestCode] = useState<string>('SCALE15');
  const [testAmount, setTestAmount] = useState<number>(300);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Create Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    discount_type: 'PERCENTAGE',
    value: 15,
    min_purchase_amount: 100,
    min_quantity: 1,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    usage_limit: 100,
    is_active: 1
  });
  const [formError, setFormError] = useState<string | null>(null);

  const loadDiscounts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/discounts?${statusFilter !== 'ALL' ? `status=${statusFilter}` : ''}`);
      setDiscounts(res.discounts || []);
    } catch (err) {
      console.error('Failed to load discounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscounts();
  }, [statusFilter]);

  const handleTestDiscount = async () => {
    setTestError(null);
    setTestResult(null);
    try {
      const res = await api.post('/api/discounts/validate', {
        code: testCode,
        amount: testAmount
      });
      setTestResult(res);
    } catch (err: any) {
      setTestError(err.message || 'Validation failed');
    }
  };

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.post('/api/discounts', form);
      setShowModal(false);
      loadDiscounts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create discount');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Discounts & Promotion Rules</h1>
          <p className="page-description">
            Configure commercial promotional codes, percentage discounts, minimum spend thresholds, and usage limits.
          </p>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> New Discount Rule
            </button>
          </div>
        )}
      </div>

      {/* Interactive Discount Validation Sandbox for Judges & Reviewers */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(to right, #fafbfc, #ffffff)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Tag size={18} color="var(--primary)" />
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Interactive Discount Rule Validator Sandbox</h3>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Test validation logic against active coupon rules, expiration dates, minimum order thresholds, and usage limits.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 180 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coupon Code:</label>
            <input
              type="text"
              className="form-control"
              value={testCode}
              onChange={(e) => setTestCode(e.target.value.toUpperCase())}
            />
          </div>
          <div style={{ width: 180 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Order Amount ($):</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={testAmount}
              onChange={(e) => setTestAmount(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleTestDiscount}>
              <Play size={14} /> Test Validation
            </button>
          </div>
        </div>

        {testResult && (
          <div style={{ marginTop: 14, padding: '10px 16px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)', color: '#065f46', fontSize: 13 }}>
            ✓ <strong>Valid Discount Code:</strong> Applied rule "{testResult.discount.name}". Calculated discount: <strong>${Number(testResult.discountAmount).toFixed(2)}</strong>.
          </div>
        )}

        {testError && (
          <div style={{ marginTop: 14, padding: '10px 16px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', color: '#e11d48', fontSize: 13 }}>
            ✗ <strong>Discount Rejected:</strong> {testError}
          </div>
        )}
      </div>

      {/* Discounts Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Coupon Code</th>
              <th>Campaign Name</th>
              <th>Type</th>
              <th>Value</th>
              <th>Min Order</th>
              <th>Usage Count / Limit</th>
              <th>Validity Period</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '36px' }}>Loading discount rules...</td></tr>
            ) : discounts.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>No discounts found.</td></tr>
            ) : (
              discounts.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong style={{ fontFamily: 'monospace', fontSize: 14, color: 'var(--primary)' }}>
                      {d.code}
                    </strong>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {d.applicable_product_name ? `Product: ${d.applicable_product_name}` : 'Order-wide'}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-draft">{d.discount_type.replace('_', ' ')}</span>
                  </td>
                  <td>
                    <strong style={{ fontSize: 14 }}>
                      {d.discount_type === 'PERCENTAGE' ? `${d.value}% Off` : `$${Number(d.value).toFixed(2)} Off`}
                    </strong>
                  </td>
                  <td>
                    {Number(d.min_purchase_amount) > 0 ? `$${Number(d.min_purchase_amount).toFixed(2)}` : 'None'}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>
                      {d.current_usage_count} / {d.usage_limit || 'Unlimited'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>
                      {d.start_date || 'Start'} to {d.end_date || 'Ongoing'}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${d.is_active ? 'active' : 'closed'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Create New Discount Promotion</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateDiscount}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, color: '#e11d48', fontSize: 13, marginBottom: 16 }}>
                    {formError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Coupon Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. FLASH20"
                      className="form-control"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount Type</label>
                    <select
                      className="form-control"
                      value={form.discount_type}
                      onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED_AMOUNT">Fixed Dollar ($)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Promotion Campaign Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q4 Growth Special"
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Value (% or $) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="form-control"
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Minimum Purchase ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.min_purchase_amount}
                      onChange={(e) => setForm({ ...form, min_purchase_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Usage Limit</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.usage_limit}
                      onChange={(e) => setForm({ ...form, usage_limit: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End / Expiration Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Discount
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
