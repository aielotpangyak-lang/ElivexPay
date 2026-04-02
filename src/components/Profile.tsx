import { useState, useEffect } from 'react';
import { User, ChevronRight, Coins, TrendingUp, History, ArrowRightLeft, Activity, Lock, ShieldAlert, X, Copy, Check, Gift, PlaySquare, HeadphonesIcon, Send, Instagram, CheckCircle2, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, setDoc, limit, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAppStore } from '../store';
import { OperationType, handleFirestoreError } from '../lib/firestoreErrorHandler';
import ProfileHeader from './ProfileHeader';
import ProfileMenu from './ProfileMenu';

interface BuyRequest {
  id: string;
  orderNo: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  utr?: string;
  userUpiId?: string;
}

interface SellRequest {
  id: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
}

export default function Profile({ onLogout, onNavigate }: { onLogout: () => void, onNavigate: (tab: any) => void }) {
  const { 
    isAdmin, setIsAdmin, eCoinBalance, todayProfit, totalBought, totalPending, 
    totalApproved, totalSold, themeDeducted, telegramLink, 
    instagramLink, totalBuyAmount, hasBoughtAnyAmount,
    tutorialVideos, careIds, newbieRewardAmount,
    isTelegramJoined, isInstagramFollowed, newbieRewardClaimed,
    todayTeamCommission, dailyBonusClaimedDate
  } = useAppStore();

  const [buyRequests, setBuyRequests] = useState<BuyRequest[]>([]);
  const [sellRequests, setSellRequests] = useState<SellRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [recentBuyRequests, setRecentBuyRequests] = useState<BuyRequest[]>([]);
  const [buyHistoryTab, setBuyHistoryTab] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [resubmitUtr, setResubmitUtr] = useState('');
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);
  const [showRecentRequests, setShowRecentRequests] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [view, setView] = useState<'main' | 'activity' | 'ecoin' | 'profit' | 'buy_history' | 'sell_history' | 'newbie_reward' | 'tutorial' | 'service' | 'password'>('main');
  const [activityTab, setActivityTab] = useState<'Added' | 'Deducted'>('Added');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const isTransactionCompleted = totalBuyAmount >= 5000;
  const allTasksCompleted = isTelegramJoined && isInstagramFollowed && isTransactionCompleted && hasBoughtAnyAmount;

  const handleTaskClick = async (type: 'telegram' | 'instagram') => {
    if (!auth.currentUser) return;
    
    if (type === 'telegram') {
      window.open(telegramLink, '_blank');
      if (!isTelegramJoined) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { telegramJoined: true });
          toast.success('Telegram task completed!', {
            icon: <Send className="w-5 h-5 text-blue-500" />
          });
        } catch (e) { console.error(e); }
      }
    } else {
      window.open(instagramLink, '_blank');
      if (!isInstagramFollowed) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { instagramFollowed: true });
          toast.success('Instagram task completed!', {
            icon: <Instagram className="w-5 h-5 text-pink-500" />
          });
        } catch (e) { console.error(e); }
      }
    }
  };

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [copied, setCopied] = useState(false);

  const { shortId, mobile, setShortId, setMobile } = useAppStore();

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        const userId = auth.currentUser.uid;
        const path = `users/${userId}`;
        try {
          const userRef = doc(db, 'users', userId);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            let currentShortId = data.shortId;

            // Auto-backfill if missing
            if (!currentShortId) {
              const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
              currentShortId = '';
              for (let i = 0; i < 6; i++) {
                currentShortId += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              await updateDoc(userRef, { shortId: currentShortId });
              await setDoc(doc(db, 'short_ids', currentShortId.toLowerCase()), { uid: userId, shortId: currentShortId.toLowerCase() });
            }

            // Store values are updated by App.tsx onSnapshot, 
            // but we can set them here for initial load if needed
            // or just rely on the sync.
            
            // Fetch recent buy requests for preview
            const buyQ = query(
              collection(db, 'buy_requests'),
              where('userId', '==', userId),
              orderBy('createdAt', 'desc'),
              limit(3)
            );
            const buySnapshot = await getDocs(buyQ);
            setRecentBuyRequests(buySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BuyRequest[]);
          }
        } catch (error) {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, path);
          }
        }
      }
    };
    fetchUserData();
  }, [auth.currentUser]);

  const fetchHistory = async () => {
    if (!auth.currentUser) return;
    setLoadingHistory(true);
    try {
      // Fetch Buy Requests
      const buyQ = query(
        collection(db, 'buy_requests'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const buySnapshot = await getDocs(buyQ);
      setBuyRequests(buySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BuyRequest[]);

      // Fetch Sell Requests
      const sellQ = query(
        collection(db, 'sell_requests'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const sellSnapshot = await getDocs(sellQ);
      setSellRequests(sellSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SellRequest[]);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(transData);
    });
    return () => unsubscribe();
  }, []);

  const addedTransactions = transactions.filter(t => 
    t.type === 'Buy' || t.type === 'Referral' || t.type === 'TeamBonus' || t.type === 'Reward'
  );
  const deductedTransactions = transactions.filter(t => 
    t.type === 'Withdraw' || t.type === 'Order'
  );

  const handleMenuClick = (id: string) => {
    if (id === 'team') {
      window.history.replaceState({}, '', '?teamView=details');
      onNavigate('team');
    } else if (id === 'logout') {
      onLogout();
    } else {
      if (id === 'buy_history' || id === 'sell_history' || id === 'activity') {
        fetchHistory();
      }
      setView(id as any);
    }
  };

  const handleResetPassword = async () => {
    if (!auth.currentUser) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsResetting(true);
    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
      
      try {
        await reauthenticateWithCredential(auth.currentUser, credential);
      } catch (e: any) {
        if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
          toast.error('Invalid old password');
        } else {
          toast.error('Failed to verify old password');
        }
        setIsResetting(false);
        return;
      }

      await updatePassword(auth.currentUser, newPassword);
      toast.success('Password updated successfully');
      setView('main');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to update password');
    } finally {
      setIsResetting(false);
    }
  };

  const handleClaimNewbieReward = async () => {
    if (!auth.currentUser || !allTasksCompleted || newbieRewardClaimed) return;
    
    const userId = auth.currentUser.uid;
    const userRef = doc(db, 'users', userId);
    
    try {
      await updateDoc(userRef, {
        eCoinBalance: eCoinBalance + newbieRewardAmount,
        newbieRewardClaimed: true,
        newbieBonusCompleted: true
      });
      toast.success(`₹${newbieRewardAmount} Reward claimed successfully!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleAdminLogin = () => {
    if (adminCode === 'admin123') {
      setIsAdmin(true);
      toast.success('Admin mode enabled');
      setAdminCode('');
      setActiveModal(null);
    } else {
      toast.error('Invalid code');
    }
  };

  const handleResubmitUtr = async (requestId: string) => {
    if (!resubmitUtr || resubmitUtr.length !== 12) {
      toast.error('Please enter a valid 12-digit UTR');
      return;
    }

    try {
      await updateDoc(doc(db, 'buy_requests', requestId), {
        utr: resubmitUtr,
        updatedAt: new Date().toISOString()
      });
      toast.success('UTR updated successfully');
      setResubmittingId(null);
      setResubmitUtr('');
      fetchHistory();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `buy_requests/${requestId}`);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setAdminCode('');
    setPassword('');
    setResubmittingId(null);
    setResubmitUtr('');
  };

  const menuItems = [
    { id: 'ecoin', icon: <Coins className="w-5 h-5 text-indigo-500" />, label: "E-Coin", value: eCoinBalance.toFixed(2) },
    { id: 'profit', icon: <TrendingUp className="w-5 h-5 text-emerald-500" />, label: "Today Profit", value: todayProfit.toFixed(2) },
    { id: 'buy_history', icon: <History className="w-5 h-5 text-blue-500" />, label: "Buy History" },
    { id: 'sell_history', icon: <ArrowRightLeft className="w-5 h-5 text-orange-500" />, label: "Sell History" },
    { id: 'activity', icon: <Activity className="w-5 h-5 text-purple-500" />, label: "Activity" },
    { id: 'newbie_reward', icon: <Gift className="w-5 h-5 text-rose-500" />, label: "New Reward" },
    { id: 'team', icon: <User className="w-5 h-5 text-indigo-600" />, label: "My Team" },
    { id: 'tutorial', icon: <PlaySquare className="w-5 h-5 text-red-500" />, label: "Tutorial" },
    { id: 'service', icon: <HeadphonesIcon className="w-5 h-5 text-teal-500" />, label: "Service" },
    { id: 'password', icon: <Lock className="w-5 h-5 text-slate-500" />, label: "Password" },
  ];

  if (view === 'ecoin') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">My E-Coin</h2>
        </div>
        <div className="p-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Coins className="w-10 h-10 text-indigo-600" />
            </div>
            <span className="text-slate-400 text-sm font-bold uppercase tracking-widest block mb-1">Current Balance</span>
            <h3 className="text-4xl font-black text-slate-900 mb-6">₹{eCoinBalance.toFixed(2)}</h3>
            <button 
              onClick={() => onNavigate('buy')}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all"
            >
              Buy More E-Coin
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'profit') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">Today's Profit</h2>
        </div>
        <div className="p-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-10 h-10 text-emerald-600" />
            </div>
            <span className="text-slate-400 text-sm font-bold uppercase tracking-widest block mb-1">Total Profit Today</span>
            <h3 className="text-4xl font-black text-emerald-600 mb-2">₹{todayProfit.toFixed(2)}</h3>
            <p className="text-slate-400 text-xs font-medium">Profit resets every 24 hours</p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'buy_history') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">Buy History</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[8px] font-bold text-slate-400 uppercase block">Total</span>
              <span className="text-xs font-bold text-indigo-600">₹{totalBought.toFixed(0)}</span>
            </div>
            <div className="text-center p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[8px] font-bold text-amber-400 uppercase block">Pending</span>
              <span className="text-xs font-bold text-amber-600">₹{totalPending.toFixed(0)}</span>
            </div>
            <div className="text-center p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[8px] font-bold text-emerald-400 uppercase block">Approved</span>
              <span className="text-xs font-bold text-emerald-600">₹{totalApproved.toFixed(0)}</span>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['Pending', 'Approved', 'Rejected'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setBuyHistoryTab(tab)}
                className={`flex-1 py-2.5 text-[10px] font-bold rounded-lg transition-all ${
                  buyHistoryTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-3">
                  {loadingHistory ? (
                    <div className="flex justify-center py-12">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : buyRequests.filter(r => r.status === buyHistoryTab).length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs italic">No {buyHistoryTab.toLowerCase()} requests found</div>
                  ) : (
                    buyRequests.filter(r => r.status === buyHistoryTab).map(req => (
                      <div key={req.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Order: {req.orderNo}</span>
                            <span className="text-lg font-black text-slate-900">₹{req.amount}</span>
                            <span className="text-[10px] text-slate-400 block mt-1">{new Date(req.createdAt).toLocaleString()}</span>
                          </div>
                          <span className={`text-[8px] font-bold px-2 py-1 rounded-lg uppercase ${
                            req.status === 'Pending' ? 'bg-amber-100 text-amber-600' :
                            req.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                            'bg-rose-100 text-rose-600'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 bg-slate-50 p-2 rounded-lg">
                          {req.utr ? <span>UTR: {req.utr}</span> : <span>UPI ID: {req.userUpiId}</span>}
                        </div>
                        {req.status === 'Pending' && (
                          <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => setView('service')} className="py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">Support</button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'sell_history') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">Sell History</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">Total Sold</span>
            <span className="font-black text-indigo-600 text-xl">₹{totalSold.toFixed(2)}</span>
          </div>
          <div className="space-y-3">
            {loadingHistory ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : sellRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs italic">No sell requests found</div>
            ) : (
              sellRequests.map(req => (
                <div key={req.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{new Date(req.createdAt).toLocaleDateString()}</span>
                    <span className="text-xs font-bold text-slate-700">Withdrawal</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-slate-900 block">₹{req.amount}</span>
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase ${
                      req.status === 'Pending' ? 'bg-amber-100 text-amber-600' :
                      req.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-rose-100 text-rose-600'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'newbie_reward') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">New Reward</h2>
        </div>
        <div className="p-6">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="w-10 h-10" />
            </div>
            <h4 className="font-black text-2xl text-slate-900 mb-2">Newbie Reward</h4>
            <p className="text-slate-500 text-sm font-medium">Complete tasks to claim your bonus!</p>
          </div>

          <div className="space-y-4">
            <button onClick={() => handleTaskClick('telegram')} className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isTelegramJoined ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                  {isTelegramJoined ? <CheckCircle2 className="w-6 h-6" /> : <Send className="w-6 h-6" />}
                </div>
                <div className="text-left">
                  <span className="font-bold block text-sm">Subscribe Channel</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{isTelegramJoined ? 'Completed' : 'Join Telegram'}</span>
                </div>
              </div>
              {!isTelegramJoined && <div className="bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full">GO</div>}
            </button>

            <button onClick={() => handleTaskClick('instagram')} className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isInstagramFollowed ? 'bg-emerald-50 text-emerald-600' : 'bg-pink-50 text-pink-600'}`}>
                  {isInstagramFollowed ? <CheckCircle2 className="w-6 h-6" /> : <Instagram className="w-6 h-6" />}
                </div>
                <div className="text-left">
                  <span className="font-bold block text-sm">Follow Instagram</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{isInstagramFollowed ? 'Completed' : 'Follow Us'}</span>
                </div>
              </div>
              {!isInstagramFollowed && <div className="bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full">GO</div>}
            </button>

            <div className="w-full p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isTransactionCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {isTransactionCompleted ? <CheckCircle2 className="w-6 h-6" /> : <ArrowRightLeft className="w-6 h-6" />}
                  </div>
                  <div className="text-left">
                    <span className="font-bold block text-sm">₹5,000 Total Purchase</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">₹{totalBuyAmount} / ₹5000</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleMenuClick('buy_history')}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-all"
                >
                  View History
                </button>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className={`h-full transition-all duration-500 ${isTransactionCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${Math.min((totalBuyAmount / 5000) * 100, 100)}%` }}></div>
              </div>
            </div>

            <button 
              disabled={!allTasksCompleted || newbieRewardClaimed}
              onClick={handleClaimNewbieReward}
              className={`w-full py-5 rounded-2xl font-black text-base shadow-xl transition-all active:scale-95 mt-4 ${
                newbieRewardClaimed ? 'bg-emerald-100 text-emerald-600' : allTasksCompleted ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-slate-200 text-slate-400'
              }`}
            >
              {newbieRewardClaimed ? 'Reward Claimed' : allTasksCompleted ? `Claim ₹${newbieRewardAmount} Reward` : 'Complete Tasks to Claim'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'tutorial') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">Tutorial</h2>
        </div>
        <div className="p-4 space-y-4">
          {tutorialVideos.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic">No tutorials available</div>
          ) : (
            tutorialVideos.map((video, idx) => (
              <div key={idx} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="aspect-video bg-slate-900 flex items-center justify-center">
                  <PlaySquare className="w-12 h-12 text-white/20" />
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-slate-800">Tutorial Video {idx + 1}</h4>
                  <button onClick={() => window.open(video, '_blank')} className="mt-3 w-full py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold border border-indigo-100">Watch Now</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === 'service') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">Customer Service</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
            <div className="w-16 h-16 bg-teal-50 text-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <HeadphonesIcon className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-slate-900 mb-2">Need Help?</h4>
            <p className="text-slate-500 text-xs mb-6">Our support team is available 24/7 to assist you with any issues.</p>
            <div className="space-y-3">
              {careIds.map((id, idx) => (
                <button 
                  key={idx}
                  onClick={() => window.open(`https://t.me/${id}`, '_blank')}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                  <Send className="w-5 h-5" />
                  Support Agent {idx + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'password') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">Change Password</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-widest ml-1">Current Password</label>
              <input 
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-widest ml-1">New Password</label>
              <input 
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-widest ml-1">Confirm New Password</label>
              <input 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <button 
            disabled={isResetting}
            onClick={handleResetPassword}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-base shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isResetting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'activity') {
    const totalAdded = addedTransactions.reduce((sum, t) => sum + (t.amount || t.total || 0), 0);
    const totalDeducted = deductedTransactions.reduce((sum, t) => sum + (t.amount || t.total || 0), 0);
    const rewardsReceived = transactions.filter(t => t.type === 'Referral' || t.type === 'TeamBonus' || t.type === 'Reward')
      .reduce((sum, t) => sum + (t.amount || t.total || 0), 0);
    const ordersForRewards = buyRequests.length;

    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        {/* Header */}
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">Activity History</h2>
        </div>

        <div className="p-4 flex-1">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Added</span>
              <span className="text-lg font-black text-emerald-600">₹{totalAdded.toFixed(2)}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Deducted</span>
              <span className="text-lg font-black text-rose-600">₹{totalDeducted.toFixed(2)}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Orders for Reward</span>
              <span className="text-lg font-black text-indigo-600">{ordersForRewards}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Rewards Received</span>
              <span className="text-lg font-black text-amber-600">₹{rewardsReceived.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button 
              onClick={() => setActivityTab('Added')}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activityTab === 'Added' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
            >
              Added
            </button>
            <button 
              onClick={() => setActivityTab('Deducted')}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activityTab === 'Deducted' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
            >
              Deducted
            </button>
          </div>

          <div className="space-y-3">
            {(activityTab === 'Added' ? addedTransactions : deductedTransactions).length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <History className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-400 text-sm font-medium">No transactions found</p>
              </div>
            ) : (
              (activityTab === 'Added' ? addedTransactions : deductedTransactions).map((t) => (
                <div key={t.id} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      activityTab === 'Added' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {activityTab === 'Added' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{t.reason || t.type}</h4>
                      <p className="text-xs text-slate-400 font-medium">{new Date(t.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-base font-black ${
                      activityTab === 'Added' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {activityTab === 'Added' ? '+' : '-'}₹{(t.amount || t.total || 0).toFixed(2)}
                    </span>
                    {t.reward > 0 && (
                      <p className="text-[10px] text-emerald-500 font-bold">Incl. ₹{t.reward} Bonus</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-24 bg-slate-50 min-h-screen relative">
      {/* Header */}
      <div className="text-center py-4 font-bold text-slate-900 border-b border-slate-100 bg-white">
        My Profile
      </div>

      <ProfileHeader shortId={shortId} mobile={mobile} copied={copied} setCopied={setCopied} />

      <ProfileMenu menuItems={menuItems} onMenuClick={handleMenuClick} />

      <div className="p-6 mt-12 space-y-3 pb-12">
        {isAdmin && (
          <button 
            onClick={() => onNavigate('admin')}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <ShieldAlert className="w-5 h-5" />
            Admin Panel
          </button>
        )}
        
        <button 
          onClick={onLogout}
          className="w-full py-4 border border-rose-200 bg-rose-50 text-rose-600 rounded-2xl font-bold hover:bg-rose-100 transition-colors shadow-sm active:scale-95 transition-all"
        >
          Logout
        </button>
      </div>

      {/* Modals */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900 capitalize">
                {activeModal.replace('_', ' ')}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-5">
              {activeModal === 'admin_panel' && (
                <div className="text-center py-6">
                  <ShieldAlert className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                  <h4 className="font-bold text-slate-900 mb-2">Admin Dashboard</h4>
                  <p className="text-slate-600 text-sm mb-6">Manage application settings and content.</p>
                  <button 
                    onClick={() => {
                      closeModal();
                      window.location.hash = '#admin';
                    }}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold shadow-md transition-colors"
                  >
                    Go to Admin Page
                  </button>
                </div>
              )}

              {activeModal === 'admin_login' && (
                <div className="space-y-4">
                  <div className="text-center mb-2">
                    <ShieldAlert className="w-10 h-10 text-slate-800 mx-auto mb-2" />
                    <h4 className="font-bold text-slate-900">Admin Access</h4>
                    <p className="text-slate-500 text-xs">Enter the secret code to enable admin mode.</p>
                  </div>
                  <div>
                    <input 
                      type="password" 
                      value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-center font-bold tracking-widest"
                      placeholder="••••••••"
                      autoFocus
                    />
                  </div>
                  <button 
                    onClick={handleAdminLogin}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold shadow-md transition-colors"
                  >
                    Verify Code
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
