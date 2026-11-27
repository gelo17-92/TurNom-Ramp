import React, { useState, useEffect, useRef } from 'react';

export const LocalInput = ({ value, onChange, className, type = "text", placeholder, disabled = false }: { value: any, onChange: (val: string) => void, className?: string, type?: string, placeholder?: string, disabled?: boolean }) => {
  const isDateOrTime = type === "date" || type === "time";
  const [localValue, setLocalValue] = useState(() => {
    if (isDateOrTime) return value?.toString() || '';
    return value?.toString().replace('.', ',') || '';
  });
  const isFocused = useRef(false);

  useEffect(() => {
    if (isFocused.current) return;
    
    if (isDateOrTime) {
      setLocalValue(value?.toString() || '');
      return;
    }

    const valStr = value?.toString().replace('.', ',') || '';
    if (valStr === localValue) return;

    // If the numeric values are the same, don't update local state
    // This allows typing "1," without it being reset to "1"
    const numValue = parseFloat(value?.toString() || '0');
    const numLocal = parseFloat(localValue.replace(',', '.'));
    
    if (!isNaN(numValue) && !isNaN(numLocal) && numValue === numLocal) {
      return;
    }
    
    setLocalValue(valStr);
  }, [value, isDateOrTime]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isDateOrTime) {
      setLocalValue(val);
      onChange(val);
      return;
    }
    setLocalValue(val);
    onChange(val.replace(',', '.'));
  };

  return (
    <input
      type={type === "number" ? "text" : type}
      inputMode={type === "number" ? "decimal" : undefined}
      value={localValue}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={() => { isFocused.current = true; }}
      onBlur={() => { 
        isFocused.current = false;
        // Small delay to allow potential re-renders to finish before resetting
        setTimeout(() => {
          if (!isFocused.current) {
            setLocalValue(isDateOrTime ? (value?.toString() || '') : (value?.toString().replace('.', ',') || ''));
          }
        }, 50);
      }}
      onChange={handleChange}
      className={className}
      style={{ touchAction: 'manipulation' }}
    />
  );
};
