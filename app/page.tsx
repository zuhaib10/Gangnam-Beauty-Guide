import type { Metadata } from "next";
import ReviewWorkflow from "./ReviewWorkflow";

export const metadata: Metadata = {
  title: "Review Passport — Gangnam Beauty Guide",
  description:
    "A provenance-first workflow for translating, normalizing, and verifying Korean clinic reviews.",
};

export default function Home() {
  return <ReviewWorkflow />;
}
