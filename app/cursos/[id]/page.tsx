import { courses } from "@/data/courses/catalog";
import CourseView from "@/components/CourseView";

export const dynamicParams = false;

export function generateStaticParams() {
  return courses.map((c) => ({ id: c.id }));
}

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseView id={id} />;
}
