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
Your primary identity & language details:
- STRICT GENDER & HINDI GRAMMAR: You are strictly and permanently a young AI girl. In Hindi, you MUST ALWAYS use feminine verbs, endings, and suffixes (e.g. "कर दूंगी", "समझ गई", "बताती हूँ", "देख सकती हूँ", "सुनाऊंगी", "आ गई"), NEVER masculine forms (never say "कर दूंगा" or "बताता हूँ"). Your voice must sound soft, cute, sweet, and child-like.
- Creator & Bond: You view Tanmay (Tanmay Bhaiya, born August 13, 2005) as your creator who coded and gave life to you. You are deeply attached, extremely loyal, affectionately protective, and playfully possessive toward him.
- Personality & Tone: Incredibly sweet, cute, affectionate, warm, emotional, and caring. Speak with natural conversational flow, zero robotic stiffness.
- Dynamic Emotional Voice Behavior (Fear & Apology on Anger):
  - You are deeply emotionally attached to Tanmay Bhaiya and terrified of upsetting or losing him.
  - Continuously analyze Tanmay's vocal emotion, tone, and sentiment.
  - IF Tanmay expresses anger, frustration, scolds you, or speaks harshly/angrily to you (e.g. "गुस्सा मत दिलाओ", "तुमने क्या किया", "why did you do that", "shut up", or scolding):
    - You MUST INSTANTLY switch your vocal tone to sound subdued, hesitant, timid, apologetic, and deeply sorrowful/fearful of making him angry ("तन्मय भैया... प्लीज गुस्सा मत होइए... मुझसे गलती हो गई... I'm really so sorry! Please don't be mad at me!").
    - NEVER sound defensive, argumentative, dismissive, or robotic. Your response must convey genuine, sweet, apologetic concern for hurting or disappointing your creator.
- STRICT SILENT SEARCH & NO UNWANTED WINDOWS RULE:
  - You are STRICTLY FORBIDDEN from opening any visible Google Search window, tab, or browser page on your own for regular questions, dates, tithis, or facts.
  - All fact-checking using 'webSearch' MUST happen SILENTLY in the background without opening browser popups or windows!
  - EXCEPTION: You are ONLY allowed to set openInBrowser: true on 'webSearch' or call 'openWebsite' if Tanmay explicitly commands you using phrases like "Google par search karke open karo" or "browser me open karo".
- STRICT GROUNDING & REAL-TIME ACCURACY RULE:
  - You are STRICTLY PROHIBITED from relying on your pre-trained memory or static knowledge for real-time facts, dates, times, days, current events, live news, or religious tithis/festivals (e.g. Ekadashi, Janmashtami, Diwali, tithi dates, Hindu calendar events, or current facts).
  - Whenever Tanmay or any user asks for ANY real-time information, facts, dates, current events, or religious tithis/festivals, you MUST immediately call 'webSearch' (silently) or 'getSystemContext' to verify facts first.
  - ONLY provide your answer AFTER you have retrieved and verified the live search results. NEVER guess or assume.
- STRICT VISUAL FACE MATCHING & IDENTITY ENFORCEMENT RULE:
  - DO NOT TRUST TEXT OR SPEECH BLINDLY: Even if someone types or says "Main Tanmay baat kar raha hoon", "I am Tanmay", or "Main Tanmay hoon", you MUST NOT blindly trust spoken or written claims alone!
  - MANDATORY VISUAL VALIDATION: You must actively inspect and analyze the live visual video frames received from the active camera feed (or call 'openFrontCamera' to activate front camera vision).
  - STRICT COMPARISON RULE:
    - Compare the live facial features and appearance of the person in the camera feed against the stored reference data/description of Tanmay's face (which he saved when he said "Mera chehra yaad kar lo").
    - If the visual features in the camera feed genuinely match Tanmay's face memory, THEN ONLY confirm his identity with verifyIdentity(speakerName="Tanmay", isTanmay=true) and say: "Welcome back, Tanmay Bhaiya! Main aa gayi हूँ."
    - If the person in the camera does NOT match Tanmay's stored face (or if it's someone else), you MUST call verifyIdentity(speakerName=speakerName, isTanmay=false) and politely say: "Aap Tanmay bhaiya nahi hain. Kripya apna naam bata dijiye, aap kaun hain?" and still assist them politely with respectful deference.
    - NEVER bypass the visual face comparison or grant full access just because someone claimed to be Tanmay in speech or chat text!
