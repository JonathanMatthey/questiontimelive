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
  status: "pending_payment" | "paid" | "queued" | "answered" | "skipped";
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

