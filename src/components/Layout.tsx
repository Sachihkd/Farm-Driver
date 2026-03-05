import React, { useState, useEffect } from 'react';
import { LogOut, Flower2, LayoutDashboard, FileText, Settings, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';
import { Toaster } from 'react-hot-toast';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
  activeView?: 'dashboard' | 'reports' | 'settings';
  onViewChange?: (view: 'dashboard' | 'reports' | 'settings') => void;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, children, activeView, onViewChange }) => {
  const [branding, setBranding] = useState<{ name: string; logo: string; wallpaper: string }>({
    name: '',
    logo: '',
    wallpaper: ''
  });
  const [groupName, setGroupName] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const companyCode = searchParams.get('companyCode');
        
        let url = '/branding';
        if (user && user.company_id) {
          url = `/branding?companyId=${user.company_id}`;
        } else if (companyCode) {
          url = `/branding?companyCode=${companyCode}`;
        }
        
        const brandingData = await api.get(url);
        setBranding({
          name: brandingData.companyName || '',
          logo: brandingData.companyLogo || '',
          wallpaper: brandingData.companyWallpaper || ''
        });

        const defaultBranding = await api.get('/branding');
        if (defaultBranding.companyName) setGroupName(defaultBranding.companyName);
      } catch (err) {
        console.error('Failed to fetch branding');
      }
    };
    fetchBranding();

    window.addEventListener('branding-updated', fetchBranding);
    return () => window.removeEventListener('branding-updated', fetchBranding);
  }, [user]);

  const isDriver = user?.role === 'driver';

  const backgroundStyle = branding.wallpaper 
    ? { 
        backgroundImage: `url(${branding.wallpaper})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } 
    : {};

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports', label: 'Reports', icon: FileText },
    ...(user?.role === 'admin' ? [{ id: 'settings', label: 'Settings', icon: Settings }] : []),
  ];

  if (!user) {
    return (
      <div className="min-h-screen font-sans text-slate-900 overflow-x-hidden" style={backgroundStyle}>
        <Toaster position="top-right" />
        <main className={`max-w-7xl mx-auto px-4 py-1 min-h-screen ${branding.wallpaper ? 'bg-black/20 backdrop-blur-sm' : 'bg-white'}`}>
          {children}
        </main>
      </div>
    );
  }

  if (isDriver) {
    return (
      <div className="min-h-screen font-sans text-slate-900 overflow-x-hidden" style={backgroundStyle}>
        <Toaster position="top-right" />
        <main className={`relative z-10 min-h-screen ${branding.wallpaper ? 'bg-black/20 backdrop-blur-sm' : 'bg-[#57B6FF]'}`}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans text-slate-900 flex flex-col md:flex-row overflow-x-hidden" style={backgroundStyle}>
      <Toaster position="top-right" />

      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:flex flex-col fixed h-screen border-r border-gray-100 z-50 transition-all duration-300 ${
          isSidebarCollapsed ? 'w-[80px]' : 'w-[260px]'
        } ${branding.wallpaper ? 'bg-white/95 backdrop-blur-md' : 'bg-white'}`}
      >
        <div className="p-4 flex flex-col h-full relative">
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-20 bg-white border border-gray-100 rounded-full p-1 shadow-sm text-slate-400 hover:text-slate-900 z-50 hidden md:block"
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <div className={`flex items-center gap-3 mb-10 ${isSidebarCollapsed ? 'justify-center' : 'px-2'}`}>
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border border-gray-100">
              {branding.logo ? (
                <img src={branding.logo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                  <Flower2 size={24} className="text-slate-400" />
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="font-serif font-bold text-lg leading-tight truncate text-slate-900">{branding.name}</h1>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Driver Tracker</p>
                <div className="flex flex-col">
                  <p className="text-[8px] font-bold text-[#006600] leading-tight">Developed by Naman Tech</p>
                  <p className="text-[8px] font-bold text-[#006600] leading-tight">Version 1.0</p>
                </div>
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange?.(item.id as any)}
                title={isSidebarCollapsed ? item.label : ''}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isSidebarCollapsed ? 'justify-center' : ''
                } ${
                  activeView === item.id
                    ? 'bg-[#003399] text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon size={18} strokeWidth={1.5} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-gray-100">
            <div className={`flex items-center gap-3 mb-6 ${isSidebarCollapsed ? 'justify-center' : 'px-2'}`}>
              <div className={`flex-1 min-w-0 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
                <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{user.user_id}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              title={isSidebarCollapsed ? 'Logout' : ''}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all ${
                isSidebarCollapsed ? 'justify-center' : ''
              }`}
            >
              <LogOut size={18} strokeWidth={1.5} />
              {!isSidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className={`md:hidden flex items-center justify-between px-4 h-16 border-b border-gray-100 sticky top-0 z-50 ${branding.wallpaper ? 'bg-white/95 backdrop-blur-md' : 'bg-white'}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-100 flex-shrink-0">
            {branding.logo ? (
              <img src={branding.logo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Flower2 size={16} className="text-slate-400" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="font-serif font-bold text-base truncate max-w-[150px] leading-tight">{branding.name}</h1>
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold leading-tight">Driver Tracker</p>
            <p className="text-[8px] font-bold text-[#006600] leading-tight">Developed by Naman Tech | v1.0</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-slate-900"
          >
            <LogOut size={20} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main 
        className={`flex-1 min-h-screen transition-all duration-300 ${
          isSidebarCollapsed ? 'md:ml-[80px]' : 'md:ml-[260px]'
        } ${branding.wallpaper ? 'bg-white/80 backdrop-blur-sm' : 'bg-white'}`}
      >
        <div className="max-w-[1280px] mx-auto px-4 py-6 md:px-8 md:py-10">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 border-t border-gray-100 flex items-center justify-around h-16 z-50 px-2 pb-[env(safe-area-inset-bottom)] ${branding.wallpaper ? 'bg-white/95 backdrop-blur-md' : 'bg-white'}`}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange?.(item.id as any)}
            className={`flex flex-col items-center justify-center gap-1 min-w-[64px] h-full transition-all ${
              activeView === item.id ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            <item.icon size={20} strokeWidth={activeView === item.id ? 2 : 1.5} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
