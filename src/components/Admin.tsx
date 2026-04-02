import { useState, useEffect } from 'react';
import { 
  ShieldAlert, Save, LogOut, ArrowLeft, Users, CheckCircle2, XCircle, 
  Clock, Search, UserPlus, UserMinus, Wallet, Phone, User as UserIcon,
  ChevronRight, ChevronDown, Filter, ArrowUpDown, RefreshCcw, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  collection, getDocs, updateDoc, doc, query, where, orderBy, 
  getDoc, onSnapshot, Timestamp, increment, addDoc, deleteDoc, setDoc, runTransaction
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAppStore } from '../store';
import { OperationType, handleFirestoreError } from '../lib/firestoreErrorHandler';

interface UserData {
  id: string;
  uid: string;
  shortId?: string;
  mobile: string;
  role: string;
  eCoinBalance: number;
  createdAt: string;
}

interface SellRequest {
  id: string;
  userId: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  accountDetails: any;
  userNumericId?: string;
}

interface BuyOrder {
  id: string;
  orderNo: string;
  price: number;
  reward: number;
  itoken: number;
  type: 'UPI' | 'Bank';
  upiId?: string;
  bankName?: string;
  bankAccNo?: string;
  bankIfsc?: string;
  payeeName?: string;
  status: 'Available' | 'Sold' | 'Processing';
  createdAt: string;
}

interface BuyRequest {
  id: string;
  userId: string;
  orderId: string;
  orderNo: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  userNumericId?: string;
  utr?: string;
}

