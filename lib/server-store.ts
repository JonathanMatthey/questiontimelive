/**
 * Server-side store using Upstash Redis.
 * This allows data to be shared across different browsers/clients and serverless functions.
 * Falls back to in-memory storage when Redis is not configured (local development).
 */

import type { Session, Question, Payment, CoHostToken, GuestPayment, GuestBalance } from "./types";

// Check if Upstash Redis is configured (supports both Vercel KV naming and Upstash naming)
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = !!(redisUrl && redisToken);

// Lazy import Redis to avoid errors when not configured
let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis() {
  if (!hasRedis) return null;
  if (!redisClient) {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({
      url: redisUrl!,
      token: redisToken!,
    });
  }
  return redisClient;
}

// In-memory fallback for local development
const memoryStore: {
  sessions: Map<string, SerializedSession>;
  questions: Map<string, SerializedQuestion>;
  payments: Map<string, Payment>;
  sessionQuestions: Map<string, Set<string>>;
  sessionPayments: Map<string, Set<string>>;
  questionPayments: Map<string, string>;
  viewerCounts: Map<string, number>;
  guestPayments: Map<string, GuestPayment>;
  guestBalances: Map<string, number>; // guestId:sessionId -> balance
} = {
  sessions: new Map(),
  questions: new Map(),
  payments: new Map(),
  sessionQuestions: new Map(),
  sessionPayments: new Map(),
  questionPayments: new Map(),
  viewerCounts: new Map(),
  guestPayments: new Map(),
  guestBalances: new Map(),
};

// Key prefixes
const SESSIONS_KEY = "sessions";
const QUESTIONS_KEY = "questions";
const PAYMENTS_KEY = "payments";
const GUEST_PAYMENTS_KEY = "guest_payments";
const GUEST_BALANCES_KEY = "guest_balances";

// Types for serialized data (dates as strings for JSON storage)
type SerializedSession = Omit<Session, "createdAt" | "startedAt" | "endedAt"> & {
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
};

type SerializedQuestion = Omit<Question, "createdAt" | "answeredAt"> & {
  createdAt: string;
  answeredAt?: string;
};

// Helper to serialize dates
function serializeSession(session: Session): SerializedSession {
  return {
    ...session,
    createdAt: session.createdAt instanceof Date ? session.createdAt.toISOString() : String(session.createdAt),
    startedAt: session.startedAt instanceof Date ? session.startedAt.toISOString() : session.startedAt ? String(session.startedAt) : undefined,
    endedAt: session.endedAt instanceof Date ? session.endedAt.toISOString() : session.endedAt ? String(session.endedAt) : undefined,
  };
}

function deserializeSession(session: SerializedSession | null): Session | null {
  if (!session) return null;
  return {
    ...session,
    createdAt: new Date(session.createdAt),
    startedAt: session.startedAt ? new Date(session.startedAt) : undefined,
    endedAt: session.endedAt ? new Date(session.endedAt) : undefined,
  };
}

function serializeQuestion(question: Question): SerializedQuestion {
  return {
    ...question,
    createdAt: question.createdAt instanceof Date ? question.createdAt.toISOString() : String(question.createdAt),
    answeredAt: question.answeredAt instanceof Date ? question.answeredAt.toISOString() : question.answeredAt ? String(question.answeredAt) : undefined,
  };
}

function deserializeQuestion(question: SerializedQuestion | null): Question | null {
  if (!question) return null;
  return {
    ...question,
    createdAt: new Date(question.createdAt),
    answeredAt: question.answeredAt ? new Date(question.answeredAt) : undefined,
  };
}

// Session operations
export async function getAllSessions(): Promise<Session[]> {
  const redis = await getRedis();

  if (redis) {
    const sessionIds = await redis.smembers(SESSIONS_KEY);
    if (!sessionIds.length) return [];

    const sessions = await Promise.all(
      sessionIds.map(id => redis.get<SerializedSession>(`session:${id}`))
    );

    return sessions.filter((s): s is SerializedSession => s !== null).map(s => deserializeSession(s)!);
  } else {
    // In-memory fallback
    return Array.from(memoryStore.sessions.values()).map(s => deserializeSession(s)!);
  }
}

