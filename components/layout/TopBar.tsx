"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  updateDoc, 
  doc, 
  writeBatch,
  Timestamp 
} from "firebase/firestore";
import { 
  Bell, 
  Settings, 
  User,
  CheckCircle,
  AlertCircle,
  Info,
  Clock
} from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "approval" | "rejection" | "reminder" | "info";
  read: boolean;
  createdAt: Timestamp | Date;
}

const roleBadgeColors = {
  admin: { backgroundColor: "#f3e8ff", color: "#7c3aed" },
  finance: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  manager: { backgroundColor: "#fed7aa", color: "#ea580c" },
  employee: { backgroundColor: "#f3f4f6", color: "#374151" },
};

const roleDisplayNames = {
  admin: "Admin",
  finance: "Finance",
  manager: "Manager",
  employee: "Employee",
};

export function TopBar({ currentPage }: { currentPage: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications from Firestore
  useEffect(() => {
    if (!user) return;

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const notificationsData: Notification[] = [];
      let unread = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const notification: Notification = {
          id: doc.id,
          title: data.title || "Notification",
          message: data.message || "",
          type: data.type || "info",
          read: data.read || false,
          createdAt: data.createdAt || new Date()
        };
        notificationsData.push(notification);
        
        if (!notification.read) {
          unread++;
        }
      });

      setNotifications(notificationsData);
      setUnreadCount(unread);
    });

    return unsubscribe;
  }, [user]);

  if (!user) return null;

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(db);
      unreadNotifications.forEach((notification) => {
        const docRef = doc(db, "notifications", notification.id);
        batch.update(docRef, { read: true });
      });

      await batch.commit();
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'approval': return <CheckCircle size={16} />;
      case 'rejection': return <AlertCircle size={16} />;
      case 'reminder': return <Clock size={16} />;
      default: return <Info size={16} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'approval': return { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
      case 'rejection': return { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
      case 'reminder': return { backgroundColor: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a" };
      default: return { backgroundColor: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe" };
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
  };

  const roleColor = roleBadgeColors[user.role as keyof typeof roleBadgeColors] || roleBadgeColors.employee;
  const roleDisplayName = roleDisplayNames[user.role as keyof typeof roleDisplayNames] || "Employee";

  const formatPageName = (page: string) => {
    return page
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div
      style={{
        height: "64px",
        backgroundColor: "white",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: "24px",
        paddingRight: "24px",
      }}
    >
      {/* LEFT - Current page name */}
      <div>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#111827",
            margin: 0,
          }}
        >
          {formatPageName(currentPage)}
        </h1>
      </div>

      {/* RIGHT - Role badge + notifications + avatar + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>

        {/* Role badge */}
        <div
          style={{
            backgroundColor: roleColor.backgroundColor,
            color: roleColor.color,
            padding: "4px 12px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: "600",
          }}
        >
          {roleDisplayName}
        </div>

        {/* Notifications */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (showNotifications) markAllAsRead();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              backgroundColor: "white",
              cursor: "pointer",
              position: "relative"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f9fafb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "white";
            }}
          >
            <Bell size={18} color="#6b7280" />
            {unreadCount > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                  color: "white",
                  fontSize: "10px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div
              style={{
                position: "absolute",
                top: "44px",
                right: "0",
                width: "320px",
                maxHeight: "400px",
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                zIndex: 50,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #f3f4f6",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#111827",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{
                      fontSize: "12px",
                      color: "#10b981",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "500"
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {notifications.length === 0 ? (
                  <div
                    style={{
                      padding: "24px",
                      textAlign: "center",
                      color: "#9ca3af",
                      fontSize: "14px"
                    }}
                  >
                    No notifications
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markAsRead(notif.id)}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #f3f4f6",
                        cursor: "pointer",
                        backgroundColor: notif.read ? "white" : "#f9fafb"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f3f4f6";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = notif.read ? "white" : "#f9fafb";
                      }}
                    >
                      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <div
                          style={{
                            ...getNotificationColor(notif.type),
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                          }}
                        >
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: "600", color: "#111827", marginBottom: "2px" }}>
                            {notif.title}
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                            {notif.message}
                          </div>
                          <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                            {(notif.createdAt instanceof Date 
                            ? notif.createdAt 
                            : notif.createdAt?.toDate?.() ?? new Date()
                          ).toLocaleDateString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "numeric",
                              month: "short"
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {notifications.length === 0 && (
                  <div style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "14px"
                  }}>
                    <div style={{ marginBottom: "8px" }}>🔔</div>
                    <div>No notifications</div>
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>
                      You're all caught up!
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar circle with initials - clickable to profile */}
        <button
          onClick={() => router.push("/profile")}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            cursor: "pointer",
            overflow: "hidden"
          }}
        >
          {user?.photoURL ? (
            <img 
              src={user.photoURL} 
              alt="Profile" 
              style={{ width: "100%", height: "100%", objectFit: "cover" }} 
            />
          ) : (
            <span style={{ color: "white", fontSize: "14px", fontWeight: "600" }}>
              {getInitials(user.fullName)}
            </span>
          )}
        </button>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            backgroundColor: "white",
            color: "#6b7280",
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#fef2f2";
            (e.currentTarget as HTMLButtonElement).style.color = "#dc2626";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#fecaca";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "white";
            (e.currentTarget as HTMLButtonElement).style.color = "#6b7280";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb";
          }}
        >
          {/* Logout icon */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>

      </div>
    </div>
  );
}