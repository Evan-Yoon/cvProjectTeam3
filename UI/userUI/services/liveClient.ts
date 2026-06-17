import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audio';

// Tool definitions for controlling the app state
const proposeDestinationTool: FunctionDeclaration = {
  name: 'proposeDestination',
  description: 'Propose a destination that the user wants to go to. Call this when the user mentions a place.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      destination: {
        type: Type.STRING,
        description: 'The name of the destination place.',
      },
    },
    required: ['destination'],
  },
};

const startNavigationTool: FunctionDeclaration = {
  name: 'startNavigation',
  description: 'Start the navigation guidance. Call this when the user confirms the destination.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const stopNavigationTool: FunctionDeclaration = {
  name: 'stopNavigation',
  description: 'Stop the current navigation. Call this when the user asks to stop or end the guide.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const askAgainTool: FunctionDeclaration = {
  name: 'askAgain',
  description: 'Call this if the user input was unclear or if they asked to repeat.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export class LiveClient {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputNode: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private sourceStream: MediaStream | null = null;
  private nextStartTime = 0;
  private sessionPromise: Promise<any> | null = null;
  private onToolCall: (name: string, args: any) => Promise<any>;
  private onVolumeChange: (vol: number) => void;
  private isConnected = false;

  constructor(
    apiKey: string, 
    onToolCall: (name: string, args: any) => Promise<any>,
    onVolumeChange: (vol: number) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onToolCall = onToolCall;
    this.onVolumeChange = onVolumeChange;
  }

  async connect() {
    if (this.isConnected) return;
    
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.outputNode = this.outputAudioContext!.createGain();
    this.outputNode.connect(this.outputAudioContext!.destination);

    this.sourceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Setup input processing
    const source = this.inputAudioContext.createMediaStreamSource(this.sourceStream);
    this.inputNode = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    this.inputNode.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer
      let sum = 0;
      for(let i=0; i<inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.onVolumeChange(rms);

      const pcmBlob = createPcmBlob(inputData);
      
      if (this.sessionPromise) {
        this.sessionPromise.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      }
    };

    source.connect(this.inputNode);
    this.inputNode.connect(this.inputAudioContext.destination);

    const config = {
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          console.log('Session opened');
          this.isConnected = true;
        },
        onmessage: this.handleMessage.bind(this),
        onclose: () => {
          console.log('Session closed');
          this.isConnected = false;
        },
        onerror: (err: any) => {
          console.error('Session error', err);
          this.isConnected = false;
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: `You are WalkMate, a helpful, encouraging navigation assistant for visually impaired users in Korea. 
        Your tone should be warm, clear, and concise.
        1. When the session starts, ask the user "Where do you want to go?" (어디로 가고 싶으신가요?) in Korean.
        2. If the user states a destination, call the function 'proposeDestination'.
        3. If the user confirms 'yes', call 'startNavigation'. 
        4. If the user says 'no', ask them to say the destination again.
        5. If the user is unclear, call 'askAgain'.
        6. During navigation, if the user says 'stop' or 'end', call 'stopNavigation'.
        Always speak in Korean.`,
        tools: [{ 
            functionDeclarations: [
                proposeDestinationTool, 
                startNavigationTool, 
                stopNavigationTool,
                askAgainTool
            ] 
        }],
      }
    };

    this.sessionPromise = this.ai.live.connect(config);
    await this.sessionPromise;
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Audio
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext && this.outputNode) {
        const audioData = base64ToUint8Array(base64Audio);
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        try {
            const audioBuffer = await decodeAudioData(
                audioData, 
                this.outputAudioContext, 
                24000, 
                1
            );
            
            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputNode);
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
        } catch (e) {
            console.error("Error decoding audio", e);
        }
    }

    // Handle Tool Calls
    if (message.toolCall) {
        for (const fc of message.toolCall.functionCalls) {
            console.log("Tool call received:", fc.name, fc.args);
            const result = await this.onToolCall(fc.name, fc.args);
            
            // Send response back
            this.sessionPromise?.then(session => {
                session.sendToolResponse({
                    functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: { result: result || "OK" }
                    }
                });
            });
        }
    }
  }

  async disconnect() {
    this.isConnected = false;
    // Cleanup audio nodes
    if (this.inputNode) this.inputNode.disconnect();
    if (this.sourceStream) {
        this.sourceStream.getTracks().forEach(t => t.stop());
    }
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
    
    // We cannot explicitly close the live session via method in current SDK version cleanly?
    // Actually typically just stopping the stream and dereferencing works, or if SDK provided close()
    // The snippet shows `onclose` callback but not `close()` method usage on session object explicitly in all examples, 
    // but typically `session.close()` or similar exists. We'll rely on reloading or dereferencing for this demo 
    // if a method isn't strictly available, but we'll try to just let it timeout or assume single session per page load.
  }
}