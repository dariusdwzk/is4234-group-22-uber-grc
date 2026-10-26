"use client";

export function ResetButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm("Reset the demo? All cases and users are recreated.")
        )
          e.preventDefault();
      }}
    >
      <button type="submit" className="border px-3 py-1">
        Reset demo
      </button>
    </form>
  );
}
