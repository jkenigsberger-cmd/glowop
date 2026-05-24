import { useContext } from "react";
import { RoleContext } from "@/lib/RoleContext";

export function useRole() {
  return useContext(RoleContext);
}