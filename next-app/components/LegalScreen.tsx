'use client';

/** 약관 · 개인정보처리방침 화면 — 내용은 lib/legalContent.ts(초안). */
import { useState } from 'react';
import { TERMS_SECTIONS, PRIVACY_SECTIONS, LEGAL_DRAFT_NOTICE } from '../lib/legalContent';

export default function LegalScreen() {
  const [tab, setTab] = useState<'terms' | 'privacy'>('terms');
  const sections = tab === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <div className="study-screen">
      <div className="study-card">
        <div className="legal-tabs">
          <button className={`legal-tab${tab === 'terms' ? ' active' : ''}`} onClick={() => setTab('terms')}>
            이용약관
          </button>
          <button className={`legal-tab${tab === 'privacy' ? ' active' : ''}`} onClick={() => setTab('privacy')}>
            개인정보처리방침
          </button>
        </div>

        <div className="legal-notice">⚠️ {LEGAL_DRAFT_NOTICE}</div>

        {sections.map((s) => (
          <div className="legal-sec" key={s.title}>
            <div className="legal-sec-title">{s.title}</div>
            <div className="legal-sec-body">{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
