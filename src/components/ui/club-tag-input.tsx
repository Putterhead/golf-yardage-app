"use client";

import { useState, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLUB_SUGGESTIONS } from "@/lib/supabase";

interface ClubTagInputProps {
  value: string[];
  onChange: (clubs: string[]) => void;
}

export function ClubTagInput({ value, onChange }: ClubTagInputProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggestions filtered by what's typed and not already selected
  const filtered = CLUB_SUGGESTIONS.filter(
    (s) =>
      !value.includes(s) &&
      s.toLowerCase().includes(input.toLowerCase())
  );

  const addClub = useCallback(
    (club: string) => {
      const trimmed = club.trim();
      if (!trimmed || value.includes(trimmed)) return;
      onChange([...value, trimmed]);
      setInput("");
      setOpen(false);
      inputRef.current?.focus();
    },
    [value, onChange]
  );

  const removeClub = useCallback(
    (club: string) => {
      onChange(value.filter((c) => c !== club));
    },
    [value, onChange]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) addClub(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeClub(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {value.map((club) => (
          <span
            key={club}
            className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2.5 py-1 text-sm font-medium text-primary"
          >
            {club}
            <button
              type="button"
              onClick={() => removeClub(club)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Input + dropdown */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so click on suggestion registers
            setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type club name or pick below…"
          className={cn(
            "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        />

        {/* Suggestions dropdown */}
        {open && filtered.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
            {filtered.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addClub(suggestion)}
                className="flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Pick from suggestions or type a custom club name and press Enter
      </p>
    </div>
  );
}
