import { useState, useEffect } from 'react';
import { Volume2, Coins, IndianRupee, History, ArrowRightLeft, Bell, Zap, Clock, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../store';
import Logo from './Logo';
import { motion, AnimatePresence } from 'motion/react';

export default function Home({ onNavigate }: { onNavigate?: (tab: 'buy' | 'upi' | 'mine') => void }) {
  const { 
    eCoinBalance, todayProfit, newsText, banners, newsUpdateDate,
    isAutoSellEnabled, activeAutoOrder
  } = useAppStore();

  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const bannerImages = banners.length > 0 ? banners : [
    "https://picsum.photos/seed/elivexpay1/800/400",
    "https://picsum.photos/seed/elivexpay2/800/400",
    "https://picsum.photos/seed/elivexpay3/800/400"
  ];

  return (
    <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
      {/* App Header */}
      <div className="px-6 pt-8 pb-2 flex flex-col items-center">
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100/50 border border-slate-100 mb-3">
          <Logo className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter">ELiveXPay</h1>
        <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] mt-1 text-center">
          Premium E-coin Exchange, Secure, Instant, Reliable
        </p>
      </div>

      {/* Banner Section */}
      <div className="px-4 mt-4">
        <div className="relative h-44 w-full rounded-[2rem] overflow-hidden shadow-xl border border-slate-200">
          {bannerImages.map((img, idx) => (
            <div 
              key={idx}
              className={`absolute inset-0 transition-opacity duration-1000 ${idx === currentBanner ? 'opacity-100' : 'opacity-0'}`}
            >
              <img 
                src={img} 
                alt={`Banner ${idx + 1}`} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-slate-900/60 flex flex-col items-center justify-end p-6">
                <div className="w-full flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">System Online</span>
                  </div>
                  <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">v2.5.6.7</span>
                </div>
              </div>
            </div>
          ))}
          {bannerImages.length > 1 && (
            <div className="absolute bottom-4 right-6 flex gap-1.5">
              {bannerImages.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-1 rounded-full transition-all duration-500 ${idx === currentBanner ? 'bg-white w-6' : 'bg-white/30 w-2'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Professional Balance Card */}
      <div className="mx-4 mt-8 relative">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg z-30 border-2 border-white">
          Verified Account
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-indigo-100/50 border border-slate-100 relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-50 rounded-full -ml-12 -mb-12 blur-2xl opacity-50"></div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                  <Coins className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Balance</span>
                  <span className="font-black text-slate-900 text-lg tracking-tight">E-Coin Wallet</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-wider">
                  1 Rs = 1 EC
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center mb-8">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black text-slate-400">₹</span>
                <span className="text-6xl font-black text-slate-900 tracking-tighter">
                  {eCoinBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-slate-400 text-xs font-bold mt-2">Available for withdrawal</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => onNavigate?.('buy')}
                className="bg-slate-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                RECHARGE
              </button>
              <button 
                onClick={() => onNavigate?.('mine')}
                className="bg-white text-slate-900 border-2 border-slate-100 py-4 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <History className="w-4 h-4" />
                HISTORY
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Auto Selling Status Indicator */}
      <AnimatePresence>
        {isAutoSellEnabled && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mx-4 mt-4"
          >
            <div className="bg-indigo-900 rounded-[2rem] p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                      <Zap className="w-6 h-6 text-amber-400 animate-pulse" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-indigo-900 animate-ping"></div>
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm tracking-tight">Auto-Selling Active</h4>
                    <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                      {activeAutoOrder?.accountDetails?.upiId ? `UPI: ${activeAutoOrder.accountDetails.upiId}` : 'System is processing orders'}
                    </p>
                  </div>
                </div>
                
                {activeAutoOrder ? (
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end text-amber-400 mb-1">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Processing</span>
                    </div>
                    <span className="text-white font-black text-lg tracking-tighter">₹{activeAutoOrder.amount}</span>
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/10">
                    <span className="text-white/60 text-[10px] font-black uppercase tracking-widest">Waiting...</span>
                  </div>
                )}
              </div>

              {activeAutoOrder && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">
                    <span>Order Progress</span>
                    <span>5:00 min</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 300, ease: "linear" }}
                      className="bg-gradient-to-r from-amber-400 to-amber-200 h-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mx-4 mt-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Today Profit</span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">₹{todayProfit.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Security</span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">SSL 256</div>
        </div>
      </div>

      {/* News Section */}
      <div className="bg-white mx-4 mt-6 rounded-[2rem] p-6 shadow-sm border border-slate-100 mb-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-indigo-600" />
            </div>
            Latest Updates
          </h3>
        </div>

        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
          <h4 className="text-slate-700 text-sm font-bold leading-relaxed whitespace-pre-wrap">{newsText}</h4>
          <div className="flex items-center gap-2 mt-4">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Updated {newsUpdateDate || 'Today'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add TrendingUp import which was missing in the previous version but used in the stats grid
import { TrendingUp } from 'lucide-react';
