import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Navbar />
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-6">
        <h1 className="text-5xl font-bold">Fund the Future on Stellar</h1>
        <p className="text-gray-400 text-lg max-w-2xl">
          Discover and support innovative projects with lightning-fast, secure transactions on the
          Stellar network.
        </p>
        <div className="flex gap-4">
          <Link
            href="/campaigns"
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium transition"
          >
            Browse Campaigns
          </Link>
          <a
            href="https://developers.stellar.org"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl border border-gray-700 hover:border-gray-500 font-medium transition"
          >
            Learn about Stellar
          </a>
        </div>
      </section>
    </main>
  );
}
