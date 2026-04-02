import { useState, FormEvent, useEffect } from 'react';
import { Lock, Smartphone, Loader2, ChevronRight, UserPlus, KeyRound } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCustomToken, EmailAuthProvider, linkWithCredential, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, query, where, getDocs, collection, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, app } from '../firebase';
import { useAppStore } from '../store';
import toast from 'react-hot-toast';
import Logo from './Logo';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [mobileOrAdmin, setMobileOrAdmin] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState(() => {
    return localStorage.getItem('pending_invitation_code') || '';
  });
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<1 | 2>(1); // 1: Mobile, 2: OTP & Password & Invite
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { setIsAdmin } = useAppStore();
  const functions = getFunctions(app);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0 && !isLogin && step === 2) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown, isLogin, step]);

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(mobileOrAdmin) && mobileOrAdmin !== '9678516469') {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    
    setIsLoading(true);

    // Simulate sending a fake OTP
    setTimeout(() => {
      console.log(`DEV MODE (Fake) OTP for ${mobileOrAdmin}: 123456`);
      toast.success('OTP sent! (Check console for fake OTP)');
      setStep(2);
      setCountdown(60);
      setIsLoading(false);
    }, 1000);
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!invitationCode) {
        toast.error('Invitation link is required for registration.');
        setIsLoading(false);
        return;
      }

      // Fake OTP validation: only accept 123456
      if (otp !== '123456') {
        toast.error('Invalid OTP.');
        setIsLoading(false);
        return;
      }

      if (mobileOrAdmin === '9678516469' && password !== 'admin123') {
        toast.error('Invalid admin password.');
        setIsLoading(false);
        return;
      }

      // Validate invitation code
      let referrerId = null;
      if (invitationCode) {
        const cleanCode = invitationCode.trim().toLowerCase();
        try {
          const shortIdDoc = await getDoc(doc(db, 'short_ids', cleanCode));
          if (shortIdDoc.exists()) {
            referrerId = shortIdDoc.data().uid;
          } else {
            const userRef = doc(db, 'users', cleanCode);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              referrerId = cleanCode;
            } else {
              toast.error('Invalid referral code.');
              setIsLoading(false);
              return;
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `short_ids/${cleanCode}`);
          setIsLoading(false);
          return;
        }
      }

      // Create user with Email/Password (Phone auth via WhatsApp removed)
      let loginEmail = `${mobileOrAdmin}@elivex.com`;
      if (mobileOrAdmin === '9678516469') {
        loginEmail = 'admin@elivex.com';
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
      
      // Backfill referrer's shortId if it was missing
      if (referrerId && invitationCode) {
        const cleanCode = invitationCode.trim().toLowerCase();
        const userRef = doc(db, 'users', referrerId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (!userData.shortId) {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let newShortId = '';
            for (let i = 0; i < 6; i++) {
              newShortId += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            try {
              await updateDoc(userRef, { shortId: newShortId });
              await setDoc(doc(db, 'short_ids', newShortId.toLowerCase()), { uid: referrerId, shortId: newShortId.toLowerCase() });
            } catch (err) {
              console.warn("Could not auto-backfill referrer shortId:", err);
            }
          }
        }
      }

      // Generate a 6-character alphanumeric short ID for the new user
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let shortId = '';
      for (let i = 0; i < 6; i++) {
        shortId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const userData: any = {
        uid: userCredential.user.uid,
        shortId: shortId,
        role: mobileOrAdmin === '9678516469' ? 'admin' : 'user',
        mobile: mobileOrAdmin,
        createdAt: new Date().toISOString()
      };
      if (referrerId) {
        userData.referrerId = referrerId;
      }
      
      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      await setDoc(doc(db, 'short_ids', shortId), { uid: userCredential.user.uid, shortId });

      setIsAdmin(false);
      toast.success('Account created successfully!');
      onLogin();
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Account already exists. Please login instead.');
      } else {
        const path = auth.currentUser ? `users/${auth.currentUser.uid}` : 'users/registration';
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-6 bg-gray-50">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <Logo className="w-24 h-24 shadow-lg rounded-2xl" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">ElivexPay</h1>
        <p className="text-gray-500 mt-2">
          {isLogin ? 'Welcome back! Please login.' : 'Create an account to start earning.'}
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {step === 1 ? (
          <form className="space-y-4" onSubmit={isLogin ? handleLogin : handleSendOtp}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Smartphone className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  value={mobileOrAdmin}
                  onChange={(e) => setMobileOrAdmin(e.target.value.replace(/\D/g, ''))}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Enter 10-digit mobile number" 
                  maxLength={10}
                  required 
                />
              </div>
            </div>

            {isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" 
                    placeholder="••••••••" 
                    required 
                  />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading || (!isLogin && countdown > 0)}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Login' : countdown > 0 ? `Wait ${countdown}s` : 'Send OTP'}
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">OTP sent to +91 {mobileOrAdmin}</p>
              <button 
                type="button" 
                onClick={() => setStep(1)}
                className="text-xs text-indigo-600 hover:underline mt-1"
              >
                Change Number
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter 6-digit OTP</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 tracking-widest" 
                  placeholder="123456" 
                  maxLength={6}
                  required 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Set Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="••••••••" 
                  required 
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invitation Code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserPlus className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Enter invitation code" 
                  required 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading || otp.length !== 6 || !password || !invitationCode}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Verify & Register
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button 
              type="button" 
              className="w-full py-3 rounded-xl font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50 mt-2"
              onClick={handleSendOtp}
              disabled={isLoading || countdown > 0}
            >
              {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setStep(1);
              setPassword('');
              setMobileOrAdmin('');
              setInvitationCode('');
              setOtp('');
            }}
            className="text-indigo-600 font-bold hover:underline"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
