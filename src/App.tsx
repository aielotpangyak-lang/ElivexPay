import { useState, useEffect } from 'react';
import { HeadphonesIcon } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
console.log("App initialized with auth:", !!auth, "and db:", !!db);
import ErrorBoundary from './components/ErrorBoundary';
import Auth from './components/Auth';
import Home from './components/Home';
import Buy from './components/Buy';
import UPI from './components/UPI';
import Team from './components/Team';
import Profile from './components/Profile';
import BottomNav from './components/BottomNav';
import Admin from './components/Admin';
import AutoSellManager from './components/AutoSellManager';
import SplashScreen from './components/SplashScreen';
import { useAppStore } from './store';

type Tab = 'home' | 'buy' | 'upi' | 'team' | 'mine' | 'admin';

export default function App() {
  const { 
    isAdmin, setIsAdmin, setECoinBalance,
    setNewsText, setTelegramLink, setInstagramLink, 
    setTutorialVideos, setBanners, setCareIds, setNewbieRewardAmount,
    setTodayProfit, setTotalBuyAmount, setHasBoughtAnyAmount,
    setIsTelegramJoined, setIsInstagramFollowed, setNewbieRewardClaimed,
    setShortId, setMobile, setIsAutoSellEnabled, setIsBoostEnabled, setLastAutoSellTime
  } = useAppStore();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('home');

  return (
    <Router>
      <AppContent 
        isSplashVisible={isSplashVisible}
        setIsSplashVisible={setIsSplashVisible}
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
        isAuthReady={isAuthReady}
        setIsAuthReady={setIsAuthReady}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdmin={isAdmin}
        setIsAdmin={setIsAdmin}
      />
    </Router>
  );
}

function AppContent({ 
  isSplashVisible, setIsSplashVisible, isLoggedIn, setIsLoggedIn, isAuthReady, setIsAuthReady,
  activeTab, setActiveTab, isAdmin, setIsAdmin 
}: any) {
  const location = useLocation();
  const { 
    setECoinBalance, setNewsText, setTelegramLink, setInstagramLink, 
    setTutorialVideos, setBanners, setCareIds, setNewbieRewardAmount,
    setTodayProfit, setTotalBuyAmount, setHasBoughtAnyAmount,
    setIsTelegramJoined, setIsInstagramFollowed, setNewbieRewardClaimed,
    setShortId, setMobile, setIsAutoSellEnabled, setIsBoostEnabled, setLastAutoSellTime,
    setAppDomain
  } = useAppStore();

  useEffect(() => {
    console.log("Current route on app load:", location.pathname);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashVisible(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [setIsSplashVisible]);

  useEffect(() => {
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
        if (data.appDomain) setAppDomain(data.appDomain);
      }
    }, (error) => {
      console.error("Error syncing global settings:", error);
    });

    return () => unsubSettings();
  }, [setNewsText, setTelegramLink, setInstagramLink, setTutorialVideos, setBanners, setCareIds, setNewbieRewardAmount, setAppDomain]);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        try {
          // One-time check for admin role
          const userDoc = await getDocFromServer(doc(db, 'users', user.uid));
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
              if (data.isAutoSellEnabled !== undefined) setIsAutoSellEnabled(data.isAutoSellEnabled);
              if (data.isBoostEnabled !== undefined) setIsBoostEnabled(data.isBoostEnabled);
              if (data.lastAutoSellTime !== undefined) setLastAutoSellTime(data.lastAutoSellTime);
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
    setNewbieRewardClaimed, setShortId, setMobile,
    setIsLoggedIn, setIsAuthReady
  ]);

  if (!isAuthReady) {
    return (
      <div className="bg-black min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AnimatePresence>
        {isSplashVisible && <SplashScreen />}
      </AnimatePresence>
      
      <div className="bg-slate-200 min-h-screen flex justify-center items-center font-sans text-slate-800">
        <Toaster position="top-center" />
        {/* Mobile App Container */}
        <div className="w-full max-w-md h-[100dvh] bg-white relative flex flex-col overflow-hidden shadow-xl sm:rounded-3xl sm:h-[90vh] sm:border border-slate-300">
          
          <Routes>
            <Route path="/login" element={
              !isLoggedIn ? <Auth onLogin={() => setIsLoggedIn(true)} initialIsLogin={true} /> : <Navigate to="/" />
            } />
            <Route path="/rs/:refCode" element={
              !isLoggedIn ? <Auth onLogin={() => setIsLoggedIn(true)} initialIsLogin={false} /> : <Navigate to="/" />
            } />
            <Route path="/" element={
              !isLoggedIn ? <Navigate to="/login" /> : (
                <>
                  <AutoSellManager />
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
                        setActiveTab('mine');
                      }} />
                    )}
                  </div>
                  
                  {/* Floating Support Button - Hide on admin page */}
                  {activeTab !== 'admin' && (
                    <motion.button 
                      drag
                      dragConstraints={{ left: -300, right: 0, top: -600, bottom: 0 }}
                      whileDrag={{ scale: 1.1 }}
                      onClick={() => window.open(useAppStore.getState().telegramLink, '_blank')}
                      className="absolute bottom-20 right-4 w-12 h-12 bg-blue-50 rounded-full shadow-md flex items-center justify-center border border-blue-100 z-40 hover:bg-blue-100 transition-colors"
                    >
                      <HeadphonesIcon className="w-6 h-6 text-blue-700" />
                    </motion.button>
                  )}

                  {/* Hide bottom nav on admin page */}
                  {activeTab !== 'admin' && (
                    <BottomNav activeTab={activeTab as any} setActiveTab={setActiveTab as any} />
                  )}
                </>
              )
            } />
          </Routes>
        </div>
      </div>
    </ErrorBoundary>
  );
}
