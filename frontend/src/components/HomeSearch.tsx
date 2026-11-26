"use client";

import { useRouter } from "next/navigation";
import { useHealth } from "@/lib/useHealth";
import SearchBox from "./SearchBox";

const REAL_EXAMPLES = ["@veritasium", "@mkbhd", "@fireship", "@kurzgesagt"];
const DEMO_EXAMPLES = ["@orbitlab", "@byteforge", "@masalamornings"];

export default function HomeSearch() {
  const router = useRouter();
  const health = useHealth();
  return (
    <SearchBox
      pickSingle
      examples={health?.demo ? DEMO_EXAMPLES : REAL_EXAMPLES}
      onSelect={(r) => router.push(`/channel/${r.id}`)}
    />
  );
}
