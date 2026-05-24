import React, { createContext, useState, useEffect, useContext } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

export const RoleContext = createContext({
  role: null,
  internalUser: null,
  isLoadingRole: true,
  roleError: null, // null | "not_found" | "inactive"
});

export function RoleProvider({ children }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [role, setRole] = useState(null);
  const [internalUser, setInternalUser] = useState(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [roleError, setRoleError] = useState(null);

  useEffect(() => {
    // Skip for public guest-form route
    if (window.location.pathname === "/guest-form") {
      setIsLoadingRole(false);
      return;
    }

    if (isLoadingAuth) return;

    if (!isAuthenticated || !user?.email) {
      setIsLoadingRole(false);
      return;
    }

    loadRole(user.email);
  }, [isAuthenticated, isLoadingAuth, user]);

  const loadRole = async (email) => {
    setIsLoadingRole(true);
    const normalizedEmail = email.trim().toLowerCase();
    console.log("[ROLE DEBUG] auth user email:", normalizedEmail);
    try {
      // Try exact match first, then case-insensitive scan
      let results = await base44.entities.InternalUser.filter({ email: normalizedEmail });
      if (!results || results.length === 0) {
        // Fallback: load all and match case-insensitively
        const all = await base44.entities.InternalUser.list();
        results = all.filter(u => u.email && u.email.trim().toLowerCase() === normalizedEmail);
      }

      if (!results || results.length === 0) {
        // Emergency fallback: if NO InternalUser records exist at all, auto-promote current user
        const allUsers = await base44.entities.InternalUser.list();
        console.log("[ROLE DEBUG] InternalUser count:", allUsers.length);
        if (allUsers.length === 0) {
          console.log("[ROLE DEBUG] Empty InternalUser table — auto-creating SUPER_ADMIN for:", normalizedEmail);
          const authUser = await base44.auth.me();
          const created = await base44.entities.InternalUser.create({
            email: normalizedEmail,
            name: authUser?.full_name || normalizedEmail,
            role: "SUPER_ADMIN",
            active: true,
            notes: "Auto-created on first setup",
          });
          setRoleError(null);
          setRole("SUPER_ADMIN");
          setInternalUser(created);
        } else {
          console.log("[ROLE DEBUG] not_found for email:", normalizedEmail);
          setRoleError("not_found");
          setRole(null);
          setInternalUser(null);
        }
      } else {
        const iu = results[0];
        console.log("[ROLE DEBUG] found InternalUser:", iu.email, "role:", iu.role, "active:", iu.active);
        if (!iu.active) {
          setRoleError("inactive");
          setRole(null);
          setInternalUser(iu);
        } else {
          setRoleError(null);
          setRole(iu.role);
          setInternalUser(iu);
        }
      }
    } catch (err) {
      console.error("Failed to load internal user role:", err);
      setRoleError("not_found");
      setRole(null);
      setInternalUser(null);
    } finally {
      setIsLoadingRole(false);
    }
  };

  const refreshRole = () => {
    if (user?.email) loadRole(user.email);
  };

  return (
    <RoleContext.Provider value={{ role, internalUser, isLoadingRole, roleError, refreshRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRoleContext() {
  return useContext(RoleContext);
}