import { StageModal } from "@/components/project/modal/StageModal";

/**
 * Shell of the intercepted Project Stage (see ./[slug]/page.tsx). A layout, not part of the
 * page: next / previous inside the modal only swaps the [slug] segment, so the dialog frame,
 * the scroll lock and the focus trap stay mounted and nothing flickers.
 */
export default function InterceptedProjectLayout({ children }: { children: React.ReactNode }) {
  return <StageModal>{children}</StageModal>;
}
