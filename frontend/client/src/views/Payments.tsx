import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  RotateCcw,
  Building2,
  DollarSign,
  Download,
  X,
  ShieldCheck,
  Info
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const Payments: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isCustomer = user?.role === 'CUSTOMER';

  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Record Payment Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [recordForm, setRecordForm] = useState({
    invoice_id: '',
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'BANK_TRANSFER',
    transaction_reference: '',
    notes: ''
  });
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (methodFilter !== 'ALL') params.append('method', methodFilter);
      if (search) params.append('search', search);

      const [payRes, invRes] = await Promise.all([
        api.get(`/api/payments?${params.toString()}`),
        !isCustomer ? api.get('/api/invoices?status=CONFIRMED') : Promise.resolve({ invoices: [] })
      ]);

      setPayments(payRes.payments || []);
      setInvoices(invRes.invoices?.filter((i: any) => Number(i.amount_due) > 0) || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [methodFilter, search]);

  const handleOpenRecord = () => {
    const firstInv = invoices[0];
    setRecordForm({
      invoice_id: firstInv?.id || '',
      amount: firstInv ? Number(firstInv.amount_due) : 0,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'BANK_TRANSFER',
      transaction_reference: `ACH-${Date.now().toString().slice(-6)}`,
      notes: ''
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.post('/api/payments', recordForm);
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record payment');
    }
  };

  const handleReversePayment = async (id: number, ref: string) => {
    const reason = window.prompt(`Enter audit reason to reverse payment ${ref}:`);
    if (!reason) return;
    try {
      await api.post(`/api/payments/${id}/reverse`, { reason });
      alert(`Payment ${ref} successfully reversed.`);
      loadData();
    } catch (err: any) {
      alert(`Reversal failed: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Payment Tracking & Ledger</h1>
          <p className="page-description">
            Audit-grade collection records, payment method breakdowns, partial installments, and reversal reconciliation.
          </p>
        </div>
        {!isCustomer && (
          <div className="page-actions">
            <button
              className="btn btn-secondary"
              onClick={() => window.open('/api/reports/export-csv?type=payments', '_blank')}
            >
              <Download size={15} /> Export Payments CSV
            </button>
            <button className="btn btn-primary" onClick={handleOpenRecord} disabled={invoices.length === 0}>
              <Plus size={16} /> Record Payment
            </button>
          </div>
        )}
      </div>

      {/* Honest Payment Statement Callout */}
      <div style={{ padding: '12px 18px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13, color: '#15803d', display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShieldCheck size={18} />
        <span>
          <strong>Financial Integrity Notice:</strong> All payment records represent verified cleared funds (ACH, Wire, Direct Debit, Check). Records immediately update customer receivables and invoice settlement status.
        </span>
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
              placeholder="Search by payment reference, customer name, transaction ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Filter size={16} color="var(--text-muted)" />
            {['ALL', 'BANK_TRANSFER', 'CREDIT_CARD', 'DIRECT_DEBIT', 'CHECK'].map((m) => (
              <button
                key={m}
                className={`btn btn-sm ${methodFilter === m ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMethodFilter(m)}
              >
                {m === 'ALL' ? 'All Methods' : m.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Payment Ref</th>
              <th>Customer</th>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Method</th>
              <th>Transaction Ref</th>
              <th>Amount</th>
              <th>Status</th>
              {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '36px' }}>Loading payment records...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>No payment records found.</td></tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong style={{ fontFamily: 'monospace' }}>{p.payment_reference}</strong>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.customer_email}</div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.invoice_number}</span>
                  </td>
                  <td>{p.payment_date}</td>
                  <td>
                    <span className="badge badge-draft">{p.payment_method.replace('_', ' ')}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {p.transaction_reference || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <strong style={{ fontSize: 14, color: p.status === 'REVERSED' ? '#e11d48' : '#047857' }}>
                      ${Number(p.amount).toFixed(2)}
                    </strong>
                  </td>
                  <td>
                    <span className={`badge badge-${p.status === 'SUCCESS' ? 'paid' : 'overdue'}`}>
                      {p.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td style={{ textAlign: 'right' }}>
                      {p.status === 'SUCCESS' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ color: '#e11d48' }}
                          title="Reverse this payment and restore invoice balance"
                          onClick={() => handleReversePayment(p.id, p.payment_reference)}
                        >
                          <RotateCcw size={13} /> Reverse
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Record Manual Payment</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, color: '#e11d48', fontSize: 13, marginBottom: 16 }}>
                    {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Target Invoice (Confirmed with balance) *</label>
                  <select
                    className="form-control"
                    required
                    value={recordForm.invoice_id}
                    onChange={(e) => {
                      const sel = invoices.find((i) => i.id === Number(e.target.value));
                      setRecordForm({
                        ...recordForm,
                        invoice_id: e.target.value,
                        amount: sel ? Number(sel.amount_due) : 0
                      });
                    }}
                  >
                    <option value="">Select unpaid invoice...</option>
                    {invoices.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.invoice_number} — {i.customer_name} (Due: ${Number(i.amount_due).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Payment Amount ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      className="form-control"
                      value={recordForm.amount}
                      onChange={(e) => setRecordForm({ ...recordForm, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Date *</label>
                    <input
                      type="date"
                      required
                      className="form-control"
                      value={recordForm.payment_date}
                      onChange={(e) => setRecordForm({ ...recordForm, payment_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-control"
                      value={recordForm.payment_method}
                      onChange={(e) => setRecordForm({ ...recordForm, payment_method: e.target.value })}
                    >
                      <option value="BANK_TRANSFER">Bank Wire / ACH</option>
                      <option value="CREDIT_CARD">Credit Card</option>
                      <option value="DIRECT_DEBIT">Direct Debit</option>
                      <option value="CHECK">Check</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Transaction Reference</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. ACH-889922"
                      value={recordForm.transaction_reference}
                      onChange={(e) => setRecordForm({ ...recordForm, transaction_reference: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Internal Audit Notes</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="Bank statement confirmation, clearing ref..."
                    value={recordForm.notes}
                    onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Payment Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
