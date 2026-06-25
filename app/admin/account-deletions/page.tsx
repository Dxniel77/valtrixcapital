import { redirect } from "next/navigation";

export default function AdminAccountDeletionsRedirect() {
  redirect("/admin/users");
}
