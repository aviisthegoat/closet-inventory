"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { useRouter } from "next/navigation";

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();

    const startScan = async () => {
      if (!videoRef.current) return;
      setScanning(true);
      try {
        const result = await codeReader.decodeOnceFromVideoDevice(
          undefined,
          videoRef.current,
        );
        const text = result.getText();
        try {
          const url = new URL(text);
          router.push(url.pathname + url.search);
        } catch {
          // Assume it's just the code string
          router.push(`/qr/${encodeURIComponent(text)}`);
        }
      } catch (err: any) {
        setError(err?.message ?? "Unable to read QR code.");
        setScanning(false);
      } finally {
        codeReader.reset();
      }
    };

    startScan();

    return () => {
      codeReader.reset();
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl ring-1 ring-zinc-100">
        <h1 className="text-lg font-semibold text-zinc-900">
          Scan a QR code
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Point your phone at a bin or item label to open it instantly.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-black/90">
          <video
            ref={videoRef}
            className="h-64 w-full object-cover"
            muted
            autoPlay
          />
        </div>
        {scanning && (
          <p className="mt-3 text-[11px] text-zinc-500">
            Hold steady… the scanner will jump automatically when it sees a
            code.
          </p>
        )}
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

