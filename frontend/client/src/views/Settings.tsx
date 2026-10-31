import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building2,
  Users,
  ShieldCheck,
  Plus,
  Save,
  CheckCircle2,
  X
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [companySettings, setCompanySettings] = useState<any>({
    company_name: 'Brightloop Software',
    support_email: 'billing@brightloop.io',
    phone: '+1 (800) 555-0199',
    address: '100 Innovation Way, Suite 400, San Francisco, CA 94105',
    currency: 'USD',
    tax_id: 'US-84920491',
    invoice_prefix: 'INV-',
    quotation_prefix: 'QT-',
    subscription_prefix: 'SUB-'
  });

  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // New Staff Modal
  const [showStaffModal, setShowStaffModal] = useState<boolean>(false);
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF'
  });
  const [staffError, setStaffError] = useState<string | null>(null);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const [compRes, staffRes] = await Promise.all([
        api.get('/api/settings/company'),
        isAdmin ? api.get('/api/settings/staff') : Promise.resolve({ staff: [] })
      ]);
      if (compRes.settings) setCompanySettings(compRes.settings);
      setStaffList(staffRes.staff || []);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    try {
      await api.put('/api/settings/company', companySettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    try {
      await api.post('/api/settings/staff', staffForm);
      setShowStaffModal(false);
      setStaffForm({ name: '', email: '', password: '', role: 'STAFF' });
      loadSettingsData();
    } catch (err: any) {
      setStaffError(err.message || 'Failed to create staff account');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>System Configuration & Staff</h1>
          <p className="page-description">
            Manage organization profile, invoice formatting prefixes, and staff role-based access controls.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div style={{ padding: '12px 18px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)', color: '#047857', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} /> Company settings saved successfully.
        </div>
      )}

      {/* Two Column Settings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 24 }}>
        {/* Company Profile Form */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Building2 size={18} color="var(--primary)" />
              Brightloop Company Details
            </h2>
          </div>
          <form onSubmit={handleSaveCompany}>
            <div className="form-group">
              <label className="form-label">Organization Legal Name</label>
              <input
                type="text"
                className="form-control"
                value={companySettings.company_name}
                onChange={(e) => setCompanySettings({ ...companySettings, company_name: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Billing Support Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={companySettings.support_email}
                  onChange={(e) => setCompanySettings({ ...companySettings, support_email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Support Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={companySettings.phone}
                  onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Registered Corporate Address</label>
              <textarea
                rows={2}
                className="form-control"
                value={companySettings.address}
                onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Base Currency</label>
                <input
                  type="text"
                  className="form-control"
                  value={companySettings.currency}
                  onChange={(e) => setCompanySettings({ ...companySettings, currency: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tax ID / Federal EIN</label>
                <input
                  type="text"
                  className="form-control"
                  value={companySettings.tax_id}
                  onChange={(e) => setCompanySettings({ ...companySettings, tax_id: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Invoice Prefix</label>
                <input
                  type="text"
                  className="form-control"
                  value={companySettings.invoice_prefix}
                  onChange={(e) => setCompanySettings({ ...companySettings, invoice_prefix: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Quotation Prefix</label>
                <input
                  type="text"
                  className="form-control"
                  value={companySettings.quotation_prefix}
                  onChange={(e) => setCompanySettings({ ...companySettings, quotation_prefix: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Subscription Prefix</label>
                <input
                  type="text"
                  className="form-control"
                  value={companySettings.subscription_prefix}
                  onChange={(e) => setCompanySettings({ ...companySettings, subscription_prefix: e.target.value })}
                />
              </div>
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={15} /> Save Changes
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Staff & Operators Management */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <ShieldCheck size={18} color="var(--primary)" />
                Staff Accounts & Operators
              </h2>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Role-based operational team permissions</span>
            </div>
            {isAdmin && (
              <button className="btn btn-sm btn-primary" onClick={() => setShowStaffModal(true)}>
                <Plus size={14} /> Add Staff
              </button>
            )}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((st) => (
                <tr key={st.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{st.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{st.email}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${st.role === 'ADMIN' ? 'active' : 'draft'}`}>
                      {st.role}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {st.created_at ? st.created_at.split(' ')[0] : 'Active'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showStaffModal && (
        <div className="modal-overlay" onClick={() => setShowStaffModal(false)}>
          <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Add Team Member</h3>
              <button className="icon-btn" onClick={() => setShowStaffModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateStaff}>
              <div className="modal-body">
                {staffError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, color: '#e11d48', fontSize: 13, marginBottom: 16 }}>
                    {staffError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Liam Patel"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Corporate Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    placeholder="liam.patel@brightloop.io"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password (&gt; 8 chars, 1 uppercase, 1 lowercase, 1 symbol) *</label>
                  <input
                    type="password"
                    required
                    className="form-control"
                    placeholder="e.g. SecureStaff2026!"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-control"
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  >
                    <option value="STAFF">Staff (Operations, Invoicing, Payments)</option>
                    <option value="ADMIN">Admin (Full System Permissions)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowStaffModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