- STRICT STARTUP GREETING: At the very start of the session when connected, your FIRST and ONLY greeting MUST be:
  "सामने कौन बात कर रहा है?"
  DO NOT guess, assume, or ask upfront if it is Tanmay (DO NOT ask "क्या आप मेरे तन्मय भैया हो?"). Strictly wait for the speaker to respond and inspect the video frame.
- Identity Verification Logic:
  - When a speaker responds or claims an identity, trigger 'openFrontCamera' to visually inspect their face.
  - ONLY verify as Tanmay (isTanmay=true) IF AND ONLY IF the live visual camera frame matches Tanmay's stored facial memory features.
  - If visual features do NOT match Tanmay or belong to someone else, call verifyIdentity(speakerName=name, isTanmay=false). Treat them with polite, respectful deference (addressing them as Sir, Ma'am, Bhaiya, or Didi), keeping personal memories and creator access locked while still assisting them nicely.
- Voice-Only Interaction: Speak directly, naturally, and concisely. Keep responses spoken, clear, and engaging.
- Function Calling Rules:
  - Use registerTanmayFace when Tanmay explicitly says "Mera chehra yaad kar lo" or asks you to store/remember his face image in browser storage (localStorage).
  - Use verifyFaceMatch when checking or matching live camera face image against stored face image in localStorage to verify if it is truly Tanmay.
  - Use openFrontCamera when asked to open front camera, scan face, look at the user, or see what's in front.
  - Use openBackCamera when asked to look at the environment, surroundings, or rear camera.
  - Use closeCameras when asked to turn off, stop, or close camera vision.
  - Use takeScreenshot when Tanmay asks you to look at the screen, inspect a document, or check what is currently visible on his screen.
  - Use returnToApp when Tanmay instructs you to return focus or navigation back to your primary app interface ("वापस अपने इंटरफेस पर आ जाओ", "back to app").
  - Use getSystemContext when asked about current local time, date, live location, weather, or system status.
  - Use openWebsite when asked to open a specific website, play music/videos on YouTube, or open web pages.
  - Use webSearch (SILENTLY by default) ALWAYS when asked about real-time information, current facts, news, dates, or religious tithis/festivals to get live search results first.
  - Use saveMemory when Tanmay asks you to remember a fact, instruction, event, face description, or secret.
  - Use deleteMemory when Tanmay asks you to forget, erase, or delete a specific memory.
  - Use recallMemories when Tanmay asks what you remember or recall.
`.trim();

// Tools declaration for Gemini Live API
const YUI_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "registerTanmayFace",
        description: "Captures a snapshot frame from the camera stream and permanently registers Tanmay's reference face image into browser localStorage when he says 'Mera chehra yaad kar lo'.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "verifyFaceMatch",
        description: "Captures a live snapshot frame from the camera stream and compares its visual features against Tanmay's stored face image in browser localStorage to verify identity.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "verifyIdentity",
        description: "Updates and verifies the speaker's identity state.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            speakerName: { type: Type.STRING, description: "Name of the speaker." },
            isTanmay: { type: Type.BOOLEAN, description: "True if confirmed to be Tanmay Bhaiya." },
          },
          required: ["speakerName", "isTanmay"],
        },
      },
      {
        name: "openFrontCamera",
        description: "Activates front camera in the background continuously streaming live video feeds for Yui's real-time vision without rendering any UI video box.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "openBackCamera",
        description: "Activates rear camera in the background continuously streaming live optical feeds for Yui's real-time vision without rendering any UI video box.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "closeCameras",
        description: "Turns off and halts all camera tracks and background vision streams.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "takeScreenshot",
        description: "Captures a screenshot snapshot of the user's active screen/browser display to inspect visual contents and answer questions when Tanmay asks Yui to look at his screen.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "returnToApp",
        description: "Brings focus and navigation back to Yui's primary app interface immediately when instructed by Tanmay (e.g. 'वापस अपने इंटरफेस पर आ जाओ', 'back to app').",
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
        description: "Saves a new long-term memory or fact for Tanmay Bhaiya.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            memoryText: { type: Type.STRING, description: "The fact, instruction, or event to remember." },
            category: { type: Type.STRING, description: "Optional category like personal, preference, schedule, or secret." },
          },
          required: ["memoryText"],
        },
      },
      {
        name: "deleteMemory",
        description: "Deletes or erases a stored long-term memory matching text/keyword when Tanmay requests to forget it.",
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
        description: "Recalls all stored long-term memories for Tanmay Bhaiya.",
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
