import { useState, useEffect } from 'react';
import { Volume2, Coins, IndianRupee, History, ArrowRightLeft, Bell } from 'lucide-react';
import { useAppStore } from '../store';
import Logo from './Logo';

export default function Home({ onNavigate }: { onNavigate?: (tab: 'buy' | 'upi' | 'mine') => void }) {
  const { 
    eCoinBalance, todayProfit, newsText, banners
  } = useAppStore();

  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const bannerImages = banners.length > 0 ? banners : ["https://picsum.photos/seed/elivexpay/800/400"];

  return (
    <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
      {/* Banner Section */}
      <div className="px-4 mt-6">
        <div className="relative h-40 w-full rounded-2xl overflow-hidden shadow-lg border border-slate-200">
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
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex flex-col justify-end p-4">
                <h2 className="text-white font-black text-xl leading-tight">Welcome to ElivexPay</h2>
                <p className="text-slate-200 text-xs font-bold uppercase tracking-wider">The Safest Way to Buy & Sell E-Coin</p>
              </div>
            </div>
          ))}
          {bannerImages.length > 1 && (
            <div className="absolute bottom-3 right-4 flex gap-1.5">
              {bannerImages.map((_, idx) => (
                <div 
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentBanner ? 'bg-white w-4' : 'bg-white/40'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-white mx-4 mt-8 rounded-2xl p-5 shadow-lg relative z-20 border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-800 text-lg">My E-Coin</span>
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">1 Rs = 1 E-Coin</span>
        </div>
        
        <div className="flex justify-between items-center mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <IndianRupee className="w-5 h-5" />
            </div>
            <span className="text-4xl font-black text-slate-900">{eCoinBalance.toFixed(2)}</span>
          </div>
          <button 
            onClick={() => onNavigate?.('buy')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
          >
            Buy Now
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 py-4 border-t border-slate-100">
          <div className="flex flex-col items-center text-center">
            <div className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wider">Today Profit</div>
            <div className="text-slate-800 font-bold text-lg">{todayProfit.toFixed(2)}</div>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wider">Reward</div>
            <div className="text-emerald-600 font-bold text-lg">4.5%</div>
          </div>
          <div className="flex justify-center items-center">
            <button 
              onClick={() => onNavigate?.('mine')}
              className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 py-4 border-t border-slate-100">
          <div className="flex flex-col items-center text-center">
            <div className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wider">Status</div>
            <div className="text-emerald-600 font-bold text-sm">Active</div>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wider">Sell Faster</div>
            <button 
              onClick={() => onNavigate?.('upi')}
              className="text-indigo-600 font-bold text-sm hover:underline"
            >
              Link UPI
            </button>
          </div>
          <div className="flex justify-center items-center">
            <button 
              onClick={() => onNavigate?.('mine')}
              className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Records
            </button>
          </div>
        </div>
      </div>

      {/* Notify Ticker */}
      <div className="bg-white mx-4 mt-4 rounded-xl p-3 shadow-sm flex items-center gap-3 border border-slate-100">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Bell className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 overflow-hidden">
          <span className="text-sm text-slate-600 font-medium truncate block">System Notification</span>
        </div>
      </div>

      {/* News Section */}
      <div className="bg-white mx-4 mt-4 rounded-xl p-5 shadow-sm border border-slate-100 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-indigo-600" />
            Latest News
          </h3>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <h4 className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{newsText}</h4>
            <span className="text-xs text-slate-400 mt-2 block font-medium">Updated Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
