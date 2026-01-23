"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type MerchantSuggestion,
  filterMerchantSuggestions,
} from "@poleursus/shared";

export interface MerchantAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: MerchantSuggestion[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function MerchantAutocomplete({
  value,
  onChange,
  suggestions,
  placeholder,
  id,
  disabled,
  className,
}: MerchantAutocompleteProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const filteredSuggestions = React.useMemo(
    () => filterMerchantSuggestions(suggestions, value),
    [suggestions, value]
  );

  const showSuggestions = isOpen && filteredSuggestions.length > 0;

  const handleSelect = (merchant: string) => {
    onChange(merchant);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    console.log("Key down:", isOpen);
    if (!showSuggestions) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(filteredSuggestions[highlightedIndex].merchant);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => setIsOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-autocomplete="list"
        aria-controls={showSuggestions ? `${id}-suggestions` : undefined}
        aria-activedescendant={
          highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined
        }
      />

      {showSuggestions && (
        <ul
          ref={listRef}
          id={`${id}-suggestions`}
          role="listbox"
          className={cn(
            "absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md",
            "bg-background border border-input shadow-md",
            // Animations matching existing Select component
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={suggestion.normalized}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              className={cn(
                "cursor-pointer select-none px-3 py-2 text-sm",
                "transition-colors duration-150",
                index === highlightedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(suggestion.merchant);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className="font-medium">{suggestion.merchant}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                ({suggestion.frequency}x)
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
