import { defineConfig, type PluginOption } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// localhost counts as a secure context, so plain `npm run dev` is enough on desktop.
// Phone tilt (DeviceOrientation) needs HTTPS when reaching the dev machine over the LAN:
// run `HTTPS=1 npm run dev` and accept the self-signed certificate warning on the phone.
const plugins: PluginOption[] = process.env.HTTPS ? [basicSsl()] : [];

// Relative base so the build works under https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  plugins,
  server: {
    host: true,
    proxy: {
      // Keeps the game server same-origin so an https page can use wss without a second certificate.
      '/server': {
        target: 'http://localhost:2567',
        ws: true,
        rewrite: (path) => path.replace(/^\/server/, ''),
      },
    },
  },
});
