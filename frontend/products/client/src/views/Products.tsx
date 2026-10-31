import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  X,
  Layers,
  Percent,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const Products: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [products, setProducts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Create Product Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [form, setForm] = useState<any>({
    code: '',
    name: '',
    product_type: 'SOFTWARE',
    sales_price: 100,
    cost_price: 20,
    description: '',
    tax_rate_id: '',
    variants: [{ variant_name: 'Standard Tier', price_adjustment: 0, is_default: 1 }]
  });
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, taxRes] = await Promise.all([
        api.get(`/api/products?${search ? `search=${search}&` : ''}${typeFilter !== 'ALL' ? `type=${typeFilter}` : ''}`),
        api.get('/api/taxes')
      ]);
      setProducts(prodRes.products || []);
      setTaxes(taxRes.taxes || []);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, typeFilter]);

  const handleOpenCreate = () => {
    const defaultTax = taxes.find((t) => t.is_default) || taxes[0];
    setEditingProduct(null);
    setForm({
      code: `PROD-${Date.now().toString().slice(-4)}`,
      name: '',
      product_type: 'SOFTWARE',
      sales_price: 149.0,
      cost_price: 30.0,
      description: '',
      tax_rate_id: defaultTax?.id || '',
      variants: [
        { variant_name: 'Standard Instance', price_adjustment: 0, is_default: 1 },
        { variant_name: 'Enterprise Cluster (+ $100)', price_adjustment: 100, is_default: 0 }
      ]
    });
    setFormError(null);
    setShowModal(true);
  };

  const addVariantRow = () => {
    setForm({
      ...form,
      variants: [...form.variants, { variant_name: '', price_adjustment: 0, is_default: 0 }]
    });
  };

  const removeVariantRow = (idx: number) => {
    setForm({
      ...form,
      variants: form.variants.filter((_: any, i: number) => i !== idx)
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (editingProduct) {
        await api.put(`/api/products/${editingProduct.id}`, form);
      } else {
        await api.post('/api/products', form);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product');
    }
  };

  const handleArchive = async (id: number) => {
    if (!window.confirm('Archive this product? Historical line items will be preserved.')) return;
    try {
      await api.del(`/api/products/${id}`);
      loadData();
    } catch (err: any) {
      alert(`Archive failed: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Products & Variants Catalog</h1>
          <p className="page-description">
            Configure core SaaS plans, add-on modules, variant price modifiers, and applicable tax structures.
          </p>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <Plus size={16} /> New Product
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
              placeholder="Search by product name, code or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Product Types</option>
              <option value="SOFTWARE">Core Software</option>
              <option value="ADDON">Add-on Modules</option>
              <option value="SERVICE">Professional Services / SLA</option>
            </select>
          </div>
        </div>
      </div>

      {/* Formula Explainer Callout */}
      <div style={{ padding: '12px 18px', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13, color: '#3730a3', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Tag size={18} />
        <span>
          <strong>Variant Price Adjustment Rule:</strong> Final Unit Price = Base Sales Price + Variant Price Adjustment. Applied consistently across Quotations, Subscriptions, and Invoices.
        </span>
      </div>

      {/* Products Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>Loading product catalog...</div>
        ) : products.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            No products matching criteria.
          </div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span className="badge badge-draft" style={{ marginBottom: 6 }}>{p.product_type}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</h3>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.code}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>${Number(p.sales_price).toFixed(2)}</div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Base Sales Price</span>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-body)', marginBottom: 16 }}>{p.description || 'No description provided.'}</p>

                {/* Variants List */}
                <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Configured Variants ({p.variants?.length || 0})
                  </div>
                  {p.variants?.length > 0 ? (
                    p.variants.map((v: any) => {
                      const finalPrice = Number(p.sales_price) + Number(v.price_adjustment);
                      return (
                        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, padding: '4px 0', borderBottom: '1px dashed var(--border-subtle)' }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{v.variant_name}</span>
                            {v.is_default === 1 && <span className="badge badge-active" style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px' }}>Default</span>}
                          </div>
                          <div>
                            <span style={{ color: Number(v.price_adjustment) > 0 ? '#047857' : 'inherit' }}>
                              {Number(v.price_adjustment) > 0 ? `+ $${Number(v.price_adjustment).toFixed(2)}` : '$0.00'}
                            </span>
                            <strong style={{ marginLeft: 8, color: 'var(--text-main)' }}>(${finalPrice.toFixed(2)})</strong>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No additional variants configured.</span>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Tax: <strong>{p.tax_name || 'Standard Rate'} ({p.tax_rate || 0}%)</strong>
                </span>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setEditingProduct(p);
                        setForm({
                          code: p.code,
                          name: p.name,
                          product_type: p.product_type,
                          sales_price: p.sales_price,
                          cost_price: p.cost_price,
                          description: p.description,
                          tax_rate_id: p.tax_rate_id,
                          variants: p.variants || []
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
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Product Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                {editingProduct ? 'Edit Product & Variants' : 'Create New Product'}
              </h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, color: '#e11d48', fontSize: 13, marginBottom: 16 }}>
                    {formError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Product Code *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Product Type</label>
                    <select
                      className="form-control"
                      value={form.product_type}
                      onChange={(e) => setForm({ ...form, product_type: e.target.value })}
                    >
                      <option value="SOFTWARE">Software License</option>
                      <option value="ADDON">Add-on Module</option>
                      <option value="SERVICE">Professional Service / SLA</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Brightloop Data Lake Engine"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Base Sales Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="form-control"
                      value={form.sales_price}
                      onChange={(e) => setForm({ ...form, sales_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.cost_price}
                      onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Applicable Tax</label>
                    <select
                      className="form-control"
                      value={form.tax_rate_id}
                      onChange={(e) => setForm({ ...form, tax_rate_id: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">No Tax / Exempt</option>
                      {taxes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.rate}%)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="Features, deployment options..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                {/* Variants Editor Section */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Product Variants & Price Modifiers</label>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={addVariantRow}>
                      <Plus size={14} /> Add Variant
                    </button>
                  </div>

                  {form.variants?.map((v: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                      <input
                        type="text"
                        placeholder="Variant Name (e.g. High Memory)"
                        className="form-control"
                        style={{ flex: 2 }}
                        value={v.variant_name}
                        onChange={(e) => {
                          const updated = [...form.variants];
                          updated[idx].variant_name = e.target.value;
                          setForm({ ...form, variants: updated });
                        }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price Adjustment"
                        className="form-control"
                        style={{ flex: 1 }}
                        value={v.price_adjustment}
                        onChange={(e) => {
                          const updated = [...form.variants];
                          updated[idx].price_adjustment = parseFloat(e.target.value) || 0;
                          setForm({ ...form, variants: updated });
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        style={{ color: '#e11d48' }}
                        onClick={() => removeVariantRow(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

