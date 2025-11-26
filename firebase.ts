import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// تم دمج إعدادات Firebase الحقيقية
const firebaseConfig = {
  apiKey: "AIzaSyCGRfMMxPsJxf3e2XLo1NBVZsvYVlvuKnM",
  authDomain: "xboom-1bd0e.firebaseapp.com",
  projectId: "xboom-1bd0e",
  storageBucket: "xboom-1bd0e.appspot.com",
  messagingSenderId: "985122000419",
  appId: "1:985122000419:web:f850148c03f7364f0deb96",
  measurementId: "G-1LN1SRQHEH"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);

// الحصول على مرجع لخدمة المصادقة
export const auth = getAuth(app);

// تهيئة Firestore مع تفعيل التخزين المؤقت (Persistence) لدعم وضع عدم الاتصال
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const storage = getStorage(app);

// --- وظيفة رفع الصور إلى Cloudinary ---
// [ملاحظة للمطور] هذه الوظيفة مسؤولة عن رفع جميع الصور في التطبيق
// (مثل الصور الرمزية والبنرات) إلى خدمة خارجية تسمى "Cloudinary".
// **هي لا تستخدم Firebase Storage على الإطلاق.**
// يتم ذلك عن طريق إرسال طلب مباشر إلى API الخاص بـ Cloudinary مع `upload_preset`
// معد مسبقاً، مما يسمح بالرفع من جانب العميل (المتصفح) بأمان.
// تعيد هذه الوظيفة رابط الصورة (URL) بعد نجاح الرفع ليتم حفظه في Firestore.
export const uploadImage = async (file: File): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ml_default'); // preset خاص بـ Cloudinary
    formData.append('cloud_name', 'dcu2umxi8');     // اسم السحابة الخاص بك في Cloudinary

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/dcu2umxi8/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();
    return data.secure_url; // إرجاع الرابط الآمن للصورة
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
};