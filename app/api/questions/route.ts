import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  getQuestionsBySession,
  createQuestion,
  updateQuestion,
  getQuestion,
  createPayment,
  updatePayment,
  getPaymentByQuestionId,
  getSessionStats,
} from "@/lib/server-store";
import type { Question, Payment } from "@/lib/types";

// GET /api/questions?sessionId=xxx - Get questions for a session
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const questions = await getQuestionsBySession(sessionId);
    const stats = await getSessionStats(sessionId);

    return NextResponse.json({ questions, stats });
  } catch (error) {
    console.error("Get questions error:", error);
    return NextResponse.json({ error: "Failed to get questions" }, { status: 500 });
  }
}

// POST /api/questions - Create a new question
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const question: Question = {
      id: nanoid(),
      sessionId: body.sessionId,
      text: body.text,
      submitterName: body.submitterName,
      submitterWalletAddress: body.submitterWalletAddress,
      amountPaid: body.amountPaid,
      status: body.status || "pending_payment",
      createdAt: new Date(),
      upvotes: 0,
    };

    const created = await createQuestion(question);

    // If payment info provided, create payment record
    if (body.payment) {
      const payment: Payment = {
        id: nanoid(),
        questionId: created.id,
        sessionId: body.sessionId,
        incomingPaymentUrl: body.payment.incomingPaymentUrl || "",
        amount: body.amountPaid,
        assetCode: body.payment.assetCode || "USD",
        assetScale: body.payment.assetScale || 2,
        status: "pending",
        createdAt: new Date(),
      };
      await createPayment(payment);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create question error:", error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}

// PATCH /api/questions - Update a question
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Question id is required" }, { status: 400 });
    }

    // Handle special actions
    if (updates.action === "answer") {
      const updated = await updateQuestion(id, {
        status: "answered",
        answeredAt: new Date(),
      });
      return NextResponse.json(updated);
    }

    if (updates.action === "skip") {
      const updated = await updateQuestion(id, { status: "skipped" });
      return NextResponse.json(updated);
    }

    if (updates.action === "upvote") {
      const question = await getQuestion(id);
      if (!question) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 });
      }
      const updated = await updateQuestion(id, { upvotes: question.upvotes + 1 });
      return NextResponse.json(updated);
    }

    if (updates.action === "markPaid") {
      const question = await getQuestion(id);
      if (!question) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 });
      }

      // Find the payment record for this question
      const payment = await getPaymentByQuestionId(id);

      const updated = await updateQuestion(id, {
        status: "paid",
        paymentId: updates.paymentId || payment?.id,
      });

      // Update payment status too
      if (payment) {
        await updatePayment(payment.id, {
          status: "completed",
          completedAt: new Date(),
        });
      }

      return NextResponse.json(updated);
    }

    const updated = await updateQuestion(id, updates);
    if (!updated) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update question error:", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}
