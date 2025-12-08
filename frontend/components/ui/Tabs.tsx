'use client';

import clsx from 'clsx';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export default function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={clsx('', className)}>
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              'flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-white hover:border-gray-300'
            )}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.icon && <span className="text-lg">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
