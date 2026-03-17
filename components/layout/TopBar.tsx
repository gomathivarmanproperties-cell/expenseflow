Fix 2 build errors in ExpenseFlow:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR 1 — app/layout.tsx
Font weight error: Instrument Serif only supports weight 400.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the Instrument_Serif font declaration in app/layout.tsx.
Remove any weight options other than 400.

Change from:
const instrumentSerif = Instrument_Serif({
  weight: ["400", "500"],  // or any other weights
  ...
})

To:
const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
})

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR 2 — components/layout/TopBar.tsx
JSX parsing error around lines 305-326.
The file got corrupted during editing.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The TopBar.tsx file has broken JSX structure. 
Please COMPLETELY REWRITE components/layout/TopBar.tsx 
from scratch with this exact implementation:

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, query, where, orderBy, limit, 
         onSnapshot, updateDoc, doc, writeBatch,
         Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { Bell, LogOut } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "approval" | "rejection" | "reminder" | "info";
  read: boolean;
  createdAt: Timestamp | Date;
}

const roleBadgeStyles: Record<string, React.CSSProperties> = {
  admin:    { backgroundColor: "#fef3c7", color: "#b45309" },
  finance:  { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  manager:  { backgroundColor: "#fed7aa", color: "#ea580c" },
  employee: { backgroundColor: "#f1f5f9", color: "#475569" },
};

const roleDisplayNames: Record<string, string> = {
  admin: "Admin", finance: "Finance", 
  manager: "Manager", employee: "Employee",
};

const notifColors: Record<string, string> = {
  reminder: "#f59e0b", approval: "#10b981", 
  rejection: "#ef4444", info: "#6366f1",
};

export function TopBar({ currentPage }: { currentPage: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && 
          !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    return onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification))
      );
    });
  }, [user]);

  if (!user) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    const batch = writeBatch(db);
    notifications
      .filter(n => !n.read)
      .forEach(n => batch.update(
        doc(db, "notifications", n.id), { read: true }
      ));
    await batch.commit();
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const initials = user.fullName
    ?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  const formatPageName = (page: string) =>
    page.split("-")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const formatDate = (createdAt: Timestamp | Date) => {
    const date = createdAt instanceof Date
      ? createdAt
      : createdAt?.toDate?.() ?? new Date();
    return date.toLocaleDateString("en-IN", {
      day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit"
    });
  };

  const roleStyle = roleBadgeStyles[user.role] ?? roleBadgeStyles.employee;

  return (
    <div style={{
      height: 64,
      backgroundColor: "white",
      borderBottom: "1px solid #e2e8f0",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: 24,
      paddingRight: 24,
    }}>

      {/* Page title */}
      <h1 style={{
        fontSize: 20,
        fontWeight: 600,
        color: "#0f172a",
        margin: 0,
        fontFamily: "var(--font-serif)",
      }}>
        {formatPageName(currentPage)}
      </h1>

      {/* Right section */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

        {/* Role badge */}
        <div style={{
          ...roleStyle,
          padding: "4px 12px",
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 600,
        }}>
          {roleDisplayNames[user.role] ?? "Employee"}
        </div>

        {/* Notification Bell */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => {
              setShowNotifs(!showNotifs);
              if (!showNotifs && unreadCount > 0) handleMarkAllRead();
            }}
            style={{
              position: "relative",
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#f59e0b",
                border: "2px solid white",
              }} />
            )}
          </button>

          {/* Notifications dropdown */}
          {showNotifs && (
            <div style={{
              position: "absolute",
              top: 46,
              right: 0,
              width: 340,
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
              zIndex: 100,
              overflow: "hidden",
            }}>
              <div style={{
                padding: "14px 16px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <span style={{ 
                  fontSize: 14, fontWeight: 600, color: "#0f172a" 
                }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      fontSize: 12,
                      color: "#10b981",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {notifications.length === 0 ? (
                  <div style={{
                    padding: 40,
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: 13,
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      You&apos;re all caught up!
                    </div>
                    <div style={{ fontSize: 12 }}>
                      No new notifications
                    </div>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => updateDoc(
                        doc(db, "notifications", n.id), 
                        { read: true }
                      )}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #f8fafc",
                        backgroundColor: n.read ? "white" : "#f0fdf4",
                        cursor: "pointer",
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: notifColors[n.type] ?? "#94a3b8",
                        marginTop: 5,
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0f172a",
                          margin: "0 0 2px 0",
                        }}>
                          {n.title}
                        </p>
                        <p style={{
                          fontSize: 12,
                          color: "#64748b",
                          margin: "0 0 4px 0",
                          lineHeight: 1.5,
                        }}>
                          {n.message}
                        </p>
                        <p style={{ 
                          fontSize: 11, color: "#94a3b8", margin: 0 
                        }}>
                          {formatDate(n.createdAt)}
                        </p>
                      </div>
                      {!n.read && (
                        <div style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          backgroundColor: "#10b981",
                          flexShrink: 0,
                          marginTop: 5,
                        }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <button
          onClick={() => router.push("/profile")}
          title="My Profile"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            backgroundColor: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #f59e0b",
            cursor: "pointer",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ 
              color: "white", fontSize: 13, fontWeight: 600 
            }}>
              {initials}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            backgroundColor: "white",
            color: "#64748b",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = "#fef2f2";
            e.currentTarget.style.color = "#dc2626";
            e.currentTarget.style.borderColor = "#fecaca";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = "white";
            e.currentTarget.style.color = "#64748b";
            e.currentTarget.style.borderColor = "#e2e8f0";
          }}
        >
          <LogOut size={14} />
          Logout
        </button>

      </div>
    </div>
  );
}