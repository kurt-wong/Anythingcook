/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Apple设计系统颜色
      colors: {
        // 品牌和强调色
        primary: {
          DEFAULT: '#0066cc', // Action Blue
          focus: '#0071e3', // Focus Blue
          'on-dark': '#2997ff', // Sky Link Blue
        },
        
        // 表面色
        canvas: {
          DEFAULT: '#ffffff', // Pure White
          parchment: '#f5f5f7', // Parchment
        },
        surface: {
          pearl: '#fafafc', // Pearl Button
          'tile-1': '#272729', // Near-Black Tile 1
          'tile-2': '#2a2a2c', // Near-Black Tile 2
          'tile-3': '#252527', // Near-Black Tile 3
          black: '#000000', // Pure Black
          'chip-translucent': 'rgba(210, 210, 215, 0.64)', // Translucent Chip Gray
        },
        
        // 文本色
        ink: {
          DEFAULT: '#1d1d1f', // Near-Black Ink
          'muted-80': '#333333', // Ink Muted 80
          'muted-48': '#7a7a7a', // Ink Muted 48
        },
        body: {
          DEFAULT: '#1d1d1f', // Body
          'on-dark': '#ffffff', // Body On Dark
          muted: '#cccccc', // Body Muted
        },
        
        // 边框和分割线
        divider: {
          soft: '#f0f0f0', // Divider Soft
        },
        hairline: '#e0e0e0', // Hairline
      },
      
      // Apple设计系统字体
      fontFamily: {
        display: ['SF Pro Display', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        body: ['SF Pro Text', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      
      // Apple设计系统字体大小和行高
      fontSize: {
        'hero-display': ['56px', { lineHeight: '1.07', letterSpacing: '-0.28px', fontWeight: '600' }],
        'display-lg': ['40px', { lineHeight: '1.10', letterSpacing: '0px', fontWeight: '600' }],
        'display-md': ['34px', { lineHeight: '1.47', letterSpacing: '-0.374px', fontWeight: '600' }],
        'lead': ['28px', { lineHeight: '1.14', letterSpacing: '0.196px', fontWeight: '400' }],
        'lead-airy': ['24px', { lineHeight: '1.5', letterSpacing: '0px', fontWeight: '300' }],
        'tagline': ['21px', { lineHeight: '1.19', letterSpacing: '0.231px', fontWeight: '600' }],
        'body-strong': ['17px', { lineHeight: '1.24', letterSpacing: '-0.374px', fontWeight: '600' }],
        'body': ['17px', { lineHeight: '1.47', letterSpacing: '-0.374px', fontWeight: '400' }],
        'dense-link': ['17px', { lineHeight: '2.41', letterSpacing: '0px', fontWeight: '400' }],
        'caption': ['14px', { lineHeight: '1.43', letterSpacing: '-0.224px', fontWeight: '400' }],
        'caption-strong': ['14px', { lineHeight: '1.29', letterSpacing: '-0.224px', fontWeight: '600' }],
        'button-large': ['18px', { lineHeight: '1.0', letterSpacing: '0px', fontWeight: '300' }],
        'button-utility': ['14px', { lineHeight: '1.29', letterSpacing: '-0.224px', fontWeight: '400' }],
        'fine-print': ['12px', { lineHeight: '1.0', letterSpacing: '-0.12px', fontWeight: '400' }],
        'micro-legal': ['10px', { lineHeight: '1.3', letterSpacing: '-0.08px', fontWeight: '400' }],
        'nav-link': ['12px', { lineHeight: '1.0', letterSpacing: '-0.12px', fontWeight: '400' }],
      },
      
      // Apple设计系统间距
      spacing: {
        'xxs': '4px',
        'xs': '8px',
        'sm': '12px',
        'md': '17px',
        'lg': '24px',
        'xl': '32px',
        'xxl': '48px',
        'section': '80px',
      },
      
      // Apple设计系统圆角
      borderRadius: {
        'none': '0px',
        'xs': '5px',
        'sm': '8px',
        'md': '11px',
        'lg': '18px',
        'pill': '9999px',
        'full': '9999px',
      },
      
      // Apple设计系统阴影（仅用于产品图片）
      boxShadow: {
        'product': 'rgba(0, 0, 0, 0.22) 3px 5px 30px 0',
        'soft': 'rgba(0, 0, 0, 0.08) 0px 1px 1px 0',
      },
      
      // 响应式断点
      screens: {
        'xs': '420px',
        'sm': '640px',
        'md': '736px',
        'lg': '834px',
        'xl': '1024px',
        '2xl': '1068px',
        '3xl': '1440px',
      },
    },
  },
  plugins: [],
}