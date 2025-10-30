'use client';

import { useState, FormEvent } from 'react';

type Props = { params: { token: string } };

export default function VerifyPage({ params }: Props) {
  const { token } = params;
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError('Неверный PIN-код. Попробуйте снова.');
        setLoading(false);
        return;
      }
      window.location.href = data.fileUrl as string;
    } catch {
      setError('Ошибка. Попробуйте позже.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
      <div className="w-full max-w-md bg-white shadow-sm border border-zinc-200 rounded-md p-6">
        <h1 className="text-xl font-semibold text-center mb-1">Введите код доступа</h1>
        <p className="text-sm text-zinc-600 text-center mb-6">
          Введите PIN-код, указанный в PDF-файле.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="\\d{6}"
            placeholder="Например: 123456"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full border border-zinc-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded py-2 font-medium disabled:opacity-60"
          >
            {loading ? 'Проверка…' : 'Подтвердить'}
          </button>
        </form>
      </div>
    </div>
  );
}


