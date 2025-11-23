import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db as firestore } from '../../firebase';

export const sendSystemNotification = async (playerId: string, message: string) => {
  if (!playerId) return;

  const userDocRef = doc(firestore, 'users', playerId);
  const userDoc = await getDoc(userDocRef);
  const recipientEmail = userDoc.data()?.email;
  if (!recipientEmail) return;

  const notificationsRef = collection(firestore, 'notifications');
  await addDoc(notificationsRef, {
    to: recipientEmail,
    message,
    timestamp: serverTimestamp(),
    read: false
  });
};