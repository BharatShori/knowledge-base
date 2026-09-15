import { KnowledgeBaseApp } from "@/components/knowledge-base-app";
import { getDashboardData } from "@/lib/data";

export default async function Home() {
  const data = await getDashboardData();
  return <KnowledgeBaseApp data={data} />;
}
