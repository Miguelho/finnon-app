import type { ReactElement, ReactNode } from "react";
import { TopNav } from "@/components/navigation/top-nav";
import styles from "./settings-layout.module.css";

type AccountSettingsLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function AccountSettingsLayout({
  children,
  params: _params,
}: AccountSettingsLayoutProps): Promise<ReactElement> {
  await _params;

  return (
    <div className={styles.page}>
      <TopNav />
      <div className={styles.wrapper}>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
