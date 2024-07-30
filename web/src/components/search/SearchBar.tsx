import React, { KeyboardEvent, ChangeEvent } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  onSearch: () => void;
}

export const SearchBar = ({ query, setQuery, onSearch }: SearchBarProps) => {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const target = event.target;
    setQuery(target.value);

    // Resize the textarea to fit the content
    target.style.height = "24px";
    const newHeight = target.scrollHeight;
    target.style.height = `${newHeight}px`;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      onSearch();
      event.preventDefault();
    }
  };

  return (
    <div className="flex justify-center">
      <div className="flex items-center w-full px-4 py-2 border-2 rounded-lg opacity-100 border-border focus-within:border-accent bg-background-search">
        <MagnifyingGlass className="text-emphasis" />
        <textarea
          autoFocus
          className="flex-grow h-6 ml-2 overflow-hidden whitespace-normal outline-none resize-none placeholder-default"
          role="textarea"
          aria-multiline
          placeholder="Search..."
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          suppressContentEditableWarning={true}
        />
      </div>
    </div>
  );
};
