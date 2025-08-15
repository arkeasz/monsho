'use client';
import React, { useEffect, useRef, useState } from 'react';
import { hashFileSHA256, extFromFilename } from '@/utils/files';
import styles from '@styles/images_upload.module.css'


type Props = {
  name?: string;
  onUploaded: (key: string | null) => void;
  uploadFolder?: string;
  maxSizeBytes?: number;
};

export default function ImagesUpload({
  name,
  onUploaded,
  uploadFolder = 'images',
  maxSizeBytes = 10 * 1024 * 1024, 
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle'|'hashing'|'requesting'|'uploading'|'done'|'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      onUploaded(null);
      setStatus('idle');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, onUploaded]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  async function handleUpload(selected: File) {
    try {
      setError(null);

      if (selected.size > maxSizeBytes) {
        throw new Error(`Archivo demasiado grande. Máx ${Math.round(maxSizeBytes/1024/1024)} MB.`);
      }

      setStatus('hashing');
      const hash = await hashFileSHA256(selected);
      const ext = extFromFilename(selected.name) || 'jpg';
      const key = `${uploadFolder}/${hash}-${Date.now()}.${ext}`;

      setStatus('requesting');
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, contentType: selected.type }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error('No se pudo obtener signedUrl: ' + txt);
      }
      const { signedUrl } = await res.json();
      if (!signedUrl) throw new Error('signedUrl no recibido');

      setStatus('uploading');
      const controller = new AbortController();
      abortRef.current = controller;

      const put = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selected.type },
        body: selected,
        signal: controller.signal,
      });

      abortRef.current = null;

      if (!put.ok) {
        const t = await put.text().catch(() => put.statusText);
        throw new Error(`PUT failed: ${put.status} ${t}`);
      }

      setStatus('done');
      setError(null);
      onUploaded(key);
    } catch (err: any) {
      console.error('Upload error', err);
      if (err?.name === 'AbortError') {
        setError('Subida cancelada');
      } else {
        setError(err?.message ?? 'Error desconocido');
      }
      setStatus('error');
      onUploaded(null);
    }
  }

  return (
    <fieldset className={styles.images}>
      <legend>IMAGEN</legend>
      <label className={styles.upload}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className={styles.input}
          disabled={status === 'requesting' || status === 'uploading' || status === 'hashing'}
          onChange={e => {
            const f = e.target.files?.[0] ?? null;
            if (!f) return;
            setFile(f);
            handleUpload(f);
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
      </label>

      {preview && (
        <div className={styles.preview}>
          <img src={preview} alt="preview" style={{ width: 120, height: 'auto' }} />
          <div>{file?.name}</div>
        </div>
      )}

      <div className={styles.status}>
        {status === 'hashing' && <small>Calculando hash…</small>}
        {status === 'requesting' && <small>Obteniendo URL firmada…</small>}
        {status === 'uploading' && <small>Subiendo imagen…</small>}
        {status === 'done' && <small style={{ color: 'green' }}>Subida completa ✅</small>}
        {status === 'error' && <small style={{ color: 'red' }}>Error: {error}</small>}
      </div>

      {/* Opcional: botón para reintentar cuando haya error */}
      {status === 'error' && file && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => {
              // reintentar la misma file
              handleUpload(file);
            }}
          >
            Reintentar
          </button>
          <button
            onClick={() => {
              // cancelar/limpiar
              if (abortRef.current) abortRef.current.abort();
              setFile(null);
              setStatus('idle');
              setError(null);
              onUploaded(null);
            }}
            style={{ marginLeft: 8 }}
          >
            Cancelar
          </button>
        </div>
      )}
    </fieldset>
  );
}
