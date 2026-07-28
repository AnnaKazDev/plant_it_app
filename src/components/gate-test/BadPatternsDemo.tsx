"use client";

import { useState } from "react";

export function BadPatternsDemo() {
  const [highlighted, setHighlighted] = useState(false);

  return (
    <button
      type="button"
      className={"rounded px-3 py-1 " + (highlighted ? "bg-emerald-500 text-white" : "bg-slate-200")}
      onClick={() => {
        setHighlighted(!highlighted);
      }}
    >
      Gate test button
    </button>
  );
}