export default function Admin({ onBack }: { onBack: () => void }) {
  const { 
    newsText, setNewsText, 
    csrTelegramId, setCsrTelegramId, 
    telegramLink, setTelegramLink, 
    instagramLink, setInstagramLink, 
    tutorialVideoUrl, setTutorialVideoUrl,
    tutorialVideos, setTutorialVideos,
    banners, setBanners,
    careIds, setCareIds,
    newbieRewardAmount, setNewbieRewardAmount,
    setIsAdmin, refundEcoin
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'settings' | 'users' | 'sales' | 'buy_orders' | 'buy_requests'>('settings');
  const [requestFilter, setRequestFilter] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [users, setUsers] = useState<UserData[]>([]);
  const [sellRequests, setSellRequests] = useState<SellRequest[]>([]);
  const [buyOrders, setBuyOrders] = useState<BuyOrder[]>([]);
  const [buyRequests, setBuyRequests] = useState<BuyRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Balance Modal State
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');

  // New Order Form State
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<BuyOrder | null>(null);
  const [newOrder, setNewOrder] = useState<Partial<BuyOrder>>({
    type: 'UPI',
    price: 100,
    status: 'Available',
    payeeName: '',
    upiId: '',
    bankName: '',
    bankAccNo: '',
    bankIfsc: ''
  });
  
  // Settings local state
  const [localNews, setLocalNews] = useState(newsText || '');
  const [localVideos, setLocalVideos] = useState((tutorialVideos || []).join('\n'));
  const [localBanners, setLocalBanners] = useState((banners || []).join('\n'));
  const [localCareIds, setLocalCareIds] = useState((careIds || []).join('\n'));
  const [localReward, setLocalReward] = useState((newbieRewardAmount || 0).toString());
  const [localTelegram, setLocalTelegram] = useState(telegramLink || '');
  const [localInstagram, setLocalInstagram] = useState(instagramLink || '');

  // Update local state when store changes (from Firestore sync)
  useEffect(() => {
    setLocalNews(newsText || '');
    setLocalVideos((tutorialVideos || []).join('\n'));
    setLocalBanners((banners || []).join('\n'));
    setLocalCareIds((careIds || []).join('\n'));
    setLocalReward((newbieRewardAmount || 0).toString());
    setLocalTelegram(telegramLink || '');
    setLocalInstagram(instagramLink || '');
  }, [newsText, tutorialVideos, banners, careIds, newbieRewardAmount, telegramLink, instagramLink]);

  useEffect(() => {
    if (!auth.currentUser) return;
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'sales') fetchSellRequests();
    if (activeTab === 'buy_orders') fetchBuyOrders();
    if (activeTab === 'buy_requests') fetchBuyRequests();
  }, [activeTab, auth.currentUser]);

  const fetchBuyOrders = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(query(collection(db, 'buy_orders'), orderBy('createdAt', 'desc')));
      const orders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BuyOrder[];
      setBuyOrders(orders);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'buy_orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchBuyRequests = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(query(collection(db, 'buy_requests'), orderBy('createdAt', 'desc')));
      const requests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BuyRequest[];
      
      const requestsWithUserIds = await Promise.all(requests.map(async (req) => {
        const userDoc = await getDoc(doc(db, 'users', req.userId));
        return {
          ...req,
          userNumericId: userDoc.exists() ? (userDoc.data().shortId || userDoc.data().uid || req.userId) : 'Unknown'
        };
      }));
      
      setBuyRequests(requestsWithUserIds);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'buy_requests');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!newOrder.price || !newOrder.type) return;
    
    setLoading(true);
    try {
      const reward = Number((newOrder.price * 0.045).toFixed(2));
      const itoken = Number((newOrder.price + reward).toFixed(2));
      const orderNo = Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join('');
      
      const orderData = {
        ...newOrder,
        orderNo,
        reward,
        itoken,
        status: 'Available',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'buy_orders'), orderData);
      toast.success('Buy order created successfully');
      setShowOrderForm(false);
      fetchBuyOrders();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'buy_orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    console.log('Delete Order button clicked for:', orderId);
    try {
      await deleteDoc(doc(db, 'buy_orders', orderId));
      toast.success('Order deleted');
      fetchBuyOrders();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `buy_orders/${orderId}`);
    }
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder) return;
    try {
      const reward = Number((editingOrder.price * 0.045).toFixed(2));
      const itoken = Number((editingOrder.price + reward).toFixed(2));
      
      await updateDoc(doc(db, 'buy_orders', editingOrder.id), {
        price: editingOrder.price,
        reward,
        itoken,
        type: editingOrder.type,
        upiId: editingOrder.upiId,
        bankName: editingOrder.bankName,
        bankAccNo: editingOrder.bankAccNo,
        bankIfsc: editingOrder.bankIfsc,
        payeeName: editingOrder.payeeName
      });
      toast.success('Order updated successfully');
      setEditingOrder(null);
      fetchBuyOrders();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `buy_orders/${editingOrder.id}`);
    }
  };

  const handleApproveBuyRequest = async (request: BuyRequest) => {
    console.log('handleApproveBuyRequest called for request:', request.id);
    try {
      // 1. Update request status
      console.log('Updating request status for:', request.id);
      try {
        await updateDoc(doc(db, 'buy_requests', request.id), {
          status: 'Approved'
        });
      } catch (e) {
        console.error('Failed to update request status:', e);
        throw e;
      }
      console.log('Request status updated');

      // 2. Update order status to Sold
      console.log('Updating order status for:', request.orderId);
      try {
        await updateDoc(doc(db, 'buy_orders', request.orderId), {
          status: 'Sold'
        });
      } catch (e) {
        console.error('Failed to update order status:', e);
        throw e;
      }
      console.log('Order status updated');

      // 3. Process transaction and bonuses (This now handles balance update too)
      try {
        const numAmount = Number(request.amount);
        const userRef = doc(db, "users", request.userId);
        
        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) {
            throw new Error("User not found");
          }

          const userData = userDoc.data();
          const referrerId = userData?.referrerId;
          const buyerBonus = numAmount * 0.045;
          const totalTokens = numAmount + buyerBonus;
          const today = new Date().toISOString().split('T')[0];

          // 1. Update Buyer Stats
          const lastProfitDate = userData?.lastProfitDate || '';
          let currentTodayProfit = userData?.todayProfit || 0;
          
          if (lastProfitDate !== today) {
            currentTodayProfit = 0;
          }

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

            const referrerRef = doc(db, "users", currentReferrerId);
            const referrerDoc = await transaction.get(referrerRef);

            if (!referrerDoc.exists()) break;

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
          
          transaction.update(userRef, {
            eCoinBalance: increment(totalTokens),
            todayProfit: currentTodayProfit + buyerBonus,
            lastProfitDate: today,
            totalBuyAmount: increment(numAmount),
            hasBoughtAnyAmount: true,
            newbieBonusCompleted: true
          });

          // Record buyer transaction
          const transRef = doc(collection(db, "transactions"));
          transaction.set(transRef, {
            userId: request.userId,
            amount: numAmount,
            reward: buyerBonus,
            total: totalTokens,
            type: 'Buy',
            status: 'Completed',
            createdAt: new Date().toISOString(),
          });

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
                eCoinBalance: increment(commissionAmount),
                todayTeamCommission: newTodayComm,
                lastCommissionDate: today,
              });

              // Record commission in transactions
              const refTransRef = doc(collection(db, "transactions"));
              transaction.set(refTransRef, {
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
              const commRef = doc(collection(db, "commissions"));
              transaction.set(commRef, {
                receiverId: item.id,
                fromUserId: request.userId,
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
        
        console.log('Transaction processed and bonuses distributed');
        toast.success('Buy request approved and balance updated', {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        });
      } catch (e) {
        console.error('Failed to process transaction:', e);
        toast.error('Approved but failed to update balance: ' + (e instanceof Error ? e.message : String(e)));
      }
      fetchBuyRequests();
    } catch (error) {
      console.error('Error approving buy request:', error);
      handleFirestoreError(error, OperationType.UPDATE, `buy_requests/${request.id}`);
    }
  };

  const handleRejectBuyRequest = async (request: BuyRequest) => {
    try {
      await updateDoc(doc(db, 'buy_requests', request.id), {
        status: 'Rejected'
      });

      // Mark order as Available again
      await updateDoc(doc(db, 'buy_orders', request.orderId), {
        status: 'Available'
      });

      toast.success('Buy request rejected');
      fetchBuyRequests();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `buy_requests/${request.id}`);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      console.log('Fetched users from DB, count:', querySnapshot.size);
      
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[];
      setUsers(usersList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  const fetchSellRequests = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(query(collection(db, 'sell_requests'), orderBy('createdAt', 'desc')));
      const requests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SellRequest[];
      
      // Fetch user numeric IDs for display
      const requestsWithUserIds = await Promise.all(requests.map(async (req) => {
        const userDoc = await getDoc(doc(db, 'users', req.userId));
        return {
          ...req,
          userNumericId: userDoc.exists() ? (userDoc.data().shortId || userDoc.data().uid || req.userId) : 'Unknown'
        };
      }));
      
      setSellRequests(requestsWithUserIds);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'sell_requests');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserBalance = async (userId: string, currentBalance: number, amount: number) => {
    const newBalance = currentBalance + amount;
    if (newBalance < 0) {
      toast.error('Balance cannot be negative');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        eCoinBalance: newBalance
      });
      toast.success(`Balance updated to ₹${newBalance}`);
      setShowBalanceModal(false);
      setBalanceAmount('');
      fetchUsers();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleApproveSale = async (request: SellRequest) => {
    try {
      await updateDoc(doc(db, 'sell_requests', request.id), {
        status: 'Approved'
      });
      toast.success('Sale approved successfully');
      fetchSellRequests();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sell_requests/${request.id}`);
    }
  };

  const handleRejectSale = async (request: SellRequest) => {
    try {
      await updateDoc(doc(db, 'sell_requests', request.id), {
        status: 'Rejected'
      });
      
      // Refund the user's balance in Firestore
      await updateDoc(doc(db, 'users', request.userId), {
        eCoinBalance: increment(request.amount)
      });
      
      toast.success('Sale rejected and balance refunded');
      fetchSellRequests();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sell_requests/${request.id}`);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const settingsData = {
        newsText: localNews,
        tutorialVideos: localVideos.split('\n').filter(v => v.trim() !== ''),
        banners: localBanners.split('\n').filter(b => b.trim() !== ''),
        careIds: localCareIds.split('\n').filter(id => id.trim() !== ''),
        newbieRewardAmount: Number(localReward) || 700,
        telegramLink: localTelegram,
        instagramLink: localInstagram,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'settings', 'global'), settingsData, { merge: true });
      
      setNewsText(localNews);
      setTelegramLink(localTelegram);
      setInstagramLink(localInstagram);
      setTutorialVideos(settingsData.tutorialVideos);
      setBanners(settingsData.banners);
      setCareIds(settingsData.careIds);
      setNewbieRewardAmount(settingsData.newbieRewardAmount);
      
      toast.success('Settings saved successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    onBack();
    toast.success('Logged out of admin mode');
  };

  const handleBackfillShortIds = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      let updatedCount = 0;
      let syncedCount = 0;

      for (const userDoc of querySnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        let currentShortId = userData.shortId;

        // 1. Generate shortId if missing
        if (!currentShortId) {
          const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
          currentShortId = '';
          for (let i = 0; i < 6; i++) {
            currentShortId += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          try {
            await updateDoc(doc(db, 'users', userId), { shortId: currentShortId });
            updatedCount++;
          } catch (err) {
            console.error(`Failed to update user ${userId}:`, err);
            handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
          }
        }

        // 2. Ensure short_ids mapping exists
        const sId = currentShortId.toLowerCase();
        try {
          const sDoc = await getDoc(doc(db, 'short_ids', sId));
          if (!sDoc.exists()) {
            await setDoc(doc(db, 'short_ids', sId), { uid: userId, shortId: sId });
            syncedCount++;
          }
        } catch (err) {
          console.error(`Failed to sync shortId ${sId} for user ${userId}:`, err);
          handleFirestoreError(err, OperationType.WRITE, `short_ids/${sId}`);
        }
      }

      toast.success(`Backfill complete! Updated ${updatedCount} users, synced ${syncedCount} mappings.`);
      if (activeTab === 'users') fetchUsers();
    } catch (error) {
      console.error('Backfill error:', error);
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.shortId?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.uid?.includes(searchQuery) || 
    u.mobile?.includes(searchQuery)
  );

  return (
    <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between p-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 font-bold">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            Admin Dashboard
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <LogOut className="w-5 h-5 text-rose-400" />
          </button>
        </div>

        {/* Admin Tabs */}
        <div className="flex border-t border-slate-800">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'settings' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800/50' : 'text-slate-400'}`}
          >
            Settings
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'users' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800/50' : 'text-slate-400'}`}
          >
            Users
          </button>
          <button 
            onClick={() => setActiveTab('sales')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'sales' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800/50' : 'text-slate-400'}`}
          >
            Sales
          </button>
          <button 
            onClick={() => setActiveTab('buy_orders')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'buy_orders' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800/50' : 'text-slate-400'}`}
          >
            Buy Orders
          </button>
          <button 
            onClick={() => setActiveTab('buy_requests')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'buy_requests' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800/50' : 'text-slate-400'}`}
          >
            Buy Req
          </button>
        </div>
      </div>

      <div className="p-5">
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <RefreshCcw className="w-4 h-4 text-indigo-600" />
                Content Management
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">News Text</label>
                  <textarea 
                    value={localNews}
                    onChange={(e) => setLocalNews(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 min-h-[80px] text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Banners (URLs, one per line)</label>
                  <textarea 
                    value={localBanners}
                    onChange={(e) => setLocalBanners(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 min-h-[80px] text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Mission & Rewards
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Newbie Reward (₹)</label>
                <input 
                  type="number" 
                  value={localReward}
                  onChange={(e) => setLocalReward(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-sm font-bold"
                />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Phone className="w-4 h-4 text-indigo-600" />
                Social & Support
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Support IDs (One per line)</label>
                  <textarea 
                    value={localCareIds}
                    onChange={(e) => setLocalCareIds(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 min-h-[80px] text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telegram Link</label>
                  <input 
                    type="text" 
                    value={localTelegram}
                    onChange={(e) => setLocalTelegram(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                System Utilities
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Use these tools to maintain data integrity and fix common issues.
              </p>
              <button 
                onClick={handleBackfillShortIds}
                disabled={loading}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                Backfill Short IDs
              </button>
            </div>

            <button 
              onClick={handleSaveSettings}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save All Settings
            </button>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text"
                placeholder="Search by UID or Mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map(user => (
                  <div key={user.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">UID: {user.shortId || user.uid}</span>
                          <span className="text-xs text-slate-500 font-medium">{user.mobile}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 uppercase block">Balance</span>
                        <span className="text-lg font-black text-indigo-600">₹{user.eCoinBalance?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => {
                          setSelectedUser(user);
                          setShowBalanceModal(true);
                        }}
                        className="flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-colors col-span-2"
                      >
                        <Wallet className="w-4 h-4" />
                        Manage Balance
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showBalanceModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-900">Manage Balance</h3>
                  <button onClick={() => setShowBalanceModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <XCircle className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                  <div className="text-xs font-bold text-slate-400 uppercase mb-1">Current Balance</div>
                  <div className="text-2xl font-black text-indigo-600">₹{selectedUser.eCoinBalance?.toFixed(2) || '0.00'}</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">UID: {selectedUser.shortId || selectedUser.uid}</div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Amount (₹)</label>
                    <input 
                      type="number"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        const amt = Number(balanceAmount);
                        if (amt > 0) handleUpdateUserBalance(selectedUser.id, selectedUser.eCoinBalance || 0, amt);
                        else toast.error('Enter a valid positive amount');
                      }}
                      className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                    >
                      <UserPlus className="w-5 h-5" />
                      Add
                    </button>
                    <button 
                      onClick={() => {
                        const amt = Number(balanceAmount);
                        if (amt > 0) handleUpdateUserBalance(selectedUser.id, selectedUser.eCoinBalance || 0, -amt);
                        else toast.error('Enter a valid positive amount');
                      }}
                      className="flex items-center justify-center gap-2 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-100"
                    >
                      <UserMinus className="w-5 h-5" />
                      Deduct
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'buy_orders' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800">Manage Buy Orders</h3>
              <button 
                onClick={() => setShowOrderForm(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md"
              >
                <UserPlus className="w-4 h-4" />
                Add Order
              </button>
            </div>

            {showOrderForm && (
              <div className="bg-white p-5 rounded-2xl shadow-lg border border-indigo-100 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800">New Buy Order</h4>
                  <button onClick={() => setShowOrderForm(false)} className="text-slate-400"><XCircle className="w-5 h-5" /></button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setNewOrder({...newOrder, type: 'UPI'})}
                    className={`py-2 rounded-xl border-2 font-bold text-xs ${newOrder.type === 'UPI' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-500'}`}
                  >
                    UPI
                  </button>
                  <button 
                    onClick={() => setNewOrder({...newOrder, type: 'Bank'})}
                    className={`py-2 rounded-xl border-2 font-bold text-xs ${newOrder.type === 'Bank' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-500'}`}
                  >
                    Bank
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price (₹)</label>
                    <input 
                      type="number" 
                      value={newOrder.price}
                      onChange={(e) => setNewOrder({...newOrder, price: Number(e.target.value)})}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reward (4.5%)</label>
                    <input 
                      type="number" 
                      value={Number((newOrder.price || 0) * 0.045).toFixed(2)}
                      disabled
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-100 text-sm font-bold text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-Coin</label>
                    <input 
                      type="number" 
                      value={Number((newOrder.price || 0) * 1.045).toFixed(2)}
                      disabled
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-100 text-sm font-bold text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payee Name</label>
                    <input 
                      type="text" 
                      value={newOrder.payeeName}
                      onChange={(e) => setNewOrder({...newOrder, payeeName: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold"
                    />
                  </div>

                  {newOrder.type === 'UPI' ? (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">UPI ID</label>
                      <input 
                        type="text" 
                        value={newOrder.upiId}
                        onChange={(e) => setNewOrder({...newOrder, upiId: e.target.value})}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bank Name</label>
                        <input 
                          type="text" 
                          value={newOrder.bankName}
                          onChange={(e) => setNewOrder({...newOrder, bankName: e.target.value})}
                          className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Account Number</label>
                        <input 
                          type="text" 
                          value={newOrder.bankAccNo}
                          onChange={(e) => setNewOrder({...newOrder, bankAccNo: e.target.value})}
                          className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">IFSC Code</label>
                        <input 
                          type="text" 
                          value={newOrder.bankIfsc}
                          onChange={(e) => setNewOrder({...newOrder, bankIfsc: e.target.value.toUpperCase()})}
                          className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold uppercase"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleCreateOrder}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md"
                >
                  Create Order
                </button>
              </div>
            )}

            <div className="space-y-3">
              {buyOrders.map(order => (
                <div key={order.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Order No</span>
                      <span className="font-bold text-slate-900 text-sm">{order.orderNo}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                      order.status === 'Available' ? 'bg-emerald-100 text-emerald-600' :
                      order.status === 'Processing' ? 'bg-amber-100 text-amber-600' :
                      order.status === 'Sold' ? 'bg-rose-100 text-rose-600' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-black text-indigo-600">₹{order.price}</span>
                    <span className="text-xs font-bold text-slate-500">{order.type}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg text-[10px] font-medium text-slate-600 mb-3">
                    {order.type === 'UPI' ? (
                      <div>UPI: {order.upiId}</div>
                    ) : (
                      <div>{order.bankName} - {order.bankAccNo} ({order.bankIfsc})</div>
                    )}
                    <div>Payee: {order.payeeName}</div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setEditingOrder(order)}
                      className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-[10px] hover:bg-indigo-100 transition-colors"
                    >
                      Edit Order
                    </button>
                    <button 
                      onClick={() => handleDeleteOrder(order.id)}
                      className="flex-1 py-2 bg-rose-50 text-rose-600 rounded-lg font-bold text-[10px] hover:bg-rose-100 transition-colors"
                    >
                      Delete Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit Order Modal */}
        {editingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800">Edit Order</h3>
                <button onClick={() => setEditingOrder(null)}><XCircle className="w-5 h-5 text-slate-400" /></button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price (₹)</label>
                  <input 
                    type="number" 
                    value={editingOrder.price}
                    onChange={(e) => setEditingOrder({...editingOrder, price: Number(e.target.value)})}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payee Name</label>
                  <input 
                    type="text" 
                    value={editingOrder.payeeName}
                    onChange={(e) => setEditingOrder({...editingOrder, payeeName: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold"
                  />
                </div>

                {editingOrder.type === 'UPI' ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">UPI ID</label>
                    <input 
                      type="text" 
                      value={editingOrder.upiId}
                      onChange={(e) => setEditingOrder({...editingOrder, upiId: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bank Name</label>
                      <input 
                        type="text" 
                        value={editingOrder.bankName}
                        onChange={(e) => setEditingOrder({...editingOrder, bankName: e.target.value})}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Account Number</label>
                      <input 
                        type="text" 
                        value={editingOrder.bankAccNo}
                        onChange={(e) => setEditingOrder({...editingOrder, bankAccNo: e.target.value})}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">IFSC Code</label>
                      <input 
                        type="text" 
                        value={editingOrder.bankIfsc}
                        onChange={(e) => setEditingOrder({...editingOrder, bankIfsc: e.target.value.toUpperCase()})}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 text-sm font-bold uppercase"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={handleUpdateOrder}
                className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md"
              >
                Update Order
              </button>
            </div>
          </div>
        )}

        {activeTab === 'buy_requests' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800">Buy Requests</h3>
              <button 
                onClick={fetchBuyRequests}
                className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50"
              >
                <RefreshCcw className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {(['Pending', 'Approved', 'Rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setRequestFilter(status)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${requestFilter === status ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {buyRequests.filter(r => r.status === requestFilter).length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                  <Clock className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 font-medium">No {requestFilter.toLowerCase()} buy requests found</p>
                </div>
              ) : (
                buyRequests.filter(r => r.status === requestFilter).map(req => (
                  <div key={req.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-900">User_{req.userNumericId}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            req.status === 'Pending' ? 'bg-amber-100 text-amber-600' :
                            req.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                            'bg-rose-100 text-rose-600'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Order: {req.orderNo}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          UTR: {req.utr || 'N/A'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {new Date(req.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 uppercase block">Amount</span>
                        <span className="text-lg font-black text-slate-900">₹{req.amount.toFixed(2)}</span>
                      </div>
                    </div>

                    {req.status === 'Pending' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => {
                            console.log('Approve button clicked');
                            handleApproveBuyRequest(req);
                          }}
                          className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </button>
                        <button 
                          onClick={() => handleRejectBuyRequest(req)}
                          className="flex items-center justify-center gap-2 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-colors shadow-md shadow-rose-100"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
