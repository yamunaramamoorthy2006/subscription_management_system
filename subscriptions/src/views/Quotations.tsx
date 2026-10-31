import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Printer,
  ArrowRight,
  Trash2,
  X,
  FileText,
  AlertCircle
} from 'lucide-react';
import { api } from '../api/client';
import { NavTab } from '../components/Shell';

interface QuotationsProps {
  onNavigate: (tab: NavTab) => void;
}

export const Quotations: React.FC<QuotationsProps> = ({ onNavigate }) => {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // New Quote Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedQuoteDetail, setSelectedQuoteDetail] = useState<any>(null);
  const [quoteLines, setQuoteLines] = useState<any[]>([]);
  const [quoteForm, setQuoteForm] = useState<any>({
    customer_id: '',
    plan_id: '',
    quotation_date: new Date().toISOString().split('T')[0],
    expiration_date: '',
    payment_terms: 'NET30',
    notes: ''
  });
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [quoteRes, custRes, planRes, prodRes] = await Promise.all([
        api.get(`/api/quotations?${statusFilter !== 'ALL' ? `status=${statusFilter}` : ''}`),
        api.get('/api/customers'),
        api.get('/api/plans'),
        api.get('/api/products')
      ]);
      setQuotations(quoteRes.quotations || []);
      setCustomers(custRes.customers || []);
      setPlans(planRes.plans || []);
      setProducts(prodRes.products || []);
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleOpenCreate = () => {
    const firstCust = customers[0]?.id || '';
    const firstPlan = plans[0]?.id || '';
    const firstProd = products[0];
    const defaultVar = firstProd?.variants?.[0];

    setQuoteForm({
      customer_id: firstCust,
      plan_id: firstPlan,
      quotation_date: new Date().toISOString().split('T')[0],
      expiration_date: '',
      payment_terms: 'NET30',
      notes: 'Initial quotation valid for 30 calendar days.'
    });

    setQuoteLines([
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
    setShowModal(true);
  };

  const addLine = () => {
    const firstProd = products[0];
    const defaultVar = firstProd?.variants?.[0];
    setQuoteLines([
      ...quoteLines,
      {
        product_id: firstProd?.id || '',
        variant_id: defaultVar?.id || null,
        description: firstProd?.name || 'Product item',
        quantity: 1,
        unit_price: firstProd?.sales_price || 0,
        variant_adjustment: defaultVar?.price_adjustment || 0,
        tax_rate: firstProd?.tax_rate || 0,
        discount_amount: 0
      }
    ]);
  };

  const removeLine = (idx: number) => {
    setQuoteLines(quoteLines.filter((_, i) => i !== idx));
  };

  // Live calculation of totals
  const subtotal = quoteLines.reduce((acc, l) => {
    const effectivePrice = Number(l.unit_price) + Number(l.variant_adjustment || 0);
    return acc + effectivePrice * Number(l.quantity || 1);
  }, 0);

  const discountTotal = quoteLines.reduce((acc, l) => acc + Number(l.discount_amount || 0), 0);
  const taxTotal = quoteLines.reduce((acc, l) => {
    const effectivePrice = Number(l.unit_price) + Number(l.variant_adjustment || 0);
    const lineSub = effectivePrice * Number(l.quantity || 1);
    const taxable = Math.max(0, lineSub - Number(l.discount_amount || 0));
    return acc + taxable * (Number(l.tax_rate || 0) / 100);
  }, 0);
  const grandTotal = Math.max(0, subtotal - discountTotal) + taxTotal;

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.post('/api/quotations', {
        ...quoteForm,
        lines: quoteLines
      });
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create quotation');
    }
  };

  const handleConfirmQuote = async (id: number) => {
    try {
      await api.post(`/api/quotations/${id}/confirm`, {});
      loadData();
      if (selectedQuoteDetail?.quotation?.id === id) {
        setSelectedQuoteDetail({
          ...selectedQuoteDetail,
          quotation: { ...selectedQuoteDetail.quotation, status: 'CONFIRMED' }
        });
      }
    } catch (err: any) {
      alert(`Confirm failed: ${err.message}`);
    }
  };

  const handleConvertQuote = async (id: number) => {
    try {
      const res = await api.post(`/api/quotations/${id}/convert`, {});
      alert(`Success! ${res.message} Subscription: ${res.subscription_number}`);
      loadData();
      setSelectedQuoteDetail(null);
      onNavigate('subscriptions');
    } catch (err: any) {
      alert(`Conversion failed: ${err.message}`);
    }
  };

  const handleViewQuote = async (id: number) => {
    try {
      const res = await api.get(`/api/quotations/${id}`);
      setSelectedQuoteDetail(res);
    } catch (err: any) {
      alert('Failed to load quotation');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Quotations & Conversion</h1>
          <p className="page-description">
            Prepare, price, validate, and convert formal commercial quotations into active recurring subscriptions.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> New Quotation
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Filter size={16} color="var(--text-muted)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Filter Status:</span>
          {['ALL', 'DRAFT', 'QUOTATION', 'CONFIRMED'].map((st) => (
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

      {/* Quotations Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Quotation #</th>
              <th>Customer</th>
              <th>Plan</th>
              <th>Quotation Date</th>
              <th>Grand Total</th>
              <th>Status</th>
              <th>Subscription Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '36px' }}>Loading quotations...</td></tr>
            ) : quotations.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>No quotations found.</td></tr>
            ) : (
              quotations.map((q) => (
                <tr key={q.id}>
                  <td>
                    <strong style={{ fontFamily: 'monospace' }}>{q.quotation_number}</strong>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{q.customer_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{q.customer_email}</div>
                  </td>
                  <td>{q.plan_name || 'Custom Setup'}</td>
                  <td>{q.quotation_date}</td>
                  <td>
                    <strong style={{ fontSize: 15, color: 'var(--primary)' }}>
                      ${Number(q.grand_total).toFixed(2)}
                    </strong>
                  </td>
                  <td>
                    <span className={`badge badge-${q.status.toLowerCase()}`}>{q.status}</span>
                  </td>
                  <td>
                    {q.converted_subscription_id ? (
                      <span className="badge badge-active" title="Converted to subscription">
                        <CheckCircle2 size={12} /> Converted
                      </span>
                    ) : q.status === 'CONFIRMED' ? (
                      <span className="badge badge-expiring">Ready to Convert</span>
                    ) : (
                      <span className="badge badge-draft">Draft</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleViewQuote(q.id)}>
                        Preview
                      </button>
                      {q.status !== 'CONFIRMED' && !q.converted_subscription_id && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleConfirmQuote(q.id)}>
                          Confirm
                        </button>
                      )}
                      {q.status === 'CONFIRMED' && !q.converted_subscription_id && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleConvertQuote(q.id)}>
                          Convert to Sub <ArrowRight size={13} />
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

      {/* Preview & Print Quotation Modal */}
      {selectedQuoteDetail && (
        <div className="modal-overlay" onClick={() => setSelectedQuoteDetail(null)}>
          <div className="modal-content" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                Quotation {selectedQuoteDetail.quotation.quotation_number}
              </h3>
              <button className="icon-btn" onClick={() => setSelectedQuoteDetail(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="printable-invoice">
                {/* Header */}
                <div className="invoice-header">
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>
                      Brightloop Software
                    </h2>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      100 Innovation Way, Suite 400 • San Francisco, CA 94105<br />
                      billing@brightloop.io • +1 (800) 555-0199
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>COMMERCIAL QUOTATION</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>
                      {selectedQuoteDetail.quotation.quotation_number}
                    </div>
                    <span className={`badge badge-${selectedQuoteDetail.quotation.status.toLowerCase()}`} style={{ marginTop: 6 }}>
                      {selectedQuoteDetail.quotation.status}
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="invoice-meta-grid">
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recipient:</span>
                    <div style={{ fontWeight: 700, marginTop: 2 }}>{selectedQuoteDetail.quotation.customer_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedQuoteDetail.quotation.customer_email}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedQuoteDetail.quotation.billing_address || 'Address on file'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quotation Date:</span>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedQuoteDetail.quotation.quotation_date}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 8, display: 'block' }}>Valid Until:</span>
                    <div style={{ fontWeight: 600 }}>{selectedQuoteDetail.quotation.expiration_date}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subscription Plan:</span>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedQuoteDetail.quotation.plan_name}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 8, display: 'block' }}>Payment Terms:</span>
                    <div style={{ fontWeight: 600 }}>{selectedQuoteDetail.quotation.payment_terms}</div>
                  </div>
                </div>

                {/* Lines Table */}
                <table className="data-table" style={{ marginBottom: 24 }}>
                  <thead>
                    <tr>
                      <th>Product / Item</th>
                      <th>Variant</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Tax</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuoteDetail.lines?.map((line: any) => (
                      <tr key={line.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{line.product_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{line.product_code}</div>
                        </td>
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

                {/* Summary calculation totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: 260 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                      <span>Subtotal:</span>
                      <strong>${Number(selectedQuoteDetail.quotation.subtotal).toFixed(2)}</strong>
                    </div>
                    {Number(selectedQuoteDetail.quotation.discount_total) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#047857' }}>
                        <span>Discounts:</span>
                        <strong>-${Number(selectedQuoteDetail.quotation.discount_total).toFixed(2)}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                      <span>Taxes:</span>
                      <strong>${Number(selectedQuoteDetail.quotation.tax_total).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid var(--border-subtle)', marginTop: 6, fontSize: 17, fontWeight: 800 }}>
                      <span>Grand Total:</span>
                      <span style={{ color: 'var(--primary)' }}>
                        ${Number(selectedQuoteDetail.quotation.grand_total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={15} /> Print Quotation
              </button>
              {selectedQuoteDetail.quotation.status !== 'CONFIRMED' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => handleConfirmQuote(selectedQuoteDetail.quotation.id)}
                >
                  Confirm Quotation
                </button>
              )}
              {selectedQuoteDetail.quotation.status === 'CONFIRMED' && !selectedQuoteDetail.quotation.converted_subscription_id && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleConvertQuote(selectedQuoteDetail.quotation.id)}
                >
                  Convert to Active Subscription <ArrowRight size={14} />
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedQuoteDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Quotation Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 840 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Create New Commercial Quotation</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveQuotation}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, color: '#e11d48', fontSize: 13, marginBottom: 16 }}>
                    {formError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Customer *</label>
                    <select
                      className="form-control"
                      required
                      value={quoteForm.customer_id}
                      onChange={(e) => setQuoteForm({ ...quoteForm, customer_id: Number(e.target.value) })}
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
                      value={quoteForm.plan_id}
                      onChange={(e) => setQuoteForm({ ...quoteForm, plan_id: Number(e.target.value) })}
                    >
                      <option value="">Select target plan...</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} (${Number(p.billing_price).toFixed(2)} / {p.billing_interval})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quotation Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={quoteForm.quotation_date}
                      onChange={(e) => setQuoteForm({ ...quoteForm, quotation_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiration Date (Optional)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={quoteForm.expiration_date}
                      onChange={(e) => setQuoteForm({ ...quoteForm, expiration_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Terms</label>
                    <select
                      className="form-control"
                      value={quoteForm.payment_terms}
                      onChange={(e) => setQuoteForm({ ...quoteForm, payment_terms: e.target.value })}
                    >
                      <option value="NET30">NET 30</option>
                      <option value="NET15">NET 15</option>
                      <option value="DUE_ON_RECEIPT">Due on Receipt</option>
                    </select>
                  </div>
                </div>

                {/* Line Items Table */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Quotation Line Items</label>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={addLine}>
                      <Plus size={14} /> Add Product Line
                    </button>
                  </div>

                  {quoteLines.map((line, idx) => {
                    const selProd = products.find((p) => p.id === Number(line.product_id));
                    return (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center', marginBottom: 8, background: 'var(--bg-subtle)', padding: 8, borderRadius: 6 }}>
                        {/* Product Selector */}
                        <select
                          className="form-control"
                          value={line.product_id}
                          onChange={(e) => {
                            const prod = products.find((p) => p.id === Number(e.target.value));
                            const defaultVar = prod?.variants?.[0];
                            const updated = [...quoteLines];
                            updated[idx] = {
                              ...updated[idx],
                              product_id: prod?.id,
                              description: prod?.name,
                              unit_price: prod?.sales_price || 0,
                              tax_rate: prod?.tax_rate || 0,
                              variant_id: defaultVar?.id || null,
                              variant_adjustment: defaultVar?.price_adjustment || 0
                            };
                            setQuoteLines(updated);
                          }}
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} (${Number(p.sales_price).toFixed(2)})</option>
                          ))}
                        </select>

                        {/* Variant Selector */}
                        <select
                          className="form-control"
                          value={line.variant_id || ''}
                          onChange={(e) => {
                            const varId = Number(e.target.value);
                            const v = selProd?.variants?.find((varItem: any) => varItem.id === varId);
                            const updated = [...quoteLines];
                            updated[idx].variant_id = varId || null;
                            updated[idx].variant_adjustment = v?.price_adjustment || 0;
                            setQuoteLines(updated);
                          }}
                        >
                          <option value="">Base Product (No variant)</option>
                          {selProd?.variants?.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {v.variant_name} (+${Number(v.price_adjustment).toFixed(2)})
                            </option>
                          ))}
                        </select>

                        {/* Quantity */}
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          className="form-control"
                          value={line.quantity}
                          onChange={(e) => {
                            const updated = [...quoteLines];
                            updated[idx].quantity = parseInt(e.target.value) || 1;
                            setQuoteLines(updated);
                          }}
                        />

                        {/* Unit price (computed) */}
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          ${(Number(line.unit_price) + Number(line.variant_adjustment || 0)).toFixed(2)}
                        </div>

                        {/* Discount */}
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Disc $"
                          className="form-control"
                          value={line.discount_amount}
                          onChange={(e) => {
                            const updated = [...quoteLines];
                            updated[idx].discount_amount = parseFloat(e.target.value) || 0;
                            setQuoteLines(updated);
                          }}
                        />

                        {/* Remove line */}
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ color: '#e11d48' }}
                          onClick={() => removeLine(idx)}
                          disabled={quoteLines.length === 1}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Summary Bar */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <div style={{ textAlign: 'right', background: '#ffffff', padding: '12px 18px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Subtotal: <strong>${subtotal.toFixed(2)}</strong> | Taxes: <strong>${taxTotal.toFixed(2)}</strong>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
                        Calculated Total: ${grandTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Draft Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
