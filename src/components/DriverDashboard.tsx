import React, { useState, useEffect } from 'react';
import { Trip, TripEvent } from '../types';
import { api } from '../services/api';
import { geminiService } from '../services/gemini';
import { toast } from 'react-hot-toast';
import { Clock, Truck, Camera, Wifi, WifiOff, X, CheckCircle2, Info, User as UserIcon, LogOut, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { User } from '../types';

interface DriverDashboardProps {
  user: User | null;
  onLogout: () => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({ user, onLogout }) => {
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showVehicleCheck, setShowVehicleCheck] = useState(false);
  const [vehicleCheckData, setVehicleCheckData] = useState({
    tires: 'ok',
    lights: 'ok',
    brakes: 'ok',
    fuel: 'ok',
    clean: 'ok',
    notes: ''
  });

  const [branding, setBranding] = useState({ name: '', logo: '', wallpaper: '' });

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const data = await api.get(`/branding?companyId=${user?.company_id}`);
        setBranding({ 
          name: data.companyName, 
          logo: data.companyLogo,
          wallpaper: data.companyWallpaper
        });
      } catch (e) {
        console.error(e);
      }
    };
    if (user?.company_id) fetchBranding();
  }, [user]);

  useEffect(() => {
    fetchActiveTrip();
    
    // Start watching position for better accuracy
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.error("Location watch error:", err),
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineEvents();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const fetchActiveTrip = async () => {
    try {
      const trip = await api.get('/trips/active');
      setActiveTrip(trip);
    } catch (err) {
      console.error('Failed to fetch active trip', err);
    }
  };

  const syncOfflineEvents = async () => {
    const offlineEvents = JSON.parse(localStorage.getItem('offline_events') || '[]');
    if (offlineEvents.length === 0) return;

    setSyncing(true);
    try {
      for (const event of offlineEvents) {
        if (event.type === 'start') {
          await api.post('/trips/start', event.data);
        } else {
          await api.post('/trips/event', event.data);
        }
      }
      localStorage.removeItem('offline_events');
      toast.success('Offline data synced successfully');
      fetchActiveTrip();
    } catch (err) {
      toast.error('Failed to sync offline data');
    } finally {
      setSyncing(false);
    }
  };

  const getGeolocation = (): Promise<{latitude: number, longitude: number}> => {
    return new Promise((resolve, reject) => {
      // If we have a fresh watched location, use it for speed and accuracy
      if (currentLocation) {
        resolve({ latitude: currentLocation.lat, longitude: currentLocation.lng });
        return;
      }

      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }), 
        (error) => {
          let msg = 'Failed to get location.';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              msg = 'Location permission denied. Please enable location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              msg = 'Location information is unavailable. Check your internet/GPS.';
              break;
            case error.TIMEOUT:
              msg = 'Location request timed out.';
              break;
          }
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleStageAction = async (stage: number) => {
    const stageNames = ['', 'Trip Start', 'Reached Airport', 'Offloaded & Return', 'Trip Complete'];
    const toastId = toast.loading(`Recording ${stageNames[stage]}...`);
    setLoading(true);
    try {
      const { latitude, longitude } = await getGeolocation();
      const vehicleNumber = localStorage.getItem('vehicle_number') || 'Unknown';

      const eventData = {
        trip_id: activeTrip?.id,
        stage,
        latitude,
        longitude,
        vehicle_number: vehicleNumber
      };

      if (!isOnline) {
        const offlineEvents = JSON.parse(localStorage.getItem('offline_events') || '[]');
        offlineEvents.push({ type: stage === 1 ? 'start' : 'event', data: eventData });
        localStorage.setItem('offline_events', JSON.stringify(offlineEvents));
        toast.success('Action saved offline', { id: toastId });
        setLastActionMessage(`${stageNames[stage]} Recorded Successfully!`);
        // Optimistically update UI
        if (stage === 1) {
          setActiveTrip({ id: -1, driver_id: 0, vehicle_number: vehicleNumber, status: 'active', created_at: new Date().toISOString(), events: [{ id: -1, trip_id: -1, stage: 1, timestamp: new Date().toISOString(), latitude, longitude }] });
        } else if (activeTrip) {
          setActiveTrip({ ...activeTrip, events: [...activeTrip.events, { id: -1, trip_id: activeTrip.id, stage, timestamp: new Date().toISOString(), latitude, longitude }] });
        }
      } else {
        let res;
        if (stage === 1) {
          res = await api.post('/trips/start', { vehicle_number: vehicleNumber, latitude, longitude });
          setActiveTrip(res);
        } else {
          res = await api.post('/trips/event', eventData);
          await fetchActiveTrip();
        }
        
        geminiService.speak(`${stageNames[stage]} successfully recorded.`);
        setLastActionMessage(`${stageNames[stage]} Recorded Successfully!`);
        
        if (res.notificationError) {
          toast.error(`Recorded, but notifications failed: ${res.notificationError}`, { id: toastId, duration: 5000 });
        } else {
          toast.success(`${stageNames[stage]} recorded!`, { id: toastId });
        }
      }
      
      // Clear message after 5 seconds
      setTimeout(() => setLastActionMessage(null), 5000);
    } catch (err: any) {
      toast.error(err.message || 'Action failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleCheckSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/vehicle-checks', {
        trip_id: activeTrip?.id,
        vehicle_number: localStorage.getItem('vehicle_number') || 'Unknown',
        check_data: vehicleCheckData
      });
      toast.success('Vehicle check submitted successfully');
      setShowVehicleCheck(false);
    } catch (err) {
      toast.error('Failed to submit vehicle check');
    } finally {
      setLoading(false);
    }
  };

  const stages = [
    { id: 1, label: 'Start Trip', color: 'from-orange-400 to-orange-600', instruction: 'Ready to start a new trip.' },
    { id: 2, label: 'Reached Airport', color: 'from-blue-400 to-blue-600', instruction: 'En route to Airport/Warehouse.' },
    { id: 3, label: 'Offload & Return', color: 'from-emerald-400 to-emerald-600', instruction: 'Awaiting offloading completion.' },
    { id: 4, label: 'Trip Complete', color: 'from-red-400 to-red-600', instruction: 'Heading back to Farm.' },
  ];

  const currentStage = activeTrip ? (activeTrip.events.length + 1) : 1;
  const isCompleted = activeTrip?.status === 'completed';

  const getInstruction = () => {
    if (isCompleted) return "Trip completed. Ready for next assignment.";
    const stage = stages.find(s => s.id === currentStage);
    return stage ? stage.instruction : "Ready to start a new trip.";
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-sans bg-transparent">
      {/* Background Curves - Only show if no company wallpaper */}
      {!branding.wallpaper && (
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[50%] bg-[#4DA8FF] rounded-[100%] opacity-50 transform -rotate-12"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[120%] h-[50%] bg-[#66C2FF] rounded-[100%] opacity-30 transform rotate-12"></div>
        </div>
      )}

      <div className="relative z-10 max-w-md mx-auto px-4 py-6 flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              {branding.logo ? (
                <img src={branding.logo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-2 border-white/50 shadow-inner"></div>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-2xl font-black text-white drop-shadow-md tracking-tight leading-tight">
                {branding.name}
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-white/80 font-black leading-tight mt-0.5">Driver Tracker</p>
              <div className="mt-1">
                <p className="text-[9px] font-bold text-[#006600] leading-tight">Developed by Naman Tech</p>
                <p className="text-[9px] font-bold text-[#006600] leading-tight">Version 1.0</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-white/80 hover:text-white transition-colors">
              <FileText size={24} />
            </button>
            <button onClick={onLogout} className="text-white/80 hover:text-white transition-colors">
              <LogOut size={24} />
            </button>
          </div>
        </div>

        {/* User Info Card */}
        <div className="bg-white/90 backdrop-blur-lg rounded-[2.5rem] p-6 mb-8 shadow-xl border border-white/50 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[#E6F4FF] flex items-center justify-center text-[#2D7A4D]">
            <UserIcon size={32} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-stone-900 leading-tight">{user?.full_name || 'Driver'}</h2>
            <p className="text-stone-500 font-bold text-sm">Role: Driver</p>
            <p className="text-stone-500 font-bold text-sm">Vehicle: <span className="text-[#2D7A4D]">{localStorage.getItem('vehicle_number') || 'KCN610C'}</span></p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'} shadow-[0_0_8px_rgba(16,185,129,0.5)]`}></div>
            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        {/* Glossy Buttons Grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {stages.map((stage) => {
            const isDone = activeTrip?.events.some(e => e.stage === stage.id);
            const isNext = currentStage === stage.id && !isCompleted;
            const isActive = isNext;
            const isDisabled = !isNext || loading;

            return (
              <motion.button
                key={stage.id}
                whileTap={!isDisabled ? { scale: 0.92, filter: 'brightness(0.8)' } : {}}
                onClick={() => handleStageAction(stage.id)}
                disabled={isDisabled}
                className={`relative h-32 rounded-[3rem] overflow-hidden transition-all duration-300 group ${
                  isActive 
                    ? `bg-gradient-to-b ${stage.color} shadow-2xl` 
                    : 'bg-gradient-to-b from-stone-700 to-stone-900 shadow-inner'
                } border-[4px] border-stone-300 shadow-[0_0_15px_rgba(0,0,0,0.3)]`}
              >
                {/* Glossy Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent h-1/2 rounded-t-[3rem]"></div>
                
                {/* Inner Bezel Effect */}
                <div className="absolute inset-[2px] rounded-[2.8rem] border border-black/20 pointer-events-none"></div>

                {/* Button Text */}
                <div className="relative z-10 h-full flex items-center justify-center px-4 text-center">
                  <span className={`text-xl font-black uppercase tracking-tight leading-tight drop-shadow-md ${
                    isActive ? 'text-white' : 'text-stone-400 opacity-60'
                  }`}>
                    {stage.label}
                  </span>
                </div>

                {/* Shine Animation */}
                {isActive && (
                  <motion.div 
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-1/2 -skew-x-12 pointer-events-none"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Instructions Card */}
        <div className="bg-white rounded-[2rem] p-6 mb-8 shadow-lg border border-white/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-stone-100 text-stone-600">
              <Info size={20} />
            </div>
            <h3 className="text-lg font-black text-stone-900 uppercase tracking-tight">Instructions</h3>
          </div>
          <p className="text-stone-500 font-bold text-base pl-11">
            {getInstruction()}
          </p>
        </div>

        {/* Vehicle Check Button (Glossy Blank Style) */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowVehicleCheck(true)}
          className="w-full bg-gradient-to-b from-stone-100 to-stone-300 h-20 rounded-[2rem] border-[4px] border-stone-200 shadow-lg flex items-center justify-center gap-3 mb-12 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-transparent h-1/2 rounded-t-[2rem]"></div>
          <Camera className="text-stone-700 relative z-10" size={24} />
          <span className="text-lg font-black text-stone-800 uppercase tracking-widest relative z-10">Perform Vehicle Check</span>
        </motion.button>

        {/* Bottom Status Message (Toast Style) */}
        <AnimatePresence>
          {lastActionMessage && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="fixed bottom-10 left-4 right-4 z-50"
            >
              <div className="bg-stone-800/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Truck size={20} className="text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold leading-tight">{lastActionMessage}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completed State Modal */}
        {isCompleted && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#57B6FF]/95 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[3rem] p-10 text-center shadow-2xl max-w-sm border border-white/50"
            >
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <CheckCircle2 size={48} />
              </div>
              <h2 className="text-3xl font-black text-stone-900 mb-2">Trip Complete!</h2>
              <p className="text-stone-500 font-bold mb-8">All data has been successfully synced to the farm office.</p>
              <button 
                onClick={() => {
                  setActiveTrip(null);
                  localStorage.removeItem('vehicle_number');
                  window.location.reload();
                }}
                className="w-full py-5 bg-gradient-to-b from-emerald-400 to-emerald-600 text-white rounded-[2rem] font-black text-xl uppercase tracking-widest shadow-xl border-[3px] border-white/40"
              >
                Start New Trip
              </button>
            </motion.div>
          </div>
        )}
      </div>

      {/* Vehicle Check Modal */}
      <AnimatePresence>
        {showVehicleCheck && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <h3 className="text-xl font-black text-stone-900 dark:text-white">Vehicle Check Template</h3>
                <button onClick={() => setShowVehicleCheck(false)} className="text-stone-400 hover:text-stone-600"><X size={24} /></button>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {['tires', 'lights', 'brakes', 'fuel', 'clean'].map((item) => (
                  <div key={item} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
                    <span className="font-bold capitalize text-stone-700 dark:text-stone-300">{item}</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setVehicleCheckData({...vehicleCheckData, [item]: 'ok'})}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${vehicleCheckData[item as keyof typeof vehicleCheckData] === 'ok' ? 'bg-emerald-600 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-500'}`}
                      >OK</button>
                      <button 
                        onClick={() => setVehicleCheckData({...vehicleCheckData, [item]: 'issue'})}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${vehicleCheckData[item as keyof typeof vehicleCheckData] === 'issue' ? 'bg-red-600 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-500'}`}
                      >Issue</button>
                    </div>
                  </div>
                ))}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-stone-400">Notes / Defects</label>
                  <textarea 
                    className="w-full p-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                    rows={3}
                    value={vehicleCheckData.notes}
                    onChange={(e) => setVehicleCheckData({...vehicleCheckData, notes: e.target.value})}
                    placeholder="Describe any issues..."
                  />
                </div>
              </div>
              <div className="p-6 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-800">
                <button 
                  onClick={handleVehicleCheckSubmit}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Submitting...' : <><CheckCircle2 size={20} /> Submit Check</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
