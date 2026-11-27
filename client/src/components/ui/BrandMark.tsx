import React from 'react';

interface BrandMarkProps {
  size?: number;
  variant?: 'color' | 'light';
  className?: string;
}

/**
 * Application brand logo rendering the configured user logo image (/logo.jpg).
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 32, className = '' }) => (
  <img
    src="/logo.jpg"
    alt="HSBC Cnet logo"
    width={size}
    height={size}
    style={{ width: size, height: size }}
    className={`object-cover rounded-[2px] shrink-0 select-none ${className}`}
  />
);
