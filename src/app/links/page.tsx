'use client';

import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

// House fallback configurations just in case DB is missing
const FALLBACK_CONFIGS: Record<string, { wifiName: string, wifiPass: string, lock: string }> = {
  'HariSanmukh': { wifiName: 'Gunatit', wifiPass: 'Dasnadas@369', lock: '••••' },
  'HariSharan':  { wifiName: 'Swaminarayan', wifiPass: 'Hari@123', lock: '••••' },
  'HariNaman':   { wifiName: 'Yogi', wifiPass: 'Bapa@369', lock: '••••' },
  'HariChintan': { wifiName: 'Pramukh', wifiPass: 'Swami@123', lock: '••••' },
  'SuhradVihar': { wifiName: 'Mahant', wifiPass: 'Swami@369', lock: '••••' },
};

export default function LinksPage() {
  const [houseConfig, setHouseConfig] = useState(FALLBACK_CONFIGS['HariSanmukh']);
  const router = useRouter();

  useEffect(() => {
    const fetchHouse = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: dbUser } = await supabase.from('users').select('household_id').eq('id', session.user.id).maybeSingle();
      
      if (dbUser?.household_id) {
        // Step 1: Check database house_configs table explicitly
        const { data: remoteConfig } = await supabase
          .from('house_configs')
          .select('wifi_name, wifi_pass, house_lock')
          .eq('household_id', dbUser.household_id)
          .maybeSingle();

        if (remoteConfig && remoteConfig.wifi_name && remoteConfig.wifi_pass) {
           setHouseConfig({
             wifiName: remoteConfig.wifi_name,
             wifiPass: remoteConfig.wifi_pass,
             lock: remoteConfig.house_lock || '••••'
           });
        } else {
          // Step 2: Fallback to local dictionary utilizing the house name
          const { data: house } = await supabase.from('households').select('name').eq('id', dbUser.household_id).maybeSingle();
          if (house?.name && FALLBACK_CONFIGS[house.name]) {
            setHouseConfig(FALLBACK_CONFIGS[house.name]);
          }
        }
      }
    };
    fetchHouse();
  }, []);
  return (
    <main
      className="min-h-screen pb-28 app-page"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="glass-nav sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-1)' }}
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>General Info</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">

        <section
          className="rounded-3xl p-5 text-white shadow-sm"
          style={{ background: 'linear-gradient(140deg, var(--accent) 0%, var(--accent-2) 100%)' }}
        >
          <p className="text-xl font-extrabold">General Info</p>
          <p className="text-sm font-medium text-white/85 mt-1">
            Essential house details and quick daily links.
          </p>
        </section>

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
            Aarti &amp; Pooja Thal
          </p>
          <div className="grid grid-cols-1 gap-3">
            <a
              href="https://youtu.be/gOe1zn4Nvrc"
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-2xl px-4 py-4 font-semibold transition-all"
              style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent-text)', border: '0.5px solid var(--border-color)' }}
            >
              Maha Aarti
            </a>
            <a
              href="https://youtu.be/1nSItb3D97Q?si=FTekfmkJrmUGSgSA"
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-2xl px-4 py-4 font-semibold transition-all"
              style={{ backgroundColor: 'var(--yellow-bg)', color: 'var(--yellow)', border: '0.5px solid var(--border-color)' }}
            >
              Pooja Thal
            </a>
          </div>
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
            House Details
          </p>
          <div className="grid grid-cols-1 gap-3">
            <div
              className="w-full rounded-2xl px-4 py-4 transition-all flex flex-col"
              style={{ backgroundColor: 'var(--bg-card-2)', border: '0.5px solid var(--border-color)' }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>Wi-Fi</p>
              <p className="font-extrabold text-[16px]" style={{ color: 'var(--text-1)' }}>{houseConfig.wifiName}</p>
              <p className="text-[14px] font-medium mt-1" style={{ color: 'var(--text-2)' }}>Pass: {houseConfig.wifiPass}</p>
            </div>
            
            <div
              className="w-full rounded-2xl px-4 py-4 transition-all flex flex-col"
              style={{ backgroundColor: 'var(--bg-card-2)', border: '0.5px solid var(--border-color)' }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>House Lock</p>
              <p className="font-extrabold text-[16px]" style={{ color: 'var(--text-1)' }}>Front Door</p>
              <p className="text-[20px] font-mono font-medium mt-1 tracking-widest" style={{ color: 'var(--text-2)' }}>{houseConfig.lock}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

