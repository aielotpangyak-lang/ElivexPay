import { useState, useEffect } from 'react';
import { User, ChevronRight, Coins, TrendingUp, History, ArrowRightLeft, Activity, Lock, ShieldAlert, X, Copy, Check, Gift, PlaySquare, HeadphonesIcon, Send, Instagram, CheckCircle2, ArrowUpRight, ArrowDownRight, Loader2, Bell, Share2, Users, Zap, Clock, ShieldCheck, AtSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, setDoc, limit, onSnapshot, writeBatch, increment } from 'firebase/firestore';
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
    isTelegramJoined, setIsTelegramJoined, isInstagramFollowed, setIsInstagramFollowed,
    isVipJoined, setIsVipJoined, isUpiLinked, setIsUpiLinked,
    accountHolderName, setAccountHolderName, upiId, setUpiId,
    bankName, setBankName, bankAccNo, setBankAccNo, bankIfsc, setBankIfsc,
    newbieRewardClaimed, setNewbieRewardClaimed,
    todayTeamCommission, dailyBonusClaimedDate, shortId, mobile
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
  const [view, setView] = useState<'main' | 'activity' | 'ecoin' | 'profit' | 'buy_history' | 'sell_history' | 'newbie_reward' | 'tutorial' | 'service' | 'password' | 'notifications' | 'link_account'>('main');
  const [activityTab, setActivityTab] = useState<'Added' | 'Deducted'>('Added');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSubmittingScreenshot, setIsSubmittingScreenshot] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkForm, setLinkForm] = useState({
    accountHolderName: '',
    upiId: '',
    bankName: '',
    bankAccNo: '',
    bankIfsc: ''
  });

  useEffect(() => {
    setLinkForm({
      accountHolderName: accountHolderName || '',
      upiId: upiId || '',
      bankName: bankName || '',
      bankAccNo: bankAccNo || '',
      bankIfsc: bankIfsc || ''
    });
  }, [accountHolderName, upiId, bankName, bankAccNo, bankIfsc]);

  const handleLinkAccount = async () => {
    if (!auth.currentUser) return;
    if (!linkForm.accountHolderName) {
      toast.error('Account holder name is required');
      return;
    }
    if (!linkForm.upiId && (!linkForm.bankName || !linkForm.bankAccNo || !linkForm.bankIfsc)) {
      toast.error('Please provide either UPI ID or complete Bank Details');
      return;
    }

    setIsLinking(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const updateData = {
        accountHolderName: linkForm.accountHolderName,
        upiId: linkForm.upiId,
        bankName: linkForm.bankName,
        bankAccNo: linkForm.bankAccNo,
        bankIfsc: linkForm.bankIfsc,
        isUpiLinked: true
      };
      await updateDoc(userRef, updateData);
      
      setAccountHolderName(linkForm.accountHolderName);
      setUpiId(linkForm.upiId);
      setBankName(linkForm.bankName);
      setBankAccNo(linkForm.bankAccNo);
      setBankIfsc(linkForm.bankIfsc);
      setIsUpiLinked(true);
      
      toast.success('Account linked successfully!');
      setView('main');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    } finally {
      setIsLinking(false);
    }
  };

  const isTransactionCompleted = totalBuyAmount >= 5000;
  const allTasksCompleted = isTelegramJoined && isVipJoined && isTransactionCompleted;

  const handleTaskClick = async (type: 'telegram' | 'instagram' | 'upi' | 'tutorial' | 'vip' | 'screenshot') => {
    if (!auth.currentUser) return;
    
    if (type === 'telegram') {
      window.open(telegramLink, '_blank');
      if (!isTelegramJoined) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { telegramJoined: true });
          setIsTelegramJoined(true);
          toast.success('Telegram task completed!', {
            icon: <Send className="w-5 h-5 text-blue-500" />
          });
        } catch (e) { 
          handleFirestoreError(e, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
        }
      }
    } else if (type === 'instagram') {
      window.open(instagramLink, '_blank');
      if (!isInstagramFollowed) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { instagramFollowed: true });
          setIsInstagramFollowed(true);
          toast.success('Instagram task completed!', {
            icon: <Instagram className="w-5 h-5 text-pink-500" />
          });
        } catch (e) { 
          handleFirestoreError(e, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
        }
      }
    } else if (type === 'vip') {
      window.open(telegramLink, '_blank');
      if (!isVipJoined) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { isVipJoined: true });
          setIsVipJoined(true);
          toast.success('VIP Group task completed!', {
            icon: <Users className="w-5 h-5 text-indigo-500" />
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
        }
      }
    } else if (type === 'upi') {
      onNavigate('upi');
    }
  };

  const handleScreenshotSubmit = async () => {
    if (!auth.currentUser || !screenshotPreview) return;
    setIsSubmittingScreenshot(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { isScreenshotSubmitted: true });
      useAppStore.getState().setIsScreenshotSubmitted(true);
      toast.success('Screenshot submitted for review!');
      setShowScreenshotModal(false);
      setScreenshotPreview(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    } finally {
      setIsSubmittingScreenshot(false);
    }
  };

  const handleTransfer = async () => {
    if (!auth.currentUser) return;
    const amount = Number(transferAmount);
    if (!amount || amount < 200) {
      toast.error('Minimum transfer amount is ₹200');
      return;
    }
    if (amount > eCoinBalance) {
      toast.error('Insufficient balance');
      return;
    }
    if (!transferUserId) {
      toast.error('Enter friend\'s User ID');
      return;
    }

    setIsTransferring(true);
    try {
      const commission = amount * 0.20;
      const totalDeduction = amount + commission;
      
      if (totalDeduction > eCoinBalance) {
        toast.error('Insufficient balance for amount + 20% fee');
        setIsTransferring(false);
        return;
      }

      // Find recipient
      const shortIdQuery = query(collection(db, 'users'), where('shortId', '==', transferUserId.toLowerCase()));
      const shortIdSnapshot = await getDocs(shortIdQuery);
      
      let recipientId = '';
      if (!shortIdSnapshot.empty) {
        recipientId = shortIdSnapshot.docs[0].id;
      } else {
        const uidDoc = await getDoc(doc(db, 'users', transferUserId));
        if (uidDoc.exists()) {
          recipientId = transferUserId;
        }
      }

      if (!recipientId) {
        toast.error('Recipient not found');
        setIsTransferring(false);
        return;
      }

      if (recipientId === auth.currentUser.uid) {
        toast.error('Cannot transfer to yourself');
        setIsTransferring(false);
        return;
      }

      const batch = writeBatch(db);
      
      // Deduct from sender (amount + 20% fee)
      batch.update(doc(db, 'users', auth.currentUser.uid), {
        eCoinBalance: increment(-totalDeduction)
      });

      // Add to recipient (full amount)
      batch.update(doc(db, 'users', recipientId), {
        eCoinBalance: increment(amount)
      });

      // Record transactions
      const senderTransRef = doc(collection(db, 'transactions'));
      batch.set(senderTransRef, {
        userId: auth.currentUser.uid,
        amount: totalDeduction,
        type: 'Transfer Out',
        status: 'Completed',
        reason: `Transfer to ${transferUserId} (₹${amount} + ₹${commission} fee)`,
        createdAt: new Date().toISOString()
      });

      const recipientTransRef = doc(collection(db, 'transactions'));
      batch.set(recipientTransRef, {
        userId: recipientId,
        amount: amount,
        type: 'Transfer In',
        status: 'Completed',
        reason: `Transfer from User_${shortId || auth.currentUser.uid.slice(0,6)}`,
        createdAt: new Date().toISOString()
      });

      await batch.commit();
      toast.success(`Transferred ₹${amount.toFixed(2)} to ${transferUserId}`);
      setShowTransferModal(false);
      setTransferAmount('');
      setTransferUserId('');
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error('Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [adminCode, setAdminCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        const userId = auth.currentUser.uid;
        try {
          const userRef = doc(db, 'users', userId);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            let currentShortId = data.shortId;

            // Update store with payment details
            setAccountHolderName(data.accountHolderName || '');
            setUpiId(data.upiId || '');
            setBankName(data.bankName || '');
            setBankAccNo(data.bankAccNo || '');
            setBankIfsc(data.bankIfsc || '');
            setIsUpiLinked(data.isUpiLinked || false);

            if (!currentShortId) {
              const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
              currentShortId = '';
              for (let i = 0; i < 6; i++) {
                currentShortId += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              await updateDoc(userRef, { shortId: currentShortId });
              await setDoc(doc(db, 'short_ids', currentShortId.toLowerCase()), { uid: userId, shortId: currentShortId.toLowerCase() });
            }
            
            const buyQ = query(
              collection(db, 'buy_requests'),
              where('userId', '==', userId),
              orderBy('createdAt', 'desc'),
              limit(3)
            );
            const buySnapshot = await getDocs(buyQ);
            setRecentBuyRequests(buySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BuyRequest[]);

            const transQ = query(
              collection(db, 'transactions'),
              where('userId', '==', userId),
              orderBy('createdAt', 'desc'),
              limit(50)
            );
            const transSnapshot = await getDocs(transQ);
            setTransactions(transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };
    fetchUserData();
  }, [auth.currentUser, view]);

  const fetchHistory = async () => {
    if (!auth.currentUser) return;
    setLoadingHistory(true);
    try {
      const buyQ = query(
        collection(db, 'buy_requests'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const buySnapshot = await getDocs(buyQ);
      setBuyRequests(buySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BuyRequest[]);

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

  const [activeAutoOrder, setActiveAutoOrder] = useState<any>(null);
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'sell_requests'),
      where('userId', '==', auth.currentUser.uid),
      where('isAutoSell', '==', true),
      where('status', '==', 'Pending'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveAutoOrder({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setActiveAutoOrder(null);
      }
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });
    return () => unsubscribe();
  }, []);

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
        toast.error('Invalid old password');
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
    if (!auth.currentUser || !allTasksCompleted || newbieRewardClaimed || isClaiming) return;
    
    setIsClaiming(true);
    const userId = auth.currentUser.uid;
    const userRef = doc(db, 'users', userId);
    
    try {
      const batch = writeBatch(db);
      batch.update(userRef, {
        eCoinBalance: increment(newbieRewardAmount),
        newbieRewardClaimed: true,
        newbieBonusCompleted: true
      });

      const transRef = doc(collection(db, 'transactions'));
      batch.set(transRef, {
        userId,
        amount: newbieRewardAmount,
        type: 'Reward',
        status: 'Completed',
        reason: 'Newbie Welcome Bonus',
        createdAt: new Date().toISOString()
      });

      await batch.commit();
      toast.success(`₹${newbieRewardAmount} Reward claimed successfully!`);
    } catch (error) {
      console.error('Claim reward error:', error);
      toast.error('Failed to claim reward');
    } finally {
      setIsClaiming(false);
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

  const closeModal = () => {
    setActiveModal(null);
    setAdminCode('');
    setResubmittingId(null);
    setResubmitUtr('');
  };

  const menuItems = [
    { id: 'ecoin', icon: <Coins className="w-5 h-5 text-blue-600" />, label: "E-Coin", value: eCoinBalance.toFixed(2) },
    { id: 'profit', icon: <TrendingUp className="w-5 h-5 text-emerald-500" />, label: "Today Profit", value: todayProfit.toFixed(2) },
    { id: 'buy_history', icon: <History className="w-5 h-5 text-blue-500" />, label: "Buy History" },
    { id: 'sell_history', icon: <ArrowRightLeft className="w-5 h-5 text-orange-500" />, label: "Sell History" },
    { id: 'activity', icon: <Activity className="w-5 h-5 text-purple-500" />, label: "Activity" },
    { id: 'link_account', icon: <ShieldCheck className="w-5 h-5 text-indigo-500" />, label: "Link Account" },
    { id: 'newbie_reward', icon: <Gift className="w-5 h-5 text-rose-500" />, label: "Newbie Bonus" },
    { id: 'team', icon: <User className="w-5 h-5 text-blue-700" />, label: "My Team" },
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
          <h2 className="font-bold text-slate-900 text-lg">E-Coin Wallet</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-indigo-100/50 border border-slate-100 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
            <div className="relative z-10">
              <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-indigo-100">
                <Coins className="w-10 h-10 text-indigo-600" />
              </div>
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] block mb-2">Available Balance</span>
              <h3 className={`text-5xl font-black mb-8 tracking-tighter ${eCoinBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                ₹{eCoinBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => onNavigate('buy')} className="py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                  RECHARGE
                </button>
                <button onClick={() => setShowTransferModal(true)} className="py-4 bg-white text-slate-900 border-2 border-slate-100 rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  TRANSFER
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              Wallet Insights
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-sm font-bold text-slate-600">Total Sold</span>
                <span className="text-lg font-black text-slate-900">₹{totalSold.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-sm font-bold text-slate-600">Today Profit</span>
                <span className="text-lg font-black text-emerald-600">₹{todayProfit.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {activeAutoOrder && (
            <div className="bg-indigo-900 p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 blur-2xl"></div>
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
                    <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm tracking-tight">Auto-Sell Processing</h4>
                    <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider">Order ID: {activeAutoOrder.id.slice(-6)}</p>
                  </div>
                </div>
                <span className="text-white font-black text-lg tracking-tighter">₹{activeAutoOrder.amount}</span>
              </div>
            </div>
          )}

          {showTransferModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Transfer Funds</h3>
                    <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                  </div>
                  <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 mb-8">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-indigo-600 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-indigo-900 uppercase tracking-wider mb-1">Transfer Policy</p>
                        <p className="text-[10px] font-bold text-indigo-600 leading-relaxed">A 20% security fee applies. Minimum transfer is ₹200. Recipient receives full amount.</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Recipient User ID</label>
                      <input type="text" value={transferUserId} onChange={(e) => setTransferUserId(e.target.value)} placeholder="Enter 6-char ID or UID" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Amount to Transfer (₹)</label>
                      <input type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="Min ₹200" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-black text-xl outline-none transition-all" />
                      {Number(transferAmount) >= 200 && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span>Service Fee (20%)</span>
                            <span>₹{(Number(transferAmount) * 0.2).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-black text-indigo-600">
                            <span>Total Deduction</span>
                            <span>₹{(Number(transferAmount) * 1.2).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <button disabled={isTransferring} onClick={handleTransfer} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-3">
                      {isTransferring ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          CONFIRM TRANSFER
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
          <h2 className="font-bold text-slate-900 text-lg">Sale History</h2>
        </div>
        <div className="p-4 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Sold</span>
                  <span className="text-xl font-black text-slate-900 tracking-tight">₹{totalSold.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Recent Transactions</h3>
            {loadingHistory ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
            ) : sellRequests.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 font-bold">No sale history found</p>
              </div>
            ) : (
              sellRequests.map(req => (
                <div key={req.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${
                    req.status === 'Approved' ? 'bg-emerald-500' : 
                    req.status === 'Rejected' ? 'bg-rose-500' : 'bg-amber-500'
                  }`}></div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {(req as any).isAutoSell ? 'Auto Sale' : 'Manual Sale'}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          req.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                          req.status === 'Rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(req.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-slate-900 tracking-tighter">₹{req.amount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-[10px] font-bold text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Transaction ID: {req.id.slice(-12).toUpperCase()}</span>
                    </div>
                    {(req as any).accountDetails && (
                      <div className="flex items-center gap-2 text-indigo-600">
                        <AtSign className="w-3 h-3" />
                        <span>
                          {(req as any).accountDetails.method === 'UPI' 
                            ? `UPI: ${(req as any).accountDetails.upiId}`
                            : `Bank: ${(req as any).accountDetails.bankName} (${(req as any).accountDetails.bankAccNo})`}
                        </span>
                      </div>
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

  if (view === 'link_account') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">Link Payment Account</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">Secure Linking</h3>
                <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-wider">Your details are encrypted and safe</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Account Holder Name</label>
              <input 
                type="text" 
                value={linkForm.accountHolderName} 
                onChange={(e) => setLinkForm({...linkForm, accountHolderName: e.target.value})} 
                placeholder="Enter full name" 
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
            </div>

            <div className="pt-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-[1px] flex-1 bg-slate-200"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UPI Details</span>
                <div className="h-[1px] flex-1 bg-slate-200"></div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">UPI ID</label>
                <input 
                  type="text" 
                  value={linkForm.upiId} 
                  onChange={(e) => setLinkForm({...linkForm, upiId: e.target.value})} 
                  placeholder="example@upi" 
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-[1px] flex-1 bg-slate-200"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Details</span>
                <div className="h-[1px] flex-1 bg-slate-200"></div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Bank Name</label>
                  <input 
                    type="text" 
                    value={linkForm.bankName} 
                    onChange={(e) => setLinkForm({...linkForm, bankName: e.target.value})} 
                    placeholder="e.g. HDFC Bank" 
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Account Number</label>
                  <input 
                    type="text" 
                    value={linkForm.bankAccNo} 
                    onChange={(e) => setLinkForm({...linkForm, bankAccNo: e.target.value})} 
                    placeholder="Enter account number" 
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">IFSC Code</label>
                  <input 
                    type="text" 
                    value={linkForm.bankIfsc} 
                    onChange={(e) => setLinkForm({...linkForm, bankIfsc: e.target.value})} 
                    placeholder="Enter IFSC code" 
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
              </div>
            </div>
          </div>

          <button 
            disabled={isLinking} 
            onClick={handleLinkAccount} 
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-base shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isLinking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Link Account'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'newbie_reward') {
    const purchaseProgress = Math.min((totalBuyAmount / 5000) * 100, 100);
    const tasks = [
      { id: 'telegram', icon: <Send className="w-5 h-5" />, label: "Subscribe to Telegram Channel", completed: isTelegramJoined, color: "bg-blue-50 text-blue-600" },
      { id: 'vip', icon: <Users className="w-5 h-5" />, label: "Join our VIP Group", completed: isVipJoined, color: "bg-indigo-50 text-indigo-600" },
      { id: 'purchase', icon: <TrendingUp className="w-5 h-5" />, label: "Purchase for ₹5000", completed: isTransactionCompleted, color: "bg-amber-50 text-amber-600", progress: purchaseProgress },
    ];

    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2"><X className="w-6 h-6 text-slate-500" /></button>
          <h2 className="font-bold text-slate-900 text-lg">Newbie Rewards</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="relative z-10">
              <Gift className="w-12 h-12 mb-4 text-indigo-200" />
              <h3 className="text-3xl font-black mb-2">₹{newbieRewardAmount}</h3>
              <p className="text-indigo-100 text-sm font-bold opacity-90">Complete all tasks to claim your welcome bonus!</p>
            </div>
          </div>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${task.color}`}>{task.icon}</div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{task.label}</h4>
                    {task.progress !== undefined && (
                      <div className="mt-2 w-32">
                        <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase mb-1"><span>Progress</span><span>{task.progress.toFixed(0)}%</span></div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${task.progress}%` }}></div></div>
                      </div>
                    )}
                  </div>
                </div>
                {task.completed ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : (
                  <button 
                    onClick={() => handleTaskClick(task.id as any)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all"
                  >Go</button>
                )}
              </div>
            ))}
          </div>
          <button disabled={!allTasksCompleted || newbieRewardClaimed || isClaiming} onClick={handleClaimNewbieReward} className={`w-full py-5 rounded-2xl font-black text-base shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${newbieRewardClaimed ? 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed' : allTasksCompleted ? 'bg-blue-600 text-white shadow-blue-100' : 'bg-slate-800 text-white/50 shadow-none'}`}>
            {isClaiming ? <Loader2 className="w-5 h-5 animate-spin" /> : newbieRewardClaimed ? 'ALREADY RECEIVED' : 'RECEIVE REWARD'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'profit') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2"><X className="w-6 h-6 text-slate-500" /></button>
          <h2 className="font-bold text-slate-900 text-lg">Today's Profit</h2>
        </div>
        <div className="p-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><TrendingUp className="w-8 h-8" /></div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest block mb-1">Today's Earnings</span>
            <h3 className="text-4xl font-black text-slate-900 mb-6">₹{todayProfit.toFixed(2)}</h3>
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Team Commission</span>
                <span className="text-lg font-black text-indigo-600">₹{todayTeamCommission.toFixed(2)}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Theme Deducted</span>
                <span className="text-lg font-black text-rose-600">₹{themeDeducted.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'buy_history') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2"><X className="w-6 h-6 text-slate-500" /></button>
          <h2 className="font-bold text-slate-900 text-lg">Buy History</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-3 bg-white rounded-2xl border border-slate-100 shadow-sm"><span className="text-[8px] font-bold text-slate-400 uppercase block">Total</span><span className="text-xs font-bold text-indigo-600">₹{totalBought.toFixed(0)}</span></div>
            <div className="text-center p-3 bg-white rounded-2xl border border-slate-100 shadow-sm"><span className="text-[8px] font-bold text-amber-400 uppercase block">Pending</span><span className="text-xs font-bold text-amber-600">₹{totalPending.toFixed(0)}</span></div>
            <div className="text-center p-3 bg-white rounded-2xl border border-slate-100 shadow-sm"><span className="text-[8px] font-bold text-emerald-400 uppercase block">Approved</span><span className="text-xs font-bold text-emerald-600">₹{totalApproved.toFixed(0)}</span></div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['Pending', 'Approved', 'Rejected'] as const).map((tab) => (
              <button key={tab} onClick={() => setBuyHistoryTab(tab)} className={`flex-1 py-2.5 text-[10px] font-bold rounded-lg transition-all ${buyHistoryTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{tab}</button>
            ))}
          </div>
          <div className="space-y-3">
            {loadingHistory ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div> : buyRequests.filter(r => r.status === buyHistoryTab).length === 0 ? <div className="text-center py-12 text-slate-400 text-xs italic">No {buyHistoryTab.toLowerCase()} requests found</div> : buyRequests.filter(r => r.status === buyHistoryTab).map(req => (
              <div key={req.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div><span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Order: {req.orderNo}</span><span className="text-lg font-black text-slate-900">₹{req.amount}</span><span className="text-[10px] text-slate-400 block mt-1">{new Date(req.createdAt).toLocaleString()}</span></div>
                  <span className={`text-[8px] font-bold px-2 py-1 rounded-lg uppercase ${req.status === 'Pending' ? 'bg-amber-100 text-amber-600' : req.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{req.status}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 bg-slate-50 p-2 rounded-lg">{req.utr ? <span>UTR: {req.utr}</span> : <span>UPI ID: {req.userUpiId}</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'activity') {
    const totalAdded = transactions.filter(t => ['Added', 'Transfer In', 'Reward', 'Referral', 'TeamBonus'].includes(t.type)).reduce((sum, t) => sum + (t.amount || t.total || 0), 0);
    const totalDeducted = transactions.filter(t => ['Deducted', 'Transfer Out', 'Withdrawal'].includes(t.type)).reduce((sum, t) => sum + (t.amount || t.total || 0), 0);
    const addedTransactions = transactions.filter(t => ['Added', 'Transfer In', 'Reward', 'Referral', 'TeamBonus'].includes(t.type));
    const deductedTransactions = transactions.filter(t => ['Deducted', 'Transfer Out', 'Withdrawal'].includes(t.type));

    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2"><X className="w-6 h-6 text-slate-500" /></button>
          <h2 className="font-bold text-slate-900 text-lg">Activity History</h2>
        </div>
        <div className="p-4 flex-1">
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Added</span><span className="text-lg font-black text-emerald-600">₹{totalAdded.toFixed(2)}</span></div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Deducted</span><span className="text-lg font-black text-rose-600">₹{totalDeducted.toFixed(2)}</span></div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button onClick={() => setActivityTab('Added')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activityTab === 'Added' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Added</button>
            <button onClick={() => setActivityTab('Deducted')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activityTab === 'Deducted' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>Deducted</button>
          </div>
          <div className="space-y-3">
            {(activityTab === 'Added' ? addedTransactions : deductedTransactions).length === 0 ? <div className="text-center py-12 text-slate-400 text-sm font-medium">No transactions found</div> : (activityTab === 'Added' ? addedTransactions : deductedTransactions).map((t) => (
              <div key={t.id} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${activityTab === 'Added' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{activityTab === 'Added' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}</div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 tracking-tight">
                      {t.type === 'Added' ? 'Added' : t.type === 'Deducted' ? 'Deducted' : (t.reason || t.type)}
                    </h4>
                    {t.reason && t.reason !== t.type && (
                      <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider mt-0.5">
                        Note: {t.reason}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      {new Date(t.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right"><span className={`text-base font-black ${activityTab === 'Added' ? 'text-emerald-600' : 'text-rose-600'}`}>{activityTab === 'Added' ? '+' : '-'}₹{(t.amount || t.total || 0).toFixed(2)}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'notifications') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2"><X className="w-6 h-6 text-slate-500" /></button>
          <h2 className="font-bold text-slate-900 text-lg">System Notifications</h2>
        </div>
        <div className="p-4 space-y-3">
          {notifications.length === 0 ? <div className="text-center py-12 text-slate-400 italic text-xs">No notifications yet</div> : notifications.map((notif) => (
            <div key={notif.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-2">
              <div className="flex justify-between items-start"><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">System Alert</span><span className="text-[8px] font-bold text-slate-400">{new Date(notif.createdAt).toLocaleString()}</span></div>
              <p className="text-xs font-bold text-slate-700 leading-relaxed">{notif.message}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'service') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2"><X className="w-6 h-6 text-slate-500" /></button>
          <h2 className="font-bold text-slate-900 text-lg">Customer Service</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
            <div className="w-16 h-16 bg-teal-50 text-teal-500 rounded-full flex items-center justify-center mx-auto mb-4"><HeadphonesIcon className="w-8 h-8" /></div>
            <h4 className="font-bold text-slate-900 mb-2">Need Help?</h4>
            <p className="text-slate-500 text-xs mb-6">Our support team is available 24/7 to assist you with any issues.</p>
            <div className="space-y-3">
              {careIds.map((id, idx) => (
                <button key={idx} onClick={() => window.open(`https://t.me/${id}`, '_blank')} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"><Send className="w-5 h-5" />Support Agent {idx + 1}</button>
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
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2"><X className="w-6 h-6 text-slate-500" /></button>
          <h2 className="font-bold text-slate-900 text-lg">Change Password</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div><label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-widest ml-1">Current Password</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
            <div><label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-widest ml-1">New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
            <div><label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-widest ml-1">Confirm New Password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
          </div>
          <button disabled={isResetting} onClick={handleResetPassword} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-base shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2">{isResetting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-24 bg-slate-50 min-h-screen relative">
      <div className="text-center py-4 font-bold text-slate-900 border-b border-slate-100 bg-white">My Profile</div>
      <ProfileHeader shortId={shortId} mobile={mobile} copied={copied} setCopied={setCopied} />
      <ProfileMenu menuItems={menuItems} onMenuClick={handleMenuClick} />
      <div className="p-6 mt-12 space-y-3 pb-12">
        {isAdmin && (
          <button onClick={() => onNavigate('admin')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-md"><ShieldAlert className="w-5 h-5" />Admin Panel</button>
        )}
        <button onClick={onLogout} className="w-full py-4 border border-rose-200 bg-rose-50 text-rose-600 rounded-2xl font-bold hover:bg-rose-100 transition-colors shadow-sm active:scale-95 transition-all">Logout</button>
      </div>
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900 capitalize">{activeModal.replace('_', ' ')}</h3>
              <button onClick={closeModal} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-5">
              {activeModal === 'admin_panel' && (
                <div className="text-center py-6">
                  <ShieldAlert className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                  <h4 className="font-bold text-slate-900 mb-2">Admin Dashboard</h4>
                  <p className="text-slate-600 text-sm mb-6">Manage application settings and content.</p>
                  <button onClick={() => { closeModal(); window.location.hash = '#admin'; }} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold shadow-md transition-colors">Go to Admin Page</button>
                </div>
              )}
              {activeModal === 'admin_login' && (
                <div className="space-y-4">
                  <div className="text-center mb-2"><ShieldAlert className="w-10 h-10 text-slate-800 mx-auto mb-2" /><h4 className="font-bold text-slate-900">Admin Access</h4><p className="text-slate-500 text-xs">Enter the secret code to enable admin mode.</p></div>
                  <div><input type="password" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-center font-bold tracking-widest" placeholder="••••••••" autoFocus /></div>
                  <button onClick={handleAdminLogin} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold shadow-md transition-colors">Verify Code</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
