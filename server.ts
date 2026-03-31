import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initializeApp, getApps, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

// Lazy initialize Firebase Admin
function getDb() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount) {
      try {
        const sa = JSON.parse(serviceAccount);
        initializeApp({
          credential: cert(sa),
          projectId: firebaseConfig.projectId,
        });
        console.log("Firebase Admin initialized with service account");
      } catch (error) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT", error);
        initializeApp({
          projectId: firebaseConfig.projectId,
        });
      }
    } else {
      try {
        initializeApp({
          credential: applicationDefault(),
          projectId: firebaseConfig.projectId,
        });
        console.log("Firebase Admin initialized with applicationDefault");
      } catch (error) {
        console.warn("Failed to initialize Firebase Admin with applicationDefault. Using fallback.", error);
        initializeApp({
          projectId: firebaseConfig.projectId,
        });
      }
    }
  }
  // Use the database ID from config if it's not the default
  const app = getApps()[0];
  return getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
}

const adminDb = getDb();
const adminFirestore = getFirestore;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/process-transaction", async (req, res) => {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ error: "Missing userId or amount" });
    }

    try {
      const db = getDb();
      const userRef = db.collection("users").doc(userId);
      
      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        const userData = userDoc.data();
        const referrerId = userData?.referrerId;
        const buyerBonus = amount * 0.045;
        const totalTokens = amount + buyerBonus;

        // 1. Update Buyer Stats
        transaction.update(userRef, {
          eCoinBalance: FieldValue.increment(totalTokens),
          todayProfit: FieldValue.increment(buyerBonus),
          transactionAmount: FieldValue.increment(amount),
          hasBoughtAnyAmount: true,
          newbieBonusCompleted: true
        });

        // Record buyer transaction
        const transRef = db.collection("transactions").doc();
        transaction.set(transRef, {
          userId,
          amount,
          reward: buyerBonus,
          total: totalTokens,
          type: 'Buy',
          status: 'Completed',
          createdAt: new Date().toISOString(),
        });

        // 2. 3-Level Referral Bonus Logic
        const levels = [
          { rate: 0.005, level: 1 }, // 0.5%
          { rate: 0.003, level: 2 }, // 0.3%
          { rate: 0.002, level: 3 }, // 0.2%
        ];

        const today = new Date().toISOString().split('T')[0];
        let currentReferrerId = referrerId;

        for (const { rate, level } of levels) {
          if (!currentReferrerId) break;

          const referrerRef = db.collection("users").doc(currentReferrerId);
          const referrerDoc = await transaction.get(referrerRef);

          if (!referrerDoc.exists) break;

          const referrerData = referrerDoc.data();
          const commissionAmount = amount * rate;

          if (commissionAmount > 0) {
            let dailyComm = referrerData?.dailyTeamCommission || 0;
            let lastCommDate = referrerData?.lastCommissionDate || '';
            let bonusClaimedDate = referrerData?.dailyBonusClaimedDate || '';

            // Reset daily commission if it's a new day
            if (lastCommDate !== today) {
              dailyComm = 0;
            }

            const newDailyComm = dailyComm + commissionAmount;
            let bonusToAdd = 0;

            // Award ₹300 bonus if daily commission reaches ₹500 and not already claimed today
            if (newDailyComm >= 500 && bonusClaimedDate !== today) {
              bonusToAdd = 300;
              bonusClaimedDate = today;
            }

            transaction.update(referrerRef, {
              eCoinBalance: FieldValue.increment(commissionAmount + bonusToAdd),
              dailyTeamCommission: newDailyComm,
              lastCommissionDate: today,
              dailyBonusClaimedDate: bonusClaimedDate,
            });

            // Record commission in transactions for Activity modal
            const transRef = db.collection("transactions").doc();
            transaction.set(transRef, {
              userId: currentReferrerId,
              amount: commissionAmount + bonusToAdd,
              reward: bonusToAdd,
              total: commissionAmount + bonusToAdd,
              type: 'Referral',
              reason: bonusToAdd > 0 ? `Referral Commission + ₹${bonusToAdd} Daily Bonus` : `Referral Commission (Level ${level})`,
              status: 'Completed',
              createdAt: new Date().toISOString(),
            });

            // Record commission
            const commRef = db.collection("commissions").doc();
            transaction.set(commRef, {
              receiverId: currentReferrerId,
              fromUserId: userId,
              amount: commissionAmount + bonusToAdd,
              baseCommission: commissionAmount,
              bonusAmount: bonusToAdd,
              level,
              purchaseAmount: amount,
              createdAt: new Date().toISOString(),
            });
          }

          // Move up the chain
          currentReferrerId = referrerData?.referrerId;
        }
      });

      console.log(`Transaction processed successfully for user ${userId}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Transaction processing error:", error);
      res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
