"use client";

import { usePathname } from "next/navigation";
import TopBar from "./TopBar";

export default function ConditionalTopBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  if (pathname.startsWith("/intake")) return null;
  return <TopBar />;
}
