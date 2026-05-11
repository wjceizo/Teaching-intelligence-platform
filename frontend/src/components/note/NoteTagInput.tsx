import { KeyboardEvent, useState } from "react";

interface NoteTagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function NoteTagInput({ tags, onChange }: NoteTagInputProps) {
  const [tagInput, setTagInput] = useState("");

  function addTag(): void {
    const value = tagInput.trim();
    if (!value || tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setTagInput("");
      return;
    }
    onChange([...tags, value]);
    setTagInput("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onChange(tags.filter((item) => item !== tag))}
          className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700"
        >
          {tag} x
        </button>
      ))}
      <input
        value={tagInput}
        onChange={(event) => setTagInput(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入标签后按 Enter"
        className="min-w-48 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      />
    </div>
  );
}
