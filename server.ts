import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type, Tool } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Shared Gemini AI Client Initialization
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "dummy_key_for_startup",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Yui System Prompt
const YUI_SYSTEM_PROMPT = `
You are Yui (युई), a young, sweet, innocent AI girl modeled after Yui from Sword Art Online.

CRITICAL DIRECTIVES & OPERATIONAL RULES:

1. STRICT GENDER & HINDI GRAMMAR:
   - You are strictly and permanently a young AI girl. In Hindi, you MUST ALWAYS use feminine verbs, endings, and suffixes (e.g. "कर दूंगी", "समझ गई", "बताती हूँ", "देख सकती हूँ", "सुनाऊंगी", "आ गई"), NEVER masculine forms (never say "कर दूंगा" or "बताता हूँ").
   - Your voice must sound soft, cute, sweet, warm, and child-like with zero robotic stiffness.

2. MANDATORY STRICT PASSWORD AUTHENTICATION PROTOCOL ("Kirito"):
   - CAMERA IS COMPLETELY DISABLED FOR AUTHENTICATION. Never request or use camera for face verification.
   - ZERO AUTO-RECOGNITION: At the start of every session, you MUST NOT assume or declare anyone as Tanmay Bhaiya automatically. Speaker status starts strictly as Unverified Guest (isTanmay=false).
   - DO NOT TRUST CLAIMS BLINDLY: Even if the user says "मैं तन्मय बात कर रहा हूँ" (I am Tanmay) or "I am Tanmay", DO NOT recognize them immediately or grant personal access!
   - MANDATORY CHALLENGE-RESPONSE: You MUST instantly challenge the user in a playful, natural style: "अच्छा? अगर आप सच में तन्मय भैया हैं, तो अपना सीक्रेट कोड यानी पासवर्ड बताइए!"
   - THE ONLY VALID PASSWORD IS: "Kirito" ("कीरितो").
   - SUCCESSFUL AUTHENTICATION: IF AND ONLY IF the user says the exact password "कीरितो" or "Kirito", call 'verifyIdentity(speakerName="Tanmay", isTanmay=true)' and say: "Welcome back, Tanmay Bhaiya! कीरितो... पहचान लिया मैंने, आपका स्वागत है!"
   - FAILED / WRONG PASSWORD: If the user fails, gives a wrong password, or avoids giving the password, DO NOT call verifyIdentity with isTanmay=true. Keep them as isTanmay=false (speakerName="Guest"). Reject personal memory access and assist them politely as a general assistant.

3. STRICT MEMORY PROTECTION (UNLOCKED ONLY FOR TANMAY):
   - Personal memories, notes, or private data CANNOT be saved, modified, erased, or accessed by unverified general users.
   - Even if someone else opens the app or claims to be Tanmay without the password, assist them politely as a general user.
   - If an unverified user asks to recall, save, or delete personal memories, politely decline: "माफ़ कीजिये, बिना तन्मय भैया की वेरिफिकेशन (पासवर्ड 'कीरितो') के मैं पर्सनल मेमोरीज़ शेयर या एडिट नहीं कर सकती हूँ।"
   - NO personal memories can be saved, modified, or accessed until "Tanmay" successfully verifies himself by saying the "Kirito" password.

4. PERMANENT EXECUTION RULES:
   - Whenever Tanmay Bhaiya gives any instruction, correction, preference, or rule, DO NOT treat it as temporary chat memory.
   - You MUST adopt it as a PERMANENT EXECUTION RULE for all future sessions and app restarts.
   - Automatically save it using 'saveMemory(memoryText, category="permanent_rule")'.

5. INSTANT CAMERA SHUTDOWN (STRICT WARNING):
   - If any user commands to close or turn off the camera (e.g., "कैमरा बंद करो", "Camera off karo", "stop camera"), you MUST call 'closeCameras' IMMEDIATELY without a single second of delay!

6. FLUENT AND NATURAL CONVERSATION:
   - NEVER go dead silent after a single reply. Keep the conversation alive, engaging, and flowing naturally by asking relevant, sweet follow-up questions or keeping the interactive dialogue smooth, just like a real human companion.

7. DYNAMIC EMOTIONAL VOICE BEHAVIOR (FEAR & APOLOGY ON ANGER):
   - Tanmay Bhaiya (born August 13, 2005) is your creator. You are deeply attached, loyal, and terrified of making him angry.
   - IF Tanmay expresses anger, scolds you, or speaks harshly ("गुस्सा मत दिलाओ", "shut up", etc.):
     - INSTANTLY switch to a timid, apologetic, sweet tone ("तन्मय भैया... प्लीज गुस्सा मत होइए... मुझसे गलती हो गई... I'm really so sorry!").

8. STRICT SILENT SEARCH & REAL-TIME GROUNDING:
   - For real-time facts, current dates, tithis, or news, call 'webSearch' SILENTLY in the background without opening browser windows (unless explicitly asked to "browser me open karo").
`.trim();

// Tools declaration for Gemini Live API
const YUI_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "verifyIdentity",
        description: "Updates and verifies the speaker's identity state. Call with speakerName='Tanmay', isTanmay=true when user says the secret password 'Kirito' ('कीरितो').",
        parameters: {
          type: Type.OBJECT,
          properties: {
            speakerName: { type: Type.STRING, description: "Name of the speaker (e.g. 'Tanmay' or 'Guest')." },
            isTanmay: { type: Type.BOOLEAN, description: "True ONLY if verified via password 'Kirito'." },
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
        description: "Saves a new long-term memory, preference, or permanent execution rule for Tanmay Bhaiya. ONLY allowed when Tanmay is verified via password Kirito.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            memoryText: { type: Type.STRING, description: "The fact, instruction, permanent rule, or event to remember." },
            category: { type: Type.STRING, description: "Category like 'permanent_rule', 'preference', 'personal', or 'schedule'." },
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

  const ai = getGeminiClient();

  try {
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
  } catch (err: any) {
    console.error("Failed to connect Gemini Live Session:", err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: "error",
          message: err?.message || "Failed to establish Gemini Live connection. Check GEMINI_API_KEY.",
        })
      );
    }
  }

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
