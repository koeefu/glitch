import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Make sure this covers your component file
  ],
  theme: {
    extend: {},
  },
  plugins: [
    tailwindcss(),
  ],
}

