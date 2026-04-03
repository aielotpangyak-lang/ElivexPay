import { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, increment, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAppStore } from '../store';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export default function AutoSellManager() {
  const { 
    isAutoSellEnabled, isBoostEnabled, eCoinBalance, 
    lastAutoSellTime, setLastAutoSellTime, sellEcoin, refundEcoin,
    activeAutoOrder, setActiveAutoOrder,
    upiId, accountHolderName, bankName, bankAccNo, bankIfsc
  } = useAppStore();

  // Listen for active auto-sell orders
  useEffect(() => {
    if (!auth.currentUser || !isAutoSellEnabled) {
      setActiveAutoOrder(null);
      return;
    }

    const q = query(
      collection(db, 'sell_requests'),
      where('userId', '==', auth.currentUser.uid),
      where('isAutoSell', '==', true),
      where('status', '==', 'Pending'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        setActiveAutoOrder({ id: snapshot.docs[0].id, ...docData });
      } else {
        setActiveAutoOrder(null);
      }
    }, (error) => {
      console.error("AutoSellManager listener error:", error);
    });

    return () => unsubscribe();
  }, [auth.currentUser, isAutoSellEnabled]);

  // Main logic loop
  useEffect(() => {
    if (!auth.currentUser || !isAutoSellEnabled || activeAutoOrder) return;

    const interval = setInterval(async () => {
      if (!auth.currentUser) return;

      const now = new Date();
      const lastTime = lastAutoSellTime ? new Date(lastAutoSellTime) : new Date(0);
      const waitTime = isBoostEnabled ? 5 * 60 * 1000 : 10 * 60 * 1000; // 5 or 10 mins

      if (now.getTime() - lastTime.getTime() >= waitTime && eCoinBalance >= 500) {
        try {
          let accountDetails: any = null;
          let accountId = 'profile_linked';

          // Prefer profile linked account
          if (upiId) {
            accountDetails = {
              upiId,
              name: accountHolderName || 'Linked Account',
              method: 'UPI'
            };
          } else if (bankAccNo) {
            accountDetails = {
              bankAccNo,
              bankName,
              bankIfsc,
              name: accountHolderName || 'Linked Bank Account',
              method: 'Bank'
            };
          } else {
            // Fallback to upi_accounts collection
            const q = query(
              collection(db, 'upi_accounts'),
              where('userId', '==', auth.currentUser.uid),
              where('type', '==', 'Buy'),
              where('status', '==', 'Active'),
              limit(1)
            );
            const upiSnap = await getDocs(q);
            
            if (!upiSnap.empty) {
              const upiData = upiSnap.docs[0].data();
              accountId = upiSnap.docs[0].id;
              accountDetails = {
                ...upiData,
                method: 'UPI',
                name: 'Auto Sell (Buy UPI)'
              };
            }
          }
          
          if (!accountDetails) {
            // No account linked, can't auto-sell
            return;
          }

          const sellAmount = 500;

          // Deduct balance
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            eCoinBalance: increment(-sellAmount),
            lastAutoSellTime: now.toISOString()
          });

          // Create sell request
          await addDoc(collection(db, 'sell_requests'), {
            userId: auth.currentUser.uid,
            amount: sellAmount,
            accountId: accountId,
            accountDetails: accountDetails,
            status: 'Pending',
            isAutoSell: true,
            createdAt: now.toISOString()
          });

          setLastAutoSellTime(now.toISOString());
          sellEcoin(sellAmount);
          toast.success('Auto-sell order generated!');
        } catch (error) {
          console.error("Error generating auto-sell order:", error);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [auth.currentUser, isAutoSellEnabled, isBoostEnabled, eCoinBalance, lastAutoSellTime, activeAutoOrder]);

  // Handle order completion (5-minute timer)
  useEffect(() => {
    if (!activeAutoOrder || !auth.currentUser) return;

    const createdAt = new Date(activeAutoOrder.createdAt);
    const now = new Date();
    const elapsed = now.getTime() - createdAt.getTime();
    const remaining = (5 * 60 * 1000) - elapsed;

    if (remaining <= 0) {
      // Complete the order immediately if time already passed
      completeOrder(activeAutoOrder);
    } else {
      const timer = setTimeout(() => {
        completeOrder(activeAutoOrder);
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [activeAutoOrder, auth.currentUser]);

  const completeOrder = async (order: any) => {
    if (!auth.currentUser) return;

    try {
      // User requested: "After five minutes are completed, it will automatically be rejected."
      const newStatus = 'Rejected';

      await updateDoc(doc(db, 'sell_requests', order.id), {
        status: newStatus,
        completedAt: new Date().toISOString()
      });

      // Refund balance since it's rejected
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        eCoinBalance: increment(order.amount)
      });
      refundEcoin(order.amount);
      toast.error('Auto-sell order completed (Rejected). Balance refunded.');
    } catch (error) {
      console.error("Error completing auto-sell order:", error);
    }
  };

  return null; // Background component
}
