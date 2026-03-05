import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { DriverDashboard } from './components/DriverDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ReportModule } from './components/ReportModule';
import { User } from './types';
import { LayoutDashboard, FileText, Settings, Clock, MapPin, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Trip } from './types';
import { api } from './services/api';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'reports' | 'settings'>('dashboard');
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [stats, setStats] = useState({ active: 0, today: 0 });

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'manager') && view === 'dashboard') {
      fetchDashboardData();
    }
  }, [user, view]);

  const fetchDashboardData = async () => {
    try {
      const trips = await api.get('/trips/recent');
      if (Array.isArray(trips)) {
        setRecentTrips(trips);
      }
      
      // Fetch some basic stats
      const allToday = await api.get(`/reports?startDate=${format(new Date(), 'yyyy-MM-dd')}&endDate=${format(new Date(), 'yyyy-MM-dd')}`);
      
      setStats({
        active: Array.isArray(trips) ? trips.filter((t: Trip) => t.status === 'active').length : 0,
        today: Array.isArray(allToday) ? allToday.length : 0
      });
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err.message || err);
    }
  };

  const handleLogin = (user: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('vehicle_number');
    setUser(null);
  };

  if (!user) {
    return (
      <Layout user={null} onLogout={() => {}}>
        <Login onLogin={handleLogin} />
      </Layout>
    );
  }

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout} 
      activeView={view} 
      onViewChange={setView}
    >
      {user.role === 'driver' ? (
        <DriverDashboard user={user} onLogout={handleLogout} />
      ) : (
        <>
          {view === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 tracking-tight">
                  Dashboard
                </h1>
                <p className="text-sm text-slate-500">Overview of recent trip activities and statistics.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center border border-gray-100">
                          <Clock size={18} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg font-serif font-bold text-slate-900">Recent Completed Trips</h3>
                      </div>
                      <button 
                        onClick={() => setView('reports')}
                        className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-900 transition-colors"
                      >
                        View All
                      </button>
                    </div>

                    <div className="space-y-4">
                      {recentTrips.length === 0 ? (
                        <div className="py-12 text-center border border-dashed border-gray-100 rounded-2xl">
                          <p className="text-slate-400 font-medium text-sm">No completed trips found yet.</p>
                        </div>
                      ) : (
                        recentTrips.map(trip => (
                          <div key={trip.id} className="p-4 bg-white rounded-xl border border-gray-100 flex items-center justify-between gap-4 hover:border-gray-200 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-gray-100">
                                <UserIcon size={18} strokeWidth={1.5} />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 text-sm">{trip.driver_name}</p>
                                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{trip.vehicle_number}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-900">
                                {trip.created_at ? (() => {
                                  try {
                                    return format(new Date(trip.created_at), 'HH:mm');
                                  } catch {
                                    return '--:--';
                                  }
                                })() : '--:--'}
                              </p>
                              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Completed</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100">
                    <h3 className="font-serif font-bold text-slate-900 mb-6 text-lg">Quick Stats</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-5 bg-slate-50 rounded-2xl border border-gray-100">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Active Trips</p>
                        <p className="text-3xl font-serif font-bold text-slate-900">{stats.active}</p>
                      </div>
                      <div className="p-5 bg-slate-50 rounded-2xl border border-gray-100">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Trips Today</p>
                        <p className="text-3xl font-serif font-bold text-slate-900">{stats.today}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {view === 'reports' && <ReportModule />}
          {view === 'settings' && <AdminDashboard />}
        </>
      )}
    </Layout>
  );
}
