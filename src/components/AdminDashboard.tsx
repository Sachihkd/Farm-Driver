import React, { useState, useEffect } from 'react';
import { User, MobileNumber, EmailId, ApiSettings, Vehicle } from '../types';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import { Users, Phone, Mail, Settings, Plus, Trash2, Building, Upload, Truck, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'numbers' | 'emails' | 'api' | 'profile' | 'vehicles' | 'companies'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [numbers, setNumbers] = useState<MobileNumber[]>([]);
  const [emails, setEmails] = useState<EmailId[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [apiSettings, setApiSettings] = useState<ApiSettings>({});
  const [loading, setLoading] = useState(false);

  // Form states
  const [newUser, setNewUser] = useState({ full_name: '', user_id: '', password: '', role: 'driver', company_id: 0 });
  const [newNumber, setNewNumber] = useState({ name: '', number: '', company_id: 0 });
  const [newEmail, setNewEmail] = useState({ name: '', email: '', company_id: 0 });
  const [newVehicle, setNewVehicle] = useState({ vehicle_number: '', model: '', company_id: 0 });
  const [newCompany, setNewCompany] = useState({ name: '', code: '', logo: '', wallpaper: '', retention_days: 30 });

  // Edit states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(0);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const getCompanyName = (companyId: number) => {
    const company = companies.find(c => c.id === companyId);
    return company ? company.name : 'Unknown';
  };

  useEffect(() => {
    if (currentUser.company_id && selectedCompanyId === 0) {
      setSelectedCompanyId(currentUser.company_id);
    }
  }, [currentUser.company_id]);

  useEffect(() => {
    fetchData();
    setEditingId(null); // Reset edit state when tab changes
    setNewUser({ full_name: '', user_id: '', password: '', role: 'driver', company_id: currentUser.company_id });
    setNewNumber({ name: '', number: '', company_id: currentUser.company_id });
    setNewEmail({ name: '', email: '', company_id: currentUser.company_id });
    setNewVehicle({ vehicle_number: '', model: '', company_id: currentUser.company_id });
    setNewCompany({ name: '', code: '', logo: '', wallpaper: '', retention_days: 30 });
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') setUsers(await api.get('/users'));
      if (activeTab === 'numbers') setNumbers(await api.get('/mobile-numbers'));
      if (activeTab === 'emails') setEmails(await api.get('/email-ids'));
      if (activeTab === 'vehicles') setVehicles(await api.get('/vehicles'));
      if (activeTab === 'companies') setCompanies(await api.get('/companies'));
      if (activeTab === 'api') {
        const targetId = currentUser.role === 'admin' ? selectedCompanyId : currentUser.company_id;
        if (targetId) {
          const settings = await api.get(`/settings?company_id=${targetId}`);
          if (Array.isArray(settings)) {
            const formatted = settings.reduce((acc: any, curr: any) => {
              try {
                acc[curr.key] = JSON.parse(curr.value);
              } catch (e) {
                acc[curr.key] = curr.value;
              }
              return acc;
            }, {});
            setApiSettings(formatted);
          } else {
            setApiSettings({});
          }
        }
      }
      // Always fetch companies for dropdowns if admin
      if (currentUser.role === 'admin') {
        const comps = await api.get('/companies');
        setCompanies(comps);
      }
    } catch (err) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/users/${editingId}`, newUser);
        toast.success('User updated');
      } else {
        await api.post('/users', newUser);
        toast.success('User added');
      }
      setNewUser({ full_name: '', user_id: '', password: '', role: 'driver', company_id: currentUser.company_id });
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save user');
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/companies/${editingId}`, newCompany);
        toast.success('Company updated');
      } else {
        await api.post('/companies', newCompany);
        toast.success('Company added');
      }
      setNewCompany({ name: '', code: '', logo: '', wallpaper: '', retention_days: 30 });
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save company');
    }
  };

  const handleAddNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNumber.number.startsWith('254')) {
      toast.error('Number must start with 254');
      return;
    }
    try {
      if (editingId) {
        await api.put(`/mobile-numbers/${editingId}`, newNumber);
        toast.success('Number updated');
      } else {
        await api.post('/mobile-numbers', newNumber);
        toast.success('Number added');
      }
      setNewNumber({ name: '', number: '', company_id: currentUser.company_id });
      setEditingId(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save number');
    }
  };

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/email-ids/${editingId}`, newEmail);
        toast.success('Email updated');
      } else {
        await api.post('/email-ids', newEmail);
        toast.success('Email added');
      }
      setNewEmail({ name: '', email: '', company_id: currentUser.company_id });
      setEditingId(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save email');
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/vehicles/${editingId}`, newVehicle);
        toast.success('Vehicle updated');
      } else {
        await api.post('/vehicles', newVehicle);
        toast.success('Vehicle added');
      }
      setNewVehicle({ vehicle_number: '', model: '', company_id: currentUser.company_id });
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save vehicle');
    }
  };

  useEffect(() => {
    if (activeTab === 'api') {
      fetchData();
    }
  }, [selectedCompanyId]);

  const handleSaveApi = async (key: string, value: any) => {
    try {
      const targetId = currentUser.role === 'admin' ? selectedCompanyId : currentUser.company_id;
      await api.post('/settings', { key, value, company_id: targetId });
      toast.success('Settings updated');
      if (['companyName', 'companyLogo', 'companyWallpaper'].includes(key)) {
        window.dispatchEvent(new CustomEvent('branding-updated'));
      }
    } catch (err) {
      toast.error('Failed to update settings');
    }
  };

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'numbers', label: 'Mobile Numbers', icon: Phone },
    { id: 'emails', label: 'Email IDs', icon: Mail },
    { id: 'vehicles', label: 'Vehicles', icon: Truck },
    { id: 'api', label: 'API Settings', icon: Settings },
    ...(currentUser.role === 'admin' ? [{ id: 'companies', label: 'Companies', icon: Building }] : []),
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 p-1 bg-slate-50 rounded-2xl w-fit border border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-[11px] uppercase tracking-wider transition-all ${
              activeTab === tab.id 
                ? 'bg-[#003399] text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon size={14} strokeWidth={1.5} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
        >
          {activeTab === 'users' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif font-bold text-slate-900">User Management</h3>
              </div>
              
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 p-6 bg-slate-50 rounded-2xl border border-[#003399]">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                    value={newUser.full_name}
                    onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">User ID</label>
                  <input
                    type="text"
                    placeholder="User ID"
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                    value={newUser.user_id}
                    onChange={e => setNewUser({ ...newUser, user_id: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Password</label>
                  <input
                    type="password"
                    placeholder="Password"
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Role</label>
                  <select
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
                  >
                    <option value="driver">Driver</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <button type="submit" className="w-full bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all py-3 text-sm">
                    {editingId ? 'Update' : <><Plus size={16} strokeWidth={1.5} /> Add User</>}
                  </button>
                  {editingId && (
                    <button 
                      type="button" 
                      onClick={() => { setEditingId(null); setNewUser({ full_name: '', user_id: '', password: '', role: 'driver', company_id: currentUser.company_id }); }}
                      className="w-full bg-white border border-gray-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all py-2 text-xs"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="py-4 px-4">Name</th>
                      <th className="py-4 px-4">User ID</th>
                      <th className="py-4 px-4">Role</th>
                      <th className="py-4 px-4">Company</th>
                      <th className="py-4 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-4 px-4 font-semibold text-slate-900 text-sm">{user.full_name}</td>
                        <td className="py-4 px-4 text-slate-500 font-mono text-xs">{user.user_id}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            user.role === 'admin' ? 'bg-red-50 text-red-600 border border-red-100' : 
                            user.role === 'manager' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-50 text-slate-600 border border-gray-100'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">{getCompanyName(user.company_id)}</td>
                        <td className="py-4 px-4 text-right space-x-1">
                          <button 
                            onClick={() => {
                              setEditingId(user.id);
                              setNewUser({ 
                                full_name: user.full_name, 
                                user_id: user.user_id, 
                                password: '********', 
                                role: user.role,
                                company_id: user.company_id
                              });
                            }}
                            className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                          >
                            <Pencil size={16} strokeWidth={1.5} />
                          </button>
                          <button 
                            onClick={() => api.delete(`/users/${user.id}`).then(fetchData)}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} strokeWidth={1.5} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'numbers' && (
            <div className="p-6">
              <h3 className="text-xl font-serif font-bold text-slate-900 mb-6">SMS Notification List</h3>
              <form onSubmit={handleAddNumber} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 p-6 bg-slate-50 rounded-2xl border border-[#003399]">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Name</label>
                  <input
                    type="text"
                    placeholder="Name"
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                    value={newNumber.name}
                    onChange={e => setNewNumber({ ...newNumber, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="Mobile (e.g. 254712345678)"
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                    value={newNumber.number}
                    onChange={e => setNewNumber({ ...newNumber, number: e.target.value })}
                    required
                  />
                </div>
                {currentUser.role === 'admin' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Company</label>
                    <select
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      value={newNumber.company_id}
                      onChange={e => setNewNumber({ ...newNumber, company_id: parseInt(e.target.value) })}
                    >
                      <option value={0}>Select Company</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex flex-col justify-end">
                  <button type="submit" className="w-full bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all py-3 text-sm">
                    {editingId ? 'Update' : <><Plus size={16} strokeWidth={1.5} /> Add Number</>}
                  </button>
                </div>
              </form>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="py-4 px-4">Name</th>
                      <th className="py-4 px-4">Mobile Number</th>
                      <th className="py-4 px-4">Company</th>
                      <th className="py-4 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {numbers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center">
                          <Phone className="mx-auto text-slate-200 mb-2" size={32} strokeWidth={1.5} />
                          <p className="text-slate-400 text-sm font-medium">No mobile numbers registered yet.</p>
                        </td>
                      </tr>
                    ) : (
                      numbers.map(num => (
                        <tr key={num.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="py-4 px-4 font-semibold text-slate-900 text-sm">{num.name}</td>
                          <td className="py-4 px-4 text-slate-500 font-mono text-xs">{num.number}</td>
                          <td className="py-4 px-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">{getCompanyName(num.company_id)}</td>
                          <td className="py-4 px-4 text-right space-x-1">
                            <button 
                              onClick={() => { 
                                setEditingId(num.id); 
                                setNewNumber({ 
                                  name: num.name, 
                                  number: num.number, 
                                  company_id: num.company_id 
                                }); 
                              }}
                              className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                            >
                              <Pencil size={16} strokeWidth={1.5} />
                            </button>
                            <button onClick={() => api.delete(`/mobile-numbers/${num.id}`).then(fetchData)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                              <Trash2 size={16} strokeWidth={1.5} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'emails' && (
            <div className="p-6">
              <h3 className="text-xl font-serif font-bold text-slate-900 mb-6">Email Notification List</h3>
              <form onSubmit={handleAddEmail} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 p-6 bg-slate-50 rounded-2xl border border-[#003399]">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Name</label>
                  <input
                    type="text"
                    placeholder="Name"
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                    value={newEmail.name}
                    onChange={e => setNewEmail({ ...newEmail, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                  <input
                    type="email"
                    placeholder="Email Address"
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                    value={newEmail.email}
                    onChange={e => setNewEmail({ ...newEmail, email: e.target.value })}
                    required
                  />
                </div>
                {currentUser.role === 'admin' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Company</label>
                    <select
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      value={newEmail.company_id}
                      onChange={e => setNewEmail({ ...newEmail, company_id: parseInt(e.target.value) })}
                    >
                      <option value={0}>Select Company</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex flex-col justify-end">
                  <button type="submit" className="w-full bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all py-3 text-sm">
                    {editingId ? 'Update' : <><Plus size={16} strokeWidth={1.5} /> Add Email</>}
                  </button>
                </div>
              </form>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="py-4 px-4">Name</th>
                      <th className="py-4 px-4">Email Address</th>
                      <th className="py-4 px-4">Company</th>
                      <th className="py-4 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {emails.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center">
                          <Mail className="mx-auto text-slate-200 mb-2" size={32} strokeWidth={1.5} />
                          <p className="text-slate-400 text-sm font-medium">No email addresses registered yet.</p>
                        </td>
                      </tr>
                    ) : (
                      emails.map(email => (
                        <tr key={email.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="py-4 px-4 font-semibold text-slate-900 text-sm">{email.name}</td>
                          <td className="py-4 px-4 text-slate-500 text-xs">{email.email}</td>
                          <td className="py-4 px-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">{getCompanyName(email.company_id)}</td>
                          <td className="py-4 px-4 text-right space-x-1">
                            <button 
                              onClick={() => { 
                                setEditingId(email.id); 
                                setNewEmail({ 
                                  name: email.name, 
                                  email: email.email, 
                                  company_id: email.company_id 
                                }); 
                              }}
                              className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                            >
                              <Pencil size={16} strokeWidth={1.5} />
                            </button>
                            <button onClick={() => api.delete(`/email-ids/${email.id}`).then(fetchData)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                              <Trash2 size={16} strokeWidth={1.5} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div className="p-6">
              <h3 className="text-xl font-serif font-bold text-slate-900 mb-6">Vehicle Management</h3>
              <form onSubmit={handleAddVehicle} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 p-6 bg-slate-50 rounded-2xl border border-[#003399]">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vehicle Number</label>
                  <input
                    type="text"
                    placeholder="Vehicle Number"
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                    value={newVehicle.vehicle_number}
                    onChange={e => setNewVehicle({ ...newVehicle, vehicle_number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Model</label>
                  <input
                    type="text"
                    placeholder="Model"
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                    value={newVehicle.model}
                    onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })}
                    required
                  />
                </div>
                {currentUser.role === 'admin' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Company</label>
                    <select
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      value={newVehicle.company_id}
                      onChange={e => setNewVehicle({ ...newVehicle, company_id: parseInt(e.target.value) })}
                    >
                      <option value={0}>Select Company</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex flex-col justify-end">
                  <button type="submit" className="w-full bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all py-3 text-sm">
                    {editingId ? 'Update' : <><Plus size={16} strokeWidth={1.5} /> Add Vehicle</>}
                  </button>
                </div>
              </form>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="py-4 px-4">Vehicle Number</th>
                      <th className="py-4 px-4">Model</th>
                      <th className="py-4 px-4">Company</th>
                      <th className="py-4 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {vehicles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center">
                          <Truck className="mx-auto text-slate-200 mb-2" size={32} strokeWidth={1.5} />
                          <p className="text-slate-400 text-sm font-medium">No vehicles registered yet.</p>
                        </td>
                      </tr>
                    ) : (
                      vehicles.map(vehicle => (
                        <tr key={vehicle.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="py-4 px-4 font-semibold text-slate-900 text-sm">{vehicle.vehicle_number}</td>
                          <td className="py-4 px-4 text-slate-500 text-xs">{vehicle.model}</td>
                          <td className="py-4 px-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">{getCompanyName(vehicle.company_id)}</td>
                          <td className="py-4 px-4 text-right space-x-1">
                            <button 
                              onClick={() => { 
                                setEditingId(vehicle.id); 
                                setNewVehicle({ 
                                  vehicle_number: vehicle.vehicle_number, 
                                  model: vehicle.model,
                                  company_id: vehicle.company_id
                                }); 
                              }}
                              className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                            >
                              <Pencil size={16} strokeWidth={1.5} />
                            </button>
                            <button onClick={() => api.delete(`/vehicles/${vehicle.id}`).then(fetchData)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                              <Trash2 size={16} strokeWidth={1.5} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="p-8 space-y-12">
              {currentUser.role === 'admin' && (
                <div className="p-6 bg-slate-50 rounded-2xl border border-[#003399] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase tracking-widest text-[10px] mb-1">Select Company</h4>
                    <p className="text-slate-400 text-xs">Manage API settings for a specific company.</p>
                  </div>
                  <select 
                    className="p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm min-w-[240px]"
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(parseInt(e.target.value))}
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
              )}

              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center border border-gray-100">
                    <Phone size={20} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-serif font-bold text-slate-900">Bulk SMS Configuration</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-slate-50 rounded-3xl border border-[#003399]">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">API URL</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      placeholder="https://api.bulksms.com/v1"
                      value={apiSettings.smsUrl || ''}
                      onChange={(e) => setApiSettings({ ...apiSettings, smsUrl: e.target.value })}
                      onBlur={(e) => handleSaveApi('smsUrl', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">API Key</label>
                    <input 
                      type="password" 
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      placeholder="••••••••••••••••"
                      value={apiSettings.smsKey || ''}
                      onChange={(e) => setApiSettings({ ...apiSettings, smsKey: e.target.value })}
                      onBlur={(e) => handleSaveApi('smsKey', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sender ID</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      placeholder="FLORA_FARM"
                      value={apiSettings.smsSenderId || ''}
                      onChange={(e) => setApiSettings({ ...apiSettings, smsSenderId: e.target.value })}
                      onBlur={(e) => handleSaveApi('smsSenderId', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Client ID</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      placeholder="343a5e19-xxxx-xxxx-9b7f-cdbd0c1d34ab"
                      value={apiSettings.smsClientId || ''}
                      onChange={(e) => setApiSettings({ ...apiSettings, smsClientId: e.target.value })}
                      onBlur={(e) => handleSaveApi('smsClientId', e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center border border-gray-100">
                    <Mail size={20} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-serif font-bold text-slate-900">SMTP Email Configuration</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-slate-50 rounded-3xl border border-[#003399]">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Host</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      placeholder="smtp.gmail.com"
                      value={apiSettings.smtpHost || ''}
                      onChange={(e) => setApiSettings({ ...apiSettings, smtpHost: e.target.value })}
                      onBlur={(e) => handleSaveApi('smtpHost', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Port</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      placeholder="587"
                      value={apiSettings.smtpPort || ''}
                      onChange={(e) => setApiSettings({ ...apiSettings, smtpPort: e.target.value })}
                      onBlur={(e) => handleSaveApi('smtpPort', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Username</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      placeholder="reports@farm.com"
                      value={apiSettings.smtpUser || ''}
                      onChange={(e) => setApiSettings({ ...apiSettings, smtpUser: e.target.value })}
                      onBlur={(e) => handleSaveApi('smtpUser', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Password</label>
                    <input 
                      type="password" 
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      placeholder="••••••••"
                      value={apiSettings.smtpPass || ''}
                      onChange={(e) => setApiSettings({ ...apiSettings, smtpPass: e.target.value })}
                      onBlur={(e) => handleSaveApi('smtpPass', e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={async () => {
                      const toastId = toast.loading('Sending test email...');
                      try {
                        const targetId = currentUser.role === 'admin' ? selectedCompanyId : currentUser.company_id;
                        await api.post('/test-email', { company_id: targetId });
                        toast.success('Test email sent successfully!', { id: toastId });
                      } catch (err: any) {
                        toast.error(`Failed: ${err.message}`, { id: toastId, duration: 5000 });
                      }
                    }}
                    className="flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                  >
                    <Mail size={18} strokeWidth={1.5} /> Send Test Email
                  </button>
                </div>
              </section>
            </div>
          )}
          {activeTab === 'companies' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center border border-gray-100">
                  <Building size={20} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-serif font-bold text-slate-900">Company Management</h3>
              </div>

              <form onSubmit={handleAddCompany} className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 p-8 bg-slate-50 rounded-3xl border border-[#003399]">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Company Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Flora Farm"
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                      value={newCompany.name}
                      onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Company Code</label>
                      <input
                        type="text"
                        placeholder="e.g. FLORA"
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                        value={newCompany.code}
                        onChange={e => setNewCompany({ ...newCompany, code: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Retention Days</label>
                      <input
                        type="number"
                        placeholder="e.g. 30"
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                        value={newCompany.retention_days}
                        onChange={e => setNewCompany({ ...newCompany, retention_days: parseInt(e.target.value) || 0 })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Company Logo</label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-2xl border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                          {newCompany.logo && newCompany.logo.trim() !== "" ? (
                            <img src={newCompany.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                          ) : (
                            <Building className="text-slate-200" size={24} strokeWidth={1.5} />
                          )}
                        </div>
                        <label className="cursor-pointer bg-white border border-gray-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                          <Upload size={14} strokeWidth={1.5} /> Upload
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setNewCompany({ ...newCompany, logo: reader.result as string });
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Wallpaper</label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-2xl border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                          {newCompany.wallpaper && newCompany.wallpaper.trim() !== "" ? (
                            <img src={newCompany.wallpaper} alt="Wallpaper" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-slate-200 text-[8px] font-bold">NONE</div>
                          )}
                        </div>
                        <label className="cursor-pointer bg-white border border-gray-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                          <Upload size={14} strokeWidth={1.5} /> Upload
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setNewCompany({ ...newCompany, wallpaper: reader.result as string });
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10">
                      {editingId ? 'Update Company' : <><Plus size={20} strokeWidth={1.5} /> Add Company</>}
                    </button>
                    {editingId && (
                      <button 
                        type="button" 
                        onClick={() => { setEditingId(null); setNewCompany({ name: '', code: '', logo: '', wallpaper: '', retention_days: 30 }); }}
                        className="px-8 bg-white border border-gray-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                      <th className="pb-4 pl-4">Logo</th>
                      <th className="pb-4">Company Name</th>
                      <th className="pb-4">Code</th>
                      <th className="pb-4">Retention</th>
                      <th className="pb-4 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {companies.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-16 text-center">
                          <Building className="mx-auto text-slate-200 mb-4" size={48} strokeWidth={1} />
                          <p className="text-slate-400 font-serif italic">No companies registered yet.</p>
                        </td>
                      </tr>
                    ) : (
                      companies.map(comp => (
                        <tr key={comp.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="py-5 pl-4">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm group-hover:scale-110 transition-transform">
                              {comp.logo && comp.logo.trim() !== "" ? (
                                <img src={comp.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                              ) : (
                                <Building className="text-slate-200" size={20} strokeWidth={1.5} />
                              )}
                            </div>
                          </td>
                          <td className="py-5">
                            <span className="font-bold text-slate-900 block">{comp.name}</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Registered Entity</span>
                          </td>
                          <td className="py-5">
                            <code className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono">{comp.code}</code>
                          </td>
                          <td className="py-5 text-slate-500 text-sm">{comp.retention_days} days</td>
                          <td className="py-5 text-right pr-4 space-x-1">
                            <button 
                              onClick={() => { 
                                setEditingId(comp.id); 
                                setNewCompany({ 
                                  name: comp.name, 
                                  code: comp.code, 
                                  logo: comp.logo, 
                                  wallpaper: comp.wallpaper, 
                                  retention_days: comp.retention_days 
                                }); 
                              }}
                              className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                              title="Edit Company"
                            >
                              <Pencil size={18} strokeWidth={1.5} />
                            </button>
                            <button 
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this company?')) {
                                  api.delete(`/companies/${comp.id}`).then(fetchData);
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                              title="Delete Company"
                            >
                              <Trash2 size={18} strokeWidth={1.5} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
