"use client";

import { SubmitButton } from "@/components/ui/SubmitButton";

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
      <SubmitButton variant="danger">Reset demo</SubmitButton>
    </form>
  );
}
