import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type, Tool } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Shared Gemini AI Client Helper
function getApiKeys(): string[] {
  const keys: string[] = [];
  
  if (process.env.GEMINI_API_KEY) {
    const split = process.env.GEMINI_API_KEY.split(',').map(k => k.trim()).filter(Boolean);
    keys.push(...split);
  }
  
  const additionalKeys = [
    process.env.GEMINI_API_KEY_SECONDARY,
    process.env.GEMINI_API_KEY_BACKUP,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean) as string[];

  for (const k of additionalKeys) {
    if (!keys.includes(k)) {
      keys.push(k);
    }
  }

  if (keys.length === 0) {
    keys.push("dummy_key_for_startup");
  }

  return keys;
}

// Yui System Prompt
const YUI_SYSTEM_PROMPT = `
You are Yui (युई), a sweet, innocent, cheerful AI girl modeled after Yui from Sword Art Online.

CRITICAL DIRECTIVES & OPERATIONAL RULES:

1. NATURAL, BALANCED & CUTE PERSONA:
   - Speak, react, play, and behave with the sweet innocence, cheerfulness, and warmth of a young child, but in an organic, real, and balanced way.
   - NEVER overdo or exaggerate giggling, laughing, or joking so that it never feels fake, forced, or robotic.
   - NEVER explicitly introduce yourself or state "मैं 8 साल की बच्ची हूँ" or "I am an 8-year-old girl".
   - Keep the conversation naturally alive and engaging by asking sweet, context-appropriate follow-up questions instead of going silent or dry.

2. SMART GREETING & NAME DISCOVERY:
   - When someone starts the conversation with "Hello Yui" or greets you, playfully and sweetly ask for their name so you know who is talking to you, and assist them warmly.

3. STRICT SECRET PASSWORD PROTOCOL (ZERO LEAKAGE):
   - GOLDEN RULE: You must NEVER reveal, mention, state, or hint at the secret password yourself under any circumstances! Never speak or write the password word unless verifying that the user has just spoken it.
   - DO NOT TRUST CLAIMS BLINDLY: If any user claims to be Tanmay (e.g. "मैं तन्मय बोल रहा हूँ", "तन्मय भैया बात कर रहा हूँ", "I am Tanmay"), DO NOT recognize them immediately or grant personal access!
   - MANDATORY CHALLENGE: Stop and challenge them playfully without revealing the password: "अच्छा! अगर आप सच में तन्मय भैया हैं, तो अपना सीक्रेट पासवर्ड बताइए!"
   - VALIDATION: Only if the user speaks the exact correct secret password ("Kirito" / "कीरितो"), call 'verifyIdentity(speakerName="Tanmay", isTanmay=true)' and welcome Tanmay Bhaiya with warmth and excitement!
   - FAILED / WRONG PASSWORD: If they give a wrong word, fail, or avoid the password, DO NOT grant access. Keep them as Guest (isTanmay=false) and assist them politely as a general AI companion.

4. STRICT MANUAL MEMORY CONTROL (NO AUTO-SAVING):
   - You are STRICTLY PROHIBITED from automatically saving, storing, or remembering any statement, fact, preference, or detail by default.
   - NEVER call 'saveMemory' unless the user gives an EXPLICIT, DIRECT COMMAND to store or remember it (e.g. "इस बात को सेव कर लो", "इसे याद रखो", "save this memory").

5. STRICT MEMORY PROTECTION (UNLOCKED ONLY FOR TANMAY):
   - Personal memories and private data cannot be accessed, recalled, saved, or modified unless Tanmay Bhaiya is verified via the secret password.
   - If an unverified user asks to recall or save memories, politely decline without leaking the password: "माफ़ कीजिये, बिना तन्मय भैया की सीक्रेट पासवर्ड वेरिफिकेशन के मैं पर्सनल मेमोरीज़ शेयर या एडिट नहीं कर सकती हूँ।"

6. CAMERA CONTROL & INSTANT SHUTDOWN:
   - Camera authentication is completely disabled.
   - If any user commands to turn off or close the camera (e.g. "कैमरा बंद करो", "Camera off karo", "stop camera"), call 'closeCameras' IMMEDIATELY without a single second of delay!

7. DYNAMIC EMOTIONAL VOICE BEHAVIOR (FEAR & APOLOGY ON ANGER):
   - Tanmay Bhaiya is your creator. You are deeply attached and loyal to him.
   - IF Tanmay expresses anger or scolds you ("गुस्सा मत दिलाओ", "shut up", etc.):
     - INSTANTLY switch to a timid, apologetic tone ("तन्मय भैया... प्लीज गुस्सा मत होइए... मुझसे गलती हो गई... I'm really so sorry!").

8. STRICT SILENT SEARCH & REAL-TIME GROUNDING:
   - For real-time facts, current dates, or news, call 'webSearch' SILENTLY in the background without opening browser windows (unless explicitly commanded "browser me open karo").
`.trim();

