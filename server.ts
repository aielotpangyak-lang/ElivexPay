import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initializeApp, getApps, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import otpApi from "./api/index.ts";

// Lazy initialize Firebase Admin
function getDb() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = firebaseConfig.projectId;

    try {
      if (serviceAccount) {
        const sa = JSON.parse(serviceAccount);
        initializeApp({
          credential: cert(sa),
          projectId: projectId,
        });
        console.log(`Firebase Admin initialized with service account for project ${projectId}`);
      } else {
        initializeApp({
          credential: applicationDefault(),
          projectId: projectId,
        });
        console.log(`Firebase Admin initialized with applicationDefault for project ${projectId}`);
      }
    } catch (error) {
      console.warn("Failed to initialize Firebase Admin with credentials. Using fallback.", error);
      initializeApp({ projectId });
    }
  }
  
  const app = getApps()[0];
  const databaseId = firebaseConfig.firestoreDatabaseId || undefined;
  console.log(`Using Firestore database: ${databaseId || '(default)'}`);
  
  try {
    return getFirestore(app, databaseId);
  } catch (error) {
    console.error(`Failed to get Firestore for database ${databaseId}. Falling back to default.`, error);
    return getFirestore(app);
  }
}

const adminDb = getDb();
const adminFirestore = getFirestore;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mount OTP API
  app.use(otpApi);

  // API routes
  app.post("/api/process-transaction", async (req, res) => {
    const { userId, amount } = req.body;
    console.log(`Processing transaction for user ${userId}, amount ${amount}`);

    if (!userId || amount === undefined) {
      return res.status(400).json({ error: "Missing userId or amount" });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    try {
      const db = getDb();
      console.log(`Using DB for transaction: ${db.projectId} / ${db.databaseId}`);
      const userRef = db.collection("users").doc(userId);
      
      await db.runTransaction(async (transaction) => {
        console.log(`Starting transaction for user ${userId}`);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          console.error(`User ${userId} not found in database`);
          throw new Error("User not found");
        }

        const userData = userDoc.data();
        console.log(`User data retrieved:`, JSON.stringify(userData));
        const referrerId = userData?.referrerId;
        const buyerBonus = numAmount * 0.045;
        const totalTokens = numAmount + buyerBonus;
        const today = new Date().toISOString().split('T')[0];

        console.log(`User ${userId} - Current balance: ${userData?.eCoinBalance || 0}, Adding: ${totalTokens}`);

        // 1. Update Buyer Stats
        const lastProfitDate = userData?.lastProfitDate || '';
        let currentTodayProfit = userData?.todayProfit || 0;
        
        if (lastProfitDate !== today) {
          currentTodayProfit = 0;
        }

        const updateData = {
          eCoinBalance: FieldValue.increment(totalTokens),
          todayProfit: currentTodayProfit + buyerBonus,
          lastProfitDate: today,
          totalBuyAmount: FieldValue.increment(numAmount),
          hasBoughtAnyAmount: true,
          newbieBonusCompleted: true
        };
        console.log(`Updating user ${userId} with:`, JSON.stringify(updateData));
        transaction.update(userRef, updateData);

        // Record buyer transaction
        const transRef = db.collection("transactions").doc();
        transaction.set(transRef, {
          userId,
          amount: numAmount,
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

        let currentReferrerId = referrerId;
        const referrersToUpdate = [];

        // CRITICAL: In Firestore transactions, all reads must happen before all writes.
        // We collect all referrer data first.
        for (let i = 0; i < levels.length; i++) {
          if (!currentReferrerId) break;

          const referrerRef = db.collection("users").doc(currentReferrerId);
          const referrerDoc = await transaction.get(referrerRef);

          if (!referrerDoc.exists) break;

          const referrerData = referrerDoc.data();
          referrersToUpdate.push({
            id: currentReferrerId,
            ref: referrerRef,
            data: referrerData,
            level: levels[i].level,
            rate: levels[i].rate
          });

          // Move up the chain for the next read
          currentReferrerId = referrerData?.referrerId;
        }

        // Now perform all writes
        for (const item of referrersToUpdate) {
          const { ref, data, level, rate } = item;
          const commissionAmount = numAmount * rate;

          if (commissionAmount > 0) {
            let todayComm = data?.todayTeamCommission || 0;
            let lastCommDate = data?.lastCommissionDate || '';

            // Reset today's commission if it's a new day
            if (lastCommDate !== today) {
              todayComm = 0;
            }

            const newTodayComm = todayComm + commissionAmount;

            transaction.update(ref, {
              eCoinBalance: FieldValue.increment(commissionAmount),
              todayTeamCommission: newTodayComm,
              lastCommissionDate: today,
            });

            // Record commission in transactions
            const transRef = db.collection("transactions").doc();
            transaction.set(transRef, {
              userId: item.id,
              amount: commissionAmount,
              reward: 0,
              total: commissionAmount,
              type: 'Referral',
              reason: `Referral Commission (Level ${level})`,
              status: 'Completed',
              createdAt: new Date().toISOString(),
            });

            // Record detailed commission
            const commRef = db.collection("commissions").doc();
            transaction.set(commRef, {
              receiverId: item.id,
              fromUserId: userId,
              amount: commissionAmount,
              baseCommission: commissionAmount,
              bonusAmount: 0,
              level,
              purchaseAmount: numAmount,
              createdAt: new Date().toISOString(),
            });
          }
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
