'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LogOut, Map, Settings, Siren } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Mapa', icon: Map },
  { href: '/analytics', label: 'Analise', icon: BarChart3 },
  { href: '/predictions', label: 'Previsao', icon: Siren },
  { href: '/admin', label: 'Admin', icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <Image src="/mboi-logo.png" alt="MBOI" width={42} height={42} className="rounded" />
            <div>
              <p className="font-semibold text-emerald-800">MBOI</p>
              <p className="text-xs text-slate-500">Gestor/Admin</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const linkClass = [
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
              active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50',
            ].join(' ');
            return (
              <Link key={item.href} href={item.href} className={linkClass}>
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
