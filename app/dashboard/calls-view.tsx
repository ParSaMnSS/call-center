"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Call, Sentiment } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/status-badge";
import { SentimentDot } from "@/components/sentiment-dot";
import { formatFaDate, resolvedLabel, t } from "@/lib/strings";

type ResolvedFilter = "all" | "yes" | "no";
type SentimentFilter = "all" | Sentiment;

export function CallsView({ initial }: { initial: Call[] }) {
  const [calls, setCalls] = useState<Call[]>(initial);

  // Filter state
  const [search, setSearch] = useState("");
  const [agent, setAgent] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [resolvedF, setResolvedF] = useState<ResolvedFilter>("all");
  const [sentF, setSentF] = useState<SentimentFilter>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // Realtime subscription
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel("calls-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        (payload) => {
          setCalls((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Call;
              if (prev.some((c) => c.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Call;
              return prev.map((c) => (c.id === row.id ? { ...c, ...row } : c));
            }
            if (payload.eventType === "DELETE") {
              const old = payload.old as { id: string };
              return prev.filter((c) => c.id !== old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const agents = useMemo(() => {
    const s = new Set<string>();
    for (const c of calls) if (c.agent_name) s.add(c.agent_name);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "fa"));
  }, [calls]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const c of calls) if (c.category) s.add(c.category);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "fa"));
  }, [calls]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromDt = from ? new Date(from + "T00:00:00") : null;
    const toDt = to ? new Date(to + "T23:59:59") : null;

    return calls.filter((c) => {
      if (agent && c.agent_name !== agent) return false;
      if (category && c.category !== category) return false;
      if (resolvedF === "yes" && c.resolved !== true) return false;
      if (resolvedF === "no" && c.resolved !== false) return false;
      if (sentF !== "all" && c.sentiment_caller !== sentF && c.sentiment_agent !== sentF) return false;

      const created = new Date(c.created_at);
      if (fromDt && created < fromDt) return false;
      if (toDt && created > toDt) return false;

      if (q) {
        const hay = [
          c.transcript, c.issue_summary, c.caller_name, c.caller_phone,
          c.agent_name, c.notes, c.category, ...(c.tags ?? []),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [calls, search, agent, category, resolvedF, sentF, from, to]);

  function clearFilters() {
    setSearch(""); setAgent(""); setCategory("");
    setResolvedF("all"); setSentF("all"); setFrom(""); setTo("");
  }

  const anyFilter = !!(search || agent || category || from || to || resolvedF !== "all" || sentF !== "all");

  return (
    <div className="space-y-4">
      {/* Filters panel */}
      <div className="panel p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <label className="text-xs text-muted mb-1 block">{t.search}</label>
            <input
              type="text"
              className="input"
              placeholder={t.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">{t.fromDate}</label>
            <input type="date" className="input fa-nums" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">{t.toDate}</label>
            <input type="date" className="input fa-nums" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">{t.agent}</label>
            <select className="input" value={agent} onChange={(e) => setAgent(e.target.value)}>
              <option value="">{t.allAgents}</option>
              {agents.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">{t.category}</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t.allCategories}</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">{t.resolvedFilter}</label>
            <select className="input" value={resolvedF} onChange={(e) => setResolvedF(e.target.value as ResolvedFilter)}>
              <option value="all">{t.allStatuses}</option>
              <option value="yes">{t.resolvedOnly}</option>
              <option value="no">{t.unresolvedOnly}</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">{t.sentiment}</label>
            <select className="input" value={sentF} onChange={(e) => setSentF(e.target.value as SentimentFilter)}>
              <option value="all">{t.allSentiments}</option>
              <option value="positive">{t.positive}</option>
              <option value="neutral">{t.neutral}</option>
              <option value="negative">{t.negative}</option>
            </select>
          </div>
        </div>
        {anyFilter && (
          <div className="mt-3 flex justify-end">
            <button onClick={clearFilters} className="btn btn-ghost text-sm text-muted">
              {t.clearFilters}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted">{t.noCalls}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t.thDate}</th>
                  <th>{t.thCaller}</th>
                  <th>{t.thAgent}</th>
                  <th>{t.thIssue}</th>
                  <th>{t.thCategory}</th>
                  <th>{t.thResolved}</th>
                  <th>{t.thSentiment}</th>
                  <th>{t.thStatus}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="cursor-pointer">
                    <td>
                      <Link href={`/dashboard/calls/${c.id}`} className="block fa-nums text-sm">
                        {formatFaDate(c.created_at)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/dashboard/calls/${c.id}`} className="block">
                        <div className="text-sm">{c.caller_name || t.unknown}</div>
                        {c.caller_phone && (
                          <div className="text-xs text-muted fa-nums" dir="ltr">{c.caller_phone}</div>
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/dashboard/calls/${c.id}`} className="block text-sm">
                        {c.agent_name || t.unknown}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/dashboard/calls/${c.id}`} className="block">
                        <div className="text-sm line-clamp-2 max-w-[420px]">
                          {c.issue_summary || (c.status !== "done" ? <span className="text-muted">…</span> : t.unknown)}
                        </div>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/dashboard/calls/${c.id}`} className="block">
                        {c.category ? <span className="badge badge-info">{c.category}</span> : <span className="text-muted">—</span>}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/dashboard/calls/${c.id}`} className="block">
                        {c.resolved === true ? (
                          <span className="badge badge-success">{resolvedLabel(true)}</span>
                        ) : c.resolved === false ? (
                          <span className="badge badge-danger">{resolvedLabel(false)}</span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/dashboard/calls/${c.id}`} className="block space-y-1">
                        <SentimentDot value={c.sentiment_caller} label={t.thCaller} />
                      </Link>
                    </td>
                    <td>
                      <Link href={`/dashboard/calls/${c.id}`} className="block">
                        <StatusBadge status={c.status} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-muted text-center fa-nums">
        نمایش {filtered.length.toLocaleString("fa-IR")} از {calls.length.toLocaleString("fa-IR")} تماس
      </div>
    </div>
  );
}
