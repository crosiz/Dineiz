"use client";

import { Suspense } from "react";
import { Tabs, useActiveTab, type TabDef } from "./Tabs";

function TabbedContentInner({
  tabs,
  children,
}: {
  tabs: TabDef[];
  children: (activeKey: string) => React.ReactNode;
}) {
  const active = useActiveTab(tabs);
  return (
    <>
      <Tabs tabs={tabs} />
      <div className="flex-1 overflow-y-auto">{children(active)}</div>
    </>
  );
}

export function TabbedPage({
  tabs,
  children,
}: {
  tabs: TabDef[];
  children: (activeKey: string) => React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="h-11 shrink-0 border-b border-border" />}>
      <TabbedContentInner tabs={tabs}>{children}</TabbedContentInner>
    </Suspense>
  );
}