export async function getSession(id: string): Promise<Session | null> {
  const redis = await getRedis();

  if (redis) {
    const session = await redis.get<SerializedSession>(`session:${id}`);
    return deserializeSession(session);
  } else {
    // In-memory fallback
    const session = memoryStore.sessions.get(id) || null;
    return deserializeSession(session);
  }
}

export async function createSession(session: Session): Promise<Session> {
  const redis = await getRedis();
  const serialized = serializeSession(session);

  if (redis) {
    await redis.set(`session:${session.id}`, serialized);
    await redis.sadd(SESSIONS_KEY, session.id);
  } else {
    // In-memory fallback
    memoryStore.sessions.set(session.id, serialized);
  }
  return session;
}

export async function updateSession(id: string, updates: Partial<Session>): Promise<Session | null> {
  const redis = await getRedis();
  const existing = await getSession(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  const serialized = serializeSession(updated);

  if (redis) {
    await redis.set(`session:${id}`, serialized);
  } else {
    // In-memory fallback
    memoryStore.sessions.set(id, serialized);
  }
  return updated;
}

export async function deleteSession(id: string): Promise<boolean> {
  const redis = await getRedis();

  if (redis) {
    await redis.del(`session:${id}`);
    await redis.srem(SESSIONS_KEY, id);
  } else {
    // In-memory fallback
    memoryStore.sessions.delete(id);
  }
  return true;
}

// Co-host token operations
export async function addCoHostToken(sessionId: string, token: CoHostToken): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const existingTokens = session.coHostTokens || [];
  const existingIndex = existingTokens.findIndex(t => t.hostNumber === token.hostNumber);

  if (existingIndex >= 0) {
    existingTokens[existingIndex] = token;
  } else {
    existingTokens.push(token);
  }

  return updateSession(sessionId, { coHostTokens: existingTokens });
}

export async function claimCoHostToken(sessionId: string, tokenValue: string): Promise<{ hostNumber: number } | null> {
  const session = await getSession(sessionId);
  if (!session || !session.coHostTokens) return null;

  const tokenIndex = session.coHostTokens.findIndex(t => t.token === tokenValue);
  if (tokenIndex < 0) return null;

  const token = session.coHostTokens[tokenIndex];
  if (token.claimed) {
    // Already claimed, but return the host number so they can still join
    return { hostNumber: token.hostNumber };
  }

  // Mark as claimed
  const updatedTokens = [...session.coHostTokens];
  updatedTokens[tokenIndex] = { ...token, claimed: true };
  await updateSession(sessionId, { coHostTokens: updatedTokens });

  return { hostNumber: token.hostNumber };
}

// Question operations
export async function getQuestionsBySession(sessionId: string): Promise<Question[]> {
  const redis = await getRedis();

  if (redis) {
    const questionIds = await redis.smembers(`${QUESTIONS_KEY}:${sessionId}`);
    if (!questionIds.length) return [];

    const questions = await Promise.all(
      questionIds.map(id => redis.get<SerializedQuestion>(`question:${id}`))
    );

    return questions.filter((q): q is SerializedQuestion => q !== null).map(q => deserializeQuestion(q)!);
  } else {
    // In-memory fallback
    const questionIds = Array.from(memoryStore.sessionQuestions.get(sessionId) || []);
    const questions: Question[] = [];
    for (const id of questionIds) {
      const q = memoryStore.questions.get(id);
      if (q) questions.push(deserializeQuestion(q)!);
    }
    return questions;
  }
}

export async function getQuestion(id: string): Promise<Question | null> {
  const redis = await getRedis();

  if (redis) {
    const question = await redis.get<SerializedQuestion>(`question:${id}`);
    return deserializeQuestion(question);
  } else {
    // In-memory fallback
    const question = memoryStore.questions.get(id) || null;
    return deserializeQuestion(question);
  }
}

export async function createQuestion(question: Question): Promise<Question> {
  const redis = await getRedis();
  const serialized = serializeQuestion(question);

  if (redis) {
    await redis.set(`question:${question.id}`, serialized);
    await redis.sadd(`${QUESTIONS_KEY}:${question.sessionId}`, question.id);
  } else {
    // In-memory fallback
    memoryStore.questions.set(question.id, serialized);
    if (!memoryStore.sessionQuestions.has(question.sessionId)) {
      memoryStore.sessionQuestions.set(question.sessionId, new Set());
    }
    memoryStore.sessionQuestions.get(question.sessionId)!.add(question.id);
  }
  return question;
}

