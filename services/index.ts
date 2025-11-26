import { doc, updateDoc, increment, setDoc, serverTimestamp, getDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import type { TransactionRequest } from '../types';

export const GameService = {
  async updateBalance(userId: string, amount: number): Promise<boolean> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        balance: increment(amount),
        lastActive: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error("Failed to update balance:", error);
      return false;
    }
  },

  async announceWin(nickname: string, amount: number, gameName: string): Promise<void> {
    try {
      const ref = doc(db, 'public', 'lastWinner');
      await setDoc(ref, {
        nickname,
        amount: Math.floor(amount),
        gameName,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to announce win", e);
    }
  }
};

export const AdminService = {
  async verifyAdminPermissions(userId: string): Promise<boolean> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      return userDoc.exists() && userDoc.data().isAdmin === true;
    } catch {
      return false;
    }
  },

  async processTransactionRequest(req: TransactionRequest, action: 'approve' | 'reject', adminId: string): Promise<void> {
    // Note: In a real app, ensure server-side validation. 
    // This client-side function orchestrates the logic.
    
    if (action === 'approve') {
      const targetUserRef = doc(db, 'users', req.userId);
      if (req.type === 'deposit') {
        await updateDoc(targetUserRef, { balance: increment(req.amount) });
      } else {
        // For withdraw, we assume balance was either reserved or we deduct now.
        // Simple implementation: deduct now.
        await updateDoc(targetUserRef, { balance: increment(-req.amount) });
      }
      
      // Update treasury tracking
      const treasuryRef = doc(db, 'public', 'treasury');
      if (req.type === 'deposit') {
        await updateDoc(treasuryRef, { balance: increment(req.amount) });
      } else {
        await updateDoc(treasuryRef, { balance: increment(-req.amount) });
      }
    }
  }
};

export const NotificationService = {
  async sendUserNotification(userId: string, title: string, body: string, type: string): Promise<void> {
    try {
      const notifRef = doc(collection(db, 'users', userId, 'mailbox'));
      await setDoc(notifRef, {
        title,
        body,
        type,
        isRead: false,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Error sending notification:", e);
    }
  },

  async sendAdminNotification(title: string, body: string, type: string): Promise<void> {
    try {
      const adminNotifRef = doc(collection(db, 'notifications'));
      await setDoc(adminNotifRef, {
        recipientId: 'ADMIN',
        recipientEmail: 'System',
        title,
        body,
        type,
        isRead: false,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Error sending admin notification:", e);
    }
  }
};