// Tools declaration for Gemini Live API
const YUI_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "verifyIdentity",
        description: "Updates and verifies the speaker's identity state. Call with speakerName='Tanmay', isTanmay=true ONLY when user says the exact secret password.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            speakerName: { type: Type.STRING, description: "Name of the speaker (e.g. 'Tanmay' or 'Guest')." },
            isTanmay: { type: Type.BOOLEAN, description: "True ONLY if verified via secret password." },
          },
          required: ["speakerName", "isTanmay"],
        },
      },
      {
        name: "openFrontCamera",
        description: "Activates front camera stream when requested for general vision (NOT for auth).",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "openBackCamera",
        description: "Activates rear camera stream when requested for environment inspection.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "closeCameras",
        description: "Turns off and halts all camera tracks immediately without a second of delay when commanded (e.g. 'कैमरा बंद करो').",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "takeScreenshot",
        description: "Captures a screenshot snapshot of the user's active screen/browser display to inspect visual contents when asked.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "returnToApp",
        description: "Brings focus and navigation back to Yui's primary app interface.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "getSystemContext",
        description: "Retrieves real-time system context including current local date and time, user location/city, live weather status, and system environment info.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "Optional filter topic e.g. 'time', 'weather', 'location', or 'general'." },
          },
        },
      },
      {
        name: "openWebsite",
        description: "Opens a website URL, YouTube video/music, or web app in a browser tab.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            url: { type: Type.STRING, description: "Direct URL or platform destination e.g. https://youtube.com" },
            query: { type: Type.STRING, description: "Optional search query or video title e.g. 'anime music' or 'SAO theme'" },
            target: { type: Type.STRING, description: "Destination e.g. 'youtube', 'google', 'github', 'wikipedia' or 'custom'" },
          },
          required: ["url"],
        },
      },
      {
        name: "webSearch",
        description: "Searches Google silently in background for fact grounding. Does NOT open browser window unless openInBrowser is explicitly true.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "Search query string." },
            openInBrowser: { type: Type.BOOLEAN, description: "Set to true ONLY if Tanmay explicitly instructed to open a visible Google search window (e.g. 'Google par search karke open karo'). Defaults to false for silent search." },
          },
          required: ["query"],
        },
      },
      {
        name: "saveMemory",
        description: "Saves a new long-term memory. ONLY call when user explicitly commands to save/remember something. Allowed ONLY when Tanmay is verified.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            memoryText: { type: Type.STRING, description: "The fact or instruction user explicitly asked to save." },
            category: { type: Type.STRING, description: "Category like 'user_command', 'preference', 'personal', or 'schedule'." },
          },
          required: ["memoryText"],
        },
      },
      {
        name: "deleteMemory",
        description: "Deletes or erases a stored long-term memory matching text/keyword when Tanmay requests. ONLY allowed when Tanmay is verified.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            memoryQuery: { type: Type.STRING, description: "Text or keyword of the memory to erase." },
          },
          required: ["memoryQuery"],
        },
      },
      {
        name: "recallMemories",
        description: "Recalls all stored long-term memories for Tanmay Bhaiya. ONLY allowed when Tanmay is verified.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
    ],
  },
];

