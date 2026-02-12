import { registerPlugin } from '@capacitor/core';

export interface NavigationPlugin {
    startNavigation(options: { destination: string }): Promise<{ status: string }>;
}

const Navigation = registerPlugin<NavigationPlugin>('Navigation');

export default Navigation;
