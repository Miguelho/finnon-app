import { TopNav } from "@/components/navigation/top-nav";
import LanguageClient from "./language-client";

export default function LanguagePage() {
  return (
    <>
      <TopNav containerClassName="max-w-2xl" />
      <LanguageClient />
    </>
  );
}
