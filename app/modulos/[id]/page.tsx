import { Suspense } from "react";
import { courses } from "@/data/courses/catalog";
import ModuleView from "@/components/ModuleView";

export const dynamicParams = false;

export function generateStaticParams() {
  return courses.map((c) => ({ id: c.id }));
}

export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><ModuleView id={id} /></Suspense>;
}
