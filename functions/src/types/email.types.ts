// Simple types for appointment system only
export interface AppointmentData {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  service: string;
  preferredDate: string;
  preferredTime: string;
  message?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  
  // Confirmed appointment details
  confirmedDate?: string;
  confirmedTime?: string;
  location?: string;
  adminNotes?: string;
  
  // Payment tracking
  paymentMethod?: 'paypal' | 'transfer' | 'cash';
  paymentStatus?: 'pending' | 'paid' | 'failed';
  paymentDate?: Date;
  
  // Session completion
  sessionCompleted?: boolean;
  sessionNotes?: string;
  
  // Cancellation tracking
  cancelledAt?: Date;
  cancelledBy?: 'client' | 'admin';
  cancellationReason?: string;
  
  // Rescheduling tracking
  originalDate?: string;
  originalTime?: string;
  rescheduleCount?: number;
  
  // Email tracking
  confirmationEmailSent?: boolean;
  approvalEmailSent?: boolean;
  reminderEmailSent?: boolean;
  
  // Pricing info
  calculatedPrice?: number;
  basePrice?: number;
  isFirstSession?: boolean;
  discount?: number;
  
  // Reservation management
  reservationToken?: string;
  tokenExpiresAt?: Date;
}

export interface TimeSlot {
  date: string;
  time: string;
  isAvailable: boolean;
  appointmentId?: string;
  isBlocked?: boolean;
  blockReason?: string;
}

export interface ScheduleTemplate {
  id?: string;
  name: string;
  description?: string;
  schedule: WeeklySchedule;
  createdAt: Date;
  updatedAt: Date;
  isDefault?: boolean;
}

export interface WeeklySchedule {
  monday: string[];
  tuesday: string[];
  wednesday: string[];
  thursday: string[];
  friday: string[];
  saturday: string[];
  sunday: string[];
}

export interface MonthlySchedule {
  id?: string;
  year: number;
  month: number;
  templateId?: string;
  customSlots: CustomTimeSlot[];
  blockedSlots: BlockedSlot[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomTimeSlot {
  date: string;
  times: string[];
  added?: boolean; // true for added, false for removed
}

export interface BlockedSlot {
  id?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  isAllDay?: boolean;
  createdAt: Date;
}

export interface ReservationToken {
  id?: string;
  appointmentId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  isUsed?: boolean;
}