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
    activeAutoOrder, setActiveAutoOrder
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
          // Get a Buy UPI account to use for selling
          const q = query(
            collection(db, 'upi_accounts'),
            where('userId', '==', auth.currentUser.uid),
            where('type', '==', 'Buy'),
            where('status', '==', 'Active'),
            limit(1)
          );
          const upiSnap = await getDocs(q);
          
          if (upiSnap.empty) {
            // No Buy UPI linked, can't auto-sell
            return;
          }

          const upiData = upiSnap.docs[0].data();
          const sellAmount = 500; // Fixed amount for auto-sell as per requirement "sufficient balance hoga joki hoga 500 ECoin"

          // Deduct balance
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            eCoinBalance: increment(-sellAmount),
            lastAutoSellTime: now.toISOString()
          });

          // Create sell request
          await addDoc(collection(db, 'sell_requests'), {
            userId: auth.currentUser.uid,
            amount: sellAmount,
            accountId: upiSnap.docs[0].id,
            accountDetails: {
              ...upiData,
              method: 'UPI', // Auto-sell always uses UPI
              name: 'Auto Sell (Buy UPI)'
            },
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
      const isConfirmed = Math.random() > 0.3; // 70% success rate
      const newStatus = isConfirmed ? 'Approved' : 'Rejected';

      await updateDoc(doc(db, 'sell_requests', order.id), {
        status: newStatus,
        completedAt: new Date().toISOString()
      });

      if (!isConfirmed) {
        // Refund balance if rejected
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          eCoinBalance: increment(order.amount)
        });
        refundEcoin(order.amount);
        toast.error('Auto-sell order rejected. Balance refunded.');
      } else {
        toast.success('Auto-sell order confirmed!');
      }
    } catch (error) {
      console.error("Error completing auto-sell order:", error);
    }
  };

  return null; // Background component
}
