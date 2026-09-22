"use client";

import { ShareButton } from "@/components/Actions";

export function InviteButton() {
  return (
    <div className="mt-5">
      <ShareButton
        compact={false}
        label="Invite a friend"
        url="/"
        title="ROUND"
        text="Where should we go tonight? ROUND gives you three places. Pick one, go."
      />
    </div>
  );
}
