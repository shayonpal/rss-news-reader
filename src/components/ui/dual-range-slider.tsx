"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";

interface DualRangeSliderProps {
  min?: number;
  max?: number;
  step?: number;
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  label?: string;
  minLabel?: string;
  maxLabel?: string;
  disabled?: boolean;
  className?: string;
  formatValue?: (value: number) => string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

const DualRangeSliderComponent: React.FC<DualRangeSliderProps> = ({
  min = 0,
  max = 100,
  step = 1,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  label,
  minLabel = "Minimum",
  maxLabel = "Maximum",
  disabled = false,
  className,
  formatValue = (v: number) => v.toString(),
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}) => {
  const [isDragging, setIsDragging] = useState<"min" | "max" | null>(null);
  const minRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Validate and sanitize input values to prevent NaN
  const safeMinValue =
    isNaN(minValue) || minValue == null
      ? min
      : Math.max(min, Math.min(minValue, max - step));
  const safeMaxValue =
    isNaN(maxValue) || maxValue == null
      ? max
      : Math.min(max, Math.max(maxValue, min + step));

  // Ensure min doesn't exceed max and vice versa
  const handleMinChange = useCallback(
    (value: number) => {
      const clampedValue = Math.min(value, safeMaxValue - step);
      onMinChange(Math.max(min, clampedValue));
    },
    [safeMaxValue, step, min, onMinChange]
  );

  const handleMaxChange = useCallback(
    (value: number) => {
      const clampedValue = Math.max(value, safeMinValue + step);
      onMaxChange(Math.min(max, clampedValue));
    },
    [safeMinValue, step, max, onMaxChange]
  );

  // Calculate fill percentage for the track - memoized for performance
  const minPercent = useMemo(
    () => Math.round(((safeMinValue - min) / (max - min)) * 100 * 100) / 100,
    [safeMinValue, min, max]
  );
  const maxPercent = useMemo(
    () => Math.round(((safeMaxValue - min) / (max - min)) * 100 * 100) / 100,
    [safeMaxValue, min, max]
  );

  // Memoize clip paths for performance - create non-overlapping zones
  const midPoint = useMemo(
    () => (minPercent + maxPercent) / 2,
    [minPercent, maxPercent]
  );
  const minClipPath = useMemo(
    () => `inset(0 ${100 - midPoint}% 0 0)`,
    [midPoint]
  );
  const maxClipPath = useMemo(
    () => `inset(0 0 0 ${midPoint}%)`,
    [midPoint]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, type: "min" | "max") => {
      const current = type === "min" ? safeMinValue : safeMaxValue;
      const onChange = type === "min" ? handleMinChange : handleMaxChange;

      switch (e.key) {
        case "ArrowUp":
        case "ArrowRight":
          e.preventDefault();
          onChange(current + step);
          break;
        case "ArrowDown":
        case "ArrowLeft":
          e.preventDefault();
          onChange(current - step);
          break;
        case "PageUp":
          e.preventDefault();
          onChange(current + step * 10);
          break;
        case "PageDown":
          e.preventDefault();
          onChange(current - step * 10);
          break;
        case "Home":
          e.preventDefault();
          onChange(type === "min" ? min : safeMinValue + step);
          break;
        case "End":
          e.preventDefault();
          onChange(type === "max" ? max : safeMaxValue - step);
          break;
      }
    },
    [
      safeMinValue,
      safeMaxValue,
      step,
      min,
      max,
      handleMinChange,
      handleMaxChange,
    ]
  );

  // Touch and mouse events
  const handleThumbMouseDown = useCallback((type: "min" | "max") => {
    setIsDragging(type);
  }, []);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(null);
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const percent = Math.min(
        100,
        Math.max(0, ((clientX - rect.left) / rect.width) * 100)
      );
      const value =
        Math.round(((percent / 100) * (max - min) + min) / step) * step;

