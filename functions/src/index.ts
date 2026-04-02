import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import axios from "axios";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();

const wawpToken = defineSecret("WAWP_TOKEN");
const wawpInstanceId = defineSecret("WAWP_INSTANCE_ID");

// --- Security Helpers ---

const hashString = (str: string) => crypto.createHash("sha256").update(str).digest("hex");

// Timing-safe comparison to prevent timing attacks
const secureCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

// Tight retry logic for faster delivery
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
      logger.error("WAWP_FAIL", { attempt: i + 1, phone: body.to, error: e.message });
      if (i === retries) return false;
      await new Promise(r => setTimeout(r, 500 * (i + 1))); // 0.5s, 1s backoff
    }
  }
  return false;
}

export const requestWhatsAppOtp = onCall(
  { secrets: [wawpToken, wawpInstanceId], enforceAppCheck: true },
  async (request) => {
    if (!request.app) {
      throw new HttpsError("permission-denied", "Unauthorized request.");
    }

    const { phone } = request.data;
    if (!phone || !/^91\d{10}$/.test(phone)) {
      throw new HttpsError("invalid-argument", "Invalid request format.");
    }

    // Check if user already exists
    const mobile = phone.substring(2);
    const userQuery = await admin.firestore().collection('users').where('mobile', '==', mobile).get();
    if (!userQuery.empty) {
      throw new HttpsError("already-exists", "Account already exists. Please login instead.");
    }

    const hashedPhone = hashString(phone);
    const otpRef = db.collection("otps").doc(hashedPhone);
    const now = admin.firestore.Timestamp.now();

    // 1. Check 60s Cooldown (Read-only first for speed)
    const otpDoc = await otpRef.get();
    if (otpDoc.exists) {
      const data = otpDoc.data()!;
      if (data.lastRequestAt) {
        const secondsSinceLastRequest = now.seconds - data.lastRequestAt.seconds;
        if (secondsSinceLastRequest < 60) {
          throw new HttpsError("resource-exhausted", "Wait 60 seconds");
        }
      }
    }

    // 2. Generate OTP
    const plainOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = hashString(plainOtp);

    // 3. Send WhatsApp Message First (Perceived Speed)
    let success = false;
    try {
      const token = wawpToken.value();
      const instanceId = wawpInstanceId.value();

      if (token && instanceId) {
        const body = {
          instance_id: instanceId,
          to: phone,
          message: `OTP: ${plainOtp} (2 min)` // Short message for faster delivery
        };
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        success = await sendWithRetry(body, headers);
      } else {
        logger.warn("WAWP credentials empty. Falling back to DEV MODE.");
        logger.info(`DEV MODE OTP for ${phone}: ${plainOtp}`);
        success = true;
      }
    } catch (e: any) {
      logger.warn("WAWP credentials not configured or error occurred. Falling back to DEV MODE.", { error: e.message });
      logger.info(`DEV MODE OTP for ${phone}: ${plainOtp}`);
      success = true;
    }

    if (!success) {
      throw new HttpsError("internal", "Failed to send WhatsApp message.");
    }

    // 4. Save to DB only after successful send
    const expiresAt = new admin.firestore.Timestamp(now.seconds + 120, now.nanoseconds);
    await otpRef.set({
      otp: hashedOtp,
      expiresAt: expiresAt,
      lastRequestAt: admin.firestore.Timestamp.now(), // Update time after send
      attempts: 0
    });

    return { success: true, message: "OTP sent successfully" };
  }
);

export const verifyWhatsAppOtp = onCall(
  { enforceAppCheck: true },
  async (request) => {
    if (!request.app) {
      throw new HttpsError("permission-denied", "Unauthorized request.");
    }

    const { phone, otp } = request.data;
    if (!phone || !/^91\d{10}$/.test(phone) || !otp || !/^\d{6}$/.test(otp)) {
      throw new HttpsError("invalid-argument", "Invalid request format.");
    }

    const hashedPhone = hashString(phone);
    const hashedInputOtp = hashString(otp);
    const otpRef = db.collection("otps").doc(hashedPhone);

    let customToken = "";

    await db.runTransaction(async (t) => {
      const doc = await t.get(otpRef);

      // Standardized Errors
      if (!doc.exists) {
        throw new HttpsError("not-found", "OTP expired");
      }

      const data = doc.data()!;
      const now = admin.firestore.Timestamp.now();

      // Clock sync issue avoided by using server timestamp
      if (now.seconds > data.expiresAt.seconds) {
        t.delete(otpRef);
        throw new HttpsError("deadline-exceeded", "OTP expired");
      }

      if (data.attempts >= 3) {
        t.delete(otpRef);
        throw new HttpsError("resource-exhausted", "Too many tries");
      }

      const isOtpValid = secureCompare(data.otp, hashedInputOtp);

      if (!isOtpValid) {
        const newAttempts = (data.attempts || 0) + 1;
        if (newAttempts >= 3) {
          t.delete(otpRef);
          throw new HttpsError("resource-exhausted", "Too many tries");
        } else {
          t.update(otpRef, { attempts: newAttempts });
          throw new HttpsError("invalid-argument", "Invalid OTP");
        }
      }

      // Delete on success (Reuse impossible)
      t.delete(otpRef);
    });

    // Create or fetch Firebase Auth user OUTSIDE the transaction
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByPhoneNumber(`+${phone}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await admin.auth().createUser({ phoneNumber: `+${phone}` });
        logger.info("New user created via WhatsApp OTP", { uid: userRecord.uid });
      } else {
        logger.error("Auth service error", { error: error.message });
        throw new HttpsError("internal", "Authentication service error.");
      }
    }

    customToken = await admin.auth().createCustomToken(userRecord.uid);

    return { success: true, token: customToken };
  }
);