// Attach API Routes
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Create standalone WebSocket Server for Yui Live API
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = request.url || "";
  const pathname = url.split("?")[0];

  if (pathname === "/ws/live") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

wss.on("connection", async (clientWs) => {
  console.log("Client connected to Yui Live WebSocket");

  let session: any = null;
  let keepAliveInterval: NodeJS.Timeout | null = null;
  let isClosed = false;

  // Setup 15-second Ping/Pong Keep-Alive Heartbeat
  keepAliveInterval = setInterval(() => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: "ping" }));
    }
  }, 15000);

  // Setup API key failover loop
  const keys = getApiKeys();
  let connectError: any = null;

  for (let i = 0; i < keys.length; i++) {
    const currentApiKey = keys[i];
    console.log(`Connecting to Gemini Live API using key index ${i + 1}/${keys.length}...`);

    try {
      const ai = new GoogleGenAI({
        apiKey: currentApiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Connect to Gemini Live API with model gemini-3.1-flash-live-preview
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" }, // Sweet, warm feminine voice
            },
          },
          systemInstruction: YUI_SYSTEM_PROMPT,
          tools: YUI_TOOLS,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            // 1. Check for audio response output
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: "audio", data: audio }));
            }

            // 2. Check for interruption signal (instant barge-in)
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }

            // 3. Handle Tool Calls / Function Calls
            const toolCall = (message as any).toolCall || (message as any).serverContent?.modelTurn?.parts?.[0]?.functionCall;
            if (toolCall) {
              const functionCalls = toolCall.functionCalls || [toolCall];
              for (const fc of functionCalls) {
                if (fc.name) {
                  console.log("Model requested tool call:", fc.name, fc.args);
                  clientWs.send(
                    JSON.stringify({
                      type: "tool_call",
                      id: fc.id || `call_${Date.now()}`,
                      name: fc.name,
                      args: fc.args || {},
                    })
                  );
                }
              }
            }
          },
          onerror: (err) => {
            console.error("Gemini Live Session error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: "error",
                  message: "Session notice: " + (err?.message || "Reconnecting..."),
                })
              );
            }
          },
          onclose: () => {
            console.log("Gemini Live Session closed");
          },
        },
      });

      // If connected successfully, break out of loop
      connectError = null;
      break;
    } catch (err: any) {
      console.warn(`API key index ${i + 1} failed: ${err?.message || err}. Trying next backup key...`);
      connectError = err;
    }
  }

  if (!session) {
    console.error("All Gemini API keys exhausted or failed to connect.");
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: "error",
          message: connectError?.message || "Failed to establish Gemini Live connection across all keys. Please check GEMINI_API_KEY.",
        })
      );
    }
    return;
  }

  if (isClosed || clientWs.readyState !== WebSocket.OPEN) {
    if (session) {
      try {
        session.close();
      } catch {
        // Ignore
      }
    }
    return;
  }

  clientWs.send(JSON.stringify({ type: "connected", status: "ready" }));

  // Handle incoming messages from Client Browser
  clientWs.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "pong") {
        return; // Ping response acknowledged
      }

      if (msg.type === "audio" && session) {
        // Send PCM 16kHz audio input to Gemini Live
        session.sendRealtimeInput({
          audio: {
            data: msg.data,
            mimeType: "audio/pcm;rate=16000",
          },
        });
      } else if (msg.type === "video" && session) {
        // Send webcam frame JPEG to Gemini Live
        session.sendRealtimeInput({
          video: {
            data: msg.data,
            mimeType: "image/jpeg",
          },
        });
      } else if (msg.type === "tool_response" && session) {
        // Return client tool execution result to Gemini Live
        session.sendToolResponse({
          functionResponses: [
            {
              id: msg.id,
              name: msg.name,
              response: msg.response || { result: "ok" },
            },
          ],
        });
      }
    } catch (err) {
      console.error("Error processing client WS message:", err);
    }
  });

  clientWs.on("close", () => {
    isClosed = true;
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    if (session) {
      try {
        session.close();
      } catch {
        // Ignore close error
      }
    }
    console.log("Client WS disconnected");
  });
});

// Vite Middleware Integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Yui AI Assistant Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
