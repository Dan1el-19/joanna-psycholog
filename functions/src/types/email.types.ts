/**
 * TypeScript types for the email system
 */

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailData {
  to: EmailAddress | string;
  cc?: EmailAddress[] | string[];
  bcc?: EmailAddress[] | string[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  variables?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  scheduledFor?: Date;
}

export interface EmailLogEntry {
  emailId: string;
  recipientEmail: string;
  subject: string;
  templateId?: string;
  status: 'queued' | 'sent' | 'failed' | 'bounced' | 'delivered';
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface UserRegistrationData {
  uid: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  registrationDate: Date;
}

export interface OrderData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface EmailValidationResult {
  isValid: boolean;
  email: string;
  errors: string[];
  suggestions?: string[];
}

export interface EmailServiceResponse {
  success: boolean;
  emailId?: string;
  logId?: string;
  message: string;
  error?: string;
}

export interface ReminderEmailData {
  customerEmail: string;
  customerName: string;
  orderId: string;
  cartItems: OrderItem[];
  abandonedAt: Date;
  reminderCount: number;
}