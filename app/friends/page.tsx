import { redirect } from "next/navigation";

/** Friends live on the YOU tab now (V25). Old links still land somewhere. */
export default function FriendsPage() {
  redirect("/you#friends");
}
