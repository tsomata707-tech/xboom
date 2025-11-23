import React, { useState, useRef } from 'react';
import { useToast } from '../AuthGate';
import UploadIcon from './icons/UploadIcon';
import { uploadImage } from '../firebase';

// مجموعة من الأنماط والبذور لإنشاء صور رمزية متنوعة من خدمة DiceBear
const avatarStyles = [
  'adventurer', 'avataaars-neutral', 'big-ears', 'bottts', 
  'croodles', 'fun-emoji', 'icons', 'lorelei', 'micah', 
  'miniavs', 'pixel-art', 'notionists'
];
const seeds = [
    'Salem', 'Max', 'Angel', 'Misty', 'Leo', 'Cleo', 'Simon', 'Toby', 'Zoe', 'Felix'
];
// إنشاء قائمة كاملة من روابط الصور الرمزية المعدة مسبقًا
const PREDEFINED_AVATARS = avatarStyles.flatMap(style => 
  seeds.map(seed => `https://api.dicebear.com/8.x/${style}/svg?seed=${seed}&radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`)
);


interface AvatarModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAvatarChange: (avatarUrl: string) => Promise<void>;
    currentAvatar: string | undefined;
    userId: string;
}

const AvatarModal: React.FC<AvatarModalProps> = ({ isOpen, onClose, onAvatarChange, currentAvatar, userId }) => {
    const [selectedAvatar, setSelectedAvatar] = useState<string | undefined>(currentAvatar);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

    if (!isOpen) return null;

    // معالج اختيار صورة رمزية من القائمة المعدة مسبقًا
    const handlePredefinedSelect = async (avatar: string) => {
        setSelectedAvatar(avatar);
        await handleSave(avatar); // الحفظ مباشرة عند الاختيار
    };
    
    // دالة مساعدة لتصغير حجم الصورة في المتصفح قبل رفعها
    // هذا يحسن أداء الرفع ويقلل من استهلاك البيانات وحجم التخزين
    const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = document.createElement('img');
            const objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;

            const cleanup = () => {
                URL.revokeObjectURL(objectUrl);
            };

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // حساب الأبعاد الجديدة مع الحفاظ على نسبة العرض إلى الارتفاع
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    cleanup();
                    return reject(new Error('Could not get canvas context'));
                }
                // رسم الصورة المصغرة على الـ canvas
                ctx.drawImage(img, 0, 0, width, height);
                // تحويل الـ canvas إلى Blob (ملف صورة) بجودة 90%
                canvas.toBlob((blob) => {
                    cleanup();
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas to Blob conversion failed'));
                    }
                }, 'image/jpeg', 0.9);
            };
            img.onerror = (error) => {
                cleanup();
                reject(error instanceof Event ? new Error('Image failed to load') : error);
            };
        });
    };

    // معالج رفع صورة مخصصة من جهاز المستخدم
    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            addToast('الرجاء رفع ملف صورة فقط (PNG, JPG)', 'error');
            return;
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            addToast('حجم الصورة كبير جداً. الحد الأقصى 2 ميجابايت.', 'error');
            return;
        }

        setIsUploading(true);
        try {
            // 1. تصغير الصورة إلى 256x256 بكسل كحد أقصى
            const resizedBlob = await resizeImage(file, 256, 256);
            const resizedFile = new File([resizedBlob], file.name, { type: file.type, lastModified: Date.now() });

            // 2. رفع الصورة المصغرة إلى Cloudinary
            const imageUrl = await uploadImage(resizedFile);
            if (imageUrl) {
                setSelectedAvatar(imageUrl);
                // 3. حفظ رابط الصورة الجديد
                await handleSave(imageUrl);
                addToast('تم رفع وتحديث الصورة بنجاح!', 'success');
            } else {
                throw new Error('فشل رفع الصورة إلى الخدمة.');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            addToast('خطأ في رفع الصورة', 'error');
        } finally {
            setIsUploading(false);
        }
    };
    
    // دالة الحفظ النهائية التي تقوم بتحديث رابط الصورة في Firestore
    const handleSave = async (avatar: string) => {
        await onAvatarChange(avatar);
        onClose(); // إغلاق النافذة بعد الحفظ
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-lg shadow-2xl shadow-purple-900/40 p-6 relative game-container-animation" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 left-4 text-gray-400 hover:text-white transition text-2xl leading-none">&times;</button>
                <h2 className="text-3xl font-bold text-cyan-400 mb-6 text-center">تغيير الصورة الرمزية</h2>

                <div className="grid grid-cols-5 sm:grid-cols-8 gap-3 mb-6 max-h-64 overflow-y-auto pr-2">
                    {PREDEFINED_AVATARS.map(avatarUrl => (
                        <button
                            key={avatarUrl}
                            onClick={() => handlePredefinedSelect(avatarUrl)}
                            className={`aspect-square flex items-center justify-center rounded-lg transition-all transform hover:scale-110 ${selectedAvatar === avatarUrl ? 'ring-4 ring-cyan-400 scale-110' : ''}`}
                        >
                            <img src={avatarUrl} alt="avatar" className="w-full h-full rounded-md bg-gray-700"/>
                        </button>
                    ))}
                </div>

                <div className="border-t border-gray-700 pt-6">
                    <input
                        type="file"
                        accept="image/png, image/jpeg"
                        ref={fileInputRef}
                        onChange={handleAvatarUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full flex items-center justify-center gap-3 py-3 text-lg font-bold bg-gray-700 rounded-lg hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isUploading ? (
                            <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>جاري الرفع...</span>
                            </>
                        ) : (
                            <>
                                <UploadIcon className="w-6 h-6" />
                                <span>تحميل صورة مخصصة</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AvatarModal;