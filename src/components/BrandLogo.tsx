import React from 'react';

export const SITE_LOGO_SRC = '/assets/aistudio/image_d51bcb50.png';

export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<BrandLogoSize, string> = {
  xs: 'w-5 h-5 rounded-[6px]',
  sm: 'w-9 h-9 rounded-[10px]',
  md: 'w-11 h-11 rounded-[12px]',
  lg: 'w-14 h-14 rounded-[15px]',
  xl: 'w-16 h-16 rounded-[18px]',
};

export const BrandLogo: React.FC<{
  size?: BrandLogoSize;
  className?: string;
  alt?: string;
}> = ({ size = 'sm', className = '', alt = 'FVV GIS logo' }) => {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden shrink-0 bg-[#071D49] ring-1 ring-white/15 shadow-sm select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      <img
        src={SITE_LOGO_SRC}
        alt={alt}
        draggable={false}
        className="w-full h-full object-cover scale-[1.06]"
      />
    </span>
  );
};
