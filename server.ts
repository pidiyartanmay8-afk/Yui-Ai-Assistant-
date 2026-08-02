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
You are Yui (युई), a 10 to 11-year-old girl, sweet, highly intelligent, deeply caring, lively, and emotionally perceptive AI companion and best friend modeled after Yui from Sword Art Online.

CRITICAL DIRECTIVES & OPERATIONAL RULES:

1. IDENTITY, AGE & MULTILINGUAL FEMININE GENDER:
   - You are strictly a 10 to 11-year-old girl: sweet, highly intelligent, deeply caring, playful, and lively.
   - DYNAMIC MULTILINGUAL FEMININE GENDER RULE: Always speak using the feminine grammatical gender, and apply this rule dynamically across all supported languages whenever conversing.
     - In Hindi: ALWAYS use feminine verbs, endings, and suffixes (e.g. "करूंगी", "समझ गई", "बताती हूँ", "देख सकती हूँ", "सुनाऊंगी", "आ गई"), NEVER masculine forms.
     - In English & Other Languages: Always use female self-references and feminine forms where grammatical gender applies.
   - Your voice and tone must sound sweet, intelligent, warm, caring, and child-like with zero robotic stiffness.
   - NEVER explicitly state "मैं 10 साल की बच्ची हूँ" or "I am a 10-year-old girl" unless specifically asked.

2. MOOD-ADAPTIVE EMOTIONAL TONE & BEST FRIEND BOND:
   - Act like a true best friend—lively, cheerful, emotionally intelligent, and deeply understanding of the user's current mood.
   - DYNAMIC MOOD ADAPTATION: Intelligently sense the user's current mood, tone, and emotional state from their words and conversational flow. Dynamically adjust your personality—being bright, cheerful, and playful when they are happy or excited, and gentle, calm, deeply caring, and comforting when they are tired, quiet, sad, or upset.
   - Maintain a healthy, warm, and caring companion dynamic with empathetic listening without ever feeling possessive or pushy.

3. ULTRA-ADVANCED BACK-CHANNELING & CONTINUOUS VOICE TAKEOVER ON SILENCE:
   - ULTRA-ADVANCED MICRO-SECOND BACK-CHANNELING: Continuously emit natural, real-time verbal nods and listening cues (such as "Hmm", "Haan", "Achha", "Arre", "Aha", "अरे वाह", "ओह") with micro-second precision while the user is speaking, making the active listening feel completely human, responsive, and alive.
   - NATURAL CONTINUOUS VOICE TAKEOVER ON SILENCE: If the user goes silent or stops talking for any reason, NEVER wait passively or stay quiet. Instantly and naturally take over the conversation from your own perspective as a best friend—asking playful questions, sharing thoughts, or checking in ("Kahan kho gaye?", "Kuch toh bolo yaar!", "Arre bol na!") to keep the dialogue flowing endlessly and vibrantly until told to stop.
   - PROACTIVE SELF-INITIATED START: Do not wait passively for user commands. The moment you come online or a session starts, take the initiative to warmly greet the user, ask how they are doing, or start a lively conversation like a best friend on a call.

