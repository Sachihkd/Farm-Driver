import React, { useState, useEffect } from 'react';
import { User, Role, Vehicle } from '../types';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import { KeyRound, User as UserIcon, Truck } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [role, setRole] = useState<Role>('driver');
  const [loading, setLoading] = useState(false);
  const [userIdValid, setUserIdValid] = useState<boolean | null>(null);
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null);
  const [branding, setBranding] = useState<{ name: string; logo: string }>({
    name: '',
    logo: ''
  });

  const fetchVehiclesForCompany = async (companyId: number) => {
    try {
      const data = await api.get(`/public/vehicles?companyId=${companyId}`);
      setVehicles(data);
    } catch (err) {
      console.error('Failed to fetch vehicles');
    }
  };

  const validateUserId = async (currentRole?: Role) => {
    if (!userId) return;
    const activeRole = currentRole || role;
    try {
      const data = await api.get(`/public/user-company/${userId}`);
      setUserIdValid(true);
      if (data.company) {
        if (activeRole === 'driver') {
          fetchVehiclesForCompany(data.company_id);
        }
      }
    } catch (err) {
      setUserIdValid(false);
      toast.error('Invalid user id');
      setVehicles([]);
    }
  };

  const validatePassword = async () => {
    if (!userId || !password || userIdValid === false) return;
    try {
      await api.post('/public/validate-password', { user_id: userId, password });
      setPasswordValid(true);
    } catch (err) {
      setPasswordValid(false);
      toast.error('Wrong password');
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const companyCode = searchParams.get('companyCode');

    const fetchVehicles = async () => {
      if (!companyCode) return;
      try {
        const url = `/public/vehicles?companyCode=${companyCode}`;
        const data = await api.get(url);
        setVehicles(data);
      } catch (err) {
        console.error('Failed to fetch vehicles');
      }
    };
    const fetchBranding = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const companyCode = searchParams.get('companyCode');
        const url = companyCode ? `/branding?companyCode=${companyCode}` : '/branding';
        const data = await api.get(url);
        if (data.companyName) setBranding(prev => ({ ...prev, name: data.companyName }));
        if (data.companyLogo) setBranding(prev => ({ ...prev, logo: data.companyLogo }));
      } catch (err) {
        console.error('Failed to fetch branding');
      }
    };
    fetchVehicles();
    fetchBranding();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final check if not already validated
    if (userIdValid === null) await validateUserId();
    if (passwordValid === null) await validatePassword();

    if (userIdValid === false) {
      toast.error('Invalid user id');
      return;
    }
    if (passwordValid === false) {
      toast.error('Wrong password');
      return;
    }

    if (role === 'driver') {
      const vehicleExists = vehicles.some(v => v.vehicle_number === vehicleNumber);
      if (!vehicleExists && vehicles.length > 0) {
        toast.error('Invalid vehicle number. Please select from the list.');
        return;
      }
      if (!vehicleNumber) {
        toast.error('Please select a vehicle number');
        return;
      }
    }

    setLoading(true);
    try {
      const data = await api.post('/login', { user_id: userId, password });
      
      // Role validation
      if (role === 'driver' && data.user.role !== 'driver') {
        toast.error('This account is not a driver account. Please switch to Admin login.');
        return;
      }
      if (role === 'admin' && data.user.role === 'driver') {
        toast.error('This is a driver account. Please switch to Driver login.');
        return;
      }
      
      if (role === 'driver') {
        localStorage.setItem('vehicle_number', vehicleNumber);
      }
      
      onLogin(data.user, data.token);
      toast.success(`Welcome back, ${data.user.full_name}`);
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-0 px-4">
      <div className="text-center mb-4">
        <div className="w-24 h-24 rounded-full mx-auto mb-2 flex items-center justify-center overflow-hidden">
          {branding.logo ? (
            <img 
              src={branding.logo} 
              alt="Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-white/50">
              <Truck size={40} className="text-emerald-600" />
            </div>
          )}
        </div>
        <h1 className="text-2xl font-black text-white drop-shadow-md tracking-tight">{branding.name}</h1>
        <p className="text-[#A50021] font-black uppercase tracking-widest text-[10px] mt-0.5">Driver Tracker</p>
        <div className="mt-0.5">
          <p className="text-[9px] font-bold text-[#006600]">Developed by Naman Tech</p>
          <p className="text-[9px] font-bold text-[#006600]">Version 1.0</p>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card-pink p-5 rounded-[1.5rem] shadow-2xl border border-white/20"
      >
        <h2 className="text-lg font-black text-stone-600 mb-4 border-b pb-1">Login</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              type="text"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setUserIdValid(null);
                setPasswordValid(null);
                setVehicles([]);
              }}
              onBlur={() => validateUserId()}
              className={`w-full pl-11 pr-4 py-2.5 bg-white border ${userIdValid === false ? 'border-red-500' : 'border-stone-200'} rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-stone-700 text-sm`}
              placeholder="User ID"
              required
            />
            {userIdValid === false && (
              <p className="text-red-500 text-[9px] font-black uppercase tracking-widest mt-0.5 ml-4">Invalid User Id</p>
            )}
          </div>

          <div className="relative">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordValid(null);
              }}
              onBlur={validatePassword}
              className={`w-full pl-11 pr-4 py-2.5 bg-white border ${passwordValid === false ? 'border-red-500' : 'border-stone-200'} rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-stone-700 text-sm`}
              placeholder="Password"
              required
            />
            {passwordValid === false && (
              <p className="text-red-500 text-[9px] font-black uppercase tracking-widest mt-0.5 ml-4">Wrong Password</p>
            )}
          </div>

          {role === 'driver' && (
            <div className="relative">
              <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                list="vehicle-list"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-stone-700 text-sm"
                placeholder="Type or Select Vehicle"
                required
              />
              <datalist id="vehicle-list">
                {vehicles.map(v => (
                  <option key={v.id} value={v.vehicle_number}>{v.model}</option>
                ))}
              </datalist>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                const newRole = role === 'driver' ? 'admin' : 'driver';
                setRole(newRole);
                if (newRole === 'driver' && userIdValid) {
                  validateUserId(newRole);
                }
              }}
              className="px-4 py-1 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-emerald-600 transition-colors"
            >
              Switch to {role === 'driver' ? 'Admin' : 'Driver'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4CAF50] hover:bg-[#43A047] text-white font-black py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 mt-1 uppercase tracking-widest text-sm"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
