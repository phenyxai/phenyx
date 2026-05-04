"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface WaitlistEntry {
  id: number;
  name: string;
  email: string;
  role: string | null;
  platforms: string[] | null;
  why: string | null;
  created_at: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch {
      console.error("Failed to fetch entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchEntries();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    
    if (password === adminPassword) {
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    setEntries([]);
    setSearchQuery("");
  };

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    
    const query = searchQuery.toLowerCase();
    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.email.toLowerCase().includes(query)
    );
  }, [entries, searchQuery]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPlatforms = (platforms: string[] | null) => {
    if (!platforms || platforms.length === 0) return "-";
    return platforms.join(", ");
  };

  const exportCSV = () => {
    const headers = ["number", "name", "email", "role", "platforms", "why", "created_at"];
    const csvContent = [
      headers.join(","),
      ...filteredEntries.map((entry, index) =>
        [
          index + 1,
          `"${entry.name}"`,
          `"${entry.email}"`,
          `"${entry.role || ""}"`,
          `"${formatPlatforms(entry.platforms)}"`,
          `"${entry.why || ""}"`,
          formatDate(entry.created_at),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `phenyx-waitlist-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold mb-8 text-white uppercase tracking-wider">
            PHENYX ADMIN
          </h1>
          
          {authError && (
            <p className="text-white/70 lowercase mb-4">access denied.</p>
          )}
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                className="w-full bg-transparent border-b border-white/30 py-2 text-white placeholder:lowercase focus:border-white focus:outline-none transition-colors"
              />
            </div>
            
            <button
              type="submit"
              className="px-6 py-2 border border-white/40 rounded-full text-sm lowercase hover:bg-white hover:text-[#0a0a0a] transition-all"
            >
              enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-semibold uppercase tracking-wider mb-2">
              PHENYX ADMIN
            </h1>
            <p className="text-sm lowercase" style={{ color: "rgba(255,255,255,0.6)" }}>
              {filteredEntries.length} members waiting
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={exportCSV}
              className="px-4 py-2 border border-white/40 rounded-full text-xs lowercase hover:bg-white hover:text-[#0a0a0a] transition-all"
            >
              export
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-white/40 rounded-full text-xs lowercase hover:bg-white hover:text-[#0a0a0a] transition-all"
            >
              logout
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="search by name or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md bg-transparent border-b border-white/30 py-2 text-white placeholder:lowercase placeholder:text-white/40 focus:border-white focus:outline-none transition-colors"
          />
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-white/60 lowercase">loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="py-3 px-2 text-xs font-normal lowercase" style={{ color: "rgba(255,255,255,0.5)" }}>#</th>
                  <th className="py-3 px-2 text-xs font-normal lowercase" style={{ color: "rgba(255,255,255,0.5)" }}>name</th>
                  <th className="py-3 px-2 text-xs font-normal lowercase" style={{ color: "rgba(255,255,255,0.5)" }}>email</th>
                  <th className="py-3 px-2 text-xs font-normal lowercase" style={{ color: "rgba(255,255,255,0.5)" }}>role</th>
                  <th className="py-3 px-2 text-xs font-normal lowercase" style={{ color: "rgba(255,255,255,0.5)" }}>platforms</th>
                  <th className="py-3 px-2 text-xs font-normal lowercase" style={{ color: "rgba(255,255,255,0.5)" }}>why</th>
                  <th className="py-3 px-2 text-xs font-normal lowercase" style={{ color: "rgba(255,255,255,0.5)" }}>date</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry, index) => (
                  <tr 
                    key={entry.id} 
                    className="border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{index + 1}</td>
                    <td className="py-3 px-2 text-sm">{entry.name}</td>
                    <td className="py-3 px-2 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{entry.email}</td>
                    <td className="py-3 px-2 text-sm lowercase" style={{ color: "rgba(255,255,255,0.6)" }}>{entry.role || "-"}</td>
                    <td className="py-3 px-2 text-sm lowercase" style={{ color: "rgba(255,255,255,0.6)" }}>{formatPlatforms(entry.platforms)}</td>
                    <td className="py-3 px-2 text-sm lowercase max-w-xs truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{entry.why || "-"}</td>
                    <td className="py-3 px-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{formatDate(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredEntries.length === 0 && (
              <p className="text-center py-8 lowercase" style={{ color: "rgba(255,255,255,0.5)" }}>
                {searchQuery ? "no results found" : "no entries yet"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
