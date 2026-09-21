export const CURRENT_USER = {
  name: "Bilal Raza",
  initials: "BR",
  role: "BRANCH_MANAGER" as const,
  roleLabel: "Branch Manager",
  avatarBg: "#B7C6EF",
  avatarFg: "#1B2C63",
};

export type Branch = {
  name: string;
  code: string;
  initials: string;
  avatarBg: string;
  avatarFg: string;
  active: boolean;
};

export const BRANCHES: Branch[] = [
  { name: "Clifton", code: "SS-KHI-001", initials: "CK", avatarBg: "#F2C88C", avatarFg: "#6B4A16", active: true },
  { name: "Gulshan", code: "SS-KHI-002", initials: "GD", avatarBg: "#A9D3BB", avatarFg: "#0F3D22", active: false },
  { name: "DHA", code: "SS-KHI-003", initials: "DH", avatarBg: "#B7C6EF", avatarFg: "#1B2C63", active: false },
];

export const CURRENT_BRANCH = BRANCHES[0];

export const TENANT_NAME = "Kababjees";
