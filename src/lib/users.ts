import type { UserDoc } from "@/models/types";

/** Non-sensitive projection of a user for API responses. */
export function publicUser(doc: UserDoc) {
  return {
    id: doc._id,
    name: doc.name,
    email: doc.email,
    role: doc.role,
    department: doc.department,
  };
}
