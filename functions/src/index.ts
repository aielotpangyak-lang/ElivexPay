import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();

// Temporary hardcoded credentials for testing
const WAWP_TOKEN = "DkpBNmcMj7CGzL";
const WAWP_INSTANCE_ID = "ADC6ED9F51D2";

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
      functions.logger.error("WAWP_FAIL", { attempt: i + 1, phone: body.to, error: e.message });
      if (i === retries) return false;
      await new Promise(r => setTimeout(r, 500 * (i + 1))); // 0.5s, 1s backoff
    }
  }
  return false;
}

export const requestWhatsAppOtp = functions.https.onCall(async (data, context) => {
  if (!context.app) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized request.");
  }

  const { phone } = data;
  if (!phone || !/^91\d{10}$/.test(phone)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid request format.");
  }

  // Check if user already exists
  const mobile = phone.substring(2);
  const userQuery = await admin.firestore().collection('users').where('mobile', '==', mobile).get();
  if (!userQuery.empty) {
    throw new functions.https.HttpsError("already-exists", "Account already exists. Please login instead.");
  }

  const hashedPhone = hashString(phone);
  const otpRef = db.collection("otps").doc(hashedPhone);
  const now = admin.firestore.Timestamp.now();

  // 1. Check 60s Cooldown (Read-only first for speed)
  const otpDoc = await otpRef.get();
  if (otpDoc.exists) {
    const otpData = otpDoc.data()!;
    if (otpData.lastRequestAt) {
      const secondsSinceLastRequest = now.seconds - otpData.lastRequestAt.seconds;
      if (secondsSinceLastRequest < 60) {
        throw new functions.https.HttpsError("resource-exhausted", "Wait 60 seconds");
      }
    }
  }

  // 2. Generate OTP
  const plainOtp = crypto.randomInt(100000, 999999).toString();
  const hashedOtp = hashString(plainOtp);

  // 3. Send WhatsApp Message First (Perceived Speed)
  const body = {
    instance_id: WAWP_INSTANCE_ID,
    to: phone,
    message: `OTP: ${plainOtp} (2 min)` // Short message for faster delivery
  };
  const headers = {
    Authorization: `Bearer ${WAWP_TOKEN}`,
    "Content-Type": "application/json",
  };

  const success = await sendWithRetry(body, headers);
  
  if (!success) {
    throw new functions.https.HttpsError("internal", "Failed to send WhatsApp message.");
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
});

export const verifyWhatsAppOtp = functions.https.onCall(async (data, context) => {
  if (!context.app) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized request.");
  }

  const { phone, otp } = data;
  if (!phone || !/^91\d{10}$/.test(phone) || !otp || !/^\d{6}$/.test(otp)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid request format.");
  }

  const hashedPhone = hashString(phone);
  const hashedInputOtp = hashString(otp);
  const otpRef = db.collection("otps").doc(hashedPhone);

  let customToken = "";

  await db.runTransaction(async (t) => {
    const doc = await t.get(otpRef);

    // Standardized Errors
    if (!doc.exists) {
      throw new functions.https.HttpsError("not-found", "OTP expired");
    }

    const otpData = doc.data()!;
    const now = admin.firestore.Timestamp.now();

    // Clock sync issue avoided by using server timestamp
    if (now.seconds > otpData.expiresAt.seconds) {
      t.delete(otpRef);
      throw new functions.https.HttpsError("deadline-exceeded", "OTP expired");
    }

    if (otpData.attempts >= 3) {
      t.delete(otpRef);
      throw new functions.https.HttpsError("resource-exhausted", "Too many tries");
    }

    const isOtpValid = secureCompare(otpData.otp, hashedInputOtp);

    if (!isOtpValid) {
      const newAttempts = (otpData.attempts || 0) + 1;
      if (newAttempts >= 3) {
        t.delete(otpRef);
        throw new functions.https.HttpsError("resource-exhausted", "Too many tries");
      } else {
        t.update(otpRef, { attempts: newAttempts });
        throw new functions.https.HttpsError("invalid-argument", "Invalid OTP");
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
      functions.logger.info("New user created via WhatsApp OTP", { uid: userRecord.uid });
    } else {
      functions.logger.error("Auth service error", { error: error.message });
      throw new functions.https.HttpsError("internal", "Authentication service error.");
    }
  }

  customToken = await admin.auth().createCustomToken(userRecord.uid);

  return { success: true, token: customToken };
});
