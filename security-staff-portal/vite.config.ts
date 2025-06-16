import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		port: 3000,
		open: true,
		host: true,
	},
	define: {
		// This makes process.env.REACT_APP_* available in the client code
		'process.env.REACT_APP_API_URL': JSON.stringify('http://localhost:8000/api'),
	}
});
