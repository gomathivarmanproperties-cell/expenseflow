"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { Bell, LogOut } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "reminder" | "approval" | "rejection" | "info";
  read: boolean;
  createdAt: string;
}

const roleBadgeColors: Record<string, { backgroundColor: string; color: string }> = {
  admin:    { backgroundColor: "#f3e8ff", color: "#7c3aed" },
  finance:  { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  manager:  { backgroundColor: "#fed7aa", color: "#ea580c" },
  employee: { backgroundColor: "#f3f4f6", color: "#374151" },
};

const roleDisplayNames: Record<string, string> = {
  admin: "Admin", finance: "Finance", manager: "Manager", employee: "Employee",
};

const notifColors: Record<string, string> = {
  reminder: "#f59e0b", approval: "#10b981", rejection: "#ef4444", info: "#6366f1",
};

export function TopBar({ currentPage }: { currentPage: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notifications"), where("userId", "==", user.uid), orderBy("createdAt", "desc"), limit(20));
    return onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => batch.update(doc(db, "notifications", n.id), { read: true }));
    await batch.commit();
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (!user) return null;

  const initials = user.fullName?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";
  const roleColor = roleBadgeColors[user.role] ?? roleBadgeColors.employee;

  const formatPageName = (page: string) =>
    page.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return (
    <div style={{ height: 64, backgroundColor: "white", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 24, paddingRight: 24 }}>

      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: 0 }}>
        {formatPageName(currentPage)}
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

        {/* Role badge */}
        <div style={{ ...roleColor, padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>
          {roleDisplayNames[user.role] ?? "Employee"}
        </div>

        {/* Notification Bell */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs && unreadCount > 0) handleMarkAllRead(); }}
            style={{ position: "relative", width: 40, height: 40, borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f9fafb")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#fff")}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ef4444", border: "2px solid #fff" }} />
            )}
          </button>

          {showNotifs && (
            <div style={{ position: "absolute", top: 48, right: 0, width: 340, backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} style={{ fontSize: 12, color: "#10b981", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No notifications yet</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => updateDoc(doc(db, "notifications", n.id), { read: true })}
                      style={{ padding: "12px 16px", borderBottom: "1px solid #f9fafb", backgroundColor: n.read ? "#fff" : "#f0fdf4", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f9fafb")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = n.read ? "#fff" : "#f0fdf4")}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: notifColors[n.type] ?? "#6b7280", marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: "0 0 2px 0" }}>{n.title}</p>
                        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 4px 0", lineHeight: 1.5 }}>{n.message}</p>
                        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
                          {n.createdAt ? new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                        </p>
                      </div>
                      {!n.read && <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10b981", flexShrink: 0, marginTop: 5 }} />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar → Profile */}
        <button
          onClick={() => router.push("/profile")}
          title="My Profile"
          style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #a7f3d0", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ color: "white", fontSize: 14, fontWeight: 600 }}>{initials}</span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "white", color: "#6b7280", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#fef2f2"; e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.borderColor = "#fecaca"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "white"; e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
        >
          <LogOut size={15} />
          Logout
        </button>

      </div>
    </div>
  );
}