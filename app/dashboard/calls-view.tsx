"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Call, Sentiment } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/status-badge";
import { SentimentDot } from "@/components/sentiment-dot";
import { formatFaDate, resolvedLabel, t } from "@/lib/strings";
import { deleteCall } from "@/lib/actions";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";

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
  const [showFilters, setShowFilters] = useState(false);

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
      {/* Search + filter toggle */}
      <div className="panel p-3 md:p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              className="input ps-9"
              placeholder={t.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-muted text-sm pointer-events-none">⌕</span>
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={"btn text-sm whitespace-nowrap " + (showFilters || anyFilter ? "" : "btn-ghost")}
          >
            {t.filters}
            {anyFilter && (
              <span className="ms-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-accent text-bg text-[10px] font-bold fa-nums">
                {[agent, category, from, to].filter(Boolean).length + (resolvedF !== "all" ? 1 : 0) + (sentF !== "all" ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
            {anyFilter && (
              <div className="md:col-span-2 lg:col-span-3 flex justify-end">
                <button onClick={clearFilters} className="btn btn-ghost text-xs text-muted">
                  {t.clearFilters}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <EmptyState hasFilter={anyFilter} totalCount={calls.length} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="panel overflow-hidden hidden md:block">
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <CallRow
                      key={c.id}
                      call={c}
                      onDeleted={(id) => setCalls((prev) => prev.filter((x) => x.id !== id))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => (
              <CallCard
                key={c.id}
                call={c}
                onDeleted={(id) => setCalls((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        </>
      )}

      <div className="text-xs text-muted text-center fa-nums">
        نمایش {filtered.length.toLocaleString("fa-IR")} از {calls.length.toLocaleString("fa-IR")} تماس
      </div>
    </div>
  );
}

function EmptyState({ hasFilter, totalCount }: { hasFilter: boolean; totalCount: number }) {
  if (hasFilter) {
    return (
      <div className="panel p-12 text-center text-muted">
        <div className="text-3xl mb-2">⌕</div>
        <div>{t.noCalls}</div>
        <div className="text-xs mt-1">با این فیلترها نتیجه‌ای پیدا نشد.</div>
      </div>
    );
  }
  if (totalCount === 0) {
    return (
      <div className="panel p-12 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-panel2 flex items-center justify-center text-2xl mb-3">♪</div>
        <div className="font-semibold mb-1">هنوز تماسی بارگذاری نشده است</div>
        <div className="text-sm text-muted mb-5">برای شروع، اولین فایل صوتی را بارگذاری کنید.</div>
        <Link href="/dashboard/upload" className="btn btn-primary inline-flex">
          + {t.newUpload}
        </Link>
      </div>
    );
  }
  return <div className="panel p-12 text-center text-muted">{t.noCalls}</div>;
}

function DeleteButton({ id, onDeleted, size = "sm" }: { id: string; onDeleted: (id: string) => void; size?: "sm" | "md" }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  async function handle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const ok = await confirm({
      title: t.confirmDelete,
      message: "این عمل غیرقابل بازگشت است. فایل صوتی و تمام داده‌های تحلیل‌شده پاک می‌شود.",
      confirmLabel: t.delete,
      cancelLabel: "انصراف",
      kind: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteCall(id);
      if (res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("تماس حذف شد", "success");
      onDeleted(id);
    });
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      title={t.delete}
      className={
        "btn btn-ghost text-danger hover:bg-danger/10 " +
        (size === "sm" ? "text-xs px-2 py-1" : "text-sm")
      }
    >
      {pending ? "…" : "🗑"}
    </button>
  );
}

function CallRow({ call: c, onDeleted }: { call: Call; onDeleted: (id: string) => void }) {
  return (
    <tr>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block fa-nums text-xs text-muted">
          {formatFaDate(c.created_at)}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block">
          <div className="text-sm">{c.caller_name || <span className="text-muted">{t.unknown}</span>}</div>
          {c.caller_phone && (
            <div className="text-xs text-muted fa-nums mt-0.5" dir="ltr">{c.caller_phone}</div>
          )}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block text-sm">
          {c.agent_name || <span className="text-muted">{t.unknown}</span>}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block">
          <div className="text-sm line-clamp-2 max-w-[420px] leading-6">
            {c.issue_summary || (c.status !== "done" ? <span className="text-muted">…</span> : <span className="text-muted">{t.unknown}</span>)}
          </div>
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block">
          {c.category ? <span className="badge badge-info">{c.category}</span> : <span className="text-muted text-xs">—</span>}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block">
          {c.resolved === true && <span className="badge badge-success">{resolvedLabel(true)}</span>}
          {c.resolved === false && <span className="badge badge-danger">{resolvedLabel(false)}</span>}
          {c.resolved == null && <span className="text-muted text-xs">—</span>}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block">
          <SentimentDot value={c.sentiment_caller} label={t.thCaller} />
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block">
          <StatusBadge status={c.status} />
        </Link>
      </td>
      <td className="text-left whitespace-nowrap">
        <DeleteButton id={c.id} onDeleted={onDeleted} />
      </td>
    </tr>
  );
}

function CallCard({ call: c, onDeleted }: { call: Call; onDeleted: (id: string) => void }) {
  return (
    <Link href={`/dashboard/calls/${c.id}`} className="block panel p-4 active:bg-panel2/60 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted fa-nums">
            <span>{formatFaDate(c.created_at)}</span>
            <StatusBadge status={c.status} />
          </div>
          <div className="mt-2 font-semibold text-sm">
            {c.caller_name || <span className="text-muted">{t.unknown}</span>}
            {c.caller_phone && (
              <span className="ms-2 text-xs text-muted fa-nums" dir="ltr">{c.caller_phone}</span>
            )}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {c.agent_name ? `کارشناس: ${c.agent_name}` : null}
          </div>
        </div>
        <DeleteButton id={c.id} onDeleted={onDeleted} />
      </div>

      {c.issue_summary && (
        <div className="text-sm mt-3 leading-7 line-clamp-2">{c.issue_summary}</div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {c.category && <span className="badge badge-info">{c.category}</span>}
        {c.resolved === true && <span className="badge badge-success">{resolvedLabel(true)}</span>}
        {c.resolved === false && <span className="badge badge-danger">{resolvedLabel(false)}</span>}
        <SentimentDot value={c.sentiment_caller} />
      </div>
    </Link>
  );
}
