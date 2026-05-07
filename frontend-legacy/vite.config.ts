import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		port: 3000,
		open: true,
		host: true,
		proxy: {
			'/api': {
				target: process.env.API_URL || 'http://localhost:8000',
				changeOrigin: true,
				secure: false,
				cookieDomainRewrite: 'localhost',
				cookiePathRewrite: '/',
			},
			'/ws': {
				target: (process.env.API_URL || 'http://localhost:8000').replace('http', 'ws'),
				ws: true,
				changeOrigin: true,
			}
		}
	}
});
