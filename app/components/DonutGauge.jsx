'use client'

// 간단한 SVG 도넛 차트. percent(0~100)만큼 채워진 원형 게이지를 그림.
export default function DonutGauge({ percent, size = 72, stroke = 8, color = '#BA7517', trackColor = '#EFE9DD' }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.24}
        fontWeight="700"
        fill="#3A3630"
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  )
}
