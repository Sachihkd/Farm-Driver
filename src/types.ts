export type Role = 'admin' | 'manager' | 'driver';

export interface User {
  id: number;
  full_name: string;
  user_id: string;
  role: Role;
  company_id?: number;
}

export interface Company {
  id: number;
  name: string;
  code: string;
  logo?: string;
  wallpaper?: string;
  retention_days?: number;
}

export interface TripEvent {
  id: number;
  trip_id: number;
  stage: number;
  timestamp: string;
  latitude: number;
  longitude: number;
}

export interface Trip {
  id: number;
  driver_id: number;
  driver_name?: string;
  vehicle_number: string;
  status: 'active' | 'completed';
  created_at: string;
  events: TripEvent[];
}

export interface MobileNumber {
  id: number;
  name: string;
  number: string;
  company_id: number;
}

export interface EmailId {
  id: number;
  name: string;
  email: string;
  company_id: number;
}

export interface Vehicle {
  id: number;
  vehicle_number: string;
  model: string;
  company_id: number;
}

export interface ApiSettings {
  smsUrl?: string;
  smsKey?: string;
  smsSenderId?: string;
  smsClientId?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  companyName?: string;
  companyLogo?: string;
  companyWallpaper?: string;
  dataRetentionDays?: number;
}
