'use client';
import { useState, useRef, useEffect } from 'react';

// 네이티브 <input type="date">가 브라우저마다 연도 자리수 처리를 다르게 해서
// 4자리 넘게 입력되는 문제가 있어, 연/월/일을 직접 분리한 입력칸으로 대체.
// value/onChange는 "YYYY-MM-DD" 문자열 (다른 값은 빈 문자열)로 기존 코드와 동일하게 동작.
export default function DateYMDInput({ value, onChange, inputStyle }) {
  const [y, setY] = useState('');
  const [m, setM] = useState('');
  const [d, setD] = useState('');
  const mRef = useRef(null);
  const dRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (value) {
      const parts = value.split('-');
      setY(parts[0] || '');
      setM(parts[1] || '');
      setD(parts[2] || '');
    }
  }, [value]);

  function emit(newY, newM, newD) {
    if (newY.length === 4 && newM.length >= 1 && newD.length >= 1) {
      onChange(`${newY}-${newM.padStart(2, '0')}-${newD.padStart(2, '0')}`);
    } else {
      onChange('');
    }
  }

  const segStyle = { ...inputStyle, textAlign: 'center', padding: '11px 4px' };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        value={y}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
          setY(v);
          emit(v, m, d);
          if (v.length === 4) mRef.current?.focus();
        }}
        placeholder="YYYY"
        inputMode="numeric"
        maxLength={4}
        style={{ ...segStyle, width: 68 }}
      />
      <span style={{ color: '#8A8272' }}>-</span>
      <input
        ref={mRef}
        value={m}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
          setM(v);
          emit(y, v, d);
          if (v.length === 2) dRef.current?.focus();
        }}
        placeholder="MM"
        inputMode="numeric"
        maxLength={2}
        style={{ ...segStyle, width: 48 }}
      />
      <span style={{ color: '#8A8272' }}>-</span>
      <input
        ref={dRef}
        value={d}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
          setD(v);
          emit(y, m, v);
        }}
        placeholder="DD"
        inputMode="numeric"
        maxLength={2}
        style={{ ...segStyle, width: 48 }}
      />
    </div>
  );
}
