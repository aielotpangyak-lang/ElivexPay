import express from "express";
import cors from "cors";
import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import axios from "axios";
import * as crypto from "crypto";

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount) {
      const sa = JSON.parse(serviceAccount);
      console.log("Service account project ID:", sa.project_id);
      initializeApp({
        credential: cert(sa),
        projectId: sa.project_id
      });
      console.log("Firebase initialized with project:", sa.project_id);
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT environment variable is missing. Attempting to initialize with default credentials.");
      initializeApp();
      console.log("Firebase initialized with default credentials.");
    }
  } catch (error) {
    console.error("Firebase initialization error", error);
  }
}

const db = getFirestore();
console.log("Firestore database name:", db.databaseId);
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// --- Security Helpers ---
const hashString = (str: string) => crypto.createHash("sha256").update(str).digest("hex");

const secureCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

async function sendWithRetry(body: any, headers: any, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await axios.post("https://api.wawp.com/send-message", body, {
        headers,
        timeout: 4000
      });
      if (res.status === 200) return true;
      throw new Error(`Non-200 status: ${res.status}`);
    } catch (e: any) {
      console.error("WAWP_FAIL", { attempt: i + 1, phone: body.to, error: e.message });
      if (i === retries) return false;
      await new Promise(r => setTimeout(r, 500 * (i + 1))); // 0.5s, 1s backoff
    }
  }
  return false;
}

// --- Endpoints ---

app.post("/api/request-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^91\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "invalid-argument", message: "Invalid request format." });
    }

    // Check if user already exists
    const mobile = phone.substring(2);
    console.log("Querying users collection for mobile:", mobile);
    let userQuery;
    try {
      userQuery = await db.collection('users').where('mobile', '==', mobile).get();
    } catch (e) {
      console.error("Error querying users collection:", e);
      throw e;
    }
    console.log("User query completed, empty:", userQuery.empty);
    if (!userQuery.empty) {
      return res.status(400).json({ error: "already-exists", message: "Account already exists. Please login instead." });
    }

    const hashedPhone = hashString(phone);
    const otpRef = db.collection("otps").doc(hashedPhone);
    const now = Timestamp.now();

    // 1. Check 60s Cooldown
    console.log("Getting OTP doc for:", hashedPhone);
    try {
      const otpDoc = await otpRef.get();
      console.log("OTP doc retrieved, exists:", otpDoc.exists);
      if (otpDoc.exists) {
        const otpData = otpDoc.data()!;
        if (otpData.lastRequestAt) {
          const secondsSinceLastRequest = now.seconds - otpData.lastRequestAt.seconds;
          if (secondsSinceLastRequest < 60) {
            return res.status(429).json({ error: "resource-exhausted", message: "Wait 60 seconds" });
          }
        }
      }
    } catch (e) {
      console.error("Error getting OTP doc:", e);
      throw e;
    }

    // 2. Generate OTP
    const plainOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = hashString(plainOtp);

    // 3. Send WhatsApp Message
    const WAWP_TOKEN = process.env.WAWP_TOKEN;
    const WAWP_INSTANCE_ID = process.env.WAWP_INSTANCE_ID;

    let success = false;
    if (WAWP_TOKEN && WAWP_INSTANCE_ID) {
      const body = {
        instance_id: WAWP_INSTANCE_ID,
        to: phone,
        message: `OTP: ${plainOtp} (2 min)`
      };
      const headers = {
        Authorization: `Bearer ${WAWP_TOKEN}`,
        "Content-Type": "application/json",
      };
      success = await sendWithRetry(body, headers);
    } else {
      console.warn("WAWP credentials empty. Falling back to DEV MODE.");
      console.info(`DEV MODE OTP for ${phone}: ${plainOtp}`);
      success = true;
    }

    if (!success) {
      return res.status(500).json({ error: "internal", message: "Failed to send WhatsApp message." });
    }

    // 4. Save to DB
    const expiresAt = new Timestamp(now.seconds + 120, now.nanoseconds);
    console.log("Saving OTP to DB...");
    try {
      await otpRef.set({
        otp: hashedOtp,
        expiresAt: expiresAt,
        lastRequestAt: Timestamp.now(),
        attempts: 0
      });
      console.log("OTP saved to DB");
    } catch (e) {
      console.error("Error saving OTP to DB:", e);
      throw e;
    }

    return res.json({ success: true, message: "OTP sent successfully" });
  } catch (error: any) {
    console.error("Error requesting OTP:", error);
    return res.status(500).json({ error: "internal", message: "Internal server error" });
  }
});

app.post("/api/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !/^91\d{10}$/.test(phone) || !otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: "invalid-argument", message: "Invalid request format." });
    }

    const hashedPhone = hashString(phone);
    const hashedInputOtp = hashString(otp);
    const otpRef = db.collection("otps").doc(hashedPhone);

    let customToken = "";

    await db.runTransaction(async (t) => {
      const doc = await t.get(otpRef);

      if (!doc.exists) {
        throw new Error("not-found");
      }

      const otpData = doc.data()!;
      const now = Timestamp.now();

      if (now.seconds > otpData.expiresAt.seconds) {
        t.delete(otpRef);
        throw new Error("deadline-exceeded");
      }

      if (otpData.attempts >= 3) {
        t.delete(otpRef);
        throw new Error("resource-exhausted");
      }

      const isOtpValid = secureCompare(otpData.otp, hashedInputOtp);

      if (!isOtpValid) {
        const newAttempts = (otpData.attempts || 0) + 1;
        if (newAttempts >= 3) {
          t.delete(otpRef);
          throw new Error("resource-exhausted");
        } else {
          t.update(otpRef, { attempts: newAttempts });
          throw new Error("invalid-argument");
        }
      }

      t.delete(otpRef);
    });

    let userRecord;
    try {
      userRecord = await getAuth().getUserByPhoneNumber(`+${phone}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await getAuth().createUser({ phoneNumber: `+${phone}` });
        console.log("New user created via WhatsApp OTP", { uid: userRecord.uid });
      } else {
        console.error("Auth service error", { error: error.message });
        return res.status(500).json({ error: "internal", message: "Authentication service error." });
      }
    }

    customToken = await getAuth().createCustomToken(userRecord.uid);
    return res.json({ success: true, token: customToken });

  } catch (error: any) {
    console.error("Error verifying OTP:", error);
    const errMessage = error.message;
    if (errMessage === "not-found" || errMessage === "deadline-exceeded") {
      return res.status(400).json({ error: errMessage, message: "OTP expired" });
    } else if (errMessage === "resource-exhausted") {
      return res.status(400).json({ error: errMessage, message: "Too many tries" });
    } else if (errMessage === "invalid-argument") {
      return res.status(400).json({ error: errMessage, message: "Invalid OTP" });
    }
    return res.status(500).json({ error: "internal", message: "Internal server error" });
  }
});

export default app;
