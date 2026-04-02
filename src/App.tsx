import { useState, useEffect } from 'react';
import { HeadphonesIcon } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import ErrorBoundary from './components/ErrorBoundary';
import Auth from './components/Auth';
import Home from './components/Home';
import Buy from './components/Buy';
import UPI from './components/UPI';
import Team from './components/Team';
import Profile from './components/Profile';
import BottomNav from './components/BottomNav';
import Admin from './components/Admin';
import { useAppStore } from './store';

type Tab = 'home' | 'buy' | 'upi' | 'team' | 'mine' | 'admin';

export default function App() {
  const { 
    isAdmin, setIsAdmin, setECoinBalance,
    setNewsText, setTelegramLink, setInstagramLink, 
    setTutorialVideos, setBanners, setCareIds, setNewbieRewardAmount,
    setTodayProfit, setTotalBuyAmount, setHasBoughtAnyAmount,
    setIsTelegramJoined, setIsInstagramFollowed, setNewbieRewardClaimed,
    setShortId, setMobile
  } = useAppStore();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('home');

  useEffect(() => {
    // Handle invitation link
    const path = window.location.pathname;
    if (path.startsWith('/rs/')) {
      const code = path.split('/rs/')[1];
      if (code) {
        localStorage.setItem('pending_invitation_code', code);
        // Redirect to root to show Auth component
        window.history.replaceState({}, '', '/');
      }
    }

    // Sync global settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.newsText) setNewsText(data.newsText);
        if (data.telegramLink) setTelegramLink(data.telegramLink);
        if (data.instagramLink) setInstagramLink(data.instagramLink);
        if (data.tutorialVideos) setTutorialVideos(data.tutorialVideos);
        if (data.banners) setBanners(data.banners);
        if (data.careIds) setCareIds(data.careIds);
        if (data.newbieRewardAmount) setNewbieRewardAmount(data.newbieRewardAmount);
      }
    }, (error) => {
      console.error("Error syncing global settings:", error);
    });

    return () => unsubSettings();
  }, [setNewsText, setTelegramLink, setInstagramLink, setTutorialVideos, setBanners, setCareIds, setNewbieRewardAmount]);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        try {
          // One-time check for admin role
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }

          // Real-time sync for user data
          if (unsubUser) unsubUser();
          unsubUser = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              const today = new Date().toISOString().split('T')[0];
              
              // Reset todayProfit and todayTeamCommission if it's a new day
              if ((data.lastProfitDate !== today && data.todayProfit !== 0) || (data.lastCommissionDate !== today && data.todayTeamCommission !== 0)) {
                try {
                  const { updateDoc: firestoreUpdateDoc } = await import('firebase/firestore');
                  const updates: any = {};
                  if (data.lastProfitDate !== today) {
                    updates.todayProfit = 0;
                    updates.lastProfitDate = today;
                  }
                  if (data.lastCommissionDate !== today) {
                    updates.todayTeamCommission = 0;
                    updates.lastCommissionDate = today;
                  }
                  if (Object.keys(updates).length > 0) {
                    await firestoreUpdateDoc(doc(db, 'users', user.uid), updates);
                  }
                } catch (e) {
                  console.error("Error resetting daily stats:", e);
                }
              }

              if (data.eCoinBalance !== undefined) setECoinBalance(data.eCoinBalance);
              if (data.todayProfit !== undefined) setTodayProfit(data.todayProfit);
              if (data.totalBuyAmount !== undefined) setTotalBuyAmount(data.totalBuyAmount);
              if (data.hasBoughtAnyAmount !== undefined) setHasBoughtAnyAmount(data.hasBoughtAnyAmount);
              if (data.telegramJoined !== undefined) setIsTelegramJoined(data.telegramJoined);
              if (data.instagramFollowed !== undefined) setIsInstagramFollowed(data.instagramFollowed);
              if (data.newbieRewardClaimed !== undefined) setNewbieRewardClaimed(data.newbieRewardClaimed);
              if (data.shortId !== undefined) setShortId(data.shortId);
              if (data.mobile !== undefined) setMobile(data.mobile);
              if (data.todayTeamCommission !== undefined) useAppStore.getState().setTodayTeamCommission(data.todayTeamCommission);
              if (data.dailyBonusClaimedDate !== undefined) useAppStore.getState().setDailyBonusClaimedDate(data.dailyBonusClaimedDate);
            }
          }, (error) => {
            console.error("Error syncing user data:", error);
          });
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setIsLoggedIn(false);
        setIsAdmin(false);
        useAppStore.getState().resetStore();
        if (unsubUser) unsubUser();
        unsubUser = undefined;
      }
      setIsAuthReady(true);
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
    };
  }, [
    setIsAdmin, setECoinBalance, setTodayProfit, 
    setTotalBuyAmount, setHasBoughtAnyAmount,
    setIsTelegramJoined, setIsInstagramFollowed,
    setNewbieRewardClaimed, setShortId, setMobile
  ]);

  // Handle hash routing for admin panel
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin' && isAdmin) {
        setActiveTab('admin');
      } else if (activeTab === 'admin' && !isAdmin) {
        setActiveTab('home');
        window.location.hash = '';
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Initial check
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAdmin, activeTab]);

  if (!isAuthReady) {
    return (
      <div className="bg-black min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="bg-black min-h-screen flex justify-center items-center font-sans text-slate-800">
        <Toaster position="top-center" />
        {/* Mobile App Container */}
        <div className="w-full max-w-md h-[100dvh] bg-slate-50 relative flex flex-col overflow-hidden shadow-2xl sm:rounded-[2.5rem] sm:h-[90vh] sm:border-[8px] sm:border-slate-900">
          
          {!isLoggedIn ? (
            <Auth onLogin={() => setIsLoggedIn(true)} />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto scroll-smooth bg-slate-50">
                {activeTab === 'home' && <Home onNavigate={(tab) => setActiveTab(tab)} />}
                {activeTab === 'buy' && <Buy />}
                {activeTab === 'upi' && <UPI />}
                {activeTab === 'team' && <Team />}
                {activeTab === 'mine' && <Profile 
                  onNavigate={(tab) => setActiveTab(tab)}
                  onLogout={() => {
                    auth.signOut();
                    useAppStore.getState().resetStore();
                  }} 
                />}
                {activeTab === 'admin' && isAdmin && (
                  <Admin onBack={() => {
                    window.location.hash = '';
                    setActiveTab('mine');
                  }} />
                )}
              </div>
              
              {/* Floating Support Button - Hide on admin page */}
              {activeTab !== 'admin' && (
                <button 
                  onClick={() => window.open(useAppStore.getState().telegramLink, '_blank')}
                  className="absolute bottom-20 right-4 w-12 h-12 bg-indigo-50 rounded-full shadow-lg flex items-center justify-center border-2 border-indigo-200 z-40 hover:bg-indigo-100 transition-colors"
                >
                  <HeadphonesIcon className="w-6 h-6 text-indigo-600" />
                </button>
              )}

              {/* Hide bottom nav on admin page */}
              {activeTab !== 'admin' && (
                <BottomNav activeTab={activeTab as any} setActiveTab={setActiveTab as any} />
              )}
            </>
          )}

        </div>
      </div>
    </ErrorBoundary>
  );
}
