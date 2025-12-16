import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Session, Question, Payment, SessionStats } from "./types";

interface AppState {
  // Sessions
  sessions: Session[];
  currentSession: Session | null;
  createSession: (session: Omit<Session, "id" | "createdAt" | "status">) => Session;
  updateSession: (id: string, updates: Partial<Session>) => void;
  setCurrentSession: (session: Session | null) => void;
  startSession: (id: string) => void;
  endSession: (id: string) => void;
  getSessionById: (id: string) => Session | undefined;

  // Questions
  questions: Question[];
  addQuestion: (question: Omit<Question, "id" | "createdAt" | "upvotes">) => Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  getQuestionsBySession: (sessionId: string) => Question[];
  upvoteQuestion: (id: string) => void;
  markQuestionAnswered: (id: string) => void;
  markQuestionSkipped: (id: string) => void;

  // Payments
  payments: Payment[];
  addPayment: (payment: Omit<Payment, "id" | "createdAt">) => Payment;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  getPaymentByQuestionId: (questionId: string) => Payment | undefined;

  // Stats
  getSessionStats: (sessionId: string) => SessionStats;

  // Host settings
  hostWalletAddress: string;
  setHostWalletAddress: (address: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Sessions
      sessions: [],
      currentSession: null,

      createSession: (sessionData) => {
        const session: Session = {
          ...sessionData,
          id: nanoid(),
          status: "draft",
          createdAt: new Date(),
        };
        set((state) => ({
          sessions: [...state.sessions, session],
        }));
        return session;
      },

      updateSession: (id, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
          currentSession:
            state.currentSession?.id === id
              ? { ...state.currentSession, ...updates }
              : state.currentSession,
        }));
      },

      setCurrentSession: (session) => {
        set({ currentSession: session });
      },

      startSession: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, status: "live", startedAt: new Date() } : s
          ),
        }));
      },

      endSession: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, status: "ended", endedAt: new Date() } : s
          ),
        }));
      },

      getSessionById: (id) => {
        return get().sessions.find((s) => s.id === id);
      },

      // Questions
      questions: [],

      addQuestion: (questionData) => {
        const question: Question = {
          ...questionData,
          id: nanoid(),
          createdAt: new Date(),
          upvotes: 0,
        };
        set((state) => ({
          questions: [...state.questions, question],
        }));
        return question;
      },

      updateQuestion: (id, updates) => {
        set((state) => ({
          questions: state.questions.map((q) =>
            q.id === id ? { ...q, ...updates } : q
          ),
        }));
      },

      getQuestionsBySession: (sessionId) => {
        return get().questions.filter((q) => q.sessionId === sessionId);
      },

      upvoteQuestion: (id) => {
        set((state) => ({
          questions: state.questions.map((q) =>
            q.id === id ? { ...q, upvotes: q.upvotes + 1 } : q
          ),
        }));
      },

      markQuestionAnswered: (id) => {
        set((state) => ({
          questions: state.questions.map((q) =>
            q.id === id
              ? { ...q, status: "answered", answeredAt: new Date() }
              : q
          ),
        }));
      },

      markQuestionSkipped: (id) => {
        set((state) => ({
          questions: state.questions.map((q) =>
            q.id === id ? { ...q, status: "skipped" } : q
          ),
        }));
      },

      // Payments
      payments: [],

      addPayment: (paymentData) => {
        const payment: Payment = {
          ...paymentData,
          id: nanoid(),
          createdAt: new Date(),
        };
        set((state) => ({
          payments: [...state.payments, payment],
        }));
        return payment;
      },

      updatePayment: (id, updates) => {
        set((state) => ({
          payments: state.payments.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      getPaymentByQuestionId: (questionId) => {
        return get().payments.find((p) => p.questionId === questionId);
      },

      // Stats
      getSessionStats: (sessionId) => {
        const questions = get().questions.filter((q) => q.sessionId === sessionId);
        const payments = get().payments.filter(
          (p) => p.sessionId === sessionId && p.status === "completed"
        );

        return {
          totalQuestions: questions.filter((q) => q.status !== "pending_payment").length,
          answeredQuestions: questions.filter((q) => q.status === "answered").length,
          totalEarned: payments.reduce((sum, p) => sum + p.amount, 0),
          viewerCount: Math.floor(Math.random() * 50) + 10, // Mock viewer count
        };
      },

      // Host settings
      hostWalletAddress: "",
      setHostWalletAddress: (address) => {
        set({ hostWalletAddress: address });
      },
    }),
    {
      name: "livequestiontime-storage",
      partialize: (state) => ({
        sessions: state.sessions,
        questions: state.questions,
        payments: state.payments,
        hostWalletAddress: state.hostWalletAddress,
      }),
    }
  )
);

