import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  newsText: string;
  setNewsText: (text: string) => void;
  csrTelegramId: string;
  setCsrTelegramId: (id: string) => void;
  telegramLink: string;
  setTelegramLink: (link: string) => void;
  instagramLink: string;
  setInstagramLink: (link: string) => void;
  tutorialVideoUrl: string;
  setTutorialVideoUrl: (url: string) => void;
  tutorialVideos: string[];
  setTutorialVideos: (videos: string[]) => void;
  banners: string[];
  setBanners: (banners: string[]) => void;
  careIds: string[];
  setCareIds: (ids: string[]) => void;
  newbieRewardAmount: number;
  setNewbieRewardAmount: (amount: number) => void;
  newsUpdateDate: string;
  setNewsUpdateDate: (date: string) => void;
  
  // User balances (everything 0 today)
  eCoinBalance: number;
  setECoinBalance: (amount: number) => void;
  todayProfit: number;
  totalBought: number;
  totalPending: number;
  totalApproved: number;
  totalSold: number;
  themeDeducted: number;
  totalBuyAmount: number; // For 5K transaction mission
  setTotalBuyAmount: (amount: number) => void;
  hasBoughtAnyAmount: boolean; // For "Buy Any Amount" task
  setHasBoughtAnyAmount: (bought: boolean) => void;
  isUpiLinked: boolean;
  setIsUpiLinked: (linked: boolean) => void;
  isTutorialWatched: boolean;
  setIsTutorialWatched: (watched: boolean) => void;
  setTodayProfit: (amount: number) => void;
  todayTeamCommission: number;
  setTodayTeamCommission: (amount: number) => void;
  dailyBonusClaimedDate: string;
  setDailyBonusClaimedDate: (date: string) => void;
  isTelegramJoined: boolean;
  setIsTelegramJoined: (joined: boolean) => void;
  isInstagramFollowed: boolean;
  setIsInstagramFollowed: (followed: boolean) => void;
  isVipJoined: boolean;
  setIsVipJoined: (joined: boolean) => void;
  isScreenshotSubmitted: boolean;
  setIsScreenshotSubmitted: (submitted: boolean) => void;
  isAutoSellEnabled: boolean;
  setIsAutoSellEnabled: (enabled: boolean) => void;
  isBoostEnabled: boolean;
  setIsBoostEnabled: (enabled: boolean) => void;
  lastAutoSellTime: string;
  setLastAutoSellTime: (time: string) => void;
  newbieRewardClaimed: boolean;
  setNewbieRewardClaimed: (claimed: boolean) => void;
  shortId: string;
  setShortId: (id: string) => void;
  mobile: string;
  setMobile: (mobile: string) => void;
  activeAutoOrder: any | null;
  setActiveAutoOrder: (order: any | null) => void;
  addPurchase: (amount: number) => void;
  sellEcoin: (amount: number) => void;
  refundEcoin: (amount: number) => void;
  resetStore: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isAdmin: false,
      setIsAdmin: (isAdmin) => set({ isAdmin }),
      newsText: 'Welcome to ElivexPay! Enjoy our new 4.5% reward on purchases today.',
      setNewsText: (newsText) => set({ newsText }),
      csrTelegramId: '@elivexpaycsr',
      setCsrTelegramId: (csrTelegramId) => set({ csrTelegramId }),
      telegramLink: 'https://t.me/ElivexPayOfc',
      setTelegramLink: (telegramLink) => set({ telegramLink }),
      instagramLink: 'https://www.instagram.com/elivexpayofc',
      setInstagramLink: (instagramLink) => set({ instagramLink }),
      tutorialVideoUrl: 'https://youtube.com',
      setTutorialVideoUrl: (tutorialVideoUrl) => set({ tutorialVideoUrl }),
      tutorialVideos: ['https://youtube.com'],
      setTutorialVideos: (tutorialVideos) => set({ tutorialVideos }),
      banners: ['https://picsum.photos/seed/banner1/800/400'],
      setBanners: (banners) => set({ banners }),
      careIds: ['@elivexpaycsr1', '@elivexpaycsr2', '@elivexpaycsr3'],
      setCareIds: (careIds) => set({ careIds }),
      newbieRewardAmount: 200,
      setNewbieRewardAmount: (newbieRewardAmount) => set({ newbieRewardAmount }),
      newsUpdateDate: new Date().toLocaleDateString(),
      setNewsUpdateDate: (newsUpdateDate) => set({ newsUpdateDate }),
      
      eCoinBalance: 0,
      setECoinBalance: (eCoinBalance) => set({ eCoinBalance }),
      todayProfit: 0,
      setTodayProfit: (todayProfit) => set({ todayProfit }),
      totalBought: 0,
      totalPending: 0,
      totalApproved: 0,
      totalSold: 0,
      themeDeducted: 0,
      totalBuyAmount: 0,
      setTotalBuyAmount: (totalBuyAmount) => set({ totalBuyAmount }),
      hasBoughtAnyAmount: false,
      setHasBoughtAnyAmount: (hasBoughtAnyAmount) => set({ hasBoughtAnyAmount }),
      isUpiLinked: false,
      setIsUpiLinked: (isUpiLinked) => set({ isUpiLinked }),
      isTutorialWatched: false,
      setIsTutorialWatched: (isTutorialWatched) => set({ isTutorialWatched }),
      isTelegramJoined: false,
      setIsTelegramJoined: (isTelegramJoined) => set({ isTelegramJoined }),
      isInstagramFollowed: false,
      setIsInstagramFollowed: (isInstagramFollowed) => set({ isInstagramFollowed }),
      isVipJoined: false,
      setIsVipJoined: (isVipJoined) => set({ isVipJoined }),
      isScreenshotSubmitted: false,
      setIsScreenshotSubmitted: (isScreenshotSubmitted) => set({ isScreenshotSubmitted }),
      isAutoSellEnabled: false,
      setIsAutoSellEnabled: (isAutoSellEnabled) => set({ isAutoSellEnabled }),
      isBoostEnabled: false,
      setIsBoostEnabled: (isBoostEnabled) => set({ isBoostEnabled }),
      lastAutoSellTime: '',
      setLastAutoSellTime: (lastAutoSellTime) => set({ lastAutoSellTime }),
      newbieRewardClaimed: false,
      setNewbieRewardClaimed: (newbieRewardClaimed) => set({ newbieRewardClaimed }),
      shortId: '',
      setShortId: (shortId) => set({ shortId }),
      mobile: '',
      setMobile: (mobile) => set({ mobile }),
      activeAutoOrder: null,
      setActiveAutoOrder: (activeAutoOrder) => set({ activeAutoOrder }),
      todayTeamCommission: 0,
      setTodayTeamCommission: (todayTeamCommission) => set({ todayTeamCommission }),
      dailyBonusClaimedDate: '',
      setDailyBonusClaimedDate: (dailyBonusClaimedDate) => set({ dailyBonusClaimedDate }),
      
      addPurchase: (amount) => set((state) => {
        const bonus = amount * 0.045;
        return {
          eCoinBalance: state.eCoinBalance + amount + bonus,
          todayProfit: state.todayProfit + bonus,
          totalBought: state.totalBought + amount,
          totalBuyAmount: state.totalBuyAmount + amount,
        };
      }),
      
      sellEcoin: (amount) => set((state) => ({
        eCoinBalance: state.eCoinBalance - amount,
        totalSold: state.totalSold + amount,
      })),
      
      refundEcoin: (amount) => set((state) => ({
        eCoinBalance: state.eCoinBalance + amount,
        totalSold: state.totalSold - amount,
      })),

      resetStore: () => set({
        isAdmin: false,
        eCoinBalance: 0,
        todayProfit: 0,
        totalBought: 0,
        totalPending: 0,
        totalApproved: 0,
        totalSold: 0,
        themeDeducted: 0,
        totalBuyAmount: 0,
        isTelegramJoined: false,
        isInstagramFollowed: false,
        isVipJoined: false,
      }),
    }),
    {
      name: 'elivexpay-storage',
    }
  )
);
