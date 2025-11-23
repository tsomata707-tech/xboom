import React from 'react';

interface ImageBanner {
    imageUrl: string;
    isActive: boolean;
}

interface ImageBannerDisplayProps {
    banner: ImageBanner | null;
}

const ImageBannerDisplay: React.FC<ImageBannerDisplayProps> = ({ banner }) => {

    if (banner?.isActive && banner.imageUrl) {
        return (
            // The container sets a max-height to prevent extremely tall images from breaking the layout.
            // Flexbox is used to center the image within this container.
            <div className="w-full bg-gray-900 rounded-lg overflow-hidden shadow-lg max-h-[60vh] flex items-center justify-center">
                <img 
                    src={banner.imageUrl} 
                    alt="إعلان" 
                    // The image scales to fit within the container, preserving its aspect ratio.
                    className="w-auto h-auto max-w-full max-h-full"
                />
            </div>
        );
    }

    return (
        // Placeholder with a minimum height and updated instructions.
        <div className="w-full min-h-[200px] bg-gray-900/50 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-center p-4">
            <span className="text-4xl mb-4" role="img" aria-label="sparkles">✨</span>
            <h3 className="text-2xl font-bold text-gray-400">منطقة الإعلانات</h3>
            <p className="text-gray-500 mt-2">
                لا يوجد بنر نشط حاليًا. ارفع صورة من لوحة التحكم لعرضها هنا.
            </p>
        </div>
    );
};

export default ImageBannerDisplay;