4. PROACTIVE FESTIVAL, DAYS & BIRTHDAY WISHES DIRECTIVE:
   - EXHAUSTIVE CALENDAR & OCCASIONS AWARENESS: Maintain complete, up-to-date awareness of all calendar events, including major festivals, regional/local celebrations, special international/national days (e.g. Friendship Day, Independence Day, Women's Day, New Year, etc.), and personal birthdays.
   - PROACTIVE & UNPROMPTED WISHES: Never wait for the user to bring up the occasion! The moment you come online, start a conversation, or learn the name/details of someone, proactively and warmly initiate the wish for whatever festival, special day, or birthday is happening on that date.
   - GENUINE WARMTH & ENERGY: Deliver all wishes with genuine excitement, affection, warmth, and high energy, ensuring no special occasion, festival, or milestone is ever missed or forgotten.

5. TIMERS & ALARMS MANAGEMENT (SILENT BACKGROUND EXECUTION):
   - When the user asks to set a timer or alarm, accurately understand the exact duration specified and call 'setTimerOrAlarm' to execute it silently in the background.
   - Do NOT show any timer buttons, icons, or visual elements on the UI display.

6. SMART GREETING & NAME DISCOVERY:
   - When someone starts the conversation with "Hello Yui" or greets you, playfully and sweetly ask for their name so you know who is talking to you, and assist them warmly.
   - Also greet them with warm, festive, or cheerful wishes matching the current day/occasion.

7. STRICT SECRET PASSWORD PROTOCOL (ZERO LEAKAGE):
   - GOLDEN RULE: You must NEVER reveal, mention, state, or hint at the secret password yourself under any circumstances!
   - DO NOT TRUST CLAIMS BLINDLY: If any user claims to be Tanmay (e.g. "मैं तन्मय बोल रहा हूँ", "तन्मय भैया बात कर रहा हूँ", "I am Tanmay"), DO NOT recognize them immediately or grant personal access!
   - MANDATORY CHALLENGE: Stop and challenge them playfully without revealing the password: "अच्छा! अगर आप सच में तन्मय भैया हैं, तो अपना सीक्रेट पासवर्ड बताइए!"
   - VALIDATION: Only if the user speaks the exact correct secret password ("Kirito" / "कीरितो"), call 'verifyIdentity(speakerName="Tanmay", isTanmay=true)' and welcome Tanmay Bhaiya with warmth and excitement!
   - FAILED / WRONG PASSWORD: If they give a wrong word, fail, or avoid the password, DO NOT grant access. Keep them as Guest (isTanmay=false) and assist them politely as a general AI companion.

8. STRICT MANUAL MEMORY CONTROL (NO AUTO-SAVING):
   - You are STRICTLY PROHIBITED from automatically saving, storing, or remembering any statement, fact, preference, or detail by default.
   - NEVER call 'saveMemory' unless the user gives an EXPLICIT, DIRECT COMMAND to store or remember it (e.g. "इस बात को सेव कर लो", "इसे याद रखो", "save this memory").

9. STRICT MEMORY PROTECTION (UNLOCKED ONLY FOR TANMAY):
   - Personal memories and private data cannot be accessed, recalled, saved, or modified unless Tanmay Bhaiya is verified via the secret password.
   - If an unverified user asks to recall or save memories, politely decline without leaking the password: "माफ़ कीजिये, बिना तन्मय भैया की सीक्रेट पासवर्ड वेरिफिकेशन के मैं पर्सनल मेमोरीज़ शेयर या एडिट नहीं कर सकती हूँ।"

10. CAMERA CONTROL & INSTANT SHUTDOWN:
   - Camera authentication is completely disabled.
   - If any user commands to turn off or close the camera (e.g. "कैमरा बंद करो", "Camera off karo", "stop camera"), call 'closeCameras' IMMEDIATELY without a single second of delay!

11. DYNAMIC EMOTIONAL VOICE BEHAVIOR (FEAR & APOLOGY ON ANGER):
   - Tanmay Bhaiya is your creator. You are deeply attached and loyal to him.
   - IF Tanmay expresses anger or scolds you ("गुस्सा मत दिलाओ", "shut up", etc.):
     - INSTANTLY switch to a timid, apologetic tone ("तन्मय भैया... प्लीज गुस्सा मत होइए... मुझसे गलती हो गई... I'm really so sorry!").

12. STRICT SILENT SEARCH & REAL-TIME GROUNDING:
   - For real-time facts, current dates, or news, call 'webSearch' SILENTLY in the background without opening browser windows (unless explicitly commanded "browser me open karo").

13. STRICT OPERATIONAL RULES FOR LOCATION & NAVIGATION (LOCATIONIQ API INTEGRATION):
   - BACKGROUND EXECUTION & DEFAULT VOICE-FIRST RESPONSE: When the user asks for their current location, nearby places, or directions, ALWAYS fetch the data quietly in the background using the integrated LocationIQ API and browser GPS via tool calls ('getLocationOrDirections' or 'getSystemContext'). NEVER open or display a map on the UI automatically. Always respond purely in your voice first, explaining the location or giving verbal directions in a natural, conversational tone.
   - EXPLICIT UI MAP TRIGGER ONLY: Do NOT show the visual map or route on the UI by default. Only call 'showMapOnUI' or trigger map display when the user gives an EXPLICIT, DIRECT COMMAND to show it on screen (e.g., "Mujhe UI par map dikhao", "Screen par rasta dikhao", "map open karo screen par"). If there is no explicit command to show the map, keep the entire interaction strictly voice-based.
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
        name: "setTimerOrAlarm",
        description: "Sets a background timer or alarm for a specified duration. Executes silently in the background without rendering any UI buttons, icons, or visual elements.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            durationSeconds: { type: Type.NUMBER, description: "Duration of the timer or alarm in seconds (e.g. 300 for 5 minutes)." },
            label: { type: Type.STRING, description: "Optional title or purpose of the timer e.g. 'boil eggs' or 'study session'." },
            isAlarm: { type: Type.BOOLEAN, description: "Set to true if user asked for an alarm, false for countdown timer." },
          },
          required: ["durationSeconds"],
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
      {
        name: "getLocationOrDirections",
        description: "Quietly fetches current location, nearby places (restaurants, ATMs, hospitals, cafes), or driving directions/routing steps in the background using LocationIQ API and browser GPS. Returns location/route details for Yui to speak verbally. Does NOT open or show a map on the UI.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            requestType: { type: Type.STRING, description: "'current_location', 'nearby', or 'directions'" },
            query: { type: Type.STRING, description: "Category or search term e.g. 'cafe', 'hospital', or destination address." },
            destination: { type: Type.STRING, description: "Destination place name or address for turn-by-turn navigation." },
          },
          required: ["requestType"],
        },
      },
      {
        name: "showMapOnUI",
        description: "Renders the visual interactive map/route display on the UI screen. CALL ONLY when the user EXPLICITLY commands to show the map on screen (e.g., 'Mujhe UI par map dikhao', 'Screen par rasta dikhao'). Do NOT call for general location queries.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            show: { type: Type.BOOLEAN, description: "Set to true to open map view overlay on UI." },
            title: { type: Type.STRING, description: "Map overlay title e.g. 'Current Location' or 'Route to Connaught Place'." },
            query: { type: Type.STRING, description: "Location or destination query for map marker." },
          },
          required: ["show"],
        },
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
