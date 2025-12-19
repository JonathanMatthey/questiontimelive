export interface CoHostToken {
  hostNumber: 2 | 3 | 4;
  token: string;
  claimed: boolean;
}

export interface Session {
  id: string;
  title: string;
  description: string;
  hostWalletAddress: string;
  questionPrice: number; // in cents
  assetCode: string;
  assetScale: number;
  streamUrl?: string;
  status: "draft" | "live" | "ended";
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  coHostTokens?: CoHostToken[];
}

export interface Question {
  id: string;
  sessionId: string;
  text: string;
  submitterName: string;
  submitterWalletAddress?: string;
  amountPaid: number;
  paymentId?: string;
  status: "pending_payment" | "paid" | "queued" | "active" | "answered" | "skipped";
  createdAt: Date;
  answeredAt?: Date;
  upvotes: number;
}

export interface Payment {
  id: string;
  questionId: string;
  sessionId: string;
  incomingPaymentUrl: string;
  amount: number;
  assetCode: string;
  assetScale: number;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
}

export interface WalletAddressInfo {
  id: string;
  publicName?: string;
  assetCode: string;
  assetScale: number;
  authServer: string;
  resourceServer: string;
}

export type QuestionSortOption = "newest" | "oldest" | "highest_paid" | "most_upvoted";

export interface SessionStats {
  totalQuestions: number;
  answeredQuestions: number;
  totalEarned: number;
  viewerCount: number;
}

export interface GuestPayment {
  guestId: string;
  sessionId: string;
  incomingPaymentUrls: string[]; // Array of incoming payment URLs from Web Monetization
  totalReceived: number; // Total amount received (in smallest unit, e.g., cents)
  assetCode: string;
  assetScale: number;
  lastUpdated: Date;
}

export interface GuestBalance {
  guestId: string;
  sessionId: string;
  balance: number; // Available balance (in smallest unit)
  totalReceived: number; // Total amount received (in smallest unit)
  questionCredits: number; // Number of question credits available (calculated from balance / questionPrice)
  assetCode: string;
  assetScale: number;
}

