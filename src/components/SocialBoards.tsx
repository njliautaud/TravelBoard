"use client";

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoardDeal {
  id: string;
  boardId: string;
  userId: string;
  origin: string;
  destination: string;
  price: number;
  currency: string;
  notes: string | null;
  votes: number;
  createdAt: string;
  commentCount: number;
}

interface Board {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  creatorId: string;
  createdAt: string;
  dealCount: number;
  deals: BoardDeal[];
}

interface Comment {
  id: string;
  dealId: string;
  userId: string;
  content: string;
  createdAt: string;
}

type ViewMode = "list" | "detail" | "create";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SocialBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("list");
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);

  // Create board form
  const [boardName, setBoardName] = useState("");
  const [boardDesc, setBoardDesc] = useState("");
  const [boardPublic, setBoardPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add deal form
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [dealOrigin, setDealOrigin] = useState("");
  const [dealDest, setDealDest] = useState("");
  const [dealPrice, setDealPrice] = useState("");
  const [dealNotes, setDealNotes] = useState("");

  // Comment form
  const [commentText, setCommentText] = useState("");

  const fetchBoards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/boards");
      const data = await res.json();
      if (data.boards) setBoards(data.boards);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBoards(); }, [fetchBoards]);

  async function fetchBoard(id: string) {
    try {
      const res = await fetch(`/api/boards/${id}`);
      const data = await res.json();
      if (data.board) {
        setSelectedBoard(data.board);
        // Update in list too
        setBoards((prev) => prev.map((b) => (b.id === id ? data.board : b)));
      }
    } catch { /* ignore */ }
  }

  async function fetchComments(dealId: string, boardId: string) {
    try {
      const res = await fetch(`/api/boards/${boardId}/deals/${dealId}/comments`);
      const data = await res.json();
      if (data.comments) {
        setComments((prev) => ({ ...prev, [dealId]: data.comments }));
      }
    } catch { /* ignore */ }
  }

  function openBoard(board: Board) {
    setSelectedBoard(board);
    setView("detail");
    setShowAddDeal(false);
    setExpandedDeal(null);
  }

  async function handleCreateBoard() {
    if (!boardName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: boardName,
          description: boardDesc || undefined,
          isPublic: boardPublic,
        }),
      });
      if (res.ok) {
        setBoardName("");
        setBoardDesc("");
        setView("list");
        fetchBoards();
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleDeleteBoard(id: string) {
    await fetch(`/api/boards/${id}`, { method: "DELETE" });
    setView("list");
    fetchBoards();
  }

  async function handleAddDeal() {
    if (!selectedBoard || !dealOrigin || !dealDest || !dealPrice) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/boards/${selectedBoard.id}/deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: dealOrigin,
          destination: dealDest,
          price: Number(dealPrice),
          notes: dealNotes || undefined,
        }),
      });
      if (res.ok) {
        setDealOrigin("");
        setDealDest("");
        setDealPrice("");
        setDealNotes("");
        setShowAddDeal(false);
        fetchBoard(selectedBoard.id);
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleVote(boardId: string, dealId: string, direction: "up" | "down") {
    try {
      await fetch(`/api/boards/${boardId}/deals/${dealId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      fetchBoard(boardId);
    } catch { /* ignore */ }
  }

  async function handleAddComment(boardId: string, dealId: string) {
    if (!commentText.trim()) return;
    try {
      await fetch(`/api/boards/${boardId}/deals/${dealId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      setCommentText("");
      fetchComments(dealId, boardId);
    } catch { /* ignore */ }
  }

  function toggleDealComments(dealId: string, boardId: string) {
    if (expandedDeal === dealId) {
      setExpandedDeal(null);
    } else {
      setExpandedDeal(dealId);
      if (!comments[dealId]) fetchComments(dealId, boardId);
    }
  }

  // ---- Render: Create Board ----
  function renderCreate() {
    return (
      <div className="mx-auto max-w-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">Create Board</h2>
          <button onClick={() => setView("list")} className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            Cancel
          </button>
        </div>

        <input
          type="text"
          placeholder="Board name..."
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
        />

        <textarea
          placeholder="Description (optional)..."
          rows={3}
          value={boardDesc}
          onChange={(e) => setBoardDesc(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none resize-none"
        />

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={boardPublic}
            onChange={(e) => setBoardPublic(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900"
          />
          Public board (visible to everyone)
        </label>

        <button
          onClick={handleCreateBoard}
          disabled={saving || !boardName.trim()}
          className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Board"}
        </button>
      </div>
    );
  }

  // ---- Render: Board Detail ----
  function renderDetail() {
    if (!selectedBoard) return null;
    return (
      <div className="mx-auto max-w-2xl p-4 space-y-4">
        <button onClick={() => setView("list")} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          All boards
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100">{selectedBoard.name}</h2>
            {selectedBoard.description && (
              <p className="mt-0.5 text-xs text-slate-500">{selectedBoard.description}</p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-600">
              <span>{selectedBoard.dealCount} deals</span>
              <span>{selectedBoard.isPublic ? "Public" : "Private"}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddDeal(!showAddDeal)}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              + Add Deal
            </button>
            <button
              onClick={() => handleDeleteBoard(selectedBoard.id)}
              className="rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Add Deal Form */}
        {showAddDeal && (
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Origin (e.g. JFK)"
                value={dealOrigin}
                onChange={(e) => setDealOrigin(e.target.value.toUpperCase())}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 uppercase placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Destination (e.g. NRT)"
                value={dealDest}
                onChange={(e) => setDealDest(e.target.value.toUpperCase())}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 uppercase placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
              />
            </div>
            <input
              type="number"
              placeholder="Price ($)"
              value={dealPrice}
              onChange={(e) => setDealPrice(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Notes (optional)"
              value={dealNotes}
              onChange={(e) => setDealNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
            />
            <button
              onClick={handleAddDeal}
              disabled={saving || !dealOrigin || !dealDest || !dealPrice}
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Deal"}
            </button>
          </div>
        )}

        {/* Deals List */}
        {selectedBoard.deals.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No deals posted yet. Be the first to share a deal!
          </div>
        ) : (
          <div className="space-y-3">
            {selectedBoard.deals.map((deal) => (
              <div key={deal.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-start gap-3">
                  {/* Vote buttons */}
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={() => handleVote(selectedBoard.id, deal.id, "up")}
                      className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-amber-400"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" /></svg>
                    </button>
                    <span className="text-sm font-semibold text-amber-400">{deal.votes}</span>
                    <button
                      onClick={() => handleVote(selectedBoard.id, deal.id, "down")}
                      className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                  </div>

                  {/* Deal content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">
                          {deal.origin} → {deal.destination}
                        </span>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          ${deal.price.toLocaleString()} {deal.currency}
                        </span>
                      </div>
                    </div>
                    {deal.notes && (
                      <p className="mt-1 text-xs text-slate-400">{deal.notes}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                      <span>{new Date(deal.createdAt).toLocaleDateString()}</span>
                      <button
                        onClick={() => toggleDealComments(deal.id, selectedBoard.id)}
                        className="flex items-center gap-1 text-slate-500 hover:text-slate-300"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        {deal.commentCount} comments
                      </button>
                    </div>

                    {/* Comments */}
                    {expandedDeal === deal.id && (
                      <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                        {(comments[deal.id] ?? []).map((c) => (
                          <div key={c.id} className="rounded-lg bg-slate-800/50 px-3 py-2">
                            <p className="text-xs text-slate-300">{c.content}</p>
                            <span className="text-[10px] text-slate-600">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add a comment..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddComment(selectedBoard.id, deal.id)}
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
                          />
                          <button
                            onClick={() => handleAddComment(selectedBoard.id, deal.id)}
                            disabled={!commentText.trim()}
                            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-50"
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- Render: Board List ----
  return (
    <div className="flex h-full flex-col bg-slate-950">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Social Boards</h2>
            <p className="text-xs text-slate-500">Share and vote on travel deals with others</p>
          </div>
          {view === "list" && (
            <button
              onClick={() => setView("create")}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-amber-400"
            >
              + New Board
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {view === "create" && renderCreate()}
        {view === "detail" && renderDetail()}
        {view === "list" && (
          <div className="mx-auto max-w-2xl p-4">
            {loading ? (
              <div className="py-12 text-center text-sm text-slate-500">Loading boards...</div>
            ) : boards.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/80">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">No boards yet.</p>
                <p className="mt-1 text-xs text-slate-500">Create a board to start sharing deals!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {boards.map((board) => (
                  <button
                    key={board.id}
                    onClick={() => openBoard(board)}
                    className="group w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900/80"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white">
                          {board.name}
                        </h3>
                        {board.description && (
                          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{board.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                          {board.dealCount} deals
                        </span>
                        {board.isPublic ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">Public</span>
                        ) : (
                          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">Private</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Created {new Date(board.createdAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
