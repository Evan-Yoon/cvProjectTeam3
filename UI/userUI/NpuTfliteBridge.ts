import { registerPlugin } from '@capacitor/core';

export interface NpuTflitePlugin {
    loadModel(options: { modelPath: string }): Promise<{ status: string, delegate: string }>;
    detect(options: { image: string }): Promise<{ data: number[], shape: number[] }>;
}

const NpuTflite = registerPlugin<NpuTflitePlugin>('NpuTflite');

export default NpuTflite;
