'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryDisplayProps {
  summary: string;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function SummaryDisplay({ 
  summary, 
  className,
  collapsible = false,
  defaultExpanded = true
}: SummaryDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={cn(
      "bg-gray-100 dark:bg-gray-800 rounded-lg mb-6",
      className
    )}>
      <button
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
        disabled={!collapsible}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between text-left",
          collapsible && "hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        )}
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Summary
        </span>
        {collapsible && (
          isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-3">
            {summary.split(/\n+/).filter(para => para.trim()).map((paragraph, index) => (
              <p key={index}>
                {paragraph.trim()}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}