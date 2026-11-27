import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface BankingHeaderProps {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: React.ReactNode;
  subHeader?: React.ReactNode;
}

/**
 * Clean white sub-navigation header matching documented HSBCnet Mobile detail & workflow screens.
 */
export const BankingHeader: React.FC<BankingHeaderProps> = ({
  title,
  onBack,
  backLabel = 'Back',
  rightSlot,
  subHeader,
}) => (
  <div className="sticky top-0 z-10 bg-white border-b border-[#D9DEE1]">
    <div className="px-2 sm:px-4 h-12 flex items-center justify-between gap-2">
      <div className="flex items-center min-w-0 flex-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="min-w-[44px] min-h-[44px] -ml-1 inline-flex items-center justify-center text-[#252B30] hover:bg-[#F4F5F6] rounded-[2px] transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
        <h2 className="text-[15px] font-medium text-[#252B30] truncate pl-1">{title}</h2>
      </div>
      {rightSlot && (
        <div className="flex items-center gap-1 shrink-0">{rightSlot}</div>
      )}
    </div>
    {subHeader && (
      <div className="px-4 py-2 bg-[#F4F5F6] border-t border-[#D9DEE1] text-xs text-[#68727A]">
        {subHeader}
      </div>
    )}
  </div>
);
