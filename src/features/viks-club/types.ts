export type BillingPeriod = 'monthly' | 'yearly';
export type BenefitType = 'service_credit' | 'service_discount' | 'product_discount';
export type SubscriptionStatus = 'active' | 'paused' | 'canceled' | 'expired';
export type LoyaltyTransactionType = 'earn' | 'redeem' | 'adjustment_credit' | 'adjustment_debit' | 'expiration' | 'adjustment';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface ViksClubPlanBenefit {
  id: string;
  planId: string;
  benefitType: BenefitType;
  serviceId?: string | null;
  quantity: number;
  discountPercent?: number;
  description?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ViksClubPlan {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  priceCents: number;
  billingPeriod: BillingPeriod;
  allowedDays?: DayOfWeek[];
  barberId?: string | null;
  active: boolean;
  selfServiceEnabled: boolean;
  allowSelfPause: boolean;
  allowSelfCancel: boolean;
  refundOnCancel: boolean;
  featured: boolean;
  benefits?: ViksClubPlanBenefit[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ViksClubSubscriptionBenefit {
  id: string;
  subscriptionId: string;
  planBenefitId?: string | null;
  benefitType: BenefitType;
  serviceId?: string | null;
  quantityGranted: number;
  quantityUsed: number;
  discountPercent?: number;
  periodStart: string;
  periodEnd: string;
}

export interface ViksClubSubscription {
  id: string;
  clientId: string;
  planId: string;
  barberId?: string | null;
  planName?: string;
  status: SubscriptionStatus;
  startsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  canceledAt?: string | null;
  pausedAt?: string | null;
  createdBy?: string | null;
  benefits?: ViksClubSubscriptionBenefit[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ViksClubBenefitUsage {
  id: string;
  subscriptionBenefitId: string;
  clientId: string;
  appointmentId?: string | null;
  quantity: number;
  usedAt: string;
  createdBy?: string | null;
  notes?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
}

export interface LoyaltyTransaction {
  id: string;
  clientId: string;
  type: LoyaltyTransactionType;
  points: number;
  reason: string;
  appointmentId?: string | null;
  createdBy?: string | null;
  createdAt: string;
}
