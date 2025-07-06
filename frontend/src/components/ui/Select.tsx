import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import clsx from 'clsx';

export interface Option {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface SelectProps {
  options: Option[];
  value?: string | number | (string | number)[];
  defaultValue?: string | number | (string | number)[];
  placeholder?: string;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  label?: string;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onChange?: (value: string | number | (string | number)[]) => void;
  onSearch?: (query: string) => void;
}

const Select: React.FC<SelectProps> = ({
  options,
  value,
  defaultValue,
  placeholder = '请选择...',
  multiple = false,
  searchable = false,
  clearable = false,
  disabled = false,
  loading = false,
  error,
  label,
  helperText,
  size = 'md',
  className,
  onChange,
  onSearch
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [internalValue, setInternalValue] = useState<string | number | (string | number)[]>(
    value ?? defaultValue ?? (multiple ? [] : '')
  );
  
  const selectRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 同步外部 value
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 打开下拉框时聚焦搜索框
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const filteredOptions = searchQuery
    ? options.filter(option =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const selectedOptions = multiple
    ? options.filter(option => (internalValue as (string | number)[]).includes(option.value))
    : options.find(option => option.value === internalValue);

  const handleOptionClick = (option: Option) => {
    if (option.disabled) return;

    let newValue: string | number | (string | number)[];

    if (multiple) {
      const currentValues = internalValue as (string | number)[];
      if (currentValues.includes(option.value)) {
        newValue = currentValues.filter(v => v !== option.value);
      } else {
        newValue = [...currentValues, option.value];
      }
    } else {
      newValue = option.value;
      setIsOpen(false);
    }

    setInternalValue(newValue);
    onChange?.(newValue);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = multiple ? [] : '';
    setInternalValue(newValue);
    onChange?.(newValue);
  };

  const handleRemoveTag = (optionValue: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = (internalValue as (string | number)[]).filter(v => v !== optionValue);
    setInternalValue(newValue);
    onChange?.(newValue);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const getDisplayValue = () => {
    if (multiple) {
      const selected = selectedOptions as Option[];
      if (selected.length === 0) return placeholder;
      if (selected.length === 1) return selected[0].label;
      return `已选择 ${selected.length} 项`;
    } else {
      const selected = selectedOptions as Option | undefined;
      return selected ? selected.label : placeholder;
    }
  };

  return (
    <div className={clsx('relative', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div
        ref={selectRef}
        className={clsx(
          'relative w-full border rounded-md shadow-sm cursor-pointer transition-colors',
          disabled
            ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
            : isOpen
            ? 'border-primary-500 ring-1 ring-primary-500'
            : error
            ? 'border-red-300'
            : 'border-gray-300 hover:border-gray-400',
          sizeClasses[size]
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 flex items-center min-w-0">
            {multiple && (internalValue as (string | number)[]).length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {(selectedOptions as Option[]).map(option => (
                  <span
                    key={option.value}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-primary-200"
                      onClick={(e) => handleRemoveTag(option.value, e)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className={clsx(
                'block truncate',
                (!multiple && !selectedOptions) || (multiple && (internalValue as (string | number)[]).length === 0)
                  ? 'text-gray-500'
                  : 'text-gray-900'
              )}>
                {getDisplayValue()}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            {clearable && internalValue && (
              <button
                type="button"
                className="p-1 hover:bg-gray-100 rounded"
                onClick={handleClear}
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <ChevronDown
              className={clsx(
                'w-5 h-5 text-gray-400 transition-transform',
                isOpen && 'transform rotate-180'
              )}
            />
          </div>
        </div>

        {/* 下拉选项 */}
        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
            {searchable && (
              <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  placeholder="搜索选项..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            
            {loading ? (
              <div className="py-2 px-3 text-gray-500 text-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="py-2 px-3 text-gray-500 text-center">
                {searchQuery ? '未找到匹配项' : '暂无选项'}
              </div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = multiple
                  ? (internalValue as (string | number)[]).includes(option.value)
                  : internalValue === option.value;

                return (
                  <div
                    key={option.value}
                    className={clsx(
                      'cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100',
                      option.disabled && 'opacity-50 cursor-not-allowed',
                      isSelected && 'bg-primary-50 text-primary-900'
                    )}
                    onClick={() => handleOptionClick(option)}
                  >
                    <div className="flex items-center">
                      {option.icon && (
                        <span className="mr-2">{option.icon}</span>
                      )}
                      <span className={clsx(
                        'block truncate',
                        isSelected ? 'font-medium' : 'font-normal'
                      )}>
                        {option.label}
                      </span>
                    </div>
                    
                    {isSelected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                        <Check className="w-5 h-5 text-primary-600" />
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {(error || helperText) && (
        <p className={clsx(
          'mt-1 text-sm',
          error ? 'text-red-600' : 'text-gray-500'
        )}>
          {error || helperText}
        </p>
      )}
    </div>
  );
};

export default Select;