      if (isDragging === "min") {
        handleMinChange(value);
      } else {
        handleMaxChange(value);
      }
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleMouseMove);
      document.addEventListener("touchend", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("touchmove", handleMouseMove);
        document.removeEventListener("touchend", handleMouseUp);
      };
    }
  }, [isDragging, max, min, step, handleMinChange, handleMaxChange]);

  return (
    <div
      className={cn(
        "dual-range-slider glass-morphing",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      role="group"
      aria-label={ariaLabel || label || "Range selector"}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
    >
      {label && (
        <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </div>
      )}

      {/* Combined value display */}
      <div className="mb-2 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
        {`${formatValue(safeMinValue).replace(" words", "")} – ${formatValue(safeMaxValue).replace(" words", "")} words`}
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {minLabel}: {formatValue(safeMinValue)}
        </span>
        <span>
          {maxLabel}: {formatValue(safeMaxValue)}
        </span>
      </div>

      <div className="relative flex h-12 items-center">
        {/* Track */}
        <div
          ref={trackRef}
          className="absolute z-10 h-2 w-full rounded-full overflow-hidden"
          style={{
            backgroundColor: `rgba(var(--brand-accent-rgb, 139 92 246), 0.15)`,
          }}
        >
          {/* Selected range overlay */}
          <div
            className="absolute inset-y-0 rounded-full pointer-events-none"
            style={{
              backgroundColor: `rgba(var(--brand-accent-rgb, 139 92 246), 0.45)`,
              left: `${minPercent}%`,
              right: `${100 - maxPercent}%`,
            }}
          />
        </div>

        {/* Min thumb */}
        <input
          ref={minRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeMinValue}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          onKeyDown={(e) => handleKeyDown(e, "min")}
          onMouseDown={() => handleThumbMouseDown("min")}
          onTouchStart={() => handleThumbMouseDown("min")}
          disabled={disabled}
          className="absolute z-20 h-2 w-full cursor-pointer opacity-0"
          style={{
            pointerEvents: "auto",
            clipPath: minClipPath,
          }}
          aria-label={`${minLabel || "Minimum"} ${(label || "").toLowerCase()}`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={safeMinValue}
          aria-valuetext={formatValue(safeMinValue)}
        />

        {/* Max thumb */}
        <input
          ref={maxRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeMaxValue}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          onKeyDown={(e) => handleKeyDown(e, "max")}
          onMouseDown={() => handleThumbMouseDown("max")}
          onTouchStart={() => handleThumbMouseDown("max")}
          disabled={disabled}
          className="absolute z-10 h-2 w-full cursor-pointer opacity-0"
          style={{
            pointerEvents: "auto",
            clipPath: maxClipPath,
          }}
          aria-label={`${maxLabel || "Maximum"} ${(label || "").toLowerCase()}`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={safeMaxValue}
          aria-valuetext={formatValue(safeMaxValue)}
        />

        {/* Visual thumbs */}
        <div
          className={cn(
            "absolute z-20 h-6 w-8 rounded-full border-2 shadow-lg",
            "bg-white/75 dark:bg-gray-800/75 border-blue-500/75 dark:border-blue-400/75",
            "-translate-x-1/2 transform transition-transform pointer-events-none",
            isDragging === "min" && "scale-125"
          )}
          style={{
            left: `${minPercent}%`,
            willChange: "transform",
          }}
        />
        <div
          className={cn(
            "absolute z-20 h-6 w-8 rounded-full border-2 shadow-lg",
            "bg-white/75 dark:bg-gray-800/75 border-blue-500/75 dark:border-blue-400/75",
            "-translate-x-1/2 transform transition-transform pointer-events-none",
            isDragging === "max" && "scale-125"
          )}
          style={{
            left: `${maxPercent}%`,
            willChange: "transform",
          }}
        />
      </div>

      {/* Error handling */}
      {minValue > maxValue && (
        <div className="mt-1 text-xs text-red-500" role="alert">
          Minimum value cannot exceed maximum value
        </div>
      )}
    </div>
  );
};

// Export with React.memo for performance
export const DualRangeSlider = React.memo(DualRangeSliderComponent);

// Styles for touch targets (44x44px minimum)
const touchTargetStyles = `
  .touch-target {
    min-width: 44px;
    min-height: 44px;
    position: relative;
  }
  
  .touch-target::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 44px;
    height: 44px;
  }
  
  .glass-morphing {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
`;

// Add styles to document if not already present
if (
  typeof document !== "undefined" &&
  !document.getElementById("dual-range-slider-styles")
) {
  const style = document.createElement("style");
  style.id = "dual-range-slider-styles";
  style.textContent = touchTargetStyles;
  document.head.appendChild(style);
}
