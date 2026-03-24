import React, { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { CampaignCard } from "@/components/ui/CampaignCard";
import { fetchAllCampaigns } from "@/lib/soroban";
import type { Campaign } from "@/types/campaign";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CampaignSkeleton() {
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 animate-pulse">
      <div className="w-full h-48 bg-gray-800" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-gray-800 rounded w-3/4" />
        <div className="h-4 bg-gray-800 rounded w-full" />
        <div className="h-4 bg-gray-800 rounded w-5/6" />
        <div className="h-2 bg-gray-800 rounded-full" />
        <div className="h-4 bg-gray-800 rounded w-1/2" />
        <div className="h-9 bg-gray-800 rounded-xl" />
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => <CampaignSkeleton key={i} />)}
    </div>
  );
}

// ── Campaign grid (async server component) ────────────────────────────────────

async function CampaignGrid() {
  const onChain = await fetchAllCampaigns();

  // Map on-chain data to Campaign shape; fall back to placeholder image
  const campaigns: Campaign[] = onChain.map((c) => ({
    id: c.contractId,
    title: c.title,
    description: c.description,
    raised: c.raised,
    goal: c.goal,
    deadline: c.deadline,
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800",
    contractId: c.contractId,
  }));

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
        <p className="text-5xl">🌱</p>
        <h2 className="text-xl font-semibold text-white">No campaigns yet</h2>
        <p className="text-gray-400 max-w-sm">
          Be the first to launch a campaign on Fund-My-Cause and start raising funds on Stellar.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Active Campaigns</h1>
        <Suspense fallback={<GridSkeleton />}>
          {/* @ts-expect-error async server component */}
          <CampaignGrid />
        </Suspense>
      </section>
    </main>
  );
}
