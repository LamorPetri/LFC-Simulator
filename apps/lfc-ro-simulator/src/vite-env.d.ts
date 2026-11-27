/// <reference types="vite/client" />

import { HailerApi } from '@hailer/app-sdk';

declare global {
    interface Window {
        hailerApiInstance: HailerApi;
    }
    /** Vite define: public/manifest.json:n version ja appId (vite.config.ts). */
    const __APP_VERSION__: string;
    const __APP_ID__: string;
}