'use client';

import Link from 'next/link';
import { ConnectButton } from '@mysten/dapp-kit';

export default function Header() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(13,13,13,0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      height: '68px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
        <div style={{
          width: '34px', height: '34px',
          background: '#0D0D0D',
          borderRadius: '9px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(200,255,0,0.35)',
          border: '1px solid rgba(200,255,0,0.25)',
        }}>
          <svg width="22" height="22" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path d="M512 232 L720 776 L612 776 L512 514 L412 776 L304 776 Z" fill="#C8FF00"/>
            <circle cx="512" cy="196" r="44" fill="#C8FF00"/>
          </svg>
        </div>
        <span style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.5px' }}>APEX</span>
      </Link>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {[
          { label: 'Vault', href: '/vault' },
          { label: 'Strategy', href: '/strategy' },
          { label: 'Risk', href: '/risk' },
          { label: 'Surface', href: '/surface' },
          { label: 'Markets', href: '/markets' },
          { label: 'Portfolio', href: '/portfolio' },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{
            padding: '8px 11px', borderRadius: '8px',
            fontSize: '13px', fontWeight: 600, color: 'var(--muted2)',
          }}>{item.label}</Link>
        ))}
      </nav>

      {/* Wallet */}
      <div className="apex-connect">
        <ConnectButton />
      </div>
    </header>
  );
}