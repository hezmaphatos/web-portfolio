"use client";

import { useParams } from "next/navigation";

import { ProjectEditor } from "@/components/admin/projects/ProjectEditor";

/** `/admin/projects/{id}`; the panel layout's Suspense boundary covers the request-time param. */
export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const id = /^\d+$/.test(params.id ?? "") ? Number(params.id) : Number.NaN;
  return <ProjectEditor id={id} />;
}
