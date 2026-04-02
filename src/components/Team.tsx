import { useState, useEffect, useRef } from 'react';
import { User, Copy, QrCode, ChevronRight, Users, TrendingUp, Award, Link as LinkIcon, Check, X, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { useAppStore } from '../store';

const Team = () => {
  const { 
    shortId: globalShortId, 
    eCoinBalance: globalECoinBalance,
    todayTeamCommission: globalTodayTeamCommission,
    dailyBonusClaimedDate: globalDailyBonusClaimedDate,
    setECoinBalance,
    setTodayTeamCommission,
    setDailyBonusClaimedDate
  } = useAppStore();

  const [shortId, setShortId] = useState<string>(globalShortId || 'Loading...');
  const [copiedCode, setCopiedCode] = useState(false);
  
  const [teamCount, setTeamCount] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [yesterdayCommission, setYesterdayCommission] = useState(0);
  const [claimedNewbieRewards, setClaimedNewbieRewards] = useState<string[]>([]);
  const [level1Members, setLevel1Members] = useState<any[]>([]);
  const [level2Members, setLevel2Members] = useState<any[]>([]);
  const [level3Members, setLevel3Members] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [view, setView] = useState<'main' | 'rewards' | 'details'>('main');
  const [activeTab, setActiveTab] = useState<'L1' | 'L2' | 'L3'>('L1');
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialView = params.get('teamView');
    if (initialView === 'details') {
      setView('details');
      // Clear the parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (globalShortId) setShortId(globalShortId);
  }, [globalShortId]);

  useEffect(() => {
    let unsubTeam: (() => void) | undefined;

    const fetchUserData = async () => {
      if (auth.currentUser) {
        const userId = auth.currentUser.uid;
        try {
          // Fetch User Data
          const userRef = doc(db, 'users', userId);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            let currentShortId = data.shortId;

            // Auto-backfill if missing
            if (!currentShortId) {
              const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
              currentShortId = '';
              for (let i = 0; i < 6; i++) {
                currentShortId += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              await updateDoc(userRef, { shortId: currentShortId });
              await setDoc(doc(db, 'short_ids', currentShortId.toLowerCase()), { uid: userId, shortId: currentShortId.toLowerCase() });
            }

            setShortId(currentShortId);
            setECoinBalance(data.eCoinBalance || 0);
            setDailyBonusClaimedDate(data.dailyBonusClaimedDate || null);
            setClaimedNewbieRewards(data.claimedNewbieRewards || []);
          }

          // Real-time Team Count & Notifications (Level 1)
          const usersRef = collection(db, 'users');
          const teamQuery = query(usersRef, where('referrerId', '==', userId));
          
          setLoadingMembers(true);
          unsubTeam = onSnapshot(teamQuery, async (snapshot) => {
            const l1 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLevel1Members(l1);
            
            // Fetch Level 2
            if (l1.length > 0) {
              const l1Ids = l1.map(m => m.id);
              const l2Query = query(usersRef, where('referrerId', 'in', l1Ids.slice(0, 30)));
              const l2Snapshot = await getDocs(l2Query);
              const l2 = l2Snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              setLevel2Members(l2);

              // Fetch Level 3
              if (l2.length > 0) {
                const l2Ids = l2.map(m => m.id);
                const l3Query = query(usersRef, where('referrerId', 'in', l2Ids.slice(0, 30)));
                const l3Snapshot = await getDocs(l3Query);
                const l3 = l3Snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setLevel3Members(l3);
              } else {
                setLevel3Members([]);
              }
            } else {
              setLevel2Members([]);
              setLevel3Members([]);
            }

            setLoadingMembers(false);
            isInitialLoad.current = false;
          }, (error) => {
            // Only report error if user is still logged in
            if (auth.currentUser) {
              handleFirestoreError(error, OperationType.GET, 'team_snapshot');
            }
          });

          // Fetch Commissions
          const commissionsRef = collection(db, 'commissions');
          const commissionsQuery = query(commissionsRef, where('receiverId', '==', userId));
          const commissionsSnapshot = await getDocs(commissionsQuery);
          
          let total = 0;
          let yesterday = 0;

          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const yesterdayStart = todayStart - 86400000;

          commissionsSnapshot.forEach((doc) => {
            const data = doc.data();
            const amount = data.amount || 0;
            const createdAt = new Date(data.createdAt).getTime();

            total += amount;

            if (createdAt >= yesterdayStart && createdAt < todayStart) {
              yesterday += amount;
            }
          });

          setTotalCommission(total);
          setYesterdayCommission(yesterday);

        } catch (error) {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, 'team_data');
          }
          setShortId('Error');
        }
      }
    };

    fetchUserData();

    return () => {
      if (unsubTeam) unsubTeam();
    };
  }, [auth.currentUser]);

  useEffect(() => {
    setTeamCount(level1Members.length + level2Members.length + level3Members.length);
  }, [level1Members, level2Members, level3Members]);

  const handleCopyCode = () => {
    if (shortId && shortId !== 'Loading...' && shortId !== 'Error') {
      navigator.clipboard.writeText(shortId);
      setCopiedCode(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleClaimDailyBonus = async () => {
    if (!auth.currentUser || globalTodayTeamCommission < 500) return;
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (globalDailyBonusClaimedDate === todayStr) {
      toast.error('Daily bonus already claimed for today!');
      return;
    }
    
    const userId = auth.currentUser.uid;
    const userRef = doc(db, 'users', userId);
    
    try {
      const { increment } = await import('firebase/firestore');
      await updateDoc(userRef, {
        eCoinBalance: increment(300),
        dailyBonusClaimedDate: todayStr
      });
      setDailyBonusClaimedDate(todayStr);
      setECoinBalance(globalECoinBalance + 300);
      toast.success('300 E-Coin Daily Bonus claimed successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleClaimReferralReward = async (memberId: string) => {
    if (!auth.currentUser || claimedNewbieRewards.includes(memberId)) return;
    
    const userId = auth.currentUser.uid;
    const userRef = doc(db, 'users', userId);
    
    try {
      const newClaimed = [...claimedNewbieRewards, memberId];
      const { increment } = await import('firebase/firestore');
      await updateDoc(userRef, {
        eCoinBalance: increment(500),
        claimedNewbieRewards: newClaimed
      });
      setClaimedNewbieRewards(newClaimed);
      setECoinBalance(globalECoinBalance + 500);
      toast.success('500 E-Coin Referral Reward claimed!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isDailyBonusClaimed = globalDailyBonusClaimedDate === todayStr;

  if (view === 'rewards') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        {/* Header */}
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">Member Rewards</h2>
        </div>

        <div className="p-4 flex-1">
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Award className="w-5 h-5 text-rose-500" />
              <h3 className="font-bold text-rose-800">Referral Bonus</h3>
            </div>
            <p className="text-xs text-rose-600 font-medium">Claim 500 E-Coin for every direct referral who completes ₹5000 in transactions.</p>
          </div>

          <div className="space-y-3">
            {loadingMembers ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              level1Members.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-sm font-medium italic">No direct members found yet</p>
                </div>
              ) : (
                level1Members.map((member) => {
                  const isClaimed = claimedNewbieRewards.includes(member.id);
                  const canClaim = (member.totalBuyAmount || 0) >= 5000 && !isClaimed;

                    return (
                      <div key={member.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 transition-all active:scale-[0.98]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">UID: {member.shortId || '...'}</span>
                                {(member.totalBuyAmount || 0) >= 5000 && (
                                  <span className="bg-emerald-100 text-emerald-600 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Task Done</span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 font-medium">{member.mobile || 'No mobile'}</span>
                            </div>
                          </div>

                          <button 
                            disabled={!canClaim}
                            onClick={() => handleClaimReferralReward(member.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 ${
                              isClaimed 
                                ? 'bg-emerald-100 text-emerald-600 cursor-default' 
                                : canClaim 
                                  ? 'bg-rose-500 text-white hover:bg-rose-600' 
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {isClaimed ? 'Claimed' : canClaim ? 'Claim 500 E-Coin' : 'Reward'}
                          </button>
                        </div>

                        {!(member.totalBuyAmount >= 5000) && (
                          <div className="pt-2 border-t border-slate-50">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                              <span>Progress</span>
                              <span>₹{(member.totalBuyAmount || 0).toFixed(0)} / ₹5000</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="h-full bg-indigo-500 transition-all duration-500"
                                style={{ width: `${Math.min(((member.totalBuyAmount || 0) / 5000) * 100, 100)}%` }}
                              ></div>
                            </div>
                            <p className="text-[9px] text-slate-400 font-medium mt-1.5 text-right italic">
                              ₹{(5000 - (member.totalBuyAmount || 0)).toFixed(0)} more needed to be claimable
                            </p>
                          </div>
                        )}
                      </div>
                    );
                })
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'details') {
    return (
      <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
        {/* Header */}
        <div className="flex items-center px-4 py-4 bg-white border-b border-slate-100">
          <button onClick={() => setView('main')} className="p-1 hover:bg-slate-100 rounded-full mr-2">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg">Team Details</h2>
        </div>

        <div className="flex border-b border-slate-100 bg-white sticky top-0 z-10">
          {(['L1', 'L2', 'L3'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${
                activeTab === tab 
                  ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50' 
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              Level {tab.slice(1)} ({
                tab === 'L1' ? level1Members.length : 
                tab === 'L2' ? level2Members.length : 
                level3Members.length
              })
            </button>
          ))}
        </div>

        <div className="p-4 flex-1">
          <div className="space-y-3">
            {loadingMembers ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              (activeTab === 'L1' ? level1Members : activeTab === 'L2' ? level2Members : level3Members).length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic">No members found in this level</div>
              ) : (
                (activeTab === 'L1' ? level1Members : activeTab === 'L2' ? level2Members : level3Members).map((member) => {
                  return (
                    <div key={member.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">UID: {member.shortId || '...'}</span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">{member.mobile || 'No mobile'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-24 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="text-center py-4 font-bold text-slate-900 border-b border-slate-100 bg-white">
        My Team
      </div>

      {/* Profile Info */}
      <div className="bg-white p-5 flex items-center justify-between border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100">
            <User className="w-7 h-7 text-indigo-500" />
          </div>
          <div>
            <span className="text-slate-900 font-bold block text-sm truncate max-w-[200px]">UID: {shortId}</span>
            <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block">Reward: 4.5%</span>
          </div>
        </div>
      </div>

      {/* Stats List */}
      <div className="bg-white mt-4 border-y border-slate-100 shadow-sm divide-y divide-slate-50">
        <button 
          onClick={() => { setView('details'); setActiveTab('L1'); }}
          className="w-full flex justify-between items-center p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-slate-700 font-medium">Team Count</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-indigo-600 font-bold">{teamCount}</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
        </button>
        
        <div className="flex justify-between items-center p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-slate-700 font-medium">Team Commission</span>
          </div>
          <span className="text-emerald-600 font-bold">₹{totalCommission.toFixed(2)}</span>
        </div>

        <button 
          onClick={() => { setView('rewards'); }}
          className="w-full flex justify-between items-center p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-100">
              <Award className="w-4 h-4 text-rose-500" />
            </div>
            <span className="text-slate-700 font-medium">New Team Member Reward</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-rose-600 font-bold">{level1Members.filter(m => m.newbieBonusCompleted && !claimedNewbieRewards.includes(m.id)).length} Claimable</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
        </button>

        <div className="flex justify-between items-center p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
              <TrendingUp className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-slate-700 font-medium">My Total Profit</span>
          </div>
          <span className="text-indigo-600 font-bold">₹{globalECoinBalance.toFixed(2)}</span>
        </div>

        <div className="flex justify-between items-center p-4">
          <span className="text-slate-700 font-medium pl-11">Yesterday Team Commission</span>
          <span className="text-slate-500 font-medium">₹{yesterdayCommission.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between items-center p-4">
          <span className="text-slate-700 font-medium pl-11">Today Team Commission</span>
          <span className="text-emerald-600 font-bold">₹{globalTodayTeamCommission.toFixed(2)}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white p-5 border-b border-slate-100 shadow-sm mt-4">
        <div className="flex justify-between text-sm text-slate-600 mb-2 font-medium">
          <div className="flex flex-col">
            <span>Daily Commission Tasks</span>
            <span className="text-[10px] text-slate-400">Earn 0.15% extra on daily tasks</span>
          </div>
          <span className="text-indigo-600">{globalTodayTeamCommission < 500 ? '500 more needed' : '100%'}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 mb-2 relative overflow-hidden border border-slate-200">
          <div className="bg-indigo-500 h-3 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (globalTodayTeamCommission / 500) * 100)}%` }}></div>
        </div>
        <div className="flex justify-between text-xs text-slate-400 font-medium mb-4">
          <span>₹{globalTodayTeamCommission.toFixed(2)}</span>
          <span>{globalTodayTeamCommission < 500 ? `${(500 - globalTodayTeamCommission).toFixed(2)} more needed` : '₹500'}</span>
        </div>
        
        <button 
          disabled={globalTodayTeamCommission < 500 || isDailyBonusClaimed}
          onClick={handleClaimDailyBonus}
          className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 ${
            isDailyBonusClaimed 
              ? 'bg-emerald-100 text-emerald-600 cursor-default' 
              : globalTodayTeamCommission >= 500 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isDailyBonusClaimed ? 'Today Bonus Claimed' : globalTodayTeamCommission >= 500 ? 'Claim 300 E-Coin' : '500 more needed'}
        </button>
      </div>

      {/* Referral Section */}
      <div className="bg-white mt-4 p-5 border-y border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <LinkIcon className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900">Invitation Link</h3>
        </div>
        
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex flex-col overflow-hidden pr-4">
              <span className="text-xs text-slate-500 font-medium mb-1">Your Direct Link</span>
              <span className="text-sm text-slate-800 font-bold truncate">elivexpay.vercel.app/rs/{shortId}</span>
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`elivexpay.vercel.app/rs/${shortId}`);
                toast.success('Invitation link copied!');
              }}
              className="p-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-lg transition-colors flex items-center gap-2 shrink-0"
            >
              <Copy className="w-4 h-4" />
              <span className="text-xs font-bold">Copy Link</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">L1</div>
            <div className="flex-1">
              <div className="text-sm text-slate-500 font-medium">Level 1 Commission</div>
              <div className="font-bold text-slate-800">Buy × <span className="text-emerald-600">0.5%</span></div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 font-bold">L2</div>
            <div className="flex-1">
              <div className="text-sm text-slate-500 font-medium">Level 2 Commission</div>
              <div className="font-bold text-slate-800">Buy × <span className="text-emerald-600">0.3%</span></div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">L3</div>
            <div className="flex-1">
              <div className="text-sm text-slate-500 font-medium">Level 3 Commission</div>
              <div className="font-bold text-slate-800">Buy × <span className="text-emerald-600">0.2%</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Team;
