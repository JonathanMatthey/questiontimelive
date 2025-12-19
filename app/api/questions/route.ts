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
  getGuestBalance,
  deductGuestCredit,
  getSession,
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

    // If guestId is provided, check credits before allowing submission
    if (body.guestId && body.sessionId) {
      const session = await getSession(body.sessionId);
      if (session) {
        console.log("[CREDIT CHECK] Checking credits before question submission", {
          guestId: body.guestId,
          sessionId: body.sessionId,
          submitterName: body.submitterName,
          timestamp: new Date().toISOString(),
        });
        
        const guestBalance = await getGuestBalance(body.guestId, body.sessionId);
        
        if (!guestBalance) {
          console.log("[CREDIT DENIED] No balance found for guest", {
            guestId: body.guestId,
            sessionId: body.sessionId,
            timestamp: new Date().toISOString(),
          });
          return NextResponse.json(
            { error: "Insufficient credits" },
            { status: 402 } // Payment Required
          );
        }
        
        if (guestBalance.questionCredits < 1) {
          console.log("[CREDIT DENIED] Insufficient credits", {
            guestId: body.guestId,
            sessionId: body.sessionId,
            availableCredits: guestBalance.questionCredits,
            totalReceived: (guestBalance.totalReceived / Math.pow(10, guestBalance.assetScale)).toFixed(guestBalance.assetScale),
            currency: guestBalance.assetCode,
            timestamp: new Date().toISOString(),
          });
          return NextResponse.json(
            { error: "Insufficient credits" },
            { status: 402 } // Payment Required
          );
        }
        
        // Deduct 1 credit
        await deductGuestCredit(body.guestId, body.sessionId);
        
        // Get updated balance to log
        const updatedBalance = await getGuestBalance(body.guestId, body.sessionId);
        
        console.log("[CREDIT SUCCESS] Deducting 1 credit for question", {
          guestId: body.guestId,
          sessionId: body.sessionId,
          questionId: body.id || "pending",
          submitterName: body.submitterName,
          creditsBefore: guestBalance.questionCredits,
          creditsAfter: updatedBalance?.questionCredits || 0,
          totalReceived: (guestBalance.totalReceived / Math.pow(10, guestBalance.assetScale)).toFixed(guestBalance.assetScale),
          currency: guestBalance.assetCode,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Get session to set amountPaid to question price (for tracking)
    const session = await getSession(body.sessionId);
    const questionPrice = session?.questionPrice || body.amountPaid || 0;

    const question: Question = {
      id: nanoid(),
      sessionId: body.sessionId,
      text: body.text,
      submitterName: body.submitterName,
      submitterWalletAddress: body.submitterWalletAddress || body.guestId,
      amountPaid: questionPrice, // Store question price for tracking
      status: body.status || "paid", // Questions are paid when submitted (credit deducted)
      createdAt: new Date(),
      upvotes: 0,
      ...(body.guestId && { guestId: body.guestId } as any), // Store guestId for tracking
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
      // "Answer Question" sets it as active (currently being answered)
      const updated = await updateQuestion(id, { status: "active" });
      return NextResponse.json(updated);
    }

    if (updates.action === "complete") {
      // "Complete Question" marks it as answered
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
