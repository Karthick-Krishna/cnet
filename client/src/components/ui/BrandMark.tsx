import React from 'react';

interface BrandMarkProps {
  size?: number;
  variant?: 'color' | 'light';
  className?: string;
}

/**
 * Geometric hexagon mark for HSBC Cnet UI
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 32, variant = 'color', className = '' }) => {
  const outerFill = '#DB0011';
  const centerFill = variant === 'light' ? '#FFFFFF' : '#FFFFFF';
  const sideWingFill = '#DB0011';

  return (
    <svg
      width={Math.round(size * 1.45)}
      height={size}
      viewBox="0 0 60 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="HSBC Cnet mark"
      className={className}
    >
      <rect x="0" y="0" width="60" height="36" fill={centerFill} />
      {/* Left wing */}
      <polygon points="0,18 15,3 15,33" fill={sideWingFill} />
      {/* Right wing */}
      <polygon points="60,18 45,3 45,33" fill={sideWingFill} />
      {/* Top triangle */}
      <polygon points="15,3 45,3 30,18" fill={outerFill} />
      {/* Bottom triangle */}
      <polygon points="15,33 45,33 30,18" fill={outerFill} />
    </svg>
  );
};