export async function updateQuestion(id: string, updates: Partial<Question>): Promise<Question | null> {
  const redis = await getRedis();
  const existing = await getQuestion(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  const serialized = serializeQuestion(updated);

  if (redis) {
    await redis.set(`question:${id}`, serialized);
  } else {
    // In-memory fallback
    memoryStore.questions.set(id, serialized);
  }
  return updated;
}

// Payment operations
export async function getPayment(id: string): Promise<Payment | null> {
  const redis = await getRedis();

  if (redis) {
    return redis.get<Payment>(`payment:${id}`);
  } else {
    // In-memory fallback
    return memoryStore.payments.get(id) || null;
  }
}

export async function getPaymentByQuestionId(questionId: string): Promise<Payment | null> {
  const redis = await getRedis();

  if (redis) {
    const paymentId = await redis.get<string>(`payment:question:${questionId}`);
    if (!paymentId) return null;
    return redis.get<Payment>(`payment:${paymentId}`);
  } else {
    // In-memory fallback
    const paymentId = memoryStore.questionPayments.get(questionId);
    if (!paymentId) return null;
    return memoryStore.payments.get(paymentId) || null;
  }
}

export async function createPayment(payment: Payment): Promise<Payment> {
  const redis = await getRedis();

  if (redis) {
    await redis.set(`payment:${payment.id}`, payment);
    await redis.set(`payment:question:${payment.questionId}`, payment.id);
    await redis.sadd(`${PAYMENTS_KEY}:${payment.sessionId}`, payment.id);
  } else {
    // In-memory fallback
    memoryStore.payments.set(payment.id, payment);
    memoryStore.questionPayments.set(payment.questionId, payment.id);
    if (!memoryStore.sessionPayments.has(payment.sessionId)) {
      memoryStore.sessionPayments.set(payment.sessionId, new Set());
    }
    memoryStore.sessionPayments.get(payment.sessionId)!.add(payment.id);
  }
  return payment;
}

export async function updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | null> {
  const redis = await getRedis();
  const existing = await getPayment(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };

  if (redis) {
    await redis.set(`payment:${id}`, updated);
  } else {
    // In-memory fallback
    memoryStore.payments.set(id, updated);
  }
  return updated;
}

// Viewer count operations
export async function getViewerCount(sessionId: string): Promise<number> {
  const redis = await getRedis();

  if (redis) {
    const count = await redis.get<number>(`viewers:${sessionId}`);
    return count || 0;
  } else {
    return memoryStore.viewerCounts.get(sessionId) || 0;
  }
}

export async function incrementViewerCount(sessionId: string): Promise<number> {
  const redis = await getRedis();

  if (redis) {
    const count = await redis.incr(`viewers:${sessionId}`);
    return count;
  } else {
    const current = memoryStore.viewerCounts.get(sessionId) || 0;
    const newCount = current + 1;
    memoryStore.viewerCounts.set(sessionId, newCount);
    return newCount;
  }
}

export async function decrementViewerCount(sessionId: string): Promise<number> {
  const redis = await getRedis();

  if (redis) {
    const count = await redis.decr(`viewers:${sessionId}`);
    // Don't go below 0
    if (count < 0) {
      await redis.set(`viewers:${sessionId}`, 0);
      return 0;
    }
    return count;
  } else {
    const current = memoryStore.viewerCounts.get(sessionId) || 0;
    const newCount = Math.max(0, current - 1);
    memoryStore.viewerCounts.set(sessionId, newCount);
    return newCount;
  }
}

// Get all guest payments for a session
export async function getAllGuestPaymentsBySession(sessionId: string): Promise<GuestPayment[]> {
  const redis = await getRedis();
  const guestPayments: GuestPayment[] = [];

  if (redis) {
      try {
        // Scan for all guest payment keys that match the session
        // Pattern: guest_payments:guestId:sessionId
        // We'll use SCAN to find all keys matching the pattern
        let cursor: string | number = 0;
        let scanCount = 0;
        const maxScans = 100; // Prevent infinite loops
        
        do {
          const result = await redis.scan(cursor, { match: `${GUEST_PAYMENTS_KEY}:*:${sessionId}`, count: 100 });
          cursor = result[0];
          const keys = result[1] || [];
          
          if (keys.length > 0) {
            const payments = await Promise.all(
              keys.map(key => redis.get<SerializedGuestPayment>(key))
            );
            payments.forEach(payment => {
              if (payment) {
                const deserialized = deserializeGuestPayment(payment);
                if (deserialized) {
                  guestPayments.push(deserialized);
                }
              }
            });
          }
          
          scanCount++;
          // Break if cursor is "0" or 0 (scan complete) or we've done too many scans
          const cursorValue = typeof cursor === 'string' ? parseInt(cursor, 10) : cursor;
          if (cursorValue === 0 || scanCount >= maxScans) {
            break;
          }
        } while (true);
    } catch (error) {
      console.error("[GUEST PAYMENTS ERROR] Failed to scan guest payments", {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      // Return empty array on error
      return [];
    }
  } else {
    // In-memory fallback - iterate through all guest payments
    memoryStore.guestPayments.forEach((payment, key) => {
      if (payment.sessionId === sessionId) {
        guestPayments.push(payment);
      }
    });
  }

  return guestPayments;
}

// Stats
export async function getSessionStats(sessionId: string) {
  const redis = await getRedis();
  const questions = await getQuestionsBySession(sessionId);

  // Get all guest payments for this session to calculate total earned
  // Wrap in try-catch with timeout to prevent hanging if Redis SCAN fails
  let totalEarned = 0;
  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<GuestPayment[]>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout fetching guest payments")), 5000);
    });
    
    const guestPayments = await Promise.race([
      getAllGuestPaymentsBySession(sessionId),
      timeoutPromise,
    ]);
    
    // Sum up all totalReceived amounts from guest payments
    // These are already stored in the session's currency
    totalEarned = guestPayments.reduce((sum, gp) => sum + gp.totalReceived, 0);
  } catch (error) {
    console.error("[STATS ERROR] Failed to get guest payments for session stats", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    // Continue with 0 earned if we can't fetch guest payments
    totalEarned = 0;
  }
  
  const viewerCount = await getViewerCount(sessionId);

  return {
    totalQuestions: questions.filter(q => q.status !== "pending_payment").length,
    answeredQuestions: questions.filter(q => q.status === "answered").length,
    totalEarned,
    viewerCount,
  };
}

// Guest payment operations
type SerializedGuestPayment = Omit<GuestPayment, "lastUpdated"> & {
  lastUpdated: string;
};

function serializeGuestPayment(guestPayment: GuestPayment): SerializedGuestPayment {
  return {
    ...guestPayment,
    lastUpdated: guestPayment.lastUpdated instanceof Date 
      ? guestPayment.lastUpdated.toISOString() 
      : String(guestPayment.lastUpdated),
  };
}

function deserializeGuestPayment(guestPayment: SerializedGuestPayment | null): GuestPayment | null {
  if (!guestPayment) return null;
  return {
    ...guestPayment,
    lastUpdated: new Date(guestPayment.lastUpdated),
  };
}

export async function getGuestPayment(guestId: string, sessionId: string): Promise<GuestPayment | null> {
  const redis = await getRedis();
  const key = `${guestId}:${sessionId}`;

  if (redis) {
    const data = await redis.get<SerializedGuestPayment>(`${GUEST_PAYMENTS_KEY}:${key}`);
    return deserializeGuestPayment(data);
  } else {
    const data = memoryStore.guestPayments.get(key);
    return data || null;
  }
}

export async function createOrUpdateGuestPayment(
  guestId: string,
  sessionId: string,
  assetCode: string,
  assetScale: number
): Promise<GuestPayment> {
  const redis = await getRedis();
  const key = `${guestId}:${sessionId}`;

  const existing = await getGuestPayment(guestId, sessionId);
  
  const guestPayment: GuestPayment = existing || {
    guestId,
    sessionId,
    incomingPaymentUrls: [],
    totalReceived: 0,
    assetCode,
    assetScale,
    lastUpdated: new Date(),
  };

  if (redis) {
    await redis.set(`${GUEST_PAYMENTS_KEY}:${key}`, serializeGuestPayment(guestPayment));
  } else {
    memoryStore.guestPayments.set(key, guestPayment);
  }

  return guestPayment;
}

export async function addIncomingPaymentUrl(
  guestId: string,
  sessionId: string,
  incomingPaymentUrl: string,
  assetCode: string,
  assetScale: number
): Promise<GuestPayment> {
  const redis = await getRedis();
  const key = `${guestId}:${sessionId}`;

  let guestPayment = await getGuestPayment(guestId, sessionId);
  
  if (!guestPayment) {
    guestPayment = await createOrUpdateGuestPayment(guestId, sessionId, assetCode, assetScale);
  }

  // Add URL if not already present
  if (!guestPayment.incomingPaymentUrls.includes(incomingPaymentUrl)) {
    guestPayment.incomingPaymentUrls.push(incomingPaymentUrl);
    guestPayment.lastUpdated = new Date();
  }

  if (redis) {
    await redis.set(`${GUEST_PAYMENTS_KEY}:${key}`, serializeGuestPayment(guestPayment));
  } else {
    memoryStore.guestPayments.set(key, guestPayment);
  }

  return guestPayment;
}

export async function updateGuestBalance(
  guestId: string,
  sessionId: string,
  totalReceived: number,
  assetCode: string,
  assetScale: number,
  increment?: boolean // If true, add to existing total instead of replacing
): Promise<GuestPayment> {
  const redis = await getRedis();
  const key = `${guestId}:${sessionId}`;

  // Get session to determine the correct currency to store payments in
  const session = await getSession(sessionId);
  const sessionCurrency = session?.assetCode || assetCode;
  const sessionScale = session?.assetScale ?? assetScale;

  let guestPayment = await getGuestPayment(guestId, sessionId);
  
  if (!guestPayment) {
    // Initialize with session currency
    guestPayment = await createOrUpdateGuestPayment(guestId, sessionId, sessionCurrency, sessionScale);
  }

  // Convert incoming payment to session currency if needed
  let totalReceivedInSessionCurrency = totalReceived;
  if (assetCode !== sessionCurrency || assetScale !== sessionScale) {
    // Convert from payment currency to session currency
    // Step 1: Convert to display value in payment currency
    const displayValue = totalReceived / Math.pow(10, assetScale);
    // Step 2: Convert to session currency smallest units
    // Note: This assumes 1:1 exchange rate - in production, you'd need real exchange rates
    totalReceivedInSessionCurrency = Math.floor(displayValue * Math.pow(10, sessionScale));
    
    console.log("[BALANCE UPDATE] Converting payment currency", {
      guestId,
      sessionId,
      paymentCurrency: assetCode,
      paymentScale: assetScale,
      paymentAmount: totalReceived,
      sessionCurrency: sessionCurrency,
      sessionScale: sessionScale,
      convertedAmount: totalReceivedInSessionCurrency,
      timestamp: new Date().toISOString(),
    });
  }

  // If increment is true, add to existing total (for streaming payments)
  // Otherwise, set to the new total (for polling results)
  if (increment) {
    // If existing payment is in different currency, convert it first
    if (guestPayment.assetCode !== sessionCurrency || guestPayment.assetScale !== sessionScale) {
      const existingDisplayValue = guestPayment.totalReceived / Math.pow(10, guestPayment.assetScale);
      guestPayment.totalReceived = Math.floor(existingDisplayValue * Math.pow(10, sessionScale));
    }
    guestPayment.totalReceived = guestPayment.totalReceived + totalReceivedInSessionCurrency;
  } else {
    // Use the maximum of current and new total (in case of race conditions)
    // Convert existing if needed
    if (guestPayment.assetCode !== sessionCurrency || guestPayment.assetScale !== sessionScale) {
      const existingDisplayValue = guestPayment.totalReceived / Math.pow(10, guestPayment.assetScale);
      guestPayment.totalReceived = Math.floor(existingDisplayValue * Math.pow(10, sessionScale));
    }
    guestPayment.totalReceived = Math.max(guestPayment.totalReceived, totalReceivedInSessionCurrency);
  }
  
  // Always store in session currency
  guestPayment.assetCode = sessionCurrency;
  guestPayment.assetScale = sessionScale;
  guestPayment.lastUpdated = new Date();

  if (redis) {
    await redis.set(`${GUEST_PAYMENTS_KEY}:${key}`, serializeGuestPayment(guestPayment));
    // Also store balance separately for quick lookup
    await redis.set(`${GUEST_BALANCES_KEY}:${key}`, guestPayment.totalReceived);
  } else {
    memoryStore.guestPayments.set(key, guestPayment);
    memoryStore.guestBalances.set(key, guestPayment.totalReceived);
  }

  return guestPayment;
}

export async function getGuestBalance(guestId: string, sessionId: string): Promise<GuestBalance | null> {
  const redis = await getRedis();
  const key = `${guestId}:${sessionId}`;

  const guestPayment = await getGuestPayment(guestId, sessionId);
  
  if (!guestPayment) {
    return null;
  }

  // Get session to get question price for credit calculation
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  // Calculate balance: total received minus amount spent on questions
  let balance = guestPayment.totalReceived;
  
  // Get all questions by this guest and count how many credits were used
  const questions = await getQuestionsBySession(sessionId);
  const guestQuestions = questions.filter(q => 
    q.submitterWalletAddress === guestId || 
    // Fallback: check if question metadata includes guestId
    (q as any).guestId === guestId
  );
  
  // Count questions submitted (each question costs 1 credit)
  const creditsUsed = guestQuestions
    .filter(q => q.status !== "pending_payment")
    .length;
  
  // Calculate available credits: (totalReceived / questionPrice) - creditsUsed
  // Credits are always in the host's currency (from session)
  // totalReceived should now always be stored in session currency (enforced in updateGuestBalance)
  const questionPrice = session.questionPrice; // Already in smallest unit of session currency
  
  // Convert totalReceived to session currency if there's a mismatch (safeguard)
  let totalReceivedInSessionCurrency = guestPayment.totalReceived;
  if (guestPayment.assetCode !== session.assetCode || guestPayment.assetScale !== session.assetScale) {
    // Legacy data conversion - convert from payment currency to session currency
    const totalReceivedDisplay = guestPayment.totalReceived / Math.pow(10, guestPayment.assetScale);
    totalReceivedInSessionCurrency = Math.floor(totalReceivedDisplay * Math.pow(10, session.assetScale));
    
    console.log("[CREDIT CALC] Converting legacy currency data for credit calculation", {
      guestId,
      sessionId,
      paymentCurrency: guestPayment.assetCode,
      paymentScale: guestPayment.assetScale,
      paymentTotalReceived: guestPayment.totalReceived,
      sessionCurrency: session.assetCode,
      sessionScale: session.assetScale,
      convertedTotalReceived: totalReceivedInSessionCurrency,
      questionPrice,
      timestamp: new Date().toISOString(),
    });
  }
  
  const totalCreditsEarned = questionPrice > 0 
    ? Math.floor(totalReceivedInSessionCurrency / questionPrice)
    : 0;
  const questionCredits = Math.max(0, totalCreditsEarned - creditsUsed);
  
  // Balance is still calculated for display purposes (in session currency)
  const spent = creditsUsed * questionPrice;
  balance = totalReceivedInSessionCurrency - spent;

  return {
    guestId,
    sessionId,
    balance: Math.max(0, balance),
    totalReceived: guestPayment.totalReceived,
    questionCredits,
    assetCode: guestPayment.assetCode,
    assetScale: guestPayment.assetScale,
  };
}

export async function deductGuestCredit(
  guestId: string,
  sessionId: string
): Promise<GuestBalance | null> {
  const currentBalance = await getGuestBalance(guestId, sessionId);
  
  if (!currentBalance) {
    return null;
  }

  // Check if user has at least 1 credit
  if (currentBalance.questionCredits < 1) {
    throw new Error("Insufficient credits");
  }

  // Credits are deducted when we create a question
  // The balance calculation will automatically account for it
  return currentBalance;
}
