import { useState, FormEvent } from 'react';
import { Lock, Smartphone, Loader2, ChevronRight, UserPlus } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, query, where, getDocs, collection, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAppStore } from '../store';
import toast from 'react-hot-toast';
import Logo from './Logo';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [mobileOrAdmin, setMobileOrAdmin] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [otp, setOtp] = useState('123456'); // Simulated OTP
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Mobile, 2: OTP Display, 3: Password & Invite
  const [isLoading, setIsLoading] = useState(false);
  const { setIsAdmin } = useAppStore();

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(mobileOrAdmin) && mobileOrAdmin !== '9678516469') {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    
    setIsLoading(true);
    setStep(2); // Show "Fetching OTP" step
    
    // Generate random 6-digit OTP
    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setOtp(randomOtp);

    // Simulate OTP fetching delay
    setTimeout(() => {
      setIsLoading(false);
      setStep(3); // Automatically proceed to Password & Invite
    }, 2500);
  };

  const handleLogin = async (e: FormEvent) => {
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

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      } catch (signInError: any) {
        // Auto-create admin account if it doesn't exist
        if (mobileOrAdmin === '9678516469' && (signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/user-not-found')) {
          userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
          
          const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
          let shortId = '';
          for (let i = 0; i < 6; i++) {
            shortId += chars.charAt(Math.floor(Math.random() * chars.length));
          }

          const userData: any = {
            uid: userCredential.user.uid,
            shortId: shortId,
            role: 'admin',
            mobile: mobileOrAdmin,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', userCredential.user.uid), userData);
          await setDoc(doc(db, 'short_ids', shortId), { uid: userCredential.user.uid, shortId });
        } else {
          throw signInError;
        }
      }

      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        let currentShortId = userData.shortId;

        // Backfill shortId if missing
        if (!currentShortId) {
          const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
          currentShortId = '';
          for (let i = 0; i < 6; i++) {
            currentShortId += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          await updateDoc(doc(db, 'users', userCredential.user.uid), { shortId: currentShortId });
        }

        // Ensure short_ids mapping exists
        const sId = currentShortId.toLowerCase();
        const sDoc = await getDoc(doc(db, 'short_ids', sId));
        if (!sDoc.exists()) {
          await setDoc(doc(db, 'short_ids', sId), { uid: userCredential.user.uid, shortId: sId });
        }

        if (userData.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
      
      toast.success('Logged in successfully!');
      onLogin();
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') {
        toast.error('Invalid mobile number or password. Please check your credentials or register first.');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('Account already exists. Please check your credentials.');
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
      if (mobileOrAdmin === '9678516469' && password !== 'admin123') {
        toast.error('Invalid admin password.');
        setIsLoading(false);
        return;
      }

      // Validate invitation code (which is now the referrer's shortId)
      let referrerId = null;
      if (invitationCode) {
        const cleanCode = invitationCode.trim().toLowerCase();
        try {
          const shortIdDoc = await getDoc(doc(db, 'short_ids', cleanCode));
          if (shortIdDoc.exists()) {
            referrerId = shortIdDoc.data().uid;
          } else {
            // Fallback: Check if cleanCode is a legacy UID in 'users'
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

      let loginEmail = `${mobileOrAdmin}@elivex.com`;
      if (mobileOrAdmin === '9678516469') {
        loginEmail = 'admin@elivex.com';
      }
      const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
      
      // Backfill referrer's shortId if it was missing (now authenticated)
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
                  onChange={(e) => setMobileOrAdmin(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Enter 10-digit mobile number" 
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
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Login' : 'Send OTP'}
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        ) : step === 2 ? (
          <div className="text-center py-12">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-100 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Please wait</h3>
            <p className="text-gray-500 font-medium animate-pulse">Fetching OTP directly from the text...</p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleRegister}>
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
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Register
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
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
