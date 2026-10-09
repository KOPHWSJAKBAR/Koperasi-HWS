import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export const LogoHws: React.FC<LogoProps> = ({ className = 'w-10 h-10', size }) => {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer Circle Background */}
      <circle cx="100" cy="100" r="98" fill="#FEE024" stroke="#000000" strokeWidth="2" />

      {/* House Chimney (Green) */}
      <rect x="42" y="58" width="18" height="30" fill="#2E9E44" />

      {/* House Roof (Red Triangle Chevron) */}
      <path
        d="M30 96 L100 28 L170 96 L154 96 L100 44 L46 96 Z"
        fill="#D62828"
      />

      {/* Golden Rice Stalks (Padi Wreath) */}
      <g stroke="#C69214" fill="#E8B923" strokeWidth="1">
        {/* Left side grains */}
        <ellipse cx="68" cy="80" rx="4" ry="7" transform="rotate(-30 68 80)" />
        <ellipse cx="60" cy="95" rx="4" ry="7" transform="rotate(-15 60 95)" />
        <ellipse cx="58" cy="112" rx="4" ry="7" transform="rotate(10 58 112)" />
        <ellipse cx="64" cy="128" rx="4" ry="7" transform="rotate(35 64 128)" />
        <ellipse cx="78" cy="140" rx="4" ry="7" transform="rotate(55 78 140)" />

        {/* Right side grains */}
        <ellipse cx="132" cy="80" rx="4" ry="7" transform="rotate(30 132 80)" />
        <ellipse cx="140" cy="95" rx="4" ry="7" transform="rotate(15 140 95)" />
        <ellipse cx="142" cy="112" rx="4" ry="7" transform="rotate(-10 142 112)" />
        <ellipse cx="136" cy="128" rx="4" ry="7" transform="rotate(-35 136 128)" />
        <ellipse cx="122" cy="140" rx="4" ry="7" transform="rotate(-55 122 140)" />

        {/* Inner grains */}
        <ellipse cx="76" cy="90" rx="3.5" ry="6" transform="rotate(-20 76 90)" />
        <ellipse cx="72" cy="105" rx="3.5" ry="6" transform="rotate(5 72 105)" />
        <ellipse cx="76" cy="120" rx="3.5" ry="6" transform="rotate(25 76 120)" />
        <ellipse cx="124" cy="90" rx="3.5" ry="6" transform="rotate(20 124 90)" />
        <ellipse cx="128" cy="105" rx="3.5" ry="6" transform="rotate(-5 128 105)" />
        <ellipse cx="124" cy="120" rx="3.5" ry="6" transform="rotate(-25 124 120)" />
      </g>

      {/* Blue Hexagonal Crest */}
      <polygon
        points="100,54 124,68 124,106 100,120 76,106 76,68"
        fill="#007ACC"
        stroke="#004C87"
        strokeWidth="2"
      />

      {/* Stylized "HWS" Typography inside Hexagon */}
      {/* 3D Cyan Highlights */}
      <g fill="#FFFFFF" opacity="0.95">
        {/* Letter H */}
        <path d="M82 72 H86 V83 H92 V72 H96 V102 H92 V88 H86 V102 H82 Z" fill="#00E5FF" />
        <path d="M83 73 H85 V84 H93 V73 H95 V101 H93 V87 H85 V101 H83 Z" fill="#FFFFFF" />
        {/* Letter W */}
        <path d="M96 72 H100 L103 92 L106 72 H109 L112 92 L115 72 H119 L114 102 H110 L107.5 86 L105 102 H101 Z" fill="#00E5FF" />
        <path d="M97 73 H99.5 L102.5 91 L105.5 73 H108 L111 91 L114 73 H117.5 L113.5 101 H110.5 L107 87 L103.5 101 H100.5 Z" fill="#FFFFFF" />
        {/* Letter S */}
        <path d="M120 77 C118 73 114 72 110 74 L111 78 C113 76 116 77 117 79 C118 81 116 83 113 85 C109 87 107 90 108 94 C109 98 114 102 118 100 L117 96 C114 97 111 96 111 94 C111 92 113 90 116 88 C120 86 122 82 120 77 Z" fill="#00E5FF" />
      </g>

      {/* Two Caring Open Hands (Green) */}
      {/* Left Hand */}
      <path
        d="M52 100 C50 115 54 135 70 148 C85 160 100 162 100 162 C100 162 82 155 72 142 C64 130 62 118 64 105 C65 101 62 99 59 100 C56 101 53 98 52 100 Z"
        fill="#2E9E44"
      />
      <path
        d="M59 116 C63 125 72 135 84 142 C74 135 68 126 66 117 Z"
        fill="#3AC357"
      />

      {/* Right Hand */}
      <path
        d="M148 100 C150 115 146 135 130 148 C115 160 100 162 100 162 C100 162 118 155 128 142 C136 130 138 118 136 105 C135 101 138 99 141 100 C144 101 147 98 148 100 Z"
        fill="#2E9E44"
      />
      <path
        d="M141 116 C137 125 128 135 116 142 C126 135 132 126 134 117 Z"
        fill="#3AC357"
      />

      {/* Circular Text: HIMPUNAN WIRAUSAHA SEJAHTERA */}
      <defs>
        <path
          id="textArcPath"
          d="M 32,126 A 78,78 0 0,0 168,126"
          fill="none"
        />
      </defs>
      <text
        fill="#C61A1A"
        fontSize="11.5"
        fontWeight="800"
        letterSpacing="2.2"
        fontFamily="'Plus Jakarta Sans', Arial, sans-serif"
      >
        <textPath href="#textArcPath" startOffset="50%" textAnchor="middle">
          HIMPUNAN WIRAUSAHA SEJAHTERA
        </textPath>
      </text>
    </svg>
  );
};

export const WatermarkHws: React.FC<{ opacity?: number }> = ({ opacity = 0.08 }) => {
  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none"
      style={{ opacity }}
    >
      <LogoHws className="w-[380px] h-[380px] filter grayscale-[30%]" />
    </div>
  );
};
