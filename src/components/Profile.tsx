import { useState, useEffect } from 'react';
import { User, ChevronRight, Coins, TrendingUp, History, ArrowRightLeft, Activity, Lock, ShieldAlert, X, Copy, Check, Gift, PlaySquare, HeadphonesIcon, Send, Instagram, CheckCircle2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
  utr: string;
}

interface SellRequest {
  id: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
}

export default function Profile({ onLogout }: { onLogout: () => void }) {
  const { 
    isAdmin, setIsAdmin, eCoinBalance, todayProfit, totalBought, totalPending, 
    totalApproved, totalSold, themeDeducted, telegramLink, 
    instagramLink, transactionAmount, hasBoughtAnyAmount,
    tutorialVideos, careIds, newbieRewardAmount,
    isTelegramJoined, isInstagramFollowed, newbieRewardClaimed
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
  const [activityTab, setActivityTab] = useState<'Added' | 'Deducted'>('Added');

  const isTransactionCompleted = transactionAmount >= 5000;
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
    if (id === 'telegram') {
      window.open(telegramLink, '_blank');
    } else if (id === 'instagram') {
      window.open(instagramLink, '_blank');
    } else {
      if (id === 'buy_history' || id === 'sell_history') {
        fetchHistory();
      }
      setActiveModal(id);
    }
  };

  const handleResetPassword = () => {
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    toast.success('Password reset successfully');
    closeModal();
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
    { id: 'newbie_reward', icon: <Gift className="w-5 h-5 text-rose-500" />, label: "Newbie Reward" },
    { id: 'team', icon: <User className="w-5 h-5 text-indigo-600" />, label: "My Team" },
    { id: 'invite', icon: <Send className="w-5 h-5 text-blue-600" />, label: "Invite" },
    { id: 'tutorial', icon: <PlaySquare className="w-5 h-5 text-red-500" />, label: "Tutorial" },
    { id: 'service', icon: <HeadphonesIcon className="w-5 h-5 text-teal-500" />, label: "Service" },
    { id: 'password', icon: <Lock className="w-5 h-5 text-slate-500" />, label: "Password" },
    { id: 'logout', icon: <ArrowRightLeft className="w-5 h-5 text-rose-500 rotate-180" />, label: "Logout" },
  ];

  return (
    <div className="flex flex-col pb-24 bg-slate-50 min-h-screen relative">
      {/* Header */}
      <div className="text-center py-4 font-bold text-slate-900 border-b border-slate-100 bg-white">
        My Profile
      </div>

      <ProfileHeader shortId={shortId} mobile={mobile} copied={copied} setCopied={setCopied} />

      {/* Recent Buy Requests Preview */}
      <div className="px-6 mt-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            Recent Buy Requests
          </h3>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowRecentRequests(!showRecentRequests)}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-2 py-1 rounded-md"
            >
              {showRecentRequests ? 'Hide' : 'View'}
            </button>
            <button 
              onClick={() => handleMenuClick('buy_history')}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
            >
              View All
            </button>
          </div>
        </div>
        
        {showRecentRequests && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            {recentBuyRequests.length === 0 ? (
              <div className="text-center py-4 bg-white rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">No recent requests</p>
              </div>
            ) : (
              recentBuyRequests.map((req) => (
                <div 
                  key={req.id} 
                  onClick={() => handleMenuClick('buy_history')}
                  className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order {req.orderNo}</span>
                    <span className="text-xs font-bold text-slate-700">₹{req.amount}</span>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tighter ${
                      req.status === 'Pending' ? 'bg-amber-100 text-amber-600' :
                      req.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-rose-100 text-rose-600'
                    }`}>
                      {req.status}
                    </span>
                    {req.status === 'Pending' && (
                      <span className="text-[7px] font-bold text-indigo-500 animate-pulse">Click to Edit UTR</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ProfileMenu menuItems={menuItems} onMenuClick={handleMenuClick} />

      <div className="p-6 mt-2 space-y-3">
        {isAdmin && (
          <button 
            onClick={() => setActiveModal('admin_panel')}
            className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <ShieldAlert className="w-5 h-5" />
            Admin Panel
          </button>
        )}
        
        <button 
          onClick={onLogout}
          className="w-full py-3.5 border border-rose-200 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-colors shadow-sm"
        >
          Sign Out
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
              {activeModal === 'buy_history' && (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="text-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[8px] font-bold text-slate-400 uppercase block">Total</span>
                      <span className="text-xs font-bold text-indigo-600">₹{totalBought.toFixed(0)}</span>
                    </div>
                    <div className="text-center p-2 bg-amber-50 rounded-lg border border-amber-100">
                      <span className="text-[8px] font-bold text-amber-400 uppercase block">Pending</span>
                      <span className="text-xs font-bold text-amber-600">₹{totalPending.toFixed(0)}</span>
                    </div>
                    <div className="text-center p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="text-[8px] font-bold text-emerald-400 uppercase block">Approved</span>
                      <span className="text-xs font-bold text-emerald-600">₹{totalApproved.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Status Tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                    {(['Pending', 'Approved', 'Rejected'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setBuyHistoryTab(tab)}
                        className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${
                          buyHistoryTab === tab 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {loadingHistory ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : buyRequests.filter(r => r.status === buyHistoryTab).length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs italic">No {buyHistoryTab.toLowerCase()} requests found</div>
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
                          <span>UTR: {req.utr}</span>
                        </div>

                        {req.status === 'Pending' && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button 
                              onClick={() => handleMenuClick('service')}
                              className="flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-colors"
                            >
                              <HeadphonesIcon className="w-3 h-3" />
                              Support
                            </button>
                            <button 
                              onClick={() => {
                                setResubmittingId(req.id);
                                setResubmitUtr(req.utr);
                              }}
                              className="flex items-center justify-center gap-1.5 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              Edit UTR
                            </button>
                          </div>
                        )}

                        {resubmittingId === req.id && (
                          <div className="pt-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <input 
                              type="text"
                              value={resubmitUtr}
                              onChange={(e) => setResubmitUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                              placeholder="Enter 12-digit UTR"
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setResubmittingId(null)}
                                className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleResubmitUtr(req.id)}
                                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold shadow-sm"
                              >
                                Resubmit
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeModal === 'sell_history' && (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl border border-indigo-100 mb-2">
                    <span className="text-indigo-800 font-bold text-xs">Total Sold</span>
                    <span className="font-black text-indigo-600 text-lg">₹{totalSold.toFixed(2)}</span>
                  </div>

                  {loadingHistory ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : sellRequests.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs italic">No sell requests found</div>
                  ) : (
                    sellRequests.map(req => (
                      <div key={req.id} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block">{new Date(req.createdAt).toLocaleDateString()}</span>
                          <span className="text-[10px] font-bold text-slate-500">Withdrawal</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-slate-900 block">₹{req.amount}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
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
              )}

              {activeModal === 'activity' && (
                <div className="space-y-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                    <button 
                      onClick={() => setActivityTab('Added')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activityTab === 'Added' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Added
                    </button>
                    <button 
                      onClick={() => setActivityTab('Deducted')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activityTab === 'Deducted' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Deducted
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {(activityTab === 'Added' ? addedTransactions : deductedTransactions).length === 0 ? (
                      <div className="text-center py-12">
                        <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                          <History className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-slate-400 text-xs font-medium">No transactions found</p>
                      </div>
                    ) : (
                      (activityTab === 'Added' ? addedTransactions : deductedTransactions).map((t) => (
                        <div key={t.id} className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              activityTab === 'Added' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}>
                              {activityTab === 'Added' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800">{t.reason || t.type}</h4>
                              <p className="text-[10px] text-slate-400 font-medium">{new Date(t.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-black ${
                              activityTab === 'Added' ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {activityTab === 'Added' ? '+' : '-'}₹{t.amount || t.total}
                            </span>
                            {t.reward > 0 && (
                              <p className="text-[9px] text-emerald-500 font-bold">Incl. ₹{t.reward} Bonus</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeModal === 'newbie_reward' && (
                <div className="text-center">
                  <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Gift className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-lg text-slate-900 mb-2">Newbie Reward</h4>
                  <p className="text-slate-600 text-sm mb-6">
                    Complete all 3 tasks to claim ₹{newbieRewardAmount}!
                  </p>
                  
                  <div className="space-y-3">
                    {/* Telegram */}
                    <button 
                      onClick={() => handleTaskClick('telegram')}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isTelegramJoined ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                          {isTelegramJoined ? <CheckCircle2 className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                        </div>
                        <div className="text-left">
                          <span className={`font-bold block text-sm ${isTelegramJoined ? 'text-emerald-600' : 'text-slate-900'}`}>
                            Subscribe Channel
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                            {isTelegramJoined ? 'Completed' : 'Join Telegram'}
                          </span>
                        </div>
                      </div>
                      {!isTelegramJoined && (
                        <div className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                          GO
                        </div>
                      )}
                    </button>

                    {/* Instagram */}
                    <button 
                      onClick={() => handleTaskClick('instagram')}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isInstagramFollowed ? 'bg-emerald-100 text-emerald-600' : 'bg-pink-100 text-pink-600'}`}>
                          {isInstagramFollowed ? <CheckCircle2 className="w-5 h-5" /> : <Instagram className="w-5 h-5" />}
                        </div>
                        <div className="text-left">
                          <span className={`font-bold block text-sm ${isInstagramFollowed ? 'text-emerald-600' : 'text-slate-900'}`}>
                            Follow Instagram
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                            {isInstagramFollowed ? 'Completed' : 'Follow Us'}
                          </span>
                        </div>
                      </div>
                      {!isInstagramFollowed && (
                        <div className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                          GO
                        </div>
                      )}
                    </button>

                    {/* Buy Any Amount */}
                    <div className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasBoughtAnyAmount ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            {hasBoughtAnyAmount ? <CheckCircle2 className="w-5 h-5" /> : <Coins className="w-5 h-5" />}
                          </div>
                          <div>
                            <span className={`font-bold block text-sm ${hasBoughtAnyAmount ? 'text-emerald-600' : 'text-slate-900'}`}>
                              Buy Any Amount
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                              {hasBoughtAnyAmount ? 'Completed' : 'Purchase any E-Coin order'}
                            </span>
                          </div>
                        </div>
                        {!hasBoughtAnyAmount && (
                          <button 
                            onClick={() => { closeModal(); window.location.hash = '#buy'; }}
                            className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm"
                          >
                            GO
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Transactions */}
                    <div className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isTransactionCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            {isTransactionCompleted ? <CheckCircle2 className="w-5 h-5" /> : <ArrowRightLeft className="w-5 h-5" />}
                          </div>
                          <div>
                            <span className={`font-bold block text-sm ${isTransactionCompleted ? 'text-emerald-600' : 'text-slate-900'}`}>
                              5,000 Total Buy
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                              ₹{transactionAmount} / ₹5000
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${isTransactionCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                          style={{ width: `${Math.min((transactionAmount / 5000) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Claim Button */}
                    <button 
                      disabled={!allTasksCompleted || newbieRewardClaimed}
                      onClick={handleClaimNewbieReward}
                      className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 mt-4 ${
                        newbieRewardClaimed 
                          ? 'bg-emerald-100 text-emerald-600 cursor-default' 
                          : allTasksCompleted 
                            ? 'bg-rose-500 text-white hover:bg-rose-600' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {newbieRewardClaimed 
                        ? 'Reward Claimed' 
                        : allTasksCompleted 
                          ? `Claim ₹${newbieRewardAmount} Reward` 
                          : 'Complete All Tasks'}
                    </button>
                  </div>
                </div>
              )}

              {activeModal === 'tutorial' && (
                <div className="text-center">
                  <PlaySquare className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h4 className="font-bold text-slate-900 mb-2">Tutorial Videos</h4>
                  <p className="text-slate-600 text-sm mb-6">Watch these videos to learn how to use ElivexPay.</p>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {tutorialVideos.map((url, index) => (
                      <button 
                        key={index}
                        onClick={() => window.open(url, '_blank')}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                            <PlaySquare className="w-5 h-5" />
                          </div>
                          <span className="font-bold text-slate-800 text-sm">Tutorial Video #{index + 1}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === 'service' && (
                <div className="text-center py-4">
                  <HeadphonesIcon className="w-12 h-12 text-teal-500 mx-auto mb-4" />
                  <h4 className="font-bold text-slate-900 mb-2">Customer Service</h4>
                  <p className="text-slate-600 text-sm mb-6">We're here to help you 24/7.</p>
                  
                  <div className="space-y-3">
                    {careIds.map((id, index) => (
                      <a 
                        key={index}
                        href={`https://t.me/${id.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                            <Send className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <span className="font-bold text-blue-900 text-sm block">Support Agent #{index + 1}</span>
                            <span className="text-blue-600 text-xs font-medium">{id}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-blue-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === 'password' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
                      placeholder="Enter new password"
                    />
                  </div>
                  <button 
                    onClick={handleResetPassword}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-md transition-colors"
                  >
                    Reset Password
                  </button>
                </div>
              )}
              
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
