import { useState, useEffect } from 'react';
import { Search, ChevronDown, AlertCircle, Coins, IndianRupee, Filter, ArrowUpDown, Wallet, Copy, X, History as HistoryIcon, CheckCircle2, ExternalLink, Info } from 'lucide-react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [utr, setUtr] = useState('');
  const { eCoinBalance } = useAppStore();

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
    const matchesSearch = order.price.toString().includes(searchTerm) || 
                         order.orderNo.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesPrice = true;
    if (priceFilter === '500-1000') matchesPrice = order.price >= 500 && order.price <= 1000;
    else if (priceFilter === '1000-5000') matchesPrice = order.price > 1000 && order.price <= 5000;
    else if (priceFilter === '5000+') matchesPrice = order.price > 5000;

    return matchesSearch && matchesPrice;
  });

  const displayOrders = [...filteredOrders].sort((a, b) => 
    sortOrder === 'asc' ? a.price - b.price : b.price - a.price
  );

  const handleUsdtClick = () => {
    toast('USDT coming soon', { icon: <Info className="w-5 h-5 text-indigo-600" /> });
  };

  const handleConfirmPayment = async () => {
    if (!selectedOrder || !auth.currentUser) return;
    
    // Validate UTR (Standard UPI UTR is 12 digits)
    const utrRegex = /^\d{12}$/;
    if (!utrRegex.test(utr)) {
      toast.error('Invalid UTR format. Please enter the 12-digit UTR number.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Buy Request
      await addDoc(collection(db, 'buy_requests'), {
        userId: auth.currentUser.uid,
        orderId: selectedOrder.id,
        orderNo: selectedOrder.orderNo,
        amount: selectedOrder.price,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        utr: utr
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
      setSelectedOrder(null);
      setUtr('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'buy_requests');
    } finally {
      setIsSubmitting(false);
    }
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
          If you do not try to buy now, you will not be able to get the 4.5% reward! Please pay exactly the amount shown.
        </p>
      </div>

      {/* Balance Card */}
      <div className="bg-white mx-4 mt-4 rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-indigo-600" />
          <span className="text-slate-600 font-bold">Current Balance</span>
        </div>
        <div className="flex items-center gap-1.5 font-bold text-slate-900 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
          <Coins className="w-4 h-4 text-indigo-600" />
          {eCoinBalance.toFixed(2)}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="px-4 mt-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by amount or order no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>

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
                    onClick={() => setSelectedOrder(order)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 p-8 text-white relative">
              <button 
                onClick={() => { setSelectedOrder(null); setUtr(''); }}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                  <IndianRupee className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black">Payment</h3>
              </div>
              <p className="text-indigo-100 text-sm font-medium">
                Pay exactly <span className="font-black text-white text-xl">₹{selectedOrder.price}</span>
              </p>
            </div>

            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
              <div className="space-y-4">
                {selectedOrder.type === 'UPI' ? (
                  <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center group active:bg-slate-100 transition-colors" onClick={() => copyToClipboard(selectedOrder.upiId!, 'UPI ID')}>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest mb-1">UPI ID</span>
                      <span className="font-black text-slate-900 text-lg truncate block">{selectedOrder.upiId}</span>
                    </div>
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-indigo-600 group-hover:scale-110 transition-transform">
                      <Copy className="w-5 h-5" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest mb-1">Bank Name</span>
                        <span className="font-black text-slate-900 text-lg truncate block">{selectedOrder.bankName}</span>
                      </div>
                    </div>
                    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center group active:bg-slate-100 transition-colors" onClick={() => copyToClipboard(selectedOrder.bankAccNo!, 'Account Number')}>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest mb-1">Account Number</span>
                        <span className="font-black text-slate-900 text-lg truncate block">{selectedOrder.bankAccNo}</span>
                      </div>
                      <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-indigo-600 group-hover:scale-110 transition-transform">
                        <Copy className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center group active:bg-slate-100 transition-colors" onClick={() => copyToClipboard(selectedOrder.bankIfsc!, 'IFSC Code')}>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest mb-1">IFSC Code</span>
                        <span className="font-black text-slate-900 text-lg truncate block">{selectedOrder.bankIfsc}</span>
                      </div>
                      <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-indigo-600 group-hover:scale-110 transition-transform">
                        <Copy className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center group active:bg-slate-100 transition-colors" onClick={() => copyToClipboard(selectedOrder.payeeName!, 'Payee Name')}>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest mb-1">Payee Name</span>
                    <span className="font-black text-slate-900 text-lg truncate block">{selectedOrder.payeeName}</span>
                  </div>
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-indigo-600 group-hover:scale-110 transition-transform">
                    <Copy className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100 w-full"></div>

              <div className="space-y-4">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 mb-2 ml-1 uppercase tracking-wider">Enter 12-Digit UTR Number</label>
                  <input 
                    type="text" 
                    value={utr}
                    onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="Example: 123456789012"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-lg font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-300 placeholder:font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 ml-1 font-medium italic">
                    * Find the UTR/Ref number in your payment confirmation screen.
                  </p>
                </div>

                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0" />
                  <p className="text-[10px] font-bold text-indigo-800 leading-relaxed">
                    Verification takes 5-15 minutes. Do not submit fake UTR numbers or your account may be suspended.
                  </p>
                </div>

                <button 
                  disabled={isSubmitting || utr.length !== 12}
                  onClick={handleConfirmPayment}
                  className={`w-full py-5 rounded-[1.5rem] font-black text-base shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    isSubmitting || utr.length !== 12
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Submitting...
                    </>
                  ) : 'Submit Payment Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
