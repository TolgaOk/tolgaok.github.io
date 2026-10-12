import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface CapsuleSelectProps {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export default function ChartSelect({
  id,
  label,
  value,
  options,
  onChange,
}: CapsuleSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex];
  const listboxId = `${id}-listbox`;
  const labelId = `${id}-label`;

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const choose = (index: number) => {
    onChange(options[index].value);
    setActiveIndex(index);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setOpen(true);
      setActiveIndex(
        (current) => (current + direction + options.length) % options.length,
      );
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(activeIndex);
      else {
        setActiveIndex(selectedIndex);
        setOpen(true);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    if (event.key.length === 1) {
      const match = options.findIndex((option) =>
        option.label.toLowerCase().startsWith(event.key.toLowerCase()),
      );
      if (match >= 0) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(match);
      }
    }
  };

  return (
    <div className="chart-select" ref={wrapperRef}>
      <span id={labelId}>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className="control-button chart-select-trigger"
        aria-activedescendant={
          open ? `${listboxId}-option-${activeIndex}` : undefined
        }
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${labelId} ${id}-value`}
        onClick={() => {
          setActiveIndex(selectedIndex);
          setOpen((current) => !current);
        }}
        onKeyDown={handleKeyDown}
      >
        <span id={`${id}-value`}>{selected.label}</span>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="chart-select-menu">
          <div id={listboxId} role="listbox" aria-labelledby={labelId}>
            {options.map((option, index) => (
              <button
                key={option.value}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={index === selectedIndex}
                data-active={index === activeIndex}
                onClick={() => choose(index)}
                onPointerDown={(event) => event.preventDefault()}
                onPointerMove={() => setActiveIndex(index)}
              >
                <span>{option.label}</span>
                <span className="chart-option-mark" aria-hidden="true">
                  {index === selectedIndex ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
