import { useState, FormEvent, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Smartphone, Loader2, ChevronRight, UserPlus, KeyRound } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCustomToken, EmailAuthProvider, linkWithCredential, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, query, where, getDocs, collection, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, app } from '../firebase';
import { useAppStore } from '../store';
import toast from 'react-hot-toast';
import Logo from './Logo';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export default function Auth({ onLogin, initialIsLogin = true }: { onLogin: () => void, initialIsLogin?: boolean }) {
  const { refCode } = useParams();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [mobileOrAdmin, setMobileOrAdmin] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');

  useEffect(() => {
    if (refCode) {
      console.log("Extracted referral code:", refCode);
      setInvitationCode(refCode);
      setIsLogin(false);
    }
  }, [refCode]);

  useEffect(() => {
    setIsLogin(initialIsLogin);
  }, [initialIsLogin]);
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [showOtpNotification, setShowOtpNotification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { setIsAdmin } = useAppStore();
  const functions = getFunctions(app);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(mobileOrAdmin) && mobileOrAdmin !== '9678516469') {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    
    setIsLoading(true);

    // Simulate sending a fake OTP
    setTimeout(() => {
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(newOtp);
      setShowOtpNotification(true);
      
      // Hide notification after 3 seconds
      setTimeout(() => setShowOtpNotification(false), 3000);
      
      // Auto-fill OTP after 1 second
      setTimeout(() => setOtp(newOtp), 1000);

      toast.success('OTP sent!');
      setOtpSent(true);
      setCountdown(60);
      setIsLoading(false);
    }, 1000);
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let strength = 0;
    if (pwd.length > 6) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 25;
    if (/[0-9]/.test(pwd)) strength += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 25;
    return strength;
  };

  const strength = getPasswordStrength(password);
  const strengthColor = strength < 50 ? 'bg-red-500' : strength < 75 ? 'bg-yellow-500' : 'bg-green-500';


  const loginUser = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let loginEmail = `${mobileOrAdmin}@elivex.com`;
      if (mobileOrAdmin === '9678516469') {
        loginEmail = 'admin@elivex.com';
      }

      if (mobileOrAdmin === '9678516469' && password !== 'admin123') {
        toast.error('Invalid admin password.');
        setIsLoading(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
      
      toast.success('Logged in successfully!');
      onLogin();
      navigate('/');
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') {
        toast.error('Invalid mobile number or password. Please check your credentials or register first.');
      } else {
        const path = auth.currentUser ? `users/${auth.currentUser.uid}` : 'users/unknown';
        handleFirestoreError(error, OperationType.GET, path);
        toast.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!otp || !password || !invitationCode) {
        toast.error('All fields are required.');
        setIsLoading(false);
        return;
      }

      // Fake OTP validation: only accept generatedOtp
      if (otp !== generatedOtp) {
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
      navigate('/');
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
      {showOtpNotification && (
        <div className="fixed top-4 left-4 right-4 bg-white p-4 rounded-2xl shadow-xl border border-gray-100 z-50 flex items-center gap-4 animate-in slide-in-from-top-4">
          <div className="bg-blue-100 p-2 rounded-full">
            <Smartphone className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">New Message</p>
            <p className="text-lg font-bold text-blue-600 tracking-widest">{generatedOtp}</p>
          </div>
        </div>
      )}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <Logo className="w-24 h-24 shadow-lg rounded-2xl" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">ElivexPay</h1>
        <p className="text-slate-500 mt-2">
          {isLogin ? 'Welcome back! Please login.' : 'Create an account to start earning.'}
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <form className="space-y-4" onSubmit={isLogin ? loginUser : handleRegister}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Smartphone className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="text" 
                  value={mobileOrAdmin}
                  onChange={(e) => setMobileOrAdmin(e.target.value.replace(/\D/g, ''))}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Enter 10-digit mobile number" 
                  maxLength={10}
                  required 
                />
              </div>
              {!isLogin && (
                <button 
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isLoading || countdown > 0 || otpSent}
                  className="bg-blue-700 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-800 transition-all disabled:opacity-50"
                >
                  {countdown > 0 ? `${countdown}s` : 'Send OTP'}
                </button>
              )}
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Enter 6-digit OTP</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="text" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 tracking-widest" 
                  placeholder="123456" 
                  maxLength={6}
                  required 
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" 
                placeholder="••••••••" 
                required 
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {!isLogin && (
              <div className="mt-2">
                <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${strengthColor} transition-all duration-300`} style={{ width: `${strength}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1">Password Strength</p>
              </div>
            )}
          </div>
          
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invitation Code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserPlus className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="text" 
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Enter invitation code" 
                  required 
                />
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-700 text-white py-3 rounded-xl font-bold hover:bg-blue-800 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isLogin ? 'Login' : 'Register'}
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
              const newIsLogin = !isLogin;
              setIsLogin(newIsLogin);
              if (newIsLogin) {
                navigate('/login');
              } else {
                navigate('/rs/none'); // Use a placeholder or just navigate to rs
              }
              setPassword('');
              setMobileOrAdmin('');
              setInvitationCode('');
              setOtp('');
            }}
            className="text-blue-700 font-bold hover:underline"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
