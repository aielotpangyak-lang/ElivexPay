import { useState, useEffect } from 'react';
import { Search, ChevronDown, AlertCircle, Coins, IndianRupee, Filter, ArrowUpDown, Wallet, Copy, X, History as HistoryIcon, CheckCircle2, ExternalLink, Info, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import { doc, updateDoc, increment, collection, query, where, getDocs, addDoc, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

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

export default function Buy() {
  const [activeTab, setActiveTab] = useState<'upi' | 'usdt'>('upi');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceFilter, setPriceFilter] = useState<'all' | '500-1000' | '1000-5000' | '5000+'>('all');
  const [orders, setOrders] = useState<BuyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<BuyOrder | null>(null);
  const [transactionStep, setTransactionStep] = useState<'info' | 'select_upi' | 'proceed' | 'confirm' | 'utr' | 'success'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUserUpiId, setSelectedUserUpiId] = useState<string>('');
  const [utrNumber, setUtrNumber] = useState('');
  const [userAmount, setUserAmount] = useState('');
  const [linkedBuyAccounts, setLinkedBuyAccounts] = useState<any[]>([]);
  const { eCoinBalance } = useAppStore();

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'upi_accounts'), where('userId', '==', auth.currentUser.uid), where('type', '==', 'Buy'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLinkedBuyAccounts(accs);
      if (accs.length > 0 && !selectedUserUpiId) {
        setSelectedUserUpiId((accs[0] as any).upiId);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'upi_accounts');
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'buy_orders'), 
      where('status', '==', 'Available'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BuyOrder[];
      setOrders(fetchedOrders);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'buy_orders');
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const filteredOrders = orders.filter(order => {
    let matchesPrice = true;
    if (priceFilter === '500-1000') matchesPrice = order.price >= 500 && order.price <= 1000;
    else if (priceFilter === '1000-5000') matchesPrice = order.price > 1000 && order.price <= 5000;
    else if (priceFilter === '5000+') matchesPrice = order.price > 5000;

    return matchesPrice;
  });

  const displayOrders = [...filteredOrders].sort((a, b) => 
    sortOrder === 'asc' ? a.price - b.price : b.price - a.price
  );

  const handleUsdtClick = () => {
    toast('USDT coming soon', { icon: <Info className="w-5 h-5 text-indigo-600" /> });
  };

  const handleConfirmPayment = async () => {
    if (!selectedOrder || !auth.currentUser) return;
    
    if (!selectedUserUpiId) {
      toast.error('Please select your UPI ID');
      return;
    }

    if (!utrNumber || utrNumber.length < 12) {
      toast.error('Please enter a valid 12-digit UTR number');
      return;
    }

    if (!userAmount || parseFloat(userAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Buy Request
      await addDoc(collection(db, 'buy_requests'), {
        userId: auth.currentUser.uid,
        orderId: selectedOrder.id,
        orderNo: selectedOrder.orderNo,
        amount: parseFloat(userAmount),
        userUpiId: selectedUserUpiId,
        utr: utrNumber,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      });

      // 2. Mark order as Processing
      await updateDoc(doc(db, 'buy_orders', selectedOrder.id), {
        status: 'Processing'
      });

      // 3. Update user's newbie bonus task
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        hasBoughtAnyAmount: true
      });

      toast.success('Payment request submitted! Admin will verify soon.', {
        duration: 5000,
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />
      });
      
      setTransactionStep('success');
      setUtrNumber('');
      setUserAmount('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'buy_requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProceedToPay = () => {
    if (!selectedOrder) return;
    const upiUrl = `upi://pay?pa=${selectedOrder.upiId}&pn=${selectedOrder.payeeName}&am=${selectedOrder.price}&cu=INR`;
    window.location.href = upiUrl;
    setTransactionStep('confirm');
    setUserAmount(selectedOrder.price.toString());
  };

  const handleGPayPay = () => {
    if (!selectedOrder) return;
    // Enhanced GPay deep link for better app targeting
    const upiUrl = `upi://pay?pa=${selectedOrder.upiId}&pn=${encodeURIComponent(selectedOrder.payeeName)}&am=${selectedOrder.price}&cu=INR&mode=02&purpose=00`;
    
    // On Android, we can try to force GPay if possible, but standard upi:// is safer for cross-platform
    window.location.href = upiUrl;
    
    setTransactionStep('confirm');
    setUserAmount(selectedOrder.price.toString());
  };

  const handleBuyClick = (order: BuyOrder) => {
    if (linkedBuyAccounts.length === 0) {
      toast.error('Please link a Buy UPI ID first');
      // Redirect to UPI page
      const upiTab = document.querySelector('[data-tab="upi"]') as HTMLElement;
      if (upiTab) upiTab.click();
      return;
    }
    setSelectedOrder(order);
    setTransactionStep('info');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  return (
    <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="text-center py-4 font-bold text-slate-900 border-b border-slate-100 bg-white">
        Buy E-Coin
      </div>

      {/* Tabs */}
      <div className="flex justify-around border-b border-slate-100 bg-white">
        <button 
          className={`py-3 font-bold w-1/2 transition-all ${activeTab === 'upi' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-400 hover:text-slate-600'}`}
          onClick={() => setActiveTab('upi')}
        >
          UPI
        </button>
        <button 
          className={`py-3 font-bold w-1/2 transition-all ${activeTab === 'usdt' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-400 hover:text-slate-600'}`}
          onClick={handleUsdtClick}
        >
          USDT
        </button>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 mx-4 mt-4 p-3 rounded-xl border border-amber-200 flex items-start gap-3 shadow-sm">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 font-bold leading-relaxed">
          Please pay exact amount.
        </p>
      </div>

      {/* UPI Binding Notice */}
      <div className="bg-indigo-50 mx-4 mt-4 p-3 rounded-xl border border-indigo-100 flex items-start gap-3 shadow-sm">
        <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-800 font-bold leading-relaxed">
          You need to bind a buy UPI.
        </p>
      </div>

      {/* Filters */}
      <div className="px-4 mt-6 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {(['all', '500-1000', '1000-5000', '5000+'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setPriceFilter(filter)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                priceFilter === filter 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {filter === 'all' ? 'All Amounts' : filter}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            Available Orders ({displayOrders.length})
          </h3>
          <button 
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortOrder === 'asc' ? 'Smallest First' : 'Largest First'}
          </button>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : displayOrders.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-500 font-bold">No orders found</p>
              <p className="text-xs text-slate-400 mt-1 px-6">Try adjusting your filters or search term.</p>
            </div>
          ) : (
            displayOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order No</span>
                    <span className="text-xs font-bold text-slate-600">{order.orderNo}</span>
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-[10px] font-black border border-emerald-100 uppercase">
                    Reward 4.5%
                  </div>
                </div>
                
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-rose-400 uppercase">Price</span>
                      <span className="text-lg font-black text-slate-900">₹{order.price}</span>
                    </div>
                    
                    <div className="h-8 w-px bg-slate-100"></div>
                    
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Reward</span>
                      <span className="text-sm font-bold text-slate-700">+{order.reward}</span>
                    </div>

                    <div className="h-8 w-px bg-slate-100"></div>
                    
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">Total</span>
                      <span className="text-sm font-black text-indigo-600">{order.itoken}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleBuyClick(order)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
                  >
                    Buy
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Combined Payment & UTR Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
            <button 
              onClick={() => { setSelectedOrder(null); setTransactionStep('info'); }}
              className="p-1 hover:bg-slate-100 rounded-full mr-2"
            >
              <X className="w-6 h-6 text-slate-500" />
            </button>
            <h2 className="font-bold text-slate-900 text-lg">
              {transactionStep === 'info' ? 'UPI and Pay' : 
               transactionStep === 'success' ? 'Order Success' : 'Payment Details'}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {transactionStep === 'info' ? (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IndianRupee className="w-8 h-8 text-indigo-600" />
                  </div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-1">Pay Exactly</span>
                  <h3 className="text-3xl font-black text-slate-900">₹{selectedOrder.price}</h3>
                </div>

                <div className="space-y-4">
                  <div className="p-5 bg-white rounded-3xl border border-slate-100 flex justify-between items-center group active:bg-slate-50 transition-colors" onClick={() => copyToClipboard(selectedOrder.upiId!, 'UPI ID')}>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest mb-1">UPI ID</span>
                      <span className="font-black text-slate-900 text-lg truncate block">{selectedOrder.upiId}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-indigo-600 group-hover:scale-110 transition-transform">
                      <Copy className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="p-5 bg-white rounded-3xl border border-slate-100 flex justify-between items-center group active:bg-slate-50 transition-colors" onClick={() => copyToClipboard(selectedOrder.payeeName!, 'Payee Name')}>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest mb-1">Payee Name</span>
                      <span className="font-black text-slate-900 text-lg truncate block">{selectedOrder.payeeName}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-indigo-600 group-hover:scale-110 transition-transform">
                      <Copy className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Select Your Paying UPI ID</label>
                  <div className="space-y-2">
                    {linkedBuyAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => setSelectedUserUpiId(acc.upiId)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                          selectedUserUpiId === acc.upiId 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                            : 'border-slate-100 hover:border-slate-200 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-xs border border-slate-100">
                            {acc.partnerName?.slice(0, 1)}
                          </div>
                          <div className="text-left">
                            <span className="font-bold text-sm block">{acc.upiId}</span>
                            <span className="text-[10px] opacity-70">{acc.name}</span>
                          </div>
                        </div>
                        {selectedUserUpiId === acc.upiId && <CheckCircle2 className="w-5 h-5" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                    Please pay the exact amount using your selected UPI ID. Otherwise, your money may not be safe.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-4">
                  <button 
                    disabled={!selectedUserUpiId}
                    onClick={handleProceedToPay}
                    className="w-full py-4 bg-indigo-600 disabled:bg-indigo-300 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Proceed to Pay
                  </button>
                  
                  <button 
                    disabled={!selectedUserUpiId}
                    onClick={handleGPayPay}
                    className="w-full py-4 bg-emerald-600 disabled:bg-emerald-300 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-black text-emerald-600">G</span>
                    </div>
                    Pay with GPay
                  </button>
                </div>
              </div>
            ) : transactionStep === 'confirm' ? (
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
                  <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <HelpCircle className="w-10 h-10 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Payment Done?</h3>
                  <p className="text-slate-500 text-sm font-medium">
                    If you have completed the payment in your UPI app, please confirm to submit UTR.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Paying From</span>
                    <span className="text-indigo-600 font-bold text-sm">{selectedUserUpiId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Amount</span>
                    <span className="text-slate-900 font-black text-lg">₹{selectedOrder.price}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-4">
                  <button 
                    onClick={() => setTransactionStep('utr')}
                    className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 active:scale-95 transition-all"
                  >
                    Payment Confirmation
                  </button>
                  <button 
                    onClick={() => setTransactionStep('info')}
                    className="py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold active:scale-95 transition-all"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : transactionStep === 'success' ? (
              <div className="space-y-8 py-4 animate-in zoom-in-95 duration-500">
                <div className="text-center">
                  <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                    <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-20"></div>
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 relative z-10" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Request Submitted!</h3>
                  <p className="text-slate-500 text-sm font-medium max-w-[240px] mx-auto">
                    Your payment request has been sent for verification.
                  </p>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                  <div className="bg-indigo-600 p-6 text-white text-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 block mb-1">Tokens to Receive</span>
                    <div className="flex items-center justify-center gap-2">
                      <Coins className="w-6 h-6 text-indigo-200" />
                      <span className="text-4xl font-black tracking-tighter">{selectedOrder.itoken}</span>
                    </div>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-slate-50">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Amount Paid</span>
                      <span className="text-slate-900 font-black text-lg">₹{selectedOrder.price}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-3 border-b border-slate-50">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Reward Earned</span>
                      <div className="flex items-center gap-1.5">
                        <div className="bg-emerald-100 text-emerald-600 p-1 rounded-md">
                          <ArrowUpDown className="w-3 h-3 rotate-180" />
                        </div>
                        <span className="text-emerald-600 font-black text-lg">₹{selectedOrder.reward}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center py-3">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Order ID</span>
                      <span className="text-slate-600 font-bold text-xs font-mono">{selectedOrder.orderNo}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100 flex gap-3">
                  <Info className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                    Verification usually takes 5-30 minutes. You will be notified once your balance is updated.
                  </p>
                </div>

                <button 
                  onClick={() => {
                    setSelectedOrder(null);
                    setTransactionStep('info');
                    setSelectedUserUpiId('');
                  }}
                  className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-slate-200 active:scale-95 transition-all"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-50">
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-1">Paying From</span>
                      <span className="text-slate-900 font-bold text-sm">{selectedUserUpiId}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-1">Amount</span>
                      <span className="text-indigo-600 font-black text-lg">₹{selectedOrder.price}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Enter UTR Number</label>
                      <input 
                        type="text" 
                        value={utrNumber}
                        onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        placeholder="Please enter UTR here"
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-2xl px-5 py-4 text-lg font-black tracking-[0.2em] text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Confirm Amount Paid</label>
                      <input 
                        type="number" 
                        value={userAmount}
                        readOnly
                        placeholder="₹0.00"
                        className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex gap-3">
                  <Info className="w-5 h-5 text-indigo-600 shrink-0" />
                  <p className="text-[10px] font-bold text-indigo-800 leading-relaxed">
                    Please double check your UTR number. Incorrect UTR may lead to payment failure or account suspension.
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setTransactionStep('confirm')}
                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold shadow-sm active:scale-95 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    disabled={isSubmitting || utrNumber.length < 12 || !userAmount}
                    onClick={handleConfirmPayment}
                    className={`flex-[2] py-4 rounded-2xl font-black text-base shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      isSubmitting || utrNumber.length < 12 || !userAmount
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Submitting...
                      </>
                    ) : 'Submit UTR'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}
