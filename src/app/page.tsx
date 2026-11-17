import type { Metadata } from "next";
import { StroopGame } from "@/components/StroopGame";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return <StroopGame />;
}
