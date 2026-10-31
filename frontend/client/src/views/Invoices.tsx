import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Play,
  Printer,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  CreditCard,
  Building2,
  Calendar,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { NavTab } from '../components/Shell';

interface InvoicesProps {
  onNavigate: (tab: NavTab) => void;
}

export const Invoices: React.FC<InvoicesProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Selected Invoice for Full Printable Preview
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Billing Run Modal
  const [showBillingModal, setShowBillingModal] = useState<boolean>(false);
  const [billingTargetDate, setBillingTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [billingPreview, setBillingPreview] = useState<any>(null);
  const [billingProcessing, setBillingProcessing] = useState<boolean>(false);
  const [billingRunResult, setBillingRunResult] = useState<any>(null);

  // Quick Record Payment Modal
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (search) params.append('search', search);

      const res = await api.get(`/api/invoices?${params.toString()}`);
      setInvoices(res.invoices || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [statusFilter, search]);

  const loadInvoiceDetail = async (id: number) => {
    try {
      const res = await api.get(`/api/invoices/${id}`);
      setSelectedInvoice(res);
    } catch (err: any) {
      alert(`Failed to load invoice: ${err.message}`);
    }
  };

  const handleOpenBillingModal = async () => {
    setBillingRunResult(null);
    setShowBillingModal(true);
    try {
      const res = await api.get(`/api/billing/eligible?target_date=${billingTargetDate}`);
      setBillingPreview(res);
    } catch (err) {
      // ignore
    }
  };

  const handleExecuteBillingRun = async () => {
    setBillingProcessing(true);
    try {
      const res = await api.post('/api/billing/run', { target_date: billingTargetDate });
      setBillingRunResult(res);
      loadInvoices();
    } catch (err: any) {
      alert(`Billing run error: ${err.message}`);
    } finally {
      setBillingProcessing(false);
    }
  };

  const handleConfirmInvoice = async (id: number) => {
    try {
      await api.post(`/api/invoices/${id}/confirm`, {});
      loadInvoices();
      if (selectedInvoice?.invoice?.id === id) loadInvoiceDetail(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenPaymentModal = (inv: any) => {
    setPaymentInvoice(inv);
    setPaymentAmount(Number(inv.amount_due));
    setPaymentMethod('BANK_TRANSFER');
    setPaymentRef(`TXN-${Date.now().toString().slice(-6)}`);
    setPaymentError(null);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    try {
      await api.post('/api/payments', {
        invoice_id: paymentInvoice.id,
        amount: paymentAmount,
        payment_method: paymentMethod,
        transaction_reference: paymentRef,
        notes: `Recorded against invoice ${paymentInvoice.invoice_number}`
      });
      setPaymentInvoice(null);
      loadInvoices();
      if (selectedInvoice?.invoice?.id === paymentInvoice.id) {
        loadInvoiceDetail(paymentInvoice.id);
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Invoices & Recurring Billing</h1>
          <p className="page-description">
            Automated subscription invoice generation, real-time balance tracking, overdue notifications, and payments reconciliation.
          </p>
        </div>
        {!isCustomer && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={handleOpenBillingModal}>
              <Play size={16} /> Run Recurring Billing
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
              placeholder="Search by invoice number, customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Filter size={16} color="var(--text-muted)" />
            {['ALL', 'CONFIRMED', 'PAID', 'OVERDUE', 'DRAFT'].map((st) => (
              <button
                key={st}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Subscription</th>
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th>Total Amount</th>
              <th>Amount Due</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '36px' }}>Loading invoices...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>No invoices found.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong style={{ fontFamily: 'monospace' }}>{inv.invoice_number}</strong>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.customer_email}</div>
                  </td>
                  <td>
                    {inv.subscription_number ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.subscription_number}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Direct</span>
                    )}
                  </td>
                  <td>{inv.invoice_date}</td>
                  <td>
                    <span style={{ fontWeight: inv.computed_status === 'OVERDUE' ? 700 : 'normal', color: inv.computed_status === 'OVERDUE' ? '#e11d48' : 'inherit' }}>
                      {inv.due_date}
                    </span>
                  </td>
                  <td>
                    <strong style={{ fontSize: 14 }}>${Number(inv.total_amount).toFixed(2)}</strong>
                  </td>
                  <td>
                    <strong style={{ color: Number(inv.amount_due) > 0 ? (inv.computed_status === 'OVERDUE' ? '#e11d48' : '#b45309') : '#047857' }}>
                      ${Number(inv.amount_due).toFixed(2)}
                    </strong>
                  </td>
                  <td>
                    <span className={`badge badge-${inv.computed_status.toLowerCase()}`}>
                      {inv.computed_status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => loadInvoiceDetail(inv.id)}>
                        View
                      </button>
                      {!isCustomer && inv.status === 'CONFIRMED' && Number(inv.amount_due) > 0 && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenPaymentModal(inv)}
                        >
                          Record Payment
                        </button>
                      )}
                      {!isCustomer && inv.status === 'DRAFT' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleConfirmInvoice(inv.id)}
                        >
                          Confirm
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

      {/* Full Printable Invoice Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-content" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                Invoice {selectedInvoice.invoice.invoice_number}
              </h3>
              <button className="icon-btn" onClick={() => setSelectedInvoice(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="printable-invoice">
                {/* Brand Header */}
                <div className="invoice-header">
                  <div>
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>
                      Brightloop Software
                    </h2>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {selectedInvoice.company?.address || '100 Innovation Way, Suite 400, San Francisco, CA'}<br />
                      {selectedInvoice.company?.support_email || 'billing@brightloop.io'} • Tax ID: {selectedInvoice.company?.tax_id || 'US-84920491'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>TAX INVOICE</div>
                    <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700 }}>
                      {selectedInvoice.invoice.invoice_number}
                    </div>
                    <span className={`badge badge-${selectedInvoice.invoice.computed_status.toLowerCase()}`} style={{ marginTop: 6 }}>
                      {selectedInvoice.invoice.computed_status}
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="invoice-meta-grid">
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Billed To:</span>
                    <div style={{ fontWeight: 700, marginTop: 2 }}>{selectedInvoice.invoice.customer_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedInvoice.invoice.customer_email}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedInvoice.invoice.billing_address || 'Address on record'}</div>
                    {selectedInvoice.invoice.customer_tax_id && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tax ID: {selectedInvoice.invoice.customer_tax_id}</div>
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice Date:</span>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedInvoice.invoice.invoice_date}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 8, display: 'block' }}>Payment Due:</span>
                    <div style={{ fontWeight: 700, color: selectedInvoice.invoice.computed_status === 'OVERDUE' ? '#e11d48' : 'inherit' }}>
                      {selectedInvoice.invoice.due_date}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Billing Period:</span>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>
                      {selectedInvoice.invoice.billing_period_start || 'Current'} to {selectedInvoice.invoice.billing_period_end || 'Next'}
                    </div>
                    {selectedInvoice.invoice.subscription_number && (
                      <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4 }}>
                        Subscription: {selectedInvoice.invoice.subscription_number}
                      </div>
                    )}
                  </div>
                </div>

                {/* Line Items */}
                <table className="data-table" style={{ marginBottom: 24 }}>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Variant</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Tax Rate</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.lines?.map((line: any) => (
                      <tr key={line.id}>
                        <td><strong>{line.description}</strong></td>
                        <td>{line.variant_name || 'Standard'}</td>
                        <td>{line.quantity}</td>
                        <td>${Number(line.unit_price).toFixed(2)}</td>
                        <td>{line.tax_rate}%</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          ${Number(line.line_total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals & Payments */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recorded Payments:</span>
                    {selectedInvoice.payments?.length > 0 ? (
                      selectedInvoice.payments.map((p: any) => (
                        <div key={p.id} style={{ fontSize: 12.5, padding: '4px 0', borderBottom: '1px dashed var(--border-subtle)' }}>
                          <span style={{ color: '#047857', fontWeight: 700 }}>${Number(p.amount).toFixed(2)}</span> paid on {p.payment_date} via {p.payment_method} ({p.payment_reference})
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>No payments recorded yet.</div>
                    )}
                  </div>

                  <div style={{ width: 260 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                      <span>Subtotal:</span>
                      <strong>${Number(selectedInvoice.invoice.subtotal).toFixed(2)}</strong>
                    </div>
                    {Number(selectedInvoice.invoice.discount_total) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#047857' }}>
                        <span>Discounts:</span>
                        <strong>-${Number(selectedInvoice.invoice.discount_total).toFixed(2)}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                      <span>Tax Amount:</span>
                      <strong>${Number(selectedInvoice.invoice.tax_total).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border-subtle)', marginTop: 4, fontSize: 15, fontWeight: 700 }}>
                      <span>Total Invoiced:</span>
                      <strong>${Number(selectedInvoice.invoice.total_amount).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#047857' }}>
                      <span>Amount Paid:</span>
                      <strong>${Number(selectedInvoice.invoice.amount_paid).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid var(--border-subtle)', marginTop: 4, fontSize: 18, fontWeight: 800 }}>
                      <span>Balance Due:</span>
                      <span style={{ color: Number(selectedInvoice.invoice.amount_due) > 0 ? '#e11d48' : '#047857' }}>
                        ${Number(selectedInvoice.invoice.amount_due).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={15} /> Print / Export PDF
              </button>
              {!isCustomer && Number(selectedInvoice.invoice.amount_due) > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    handleOpenPaymentModal(selectedInvoice.invoice);
                  }}
                >
                  <CreditCard size={15} /> Record Payment
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedInvoice(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Run Billing Modal */}
      {showBillingModal && (
        <div className="modal-overlay" onClick={() => setShowBillingModal(false)}>
          <div className="modal-content" style={{ maxWidth: 660 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Execute Recurring Billing Run</h3>
              <button className="icon-btn" onClick={() => setShowBillingModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* Safeguards explanation */}
              <div style={{ padding: '12px 16px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13, color: '#065f46' }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <ShieldCheck size={16} /> Automated Billing Safeguards Active:
                </div>
                <ul style={{ paddingLeft: 20, margin: 0, fontSize: 12.5 }}>
                  <li>Duplicate billing periods are strictly blocked via unique relational constraint.</li>
                  <li>Closed and paused subscriptions are excluded from invoice generation.</li>
                  <li>Subscription next billing date automatically advances by the configured interval.</li>
                </ul>
              </div>

              <div className="form-group">
                <label className="form-label">Billing Run Evaluation Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={billingTargetDate}
                  onChange={async (e) => {
                    setBillingTargetDate(e.target.value);
                    try {
                      const res = await api.get(`/api/billing/eligible?target_date=${e.target.value}`);
                      setBillingPreview(res);
                    } catch (err) {}
                  }}
                />
              </div>

              {/* Preview eligible subscriptions */}
              {billingPreview && (
                <div style={{ background: 'var(--bg-subtle)', padding: 14, borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong>Eligible Active Subscriptions:</strong>
                    <span className="badge badge-active">{billingPreview.eligibleCount} Eligible</span>
                  </div>
                  {billingPreview.subscriptions?.length > 0 ? (
                    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                      {billingPreview.subscriptions.map((s: any) => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0', borderBottom: '1px dashed var(--border-subtle)' }}>
                          <span>{s.subscription_number} — {s.customer_name}</span>
                          <strong>${Number(s.recurring_amount).toFixed(2)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No subscriptions are due for billing on or before this date.</span>
                  )}
                </div>
              )}

              {/* Run Results */}
              {billingRunResult && (
                <div style={{ padding: 14, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)' }}>
                  <strong style={{ color: '#15803d' }}>Execution Report:</strong>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    • Generated: <strong>{billingRunResult.invoicesCreated} invoices</strong><br />
                    • Skipped: <strong>{billingRunResult.skippedCount} subscriptions</strong> (due to duplicate period prevention or non-billing)
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBillingModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExecuteBillingRun}
                disabled={billingProcessing}
              >
                {billingProcessing ? 'Processing Billing...' : 'Execute Billing Run Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentInvoice && (
        <div className="modal-overlay" onClick={() => setPaymentInvoice(null)}>
          <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Record Payment against {paymentInvoice.invoice_number}</h3>
              <button className="icon-btn" onClick={() => setPaymentInvoice(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitPayment}>
              <div className="modal-body">
                {paymentError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, color: '#e11d48', fontSize: 13, marginBottom: 16 }}>
                    {paymentError}
                  </div>
                )}
                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>Customer:</span>
                    <strong>{paymentInvoice.customer_name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                    <span>Total Invoiced:</span>
                    <strong>${Number(paymentInvoice.total_amount).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                    <span>Current Outstanding:</span>
                    <strong style={{ color: '#e11d48' }}>${Number(paymentInvoice.amount_due).toFixed(2)}</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(paymentInvoice.amount_due)}
                    required
                    className="form-control"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select
                    className="form-control"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / ACH / Wire</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="DIRECT_DEBIT">Direct Debit</option>
                    <option value="CHECK">Check</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Transaction Reference (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="ACH-99882201"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentInvoice(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Payment Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
