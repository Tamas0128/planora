import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api", () => ({
  api: { me: vi.fn(), notifications: vi.fn().mockResolvedValue([]), search: vi.fn().mockResolvedValue([]) },
  clearToken: vi.fn(),
  ROLE_LABELS: {
    admin: "Admin",
    project_manager: "Projektmenedzser",
    management: "Menedzsment",
    procurement: "Beszerzés",
    billing: "Számlázás",
  },
}));

import AppLayout from "./AppLayout";
import { api } from "@/lib/api";

describe("AppLayout role-based navigation", () => {
  beforeEach(() => {
    vi.mocked(api.me).mockReset();
  });

  it("shows admin-only nav items for an admin user", async () => {
    vi.mocked(api.me).mockResolvedValue({
      id: 1,
      username: "admin",
      email: "a@example.com",
      full_name: "Admin",
      role: "admin",
      is_active: true,
      has_avatar: false,
    });

    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>
    );

    await waitFor(() => expect(screen.getByText("Felhasználók")).toBeInTheDocument());
    expect(screen.getByText("Audit napló")).toBeInTheDocument();
  });

  it("hides admin-only nav items for a project manager", async () => {
    vi.mocked(api.me).mockResolvedValue({
      id: 2,
      username: "pm",
      email: "pm@example.com",
      full_name: "PM",
      role: "project_manager",
      is_active: true,
      has_avatar: false,
    });

    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>
    );

    await waitFor(() => expect(screen.getByText("Saját feladatok")).toBeInTheDocument());
    expect(screen.queryByText("Felhasználók")).not.toBeInTheDocument();
    expect(screen.queryByText("Audit napló")).not.toBeInTheDocument();
  });
});
