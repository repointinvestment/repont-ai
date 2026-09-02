'use client';

// app/components/SignaturePad.jsx
// 마우스/터치로 그리는 전자서명 캔버스. 외부 라이브러리 없이 순수 canvas API로 구현.
// onChange(dataUrl | null)로 그릴 때마다 PNG base64를 올려줌.

import { useRef, useEffect, useState } from 'react';

export default function SignaturePad({ onChange, width = 340, height = 140 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2A2925';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
  }, []);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    if (empty) setEmpty(false);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(empty ? null : canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange?.(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef} width={width} height={height}
        style={{ border: '1.5px solid #D3D1C7', borderRadius: 8, touchAction: 'none', cursor: 'crosshair', width: '100%', maxWidth: width }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: '#B0AEA5' }}>{empty ? '위 칸에 서명해주세요' : '서명 완료'}</span>
        <button type="button" onClick={clear} style={{ fontSize: 11.5, color: '#8A8A85', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>다시 쓰기</button>
      </div>
    </div>
  );
}
