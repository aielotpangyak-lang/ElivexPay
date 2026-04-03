import { useState, useEffect } from 'react';
import { 
  ShieldAlert, Save, LogOut, ArrowLeft, Users, CheckCircle2, XCircle, 
  Clock, Search, UserPlus, UserMinus, Wallet, Phone, User as UserIcon,
  ChevronRight, ChevronDown, Filter, ArrowUpDown, RefreshCcw, Loader2,
  Package, Trash2, Edit2, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  collection, getDocs, updateDoc, doc, query, where, orderBy, 
  getDoc, onSnapshot, Timestamp, increment, addDoc, deleteDoc, setDoc, runTransaction, writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAppStore } from '../store';
import { OperationType, handleFirestoreError } from '../lib/firestoreErrorHandler';
import AIChatbot from './AIChatbot';

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

  const [activeTab, setActiveTab] = useState<'settings' | 'users' | 'sales' | 'auto_sales' | 'buy_orders' | 'buy_requests' | 'sold_orders' | 'pending_info'>('settings');
  const [requestFilter, setRequestFilter] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [users, setUsers] = useState<UserData[]>([]);
  const [sellRequests, setSellRequests] = useState<SellRequest[]>([]);
  const [autoSellRequests, setAutoSellRequests] = useState<SellRequest[]>([]);
  const [buyOrders, setBuyOrders] = useState<BuyOrder[]>([]);
  const [soldOrders, setSoldOrders] = useState<BuyOrder[]>([]);
  const [pendingOrders, setPendingOrders] = useState<BuyOrder[]>([]);
  const [selectedPendingOrders, setSelectedPendingOrders] = useState<string[]>([]);
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [showConfirmDeleteSelected, setShowConfirmDeleteSelected] = useState(false);
  const [showSalesDeleteConfirm, setShowSalesDeleteConfirm] = useState<{ show: boolean; id: string | 'bulk' | 'all' }>({ show: false, id: '' });
  const [buyRequests, setBuyRequests] = useState<BuyRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAIChatbot, setShowAIChatbot] = useState(false);

  // Balance Modal State
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');

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
  const [localNewsDate, setLocalNewsDate] = useState(useAppStore.getState().newsUpdateDate || new Date().toLocaleDateString());
  const [localTelegram, setLocalTelegram] = useState(telegramLink || '');
  const [localInstagram, setLocalInstagram] = useState(instagramLink || '');

  // Update local state when store changes (from Firestore sync)
  useEffect(() => {
    setLocalNews(newsText || '');
    setLocalVideos((tutorialVideos || []).join('\n'));
    setLocalBanners((banners || []).join('\n'));
    setLocalCareIds((careIds || []).join('\n'));
    setLocalReward((newbieRewardAmount || 0).toString());
    setLocalNewsDate(useAppStore.getState().newsUpdateDate || new Date().toLocaleDateString());
    setLocalTelegram(telegramLink || '');
    setLocalInstagram(instagramLink || '');
  }, [newsText, tutorialVideos, banners, careIds, newbieRewardAmount, telegramLink, instagramLink]);

  useEffect(() => {
    if (!auth.currentUser) return;
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'sales' || activeTab === 'auto_sales') fetchSellRequests();
    if (activeTab === 'buy_orders') fetchBuyOrders();
    if (activeTab === 'sold_orders') fetchSoldOrders();
    if (activeTab === 'buy_requests') fetchBuyRequests();
    if (activeTab === 'pending_info') fetchPendingOrders();
  }, [activeTab, auth.currentUser]);

  const fetchPendingOrders = async () => {
    setLoading(true);
    setSelectedPendingOrders([]);
    try {
      const querySnapshot = await getDocs(query(collection(db, 'buy_orders'), where('status', '==', 'Pending Info'), orderBy('createdAt', 'desc')));
      const orders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BuyOrder[];
      setPendingOrders(orders);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'buy_orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelectedPendingOrders = async () => {
    if (selectedPendingOrders.length === 0) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      selectedPendingOrders.forEach(orderId => {
        batch.delete(doc(db, 'buy_orders', orderId));
      });
      await batch.commit();
      toast.success(`${selectedPendingOrders.length} orders deleted`);
      setSelectedPendingOrders([]);
      setShowConfirmDeleteSelected(false);
      fetchPendingOrders();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'buy_orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllPendingOrders = async () => {
    setLoading(true);
    try {
      // Chunk deletion if more than 500
      const ordersToDelete = [...pendingOrders];
      while (ordersToDelete.length > 0) {
        const chunk = ordersToDelete.splice(0, 500);
        const batch = writeBatch(db);
        chunk.forEach(order => {
          batch.delete(doc(db, 'buy_orders', order.id));
        });
        await batch.commit();
      }
      
      toast.success('All pending info orders deleted');
      setShowConfirmDeleteAll(false);
      fetchPendingOrders();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'buy_orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchSoldOrders = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(query(collection(db, 'buy_orders'), where('status', '==', 'Sold'), orderBy('createdAt', 'desc')));
      const orders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BuyOrder[];
      setSoldOrders(orders);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'buy_orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllSoldOrders = async () => {
    if (!confirm('Are you sure you want to delete all sold orders?')) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      soldOrders.forEach(order => {
        batch.delete(doc(db, 'buy_orders', order.id));
      });
      await batch.commit();
      toast.success('All sold orders deleted');
      fetchSoldOrders();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'buy_orders');
    } finally {
      setLoading(false);
    }
  };

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
      if (activeTab === 'buy_orders') fetchBuyOrders();
      if (activeTab === 'pending_info') fetchPendingOrders();
      if (activeTab === 'sold_orders') fetchSoldOrders();
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
      
      setSellRequests(requestsWithUserIds.filter(r => !(r as any).isAutoSell));
      setAutoSellRequests(requestsWithUserIds.filter(r => (r as any).isAutoSell));
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

    if (balanceReason.length > 30) {
      toast.error('Reason cannot exceed 30 characters');
      return;
    }

    try {
      const batch = writeBatch(db);
      
      // Update user balance
      batch.update(doc(db, 'users', userId), {
        eCoinBalance: newBalance
      });

      // Add transaction record
      const transRef = doc(collection(db, 'transactions'));
      batch.set(transRef, {
        userId,
        amount: Math.abs(amount),
        type: amount > 0 ? 'Added' : 'Deducted',
        status: 'Completed',
        reason: balanceReason || (amount > 0 ? 'Admin Credit' : 'Admin Debit'),
        createdAt: new Date().toISOString()
      });

      // Add notification for user
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId,
        title: amount > 0 ? 'Balance Added' : 'Balance Deducted',
        message: balanceReason 
          ? `Admin ${amount > 0 ? 'added' : 'deducted'} ₹${Math.abs(amount)}. Note: ${balanceReason}`
          : `Admin ${amount > 0 ? 'added' : 'deducted'} ₹${Math.abs(amount)}.`,
        type: 'system',
        read: false,
        createdAt: new Date().toISOString()
      });

      await batch.commit();
      
      toast.success(`Balance updated to ₹${newBalance}`);
      setShowBalanceModal(false);
      setBalanceAmount('');
      setBalanceReason('');
      fetchUsers();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleBulkDeleteSales = async () => {
    if (showSalesDeleteConfirm.id === 'all') {
      try {
        setLoading(true);
        const batch = writeBatch(db);
        sellRequests.forEach(req => {
          batch.delete(doc(db, 'sell_requests', req.id));
        });
        await batch.commit();
        toast.success('All manual sales cleared');
        fetchSellRequests();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'sell_requests');
      } finally {
        setLoading(false);
        setShowSalesDeleteConfirm({ show: false, id: '' });
      }
    } else {
      try {
        setLoading(true);
        const batch = writeBatch(db);
        selectedSales.forEach(id => {
          batch.delete(doc(db, 'sell_requests', id));
        });
        await batch.commit();
        toast.success(`${selectedSales.length} sales deleted`);
        setSelectedSales([]);
        fetchSellRequests();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'sell_requests');
      } finally {
        setLoading(false);
        setShowSalesDeleteConfirm({ show: false, id: '' });
      }
    }
  };

  const toggleSelectSale = (id: string) => {
    setSelectedSales(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllSales = () => {
    if (selectedSales.length === sellRequests.length) {
      setSelectedSales([]);
    } else {
      setSelectedSales(sellRequests.map(r => r.id));
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
        newsUpdateDate: localNewsDate,
        tutorialVideos: localVideos.split('\n').filter(v => v.trim() !== ''),
        banners: localBanners.split('\n').filter(b => b.trim() !== ''),
        careIds: localCareIds.split('\n').filter(id => id.trim() !== ''),
        newbieRewardAmount: Number(localReward) || 200,
        telegramLink: localTelegram,
        instagramLink: localInstagram,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'settings', 'global'), settingsData, { merge: true });
      
      setNewsText(localNews);
      useAppStore.getState().setNewsUpdateDate(localNewsDate);
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
      <div className="bg-slate-900 text-white shadow-xl sticky top-0 z-30">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto w-full">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-all active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 font-black tracking-tight text-lg">
            <div className="bg-indigo-500 p-1.5 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            Admin Control
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-rose-500/10 rounded-full transition-all active:scale-95">
            <LogOut className="w-5 h-5 text-rose-400" />
          </button>
        </div>

        {/* Admin Tabs - Scrollable on mobile */}
        <div className="flex overflow-x-auto no-scrollbar border-t border-slate-800 px-2">
          {[
            { id: 'settings', label: 'Settings', icon: null },
            { id: 'users', label: 'Users', icon: null },
            { id: 'sales', label: 'Manual Sales', icon: null },
            { id: 'auto_sales', label: 'Auto Sales', icon: null },
            { id: 'buy_orders', label: 'Buy Orders', icon: null },
            { id: 'buy_requests', label: 'Buy Req', icon: null },
            { id: 'sold_orders', label: 'Sold Orders', icon: null },
            { id: 'pending_info', label: 'Pending Info', icon: null, badge: pendingOrders.length },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-none px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="absolute top-3 right-3 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
            </button>
          ))}
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">News Update Date</label>
                  <input 
                    type="text"
                    value={localNewsDate}
                    onChange={(e) => setLocalNewsDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-sm font-medium"
                    placeholder="e.g. 03/04/2026"
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
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">User Directory</h3>
                <p className="text-sm text-slate-500 font-medium">Manage member accounts and balances</p>
              </div>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text"
                  placeholder="Search by UID or Mobile..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold transition-all"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 font-bold animate-pulse">Loading users...</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                    <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">No users found matching your search</p>
                  </div>
                ) : (
                  filteredUsers.map(user => (
                    <div key={user.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-5">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                            <UserIcon className="w-7 h-7 text-indigo-600 group-hover:text-white transition-colors" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Member ID</span>
                            <span className="font-black text-slate-900 text-lg tracking-tight">{user.shortId || user.uid}</span>
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Phone className="w-3 h-3" />
                              <span className="text-xs font-bold">{user.mobile}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Wallet Balance</span>
                          <span className="text-2xl font-black text-indigo-600 tracking-tighter">₹{user.eCoinBalance?.toFixed(2) || '0.00'}</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setSelectedUser(user);
                          setShowBalanceModal(true);
                        }}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-slate-50 text-slate-700 rounded-2xl font-black text-xs hover:bg-indigo-600 hover:text-white transition-all active:scale-[0.98] border border-slate-100"
                      >
                        <Wallet className="w-4 h-4" />
                        MANAGE ACCOUNT BALANCE
                      </button>
                    </div>
                  ))
                )}
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
                    <input 
                      type="number"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Note (Optional, max 30 chars)</label>
                    <textarea 
                      value={balanceReason}
                      onChange={(e) => setBalanceReason(e.target.value.slice(0, 30))}
                      placeholder="Enter note for this transaction..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-sm min-h-[80px]"
                    />
                    <div className={`text-[10px] mt-1 font-bold ${balanceReason.length <= 30 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {balanceReason.length}/30 characters
                    </div>
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
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Order Pool</h3>
                <p className="text-sm text-slate-500 font-medium">Create and manage available orders</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowOrderForm(true)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  Add
                </button>
                <button 
                  onClick={() => setShowAIChatbot(true)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                >
                  <RefreshCcw className="w-4 h-4" />
                  AI Gen
                </button>
              </div>
            </div>

            {showAIChatbot && (
              <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[70] flex flex-col p-4">
                <div className="flex justify-between items-center mb-4 px-2">
                  <h3 className="text-white font-black text-xl">AI Order Generator</h3>
                  <button onClick={() => setShowAIChatbot(false)} className="p-2 bg-white/10 rounded-full text-white">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex-1 bg-white rounded-3xl overflow-hidden shadow-2xl">
                  <AIChatbot 
                    onClose={() => setShowAIChatbot(false)} 
                    onComplete={() => {
                      setShowAIChatbot(false);
                      fetchBuyOrders();
                    }} 
                  />
                </div>
              </div>
            )}
            {showOrderForm && (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-indigo-50 space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-black text-slate-900 tracking-tight">New Buy Order</h4>
                  <button onClick={() => setShowOrderForm(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <XCircle className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Payment Type</label>
                    <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                      {(['UPI', 'Bank'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setNewOrder({...newOrder, type})}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                            newOrder.type === type 
                              ? 'bg-white text-indigo-600 shadow-sm' 
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Price (₹)</label>
                    <input 
                      type="number" 
                      value={newOrder.price}
                      onChange={(e) => setNewOrder({...newOrder, price: Number(e.target.value)})}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-black"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Profit (₹)</label>
                    <input 
                      type="number" 
                      value={Number((newOrder.price || 0) * 0.045).toFixed(2)}
                      disabled
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-100 text-sm font-black text-slate-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Payee Name</label>
                    <input 
                      type="text" 
                      value={newOrder.payeeName}
                      onChange={(e) => setNewOrder({...newOrder, payeeName: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-bold"
                      placeholder="Full Name"
                    />
                  </div>

                  {newOrder.type === 'UPI' ? (
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">UPI ID</label>
                      <input 
                        type="text" 
                        value={newOrder.upiId}
                        onChange={(e) => setNewOrder({...newOrder, upiId: e.target.value})}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-bold"
                        placeholder="example@upi"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Bank Name</label>
                        <input 
                          type="text" 
                          value={newOrder.bankName}
                          onChange={(e) => setNewOrder({...newOrder, bankName: e.target.value})}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-bold"
                          placeholder="HDFC, SBI, etc."
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Account Number</label>
                        <input 
                          type="text" 
                          value={newOrder.bankAccNo}
                          onChange={(e) => setNewOrder({...newOrder, bankAccNo: e.target.value})}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-bold"
                          placeholder="000000000000"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">IFSC Code</label>
                        <input 
                          type="text" 
                          value={newOrder.bankIfsc}
                          onChange={(e) => setNewOrder({...newOrder, bankIfsc: e.target.value.toUpperCase()})}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-bold uppercase"
                          placeholder="HDFC0001234"
                        />
                      </div>
                    </>
                  )}
                </div>

                <button 
                  onClick={handleCreateOrder}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
                >
                  CREATE ORDER
                </button>
              </div>
            )}

            <div className="grid gap-4">
              {buyOrders.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                  <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">No orders in the pool</p>
                </div>
              ) : (
                buyOrders.map(order => (
                  <div key={order.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                          <Package className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Order No</span>
                          <span className="font-black text-slate-900 text-sm tracking-tight">{order.orderNo}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border ${
                        order.status === 'Available' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        order.status === 'Processing' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        order.status === 'Sold' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                        'bg-slate-50 text-slate-400 border-slate-100'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Value</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tighter">₹{order.price}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Type</span>
                        <span className="inline-block px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-100">
                          {order.type}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payee</span>
                        <span className="text-xs font-bold text-slate-700">{order.payeeName}</span>
                      </div>
                      {order.type === 'UPI' ? (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UPI ID</span>
                          <span className="text-xs font-bold text-indigo-600">{order.upiId}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank</span>
                            <span className="text-xs font-bold text-slate-700">{order.bankName}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">A/C No</span>
                            <span className="text-xs font-bold text-slate-700">{order.bankAccNo}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleDeleteOrder(order.id)}
                        className="flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] hover:bg-rose-600 hover:text-white transition-all active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        DELETE
                      </button>
                      <button 
                        onClick={() => setEditingOrder(order)}
                        className="flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        EDIT
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Edit Order Modal */}
        {editingOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Edit Order</h3>
                <button onClick={() => setEditingOrder(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Price (₹)</label>
                  <input 
                    type="number" 
                    value={editingOrder.price}
                    onChange={(e) => setEditingOrder({...editingOrder, price: Number(e.target.value)})}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Payee Name</label>
                  <input 
                    type="text" 
                    value={editingOrder.payeeName}
                    onChange={(e) => setEditingOrder({...editingOrder, payeeName: e.target.value})}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-bold"
                  />
                </div>

                {editingOrder.type === 'UPI' ? (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">UPI ID</label>
                    <input 
                      type="text" 
                      value={editingOrder.upiId}
                      onChange={(e) => setEditingOrder({...editingOrder, upiId: e.target.value})}
                      className="w-full border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-bold"
                    />
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Bank Name</label>
                      <input 
                        type="text" 
                        value={editingOrder.bankName}
                        onChange={(e) => setEditingOrder({...editingOrder, bankName: e.target.value})}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Account Number</label>
                      <input 
                        type="text" 
                        value={editingOrder.bankAccNo}
                        onChange={(e) => setEditingOrder({...editingOrder, bankAccNo: e.target.value})}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">IFSC Code</label>
                      <input 
                        type="text" 
                        value={editingOrder.bankIfsc}
                        onChange={(e) => setEditingOrder({...editingOrder, bankIfsc: e.target.value.toUpperCase()})}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-bold uppercase"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={handleUpdateOrder}
                className="w-full mt-8 bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
              >
                UPDATE ORDER DETAILS
              </button>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Sell Requests</h3>
                <p className="text-sm text-slate-500 font-medium">Process user withdrawal requests</p>
              </div>
              <div className="flex items-center gap-2">
                {sellRequests.length > 0 && (
                  <>
                    <button 
                      onClick={toggleSelectAllSales}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                    >
                      {selectedSales.length === sellRequests.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedSales.length > 0 && (
                      <button 
                        onClick={() => setShowSalesDeleteConfirm({ show: true, id: 'bulk' })}
                        className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete ({selectedSales.length})
                      </button>
                    )}
                    <button 
                      onClick={() => setShowSalesDeleteConfirm({ show: true, id: 'all' })}
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
                    >
                      Clear All
                    </button>
                  </>
                )}
                <button 
                  onClick={fetchSellRequests}
                  className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all active:scale-95"
                >
                  <RefreshCcw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {sellRequests.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                  <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">No sell requests found</p>
                </div>
              ) : (
                sellRequests.map(req => (
                  <div key={req.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-all relative overflow-hidden">
                    <div className="flex items-start gap-4">
                      <button 
                        onClick={() => toggleSelectSale(req.id)}
                        className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          selectedSales.includes(req.id) 
                            ? 'bg-indigo-600 border-indigo-600 text-white' 
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {selectedSales.includes(req.id) && <Check className="w-4 h-4" />}
                      </button>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-5">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                                <UserIcon className="w-4 h-4 text-slate-600" />
                              </div>
                              <span className="font-black text-slate-900 tracking-tight">User_{req.userNumericId}</span>
                              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border ${
                                req.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                req.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                'bg-rose-50 text-rose-600 border-rose-100'
                              }`}>
                                {req.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span className="text-[10px] font-bold">{new Date(req.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Amount</span>
                            <span className="text-2xl font-black text-slate-900 tracking-tighter">₹{req.amount.toFixed(2)}</span>
                          </div>
                        </div>

                        {req.status === 'Pending' && (
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              onClick={() => handleApproveSale(req)}
                              className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all active:scale-[0.98] shadow-lg shadow-emerald-100"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              APPROVE
                            </button>
                            <button 
                              onClick={() => handleRejectSale(req)}
                              className="flex items-center justify-center gap-2 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs hover:bg-rose-700 transition-all active:scale-[0.98] shadow-lg shadow-rose-100"
                            >
                              <XCircle className="w-4 h-4" />
                              REJECT
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Sales Delete Confirmation Modal */}
        {showSalesDeleteConfirm.show && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="w-10 h-10 text-rose-500" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                  {showSalesDeleteConfirm.id === 'all' ? 'Clear All Sales?' : 'Delete Selected Sales?'}
                </h3>
                <p className="text-slate-500 font-medium mb-8">
                  {showSalesDeleteConfirm.id === 'all' 
                    ? 'This will permanently delete all manual sales history. This action cannot be undone.' 
                    : `Are you sure you want to delete ${selectedSales.length} selected sales? This action cannot be undone.`}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowSalesDeleteConfirm({ show: false, id: '' })}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleBulkDeleteSales}
                    className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-200"
                  >
                    Delete Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sold_orders' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Sold History</h3>
                <p className="text-sm text-slate-500 font-medium">Completed and sold transactions</p>
              </div>
              {soldOrders.length > 0 && (
                <button 
                  onClick={handleDeleteAllSoldOrders}
                  className="flex items-center gap-2 bg-rose-50 text-rose-600 px-5 py-2.5 rounded-2xl font-black text-xs hover:bg-rose-600 hover:text-white transition-all active:scale-95 shadow-sm"
                >
                  <XCircle className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>

            <div className="grid gap-4">
              {soldOrders.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                  <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">No sold orders in history</p>
                </div>
              ) : (
                soldOrders.map(order => (
                  <div key={order.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Transaction ID</span>
                        <span className="font-black text-slate-900 text-lg tracking-tight">{order.orderNo}</span>
                      </div>
                      <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-rose-100">
                        Sold
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Sale Amount</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tighter">₹{order.price}</span>
                      </div>
                      <span className="inline-block px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-100">
                        {order.type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'auto_sales' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Auto Sell History</h3>
                <p className="text-sm text-slate-500 font-medium">History of automated E-Coin sales</p>
              </div>
              <button 
                onClick={fetchSellRequests}
                className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all active:scale-95"
              >
                <RefreshCcw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid gap-4">
              {autoSellRequests.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                  <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">No automated sales found</p>
                </div>
              ) : (
                autoSellRequests.map(req => (
                  <div key={req.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-all relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${
                      req.status === 'Approved' ? 'bg-emerald-500' : 
                      req.status === 'Rejected' ? 'bg-rose-500' : 'bg-amber-500'
                    }`}></div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto Sale</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            req.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                            req.status === 'Rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        <span className="font-black text-slate-900 text-lg tracking-tight">User_{req.userNumericId}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Amount</span>
                        <span className="text-2xl font-black text-indigo-600 tracking-tighter">₹{req.amount.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span className="text-[10px] font-bold">
                          {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {(req as any).completedAt && ` → ${new Date((req as any).completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold">{new Date(req.createdAt).toLocaleDateString()}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                          req.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                          req.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {req.status === 'Approved' ? 'Success' : req.status === 'Rejected' ? 'Failed' : 'Processing'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'buy_requests' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Buy Requests</h3>
                <p className="text-sm text-slate-500 font-medium">Approve or reject user payments</p>
              </div>
              <button 
                onClick={fetchBuyRequests}
                className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all active:scale-95"
              >
                <RefreshCcw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
              {(['Pending', 'Approved', 'Rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setRequestFilter(status)}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    requestFilter === status 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="grid gap-4">
              {buyRequests.filter(r => r.status === requestFilter).length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                  <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">No {requestFilter.toLowerCase()} requests</p>
                </div>
              ) : (
                buyRequests.filter(r => r.status === requestFilter).map(req => (
                  <div key={req.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-slate-600" />
                          </div>
                          <span className="font-black text-slate-900 tracking-tight">User_{req.userNumericId}</span>
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                            req.status === 'Pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            req.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            'bg-rose-50 text-rose-600 border border-rose-100'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order:</span>
                            <span className="text-xs font-bold text-slate-700">{req.orderNo}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UTR:</span>
                            <span className="text-xs font-bold text-indigo-600">{req.utr || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span className="text-[10px] font-bold">{new Date(req.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Amount</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tighter">₹{req.amount.toFixed(2)}</span>
                      </div>
                    </div>

                    {req.status === 'Pending' && (
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => handleApproveBuyRequest(req)}
                          className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all active:scale-[0.98] shadow-lg shadow-emerald-100"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          APPROVE
                        </button>
                        <button 
                          onClick={() => handleRejectBuyRequest(req)}
                          className="flex items-center justify-center gap-2 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs hover:bg-rose-700 transition-all active:scale-[0.98] shadow-lg shadow-rose-100"
                        >
                          <XCircle className="w-4 h-4" />
                          REJECT
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {activeTab === 'pending_info' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Pending Info ({pendingOrders.length})</h3>
                <p className="text-sm text-slate-500 font-medium">Orders missing payment details</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={fetchPendingOrders}
                  className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all active:scale-95"
                >
                  <RefreshCcw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
                
                {pendingOrders.length > 0 && (
                  <button 
                    onClick={() => {
                      if (selectedPendingOrders.length === pendingOrders.length) {
                        setSelectedPendingOrders([]);
                      } else {
                        setSelectedPendingOrders(pendingOrders.map(o => o.id));
                      }
                    }}
                    className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                  >
                    {selectedPendingOrders.length === pendingOrders.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}

                {selectedPendingOrders.length > 0 ? (
                  <div className="flex gap-2">
                    {showConfirmDeleteSelected ? (
                      <>
                        <button 
                          onClick={handleDeleteSelectedPendingOrders}
                          className="bg-rose-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-200"
                        >
                          Confirm Delete ({selectedPendingOrders.length})
                        </button>
                        <button 
                          onClick={() => setShowConfirmDeleteSelected(false)}
                          className="bg-slate-200 text-slate-700 px-5 py-2.5 rounded-2xl font-black text-xs hover:bg-slate-300 transition-all active:scale-95"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => setShowConfirmDeleteSelected(true)}
                        className="flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-200"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Selected ({selectedPendingOrders.length})
                      </button>
                    )}
                  </div>
                ) : (
                  pendingOrders.length > 0 && (
                    <div className="flex gap-2">
                      {showConfirmDeleteAll ? (
                        <>
                          <button 
                            onClick={handleDeleteAllPendingOrders}
                            className="bg-rose-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-200"
                          >
                            Confirm Clear All
                          </button>
                          <button 
                            onClick={() => setShowConfirmDeleteAll(false)}
                            className="bg-slate-200 text-slate-700 px-5 py-2.5 rounded-2xl font-black text-xs hover:bg-slate-300 transition-all active:scale-95"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => setShowConfirmDeleteAll(true)}
                          className="flex items-center gap-2 bg-rose-50 text-rose-600 px-5 py-2.5 rounded-2xl font-black text-xs hover:bg-rose-600 hover:text-white transition-all active:scale-95 shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          Clear All
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="grid gap-4">
              {pendingOrders.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-1">All Clear!</h4>
                  <p className="text-slate-500 font-medium max-w-[200px] mx-auto">No orders are currently pending information.</p>
                </div>
              ) : (
                pendingOrders.map(order => (
                  <div 
                    key={order.id} 
                    onClick={() => {
                      if (selectedPendingOrders.includes(order.id)) {
                        setSelectedPendingOrders(selectedPendingOrders.filter(id => id !== order.id));
                      } else {
                        setSelectedPendingOrders([...selectedPendingOrders, order.id]);
                      }
                    }}
                    className={`bg-white p-5 rounded-[2rem] shadow-sm border-2 transition-all group relative overflow-hidden cursor-pointer ${
                      selectedPendingOrders.includes(order.id) ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-100 hover:shadow-md'
                    }`}
                  >
                    <div className={`absolute top-0 left-0 w-1 h-full ${selectedPendingOrders.includes(order.id) ? 'bg-indigo-500' : 'bg-amber-400'}`}></div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          selectedPendingOrders.includes(order.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-200 bg-white'
                        }`}>
                          {selectedPendingOrders.includes(order.id) && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Order Identifier</span>
                          <span className="font-black text-slate-900 text-lg tracking-tight">{order.orderNo}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="bg-amber-50 text-amber-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-amber-100">
                          Pending Info
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrder(order.id);
                          }}
                          className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Amount</span>
                        <span className="text-2xl font-black text-indigo-600 tracking-tighter">₹{order.price}</span>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-slate-400 mb-1 justify-end">
                          <Clock className="w-3 h-3" />
                          <span className="text-[10px] font-bold">{new Date(order.createdAt).toLocaleString()}</span>
                        </div>
                        <span className="inline-block px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-100">
                          {order.type}
                        </span>
                      </div>
                    </div>
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
