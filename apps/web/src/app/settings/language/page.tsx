import { TopNav } from "@/components/navigation/top-nav";
import { PageContainer } from "@/components/layout/page-container";
import LanguageClient from "./language-client";

export default function LanguagePage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <PageContainer>
        <LanguageClient />
      </PageContainer>
    </div>
  );
}
