import { Link as LinkIcon, Settings, FileText, AlertTriangle, PlusCircle, CreditCard, ChevronLeft, ChevronRight, CheckCircle2, Circle, Loader2, Building2, AtSign, Send, Coins, IndianRupee } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAppStore } from '../store';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

// Mock Data
const PARTNERS = [
  { id: 'mobikwik', name: 'Mobikwik', desc: 'MobiKwik is an Indian digital payment platform.', available: true, color: 'bg-indigo-100 text-indigo-600', icon: 'M' },
  { id: 'phonepe', name: 'PhonePe', desc: 'PhonePe is an Indian digital payment platform.', available: true, color: 'bg-purple-100 text-purple-600', icon: 'Pe' },
  { id: 'gpay', name: 'GPay', desc: 'Google Pay is a digital wallet platform and online payment system.', available: true, color: 'bg-blue-100 text-blue-600', icon: 'G' },
];

export default function UPI() {
  const [currentView, setCurrentView] = useState<'main' | 'link'>('main');
  const [activeTab, setActiveTab] = useState<'Buy' | 'Sell'>('Buy');
  const { eCoinBalance, sellEcoin } = useAppStore();
  
  // Linked Accounts State
  const [buyAccounts, setBuyAccounts] = useState<any[]>([]);
  const [sellAccounts, setSellAccounts] = useState<any[]>([]);

  // Sell Form State
  const [sellAmount, setSellAmount] = useState('');
  const [selectedSellAccount, setSelectedSellAccount] = useState<string>('');
  const [isSelling, setIsSelling] = useState(false);

  // Link Form State
  const [linkType, setLinkType] = useState<'Buy' | 'Sell'>('Buy');
  
  // Buy Form State
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [buyName, setBuyName] = useState('');
  const [buyPhone, setBuyPhone] = useState('');
  const [isLinkingBuy, setIsLinkingBuy] = useState(false);

  // Sell Link Form State
  const [sellMethod, setSellMethod] = useState<'UPI' | 'Bank'>('UPI');
  const [sellUpiId, setSellUpiId] = useState('');
  const [bankAccNo, setBankAccNo] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [isLinkingSell, setIsLinkingSell] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'upi_accounts'), where('userId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const buyAccs: any[] = [];
      const sellAccs: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as any;
        if (data.type === 'Buy') {
          buyAccs.push(data);
        } else if (data.type === 'Sell') {
          sellAccs.push(data);
        }
      });

      setBuyAccounts(buyAccs);
      setSellAccounts(sellAccs);
      if (sellAccs.length > 0 && !selectedSellAccount) {
        setSelectedSellAccount(sellAccs[0].id);
      }
    }, (error) => {
      if (auth.currentUser) {
        console.error("Error fetching UPI accounts:", error);
      }
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleSellSubmit = async () => {
    if (!sellAmount || isNaN(Number(sellAmount)) || Number(sellAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (Number(sellAmount) > eCoinBalance) {
      toast.error('Insufficient balance');
      return;
    }
    if (!selectedSellAccount) {
      toast.error('Please select a withdrawal account');
      return;
    }

    setIsSelling(true);
    try {
      const account = sellAccounts.find(a => a.id === selectedSellAccount);
      
      // Deduct from Firestore first
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          eCoinBalance: increment(-Number(sellAmount))
        });
      }

      await addDoc(collection(db, 'sell_requests'), {
        userId: auth.currentUser?.uid,
        amount: Number(sellAmount),
        accountId: selectedSellAccount,
        accountDetails: account,
        status: 'Pending',
        createdAt: new Date().toISOString()
      });

      sellEcoin(Number(sellAmount));
      toast.success('Sell request submitted successfully!');
      setSellAmount('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sell_requests');
    } finally {
      setIsSelling(false);
    }
  };

  const handleLinkBuy = async () => {
    if (!selectedPartner || !buyName || !buyPhone || !auth.currentUser) return;
    setIsLinkingBuy(true);
    
    try {
      await addDoc(collection(db, 'upi_accounts'), {
        userId: auth.currentUser.uid,
        type: 'Buy',
        partnerId: selectedPartner.id,
        partnerName: selectedPartner.name,
        name: buyName,
        phone: buyPhone,
        status: 'Active',
        createdAt: new Date().toISOString()
      });

      toast.success('Please buy using the UPI you have linked. Otherwise, your money may not be safe.', {
        duration: 5000,
        icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      });

      setCurrentView('main');
      setActiveTab('Buy');
      // Reset form
      setSelectedPartner(null);
      setBuyName('');
      setBuyPhone('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'upi_accounts');
    } finally {
      setIsLinkingBuy(false);
    }
  };

  const handleLinkSell = async () => {
    if (!auth.currentUser) return;
    if (sellMethod === 'UPI' && !sellUpiId) return;
    if (sellMethod === 'Bank' && (!bankAccNo || !bankIfsc || !bankName)) return;

    setIsLinkingSell(true);
    try {
      const accountData: any = {
        userId: auth.currentUser.uid,
        type: 'Sell',
        method: sellMethod,
        name: sellMethod === 'UPI' ? 'UPI Account' : bankName,
        status: 'Active',
        createdAt: new Date().toISOString()
      };

      if (sellMethod === 'UPI') {
        accountData.upiId = sellUpiId;
      } else {
        accountData.bankAccNo = bankAccNo;
        accountData.bankIfsc = bankIfsc;
        accountData.bankName = bankName;
      }

      await addDoc(collection(db, 'upi_accounts'), accountData);

      toast.success('Sell account linked successfully!');
      setCurrentView('main');
      setActiveTab('Sell');
      // Reset form
      setSellUpiId('');
      setBankAccNo('');
      setBankIfsc('');
      setBankName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'upi_accounts');
    } finally {
      setIsLinkingSell(false);
    }
  };

  const maskString = (str: string, type: 'phone' | 'upi' | 'bank') => {
    if (!str) return '';
    if (type === 'phone' && str.length >= 6) {
      return `${str.slice(0, 3)}****${str.slice(-3)}`;
    }
    if (type === 'upi' && str.includes('@')) {
      const [name, domain] = str.split('@');
      if (name.length > 2) {
        return `${name.slice(0, 1)}***@${domain}`;
      }
      return `***@${domain}`;
    }
    if (type === 'bank' && str.length >= 4) {
      return `****${str.slice(-4)}`;
    }
    return str;
  };

  if (currentView === 'link') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 pb-24 relative">
        {/* Header */}
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100 sticky top-0 z-10">
          <button onClick={() => setCurrentView('main')} className="p-1 -ml-1 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6 text-slate-700" />
          </button>
          <h1 className="flex-1 text-center font-bold text-slate-900 mr-6">Link New UPI</h1>
        </div>

        {/* Link Type Toggle */}
        <div className="p-4 bg-white border-b border-slate-100">
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setLinkType('Buy')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                linkType === 'Buy' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Buy UPI (Auto)
            </button>
            <button
              onClick={() => setLinkType('Sell')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                linkType === 'Sell' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sell Account (Manual)
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-3 text-center">
            {linkType === 'Buy' 
              ? 'Buy UPI requires OTP verification for automated processing.' 
              : 'Sell accounts are used for manual withdrawals.'}
          </p>
        </div>

        {/* Buy Form */}
        {linkType === 'Buy' && (
          <div className="mt-2 bg-white border-y border-slate-100">
            <button 
              onClick={() => setShowPartnerModal(true)}
              className="w-full flex items-center justify-between p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
            >
              <span className="text-slate-600 font-medium">Partner</span>
              <div className="flex items-center gap-2">
                <span className={selectedPartner ? "text-slate-900 font-bold" : "text-slate-400"}>
                  {selectedPartner ? selectedPartner.name : 'select the kyc partner'}
                </span>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </button>
            
            <div className="flex items-center p-4 border-b border-slate-100">
              <span className="text-slate-600 font-medium w-24">Name</span>
              <input 
                type="text" 
                placeholder="Enter your name" 
                value={buyName}
                onChange={(e) => setBuyName(e.target.value)}
                className="flex-1 outline-none text-slate-900 font-medium placeholder:text-slate-300 placeholder:font-normal bg-transparent"
              />
            </div>

            <div className="flex items-center p-4">
              <span className="text-slate-600 font-medium w-24">UPI ID</span>
              <input 
                type="text" 
                placeholder="Enter UPI ID" 
                value={buyPhone}
                onChange={(e) => setBuyPhone(e.target.value)}
                className="flex-1 outline-none text-slate-900 font-medium placeholder:text-slate-300 placeholder:font-normal bg-transparent"
              />
            </div>

            <div className="p-4 mt-4">
              <button 
                onClick={handleLinkBuy}
                disabled={!selectedPartner || !buyName || !buyPhone || isLinkingBuy}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isLinkingBuy ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Linking...
                  </>
                ) : (
                  'Link Kyc'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Sell Form */}
        {linkType === 'Sell' && (
          <div className="mt-2">
            <div className="bg-white border-y border-slate-100 p-4 mb-4">
              <label className="text-sm font-bold text-slate-700 mb-3 block">Withdrawal Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setSellMethod('UPI')}
                  className={`py-3 px-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    sellMethod === 'UPI' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-slate-200 text-slate-600'
                  }`}
                >
                  <AtSign className="w-6 h-6" />
                  <span className="font-bold text-sm">UPI ID</span>
                </button>
                <button 
                  onClick={() => setSellMethod('Bank')}
                  className={`py-3 px-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    sellMethod === 'Bank' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-slate-200 text-slate-600'
                  }`}
                >
                  <Building2 className="w-6 h-6" />
                  <span className="font-bold text-sm">Bank Account</span>
                </button>
              </div>
            </div>

            <div className="bg-white border-y border-slate-100">
              {sellMethod === 'UPI' ? (
                <div className="p-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">UPI ID</label>
                  <input 
                    type="text" 
                    placeholder="e.g. name@bank" 
                    value={sellUpiId}
                    onChange={(e) => setSellUpiId(e.target.value)}
                    className="w-full outline-none text-slate-900 font-medium placeholder:text-slate-300 py-2 border-b border-slate-200 focus:border-indigo-600 transition-colors bg-transparent"
                  />
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Account Holder Name</label>
                    <input 
                      type="text" 
                      placeholder="Enter full name" 
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full outline-none text-slate-900 font-medium placeholder:text-slate-300 py-2 border-b border-slate-200 focus:border-indigo-600 transition-colors bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Account Number</label>
                    <input 
                      type="text" 
                      placeholder="Enter account number" 
                      value={bankAccNo}
                      onChange={(e) => setBankAccNo(e.target.value)}
                      className="w-full outline-none text-slate-900 font-medium placeholder:text-slate-300 py-2 border-b border-slate-200 focus:border-indigo-600 transition-colors bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">IFSC Code</label>
                    <input 
                      type="text" 
                      placeholder="Enter IFSC code" 
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                      className="w-full outline-none text-slate-900 font-medium placeholder:text-slate-300 py-2 border-b border-slate-200 focus:border-indigo-600 transition-colors bg-transparent uppercase"
                    />
                  </div>
                </div>
              )}

              <div className="p-4 mt-2">
                <button 
                  onClick={handleLinkSell}
                  disabled={isLinkingSell || (sellMethod === 'UPI' ? !sellUpiId : (!bankAccNo || !bankIfsc || !bankName))}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                  {isLinkingSell ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Details'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Partner Selection Modal */}
        {showPartnerModal && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full rounded-t-3xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-full duration-300">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
                <h3 className="font-bold text-slate-800 text-lg">Choose a link authorization partner</h3>
                <button onClick={() => setShowPartnerModal(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-full">
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </button>
              </div>
              
              <div className="overflow-y-auto p-2">
                {PARTNERS.map((partner) => (
                  <div 
                    key={partner.id}
                    onClick={() => {
                      if (partner.available) {
                        setSelectedPartner(partner);
                        setShowPartnerModal(false);
                      }
                    }}
                    className={`flex items-start gap-4 p-4 rounded-2xl transition-colors ${
                      partner.available ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${partner.color}`}>
                      {partner.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800 text-base">{partner.name}</h4>
                      <p className="text-sm text-slate-500 mt-0.5 leading-snug">{partner.desc}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 mt-1">
                      <button className="bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-md">
                        Download
                      </button>
                      {selectedPartner?.id === partner.id ? (
                        <CheckCircle2 className="w-6 h-6 text-blue-500" />
                      ) : (
                        <Circle className={`w-6 h-6 ${partner.available ? 'text-slate-300' : 'text-slate-200'}`} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main View
  const activeAccounts = activeTab === 'Buy' ? buyAccounts : sellAccounts;

  return (
    <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="text-center py-4 font-bold text-slate-900 border-b border-slate-100 bg-white">
        UPI Management
      </div>

      {/* Warning */}
      <div className="bg-rose-50 mx-4 mt-4 p-3 rounded-xl border border-rose-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-rose-800 font-medium">
          If you change your UPI ID, please relink your UPI ID.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="px-4 mt-4 mb-6">
        <button 
          onClick={() => {
            setLinkType(activeTab);
            setCurrentView('link');
          }}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold shadow-md transition-all active:scale-[0.98]"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Link New UPI</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex justify-around border-b border-slate-200 bg-white mx-4 rounded-t-xl">
        <button 
          onClick={() => setActiveTab('Buy')}
          className={`py-3 font-bold px-4 w-1/2 transition-colors ${
            activeTab === 'Buy' 
              ? 'text-indigo-600 border-b-2 border-indigo-600' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Buy
        </button>
        <button 
          onClick={() => setActiveTab('Sell')}
          className={`py-3 font-bold px-4 w-1/2 transition-colors ${
            activeTab === 'Sell' 
              ? 'text-indigo-600 border-b-2 border-indigo-600' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Sell Form (Only in Sell Tab) */}
      {activeTab === 'Sell' && (
        <div className="bg-white mx-4 mb-6 rounded-b-xl p-5 shadow-sm border border-t-0 border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <span className="text-slate-600 font-bold">Available Balance</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Coins className="w-4 h-4 text-indigo-600" />
              ₹{eCoinBalance.toFixed(2)}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Amount to Sell (₹)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <IndianRupee className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="number"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-900 font-bold"
                placeholder="Enter amount"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Withdraw to
            </label>
            <select 
              value={selectedSellAccount}
              onChange={(e) => setSelectedSellAccount(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" disabled>Select an account</option>
              {sellAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.method === 'UPI' ? acc.upiId : `${acc.bankName} (****${acc.bankAccNo.slice(-4)})`}
                </option>
              ))}
            </select>
            {sellAccounts.length === 0 && (
              <p className="text-[10px] text-rose-500 font-bold mt-1">Please link a Sell account first</p>
            )}
          </div>

          <button 
            onClick={handleSellSubmit}
            disabled={isSelling || !sellAmount || sellAccounts.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-3.5 rounded-xl font-bold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isSelling ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Sell Now</>}
          </button>
        </div>
      )}

      {/* Linked Accounts List */}
      <div className="bg-white mx-4 rounded-b-xl shadow-sm border border-t-0 border-slate-100 divide-y divide-slate-100 min-h-[200px]">
        {activeAccounts.length === 0 ? (
          <div className="p-8 flex flex-col items-center justify-center text-center h-full">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-slate-800 font-bold mb-2">No Upi Linked</h3>
            <p className="text-slate-500 text-sm font-medium">
              please link atleast one Buy UPI or Sell UPI
            </p>
            <button 
              onClick={() => {
                setLinkType(activeTab);
                setCurrentView('link');
              }}
              className="mt-4 text-indigo-600 font-bold text-sm hover:underline"
            >
              Link {activeTab} Account Now
            </button>
          </div>
        ) : (
          activeAccounts.map((acc) => {
            const partnerInfo = PARTNERS.find(p => p.id === acc.partnerId) || PARTNERS[0];
            
            return (
              <div key={acc.id} className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  {activeTab === 'Buy' ? (
                    <>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${partnerInfo.color}`}>
                        {partnerInfo.icon}
                      </div>
                      <div>
                        <span className="text-slate-800 font-bold block">{acc.partnerName} ({maskString(acc.phone, 'upi')})</span>
                        <span className="text-slate-500 text-xs font-medium">{acc.name}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-indigo-100 text-indigo-600">
                        {acc.method === 'UPI' ? <AtSign className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                      </div>
                      <div>
                        <span className="text-slate-800 font-bold block">{acc.name}</span>
                        <span className="text-slate-500 text-xs font-medium">
                          {acc.method === 'UPI' ? maskString(acc.upiId, 'upi') : `****${maskString(acc.bankAccNo, 'bank')} (${acc.bankIfsc})`}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-6 bg-indigo-500 rounded-full relative cursor-pointer">
                      <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                    </div>
                    <span className="text-indigo-600 text-sm font-bold">{acc.status}</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-sm text-slate-700 font-bold transition-colors">
                      <Settings className="w-4 h-4" /> Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
