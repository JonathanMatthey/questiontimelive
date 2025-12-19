/**
 * Server-side store using Upstash Redis.
 * This allows data to be shared across different browsers/clients and serverless functions.
 * Falls back to in-memory storage when Redis is not configured (local development).
 */

import type { Session, Question, Payment, CoHostToken } from "./types";

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
} = {
  sessions: new Map(),
  questions: new Map(),
  payments: new Map(),
  sessionQuestions: new Map(),
  sessionPayments: new Map(),
  questionPayments: new Map(),
};

// Key prefixes
const SESSIONS_KEY = "sessions";
const QUESTIONS_KEY = "questions";
const PAYMENTS_KEY = "payments";

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

// Stats
export async function getSessionStats(sessionId: string) {
  const redis = await getRedis();
  const questions = await getQuestionsBySession(sessionId);

  let payments: (Payment | null)[] = [];

  if (redis) {
    const paymentIds = await redis.smembers(`${PAYMENTS_KEY}:${sessionId}`);
    payments = paymentIds.length
      ? await Promise.all(paymentIds.map(id => redis.get<Payment>(`payment:${id}`)))
      : [];
  } else {
    // In-memory fallback
    const paymentIds = memoryStore.sessionPayments.get(sessionId) || new Set();
    payments = Array.from(paymentIds).map(id => memoryStore.payments.get(id) || null);
  }

  const completedPayments = payments.filter(p => p && p.status === "completed") as Payment[];

  return {
    totalQuestions: questions.filter(q => q.status !== "pending_payment").length,
    answeredQuestions: questions.filter(q => q.status === "answered").length,
    totalEarned: completedPayments.reduce((sum, p) => sum + p.amount, 0),
    viewerCount: Math.floor(Math.random() * 50) + 10, // Mock for now
  };
}
