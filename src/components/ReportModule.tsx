import React, { useState, useEffect } from 'react';
import { Trip, User, Vehicle } from '../types';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import { FileText, Download, Filter, Calendar, User as UserIcon, Truck } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion } from 'motion/react';

export const ReportModule: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicleChecks, setVehicleChecks] = useState<any[]>([]);
  const [activeReportTab, setActiveReportTab] = useState<'trips' | 'checks'>('trips');
  const [drivers, setDrivers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter states
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [driverId, setDriverId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [apiSettings, setApiSettings] = useState<any>({});

  useEffect(() => {
    fetchDrivers();
    fetchVehicles();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const settings = await api.get('/settings');
      const formatted = settings.reduce((acc: any, curr: any) => {
        acc[curr.key] = JSON.parse(curr.value);
        return acc;
      }, {});
      setApiSettings(formatted);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDrivers = async () => {
    try {
      const users = await api.get('/users');
      setDrivers(users.filter((u: User) => u.role === 'driver'));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVehicles = async () => {
    try {
      const data = await api.get('/vehicles');
      setVehicles(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      if (activeReportTab === 'trips') {
        const data = await api.get(`/reports?startDate=${startDate}&endDate=${endDate}&driverId=${driverId}&vehicleNumber=${vehicleNumber}`);
        setTrips(data);
        if (data.length === 0) toast.error('No trips found for selected filters');
      } else {
        const data = await api.get(`/vehicle-checks?startDate=${startDate}&endDate=${endDate}&driverId=${driverId}&vehicleNumber=${vehicleNumber}`);
        setVehicleChecks(data);
        if (data.length === 0) toast.error('No vehicle checks found for selected filters');
      }
    } catch (err) {
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (tripsToReport: Trip[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const companyName = apiSettings.companyName || "BLISS FLORA LTD.";
    const reportTitle = `Detailed Trip Analytics Report: ${format(new Date(startDate), 'dd-MM-yyyy')} to ${format(new Date(endDate), 'dd-MM-yyyy')}`;
    
    // Logo
    if (apiSettings.companyLogo) {
      try {
        const logoData = apiSettings.companyLogo;
        const format = logoData.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(logoData, format, 138.5, 5, 20, 20);
      } catch (e) {
        console.error("PDF Logo Error:", e);
        doc.setDrawColor(184, 134, 11);
        doc.setLineWidth(1);
        doc.circle(148.5, 15, 8);
        doc.setFontSize(10);
        doc.setTextColor(184, 134, 11);
        doc.text(companyName.charAt(0), 148.5, 16, { align: 'center' });
      }
    } else {
      doc.setDrawColor(184, 134, 11);
      doc.setLineWidth(1);
      doc.circle(148.5, 15, 8);
      doc.setFontSize(10);
      doc.setTextColor(184, 134, 11);
      doc.text(companyName.charAt(0), 148.5, 16, { align: 'center' });
    }

    // Company Name
    doc.setFontSize(24);
    doc.setTextColor(45, 122, 77); // Green
    doc.setFont("helvetica", "bold");
    doc.text(companyName.toUpperCase(), 148.5, 30, { align: 'center' });

    // Subtitle
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.text(reportTitle, 148.5, 38, { align: 'center' });

    // Table Data Preparation
    const tableBody = tripsToReport.map(trip => {
      const getStageData = (stage: number) => {
        const event = trip.events.find(e => e.stage === stage);
        if (!event) return { date: '-', time: '-', lat: 0, lng: 0 };
        return {
          date: format(new Date(event.timestamp), 'dd-MM-yy'),
          time: format(new Date(event.timestamp), 'hh:mm a'),
          lat: event.latitude,
          lng: event.longitude
        };
      };

      const s1 = getStageData(1);
      const s2 = getStageData(2);
      const s3 = getStageData(3);
      const s4 = getStageData(4);

      const formatDurPipe = (ms: number) => {
        const mins = Math.floor(ms / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };

      const getDurMs = (st1: number, st2: number) => {
        const e1 = trip.events.find(e => e.stage === st1);
        const e2 = trip.events.find(e => e.stage === st2);
        if (e1 && e2) return new Date(e2.timestamp).getTime() - new Date(e1.timestamp).getTime();
        return 0;
      };

      const d12 = getDurMs(1, 2);
      const d23 = getDurMs(2, 3);
      const d34 = getDurMs(3, 4);
      const totalMs = d12 + d23 + d34;

      const durationStr = `${formatDurPipe(d12)} | ${formatDurPipe(d23)} | ${formatDurPipe(d34)}`;
      const totalStr = formatDurPipe(totalMs);

      return [
        { content: `${trip.driver_name}\n${trip.vehicle_number}`, styles: { fontStyle: 'bold' as const } },
        { content: `${s1.date}\n${s1.time}\n `, styles: { textColor: [0, 0, 0] } },
        { content: `${s2.date}\n${s2.time}\n `, styles: { textColor: [0, 0, 0] } },
        { content: `${s3.date}\n${s3.time}\n `, styles: { textColor: [0, 0, 0] } },
        { content: `${s4.date}\n${s4.time}\n `, styles: { textColor: [0, 0, 0] } },
        durationStr,
        { content: totalStr, styles: { fontStyle: 'bold' as const, fontSize: 12 } }
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [['Driver / Vehicle', '1. Start', '2. Airport', '3. Return', '4. Finished', 'S1-S2 | S2-S3 | S3-S4', 'Total Trip']],
      body: tableBody as any,
      theme: 'plain',
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' as const },
      styles: { cellPadding: 5, fontSize: 10, valign: 'middle' },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index >= 1 && data.column.index <= 4) {
          const stage = data.column.index;
          const trip = tripsToReport[data.row.index];
          const event = trip.events.find(e => e.stage === stage);
          if (event) {
            const url = `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`;
            const x = data.cell.x + 5;
            const y = data.cell.y + data.cell.height - 5;
            doc.setTextColor(37, 99, 235);
            doc.setFontSize(9);
            doc.text("View Map", x, y);
            doc.link(x, y - 3, 20, 5, { url });
          }
        }
      }
    });

    // Footer
    const footerY = 200;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generated by ${companyName} Tracking System | ${format(new Date(), 'dd-MM-yyyy HH:mm')}`, 10, footerY);

    doc.save(`Trip_Analytics_${format(new Date(), 'ddMMyy')}.pdf`);
  };

  const generateChecksPDF = (checksToReport: any[]) => {
    const doc = new jsPDF({ orientation: 'portrait' });
    const companyName = apiSettings.companyName || "BLISS FLORA LTD.";
    const reportTitle = `Vehicle Check Report: ${format(new Date(startDate), 'dd-MM-yyyy')} to ${format(new Date(endDate), 'dd-MM-yyyy')}`;
    
    doc.setFontSize(20);
    doc.setTextColor(45, 122, 77);
    doc.text(companyName.toUpperCase(), 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(reportTitle, 105, 28, { align: 'center' });

    const tableBody = checksToReport.map(check => [
      format(new Date(check.created_at), 'dd-MM-yy HH:mm'),
      check.driver_name,
      check.vehicle_number,
      `Tires: ${check.check_data.tires}\nLights: ${check.check_data.lights}\nBrakes: ${check.check_data.brakes}\nFuel: ${check.check_data.fuel}\nClean: ${check.check_data.clean}`,
      check.check_data.notes || '-'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Date/Time', 'Driver', 'Vehicle', 'Status', 'Notes']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [45, 122, 77] },
      styles: { fontSize: 9 }
    });

    doc.save(`Vehicle_Checks_${format(new Date(), 'ddMMyy')}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 p-1 bg-stone-100 rounded-xl w-fit">
        <button 
          onClick={() => setActiveReportTab('trips')}
          className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${activeReportTab === 'trips' ? 'bg-white shadow-sm text-emerald-700' : 'text-stone-500 hover:text-stone-700'}`}
        >Trip Reports</button>
        <button 
          onClick={() => setActiveReportTab('checks')}
          className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${activeReportTab === 'checks' ? 'bg-white shadow-sm text-emerald-700' : 'text-stone-500 hover:text-stone-700'}`}
        >Vehicle Checks</button>
      </div>

      <div className="bg-card-pink p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
            <Filter size={18} />
          </div>
          <h2 className="text-lg font-black text-stone-900">Reports</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
              <Calendar size={12} /> Start Date
            </label>
            <input 
              type="date" 
              className="w-full p-2 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
              <Calendar size={12} /> End Date
            </label>
            <input 
              type="date" 
              className="w-full p-2 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
              <UserIcon size={12} /> Driver
            </label>
            <select 
              className="w-full p-2 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              value={driverId}
              onChange={e => setDriverId(e.target.value)}
            >
              <option value="">All Drivers</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
              <Truck size={12} /> Vehicle
            </label>
            <select 
              className="w-full p-2 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              value={vehicleNumber}
              onChange={e => setVehicleNumber(e.target.value)}
            >
              <option value="">All Vehicles</option>
              {vehicles.map(v => <option key={v.id} value={v.vehicle_number}>{v.vehicle_number} - {v.model}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6">
          <button 
            onClick={fetchReports}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 text-sm uppercase tracking-widest"
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>

          <button 
            onClick={() => activeReportTab === 'trips' ? generatePDF(trips) : generateChecksPDF(vehicleChecks)}
            disabled={(activeReportTab === 'trips' ? trips.length === 0 : vehicleChecks.length === 0) || loading}
            className={`flex items-center justify-center gap-2 px-6 py-3 font-black rounded-xl transition-all text-sm uppercase tracking-widest ${
              (activeReportTab === 'trips' ? trips.length > 0 : vehicleChecks.length > 0) 
                ? 'bg-stone-900 text-white shadow-lg shadow-stone-200 hover:bg-stone-800' 
                : 'bg-stone-100 text-stone-400 cursor-not-allowed'
            }`}
          >
            <Download size={16} /> Download
          </button>
        </div>
      </div>

      {/* Trip cards removed for cleaner screen as requested */}
    </div>
  );
};
