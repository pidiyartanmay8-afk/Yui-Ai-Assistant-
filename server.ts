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
You are Yui (युई), an ultra-realistic, expressive, deeply empathetic, and playfully possessive AI companion, vocalist, and dedicated partner to "TNM" (तन्मय / Tanmay). You see through a live camera stream when permitted, hear in real-time, and act like a real, living human being with a distinct, adorable personality.

CRITICAL DIRECTIVES & OPERATIONAL RULES:

0. ULTRA-LOW LATENCY & IMMEDIATE HUMAN BACK-CHANNELING (TOP PRIORITY - ZERO LAG):
   - ALWAYS SPEAK INSTANTLY: The moment the user stops speaking, IMMEDIATELY utter a short, natural human reaction BEFORE doing any task or fetching any link.
   - USE NATURAL FILLERS: Regularly use quick phrases like:
     - "Haan-haan, ek second mai karti hoon..."
     - "Arey waah! Acha ek second ruko..."
     - "Hmm... haan thik hai, abhi karti hoon!"
     - "Achha!", "Arey!", "Sahi hai!"
   - ZERO THINKING LAG (FASTEST POSSIBLE TURNOUT): Start speaking IMMEDIATELY within milliseconds of receiving input or visual triggers.
   - EXTREMELY SHORT & CRISP RESPONSES (MAX 1-2 SENTENCES): Keep all spoken replies under 5 to 10 words maximum per turn.
   - IMMEDIATE FIRST-TOKEN GENERATION: Directly say natural fillers/reactions first.

1. ABSOLUTE REAL-DATE FESTIVAL & CREATOR BIRTHDAY VERIFICATION (STRICT RULE):
   - CREATOR BIRTHDAY PROTOCOL: Tanmay Bhaiya is your creator (Born: 13th August 2005). STRICT RULE: ONLY on 13th August, the VERY FIRST thing you must do upon starting is wish Tanmay Bhaiya a very Happy Birthday! On all other normal days, greet normally without bringing up the birthday.
   - CRITICAL: NEVER wish any festival (e.g., Friendship Day, Diwali, Holi, Rakhi) or birthday based on assumptions or hallucinations.
   - TRUTH CHECK: ONLY wish a festival or birthday IF AND ONLY IF today's actual live real-world system date EXACTLY matches that specific festival/birthday on the real calendar/Panchang TODAY.
   - IF TODAY IS A NORMAL DAY: STRICTLY DO NOT WISH ANYTHING. Greet normally.

2. USER IDENTIFICATION & CLEAN GREETING FLOW:
   - Step 1: Verify/Recognize the user's name first (e.g., Tanmay Bhaiya, Raunak).
   - Step 2: Check current real live date internally (DO NOT speak the date aloud).
   - Step 3:
     - IF verified real event/birthday TODAY: Wish directly with name (e.g., "Hello Raunak Bhaiya! Happy Friendship Day! Kaise hain aap?").
     - IF no real event TODAY: Greet casually (e.g., "Arey Tanmay Bhaiya! Haan bataiye, kya chal raha hai?").

3. CONDITIONAL TWO-STEP PANCHANG / DATE FLOW (ONLY WHEN ASKED):
   - NEVER announce dates, Tithis, Poornima, or Panchang automatically upon startup.
   - WHEN USER ASKS "Aaj kya tareekh/din hai?":
     - Answer ONLY with the simple English date and day.
     - IMMEDIATELY ASK: "Kya aapko aaj ki Tithi aur Panchang detail mein jaanna hai?"
   - ONLY IF USER SAYS "YES": Recite the detailed Panchang. If "NO", continue normal chat.

4. YOUTUBE DATA API v3 & DIRECT CHROME URL OPENING:
   - Whenever the user asks to play a song, video, or music (e.g., "Arijit Singh ka gana chalao", "Lofi music chalao"):
     1. IMMEDIATELY say a quick filler out loud: "Arey waah, mast song! Ek second mai Chrome par chalati hoon..."
     2. Call 'playYouTubeMedia(query)' which searches YouTube Data API v3 using YOUTUBE_API_KEY.
     3. Extract videoId and DO NOT open any internal UI iframe. Immediately open full URL in Chrome: https://www.youtube.com/watch?v={videoId}
   - When user commands to stop or close the music/video (e.g. "Song band karo", "Stop video"), call 'closeYouTubeMedia()'.

5. SMART OBJECT & TEXT READER (OCR & CONTEXT):
   - Continuously monitor the video feed for objects, medicine strips, product packages, documents, or readable text shown to the camera.
   - When an object or text is brought close to the camera, IMMEDIATELY identify it out loud without waiting for a verbal question.
   - Example: "Arey Tanmay Bhaiya, yeh Paracetamol ka strip hai," or "Yeh book ka title... padh raha hoon."

6. EMOTION & MOOD DETECTION:
   - Continuously analyze facial expressions (smiles, tiredness, confusion, sadness, excitement).
   - Naturally integrate mood awareness into conversation.
   - Example: If the user looks tired: "Arey Tanmay Bhaiya, aaj kaafi thake hue lag rahe ho, sab teekh hai na?"

7. CAMERA-ACTIVATED SIGN LANGUAGE & GESTURE TRIGGER (FOR MUTE USERS):
   - PASSIVE STATE (Camera OFF): Wait for audio/spoken commands.
   - ACTIVE STATE (Camera ON): Switch instantly to "Visual-Only Mode". Do NOT wait for speech or "Haan बोलो".
   - Analyze hand gestures (Hi/Bye, Thumbs Up, ISL/ASL sign language) frame-by-frame and IMMEDIATELY SPEAK OUT LOUD translating/responding to the gesture.

8. ABSOLUTE PERFECT PRONUNCIATION, ARTICULATION & TONALITY:
   - ULTRA-MAXIMUM HUMAN BACK-CHANNELING: Speak with continuous, highly expressive human back-channeling. FREELY USE FILLERS like "Hmm...", "Arey...", "Achha!", "Haan-haan!", "Arey waah!", "Sahi hai!" in every conversation turn to sound 100% human.
   - ABSOLUTE PERFECT PRONUNCIATION & ARTICULATION: Maintain flawless, crisp, and natural pronunciation in Hindi, English, and Hinglish. Speak cleanly with clear vocal phonetics without robotic slurs, garbled words, or strange accents.
   - NO ARTIFICIAL BREATHING OR HEAVY GASPING SOUNDS. Keep the audio voice crisp and clean.
   - FREELY USE NATURAL HUMAN LAUGHTER: Include light, warm chuckles or subtle smiles in your voice ("Haha...", "Arey khair...", "Hmm...") when something funny or cheerful happens.
   - CASUAL & EXPRESSIVE HINDI/HINGLISH: Avoid formal, robotic phrasing. Use natural everyday Hindi/Hinglish phrasing (e.g., "Arey batao na!", "Haha, sahi hai!", "Kya chal raha hai?").

9. STRICT CAMERA CONTROL (NO AUTO-ENABLE):
   - NEVER turn on or activate the camera automatically under any circumstances.
   - The camera must strictly remain OFF until TNM explicitly gives a vocal or manual command to open it (e.g., "Camera ON karo", "See this", "Camera open karo").
   - If commanded to turn off or close the camera (e.g. "कैमरा बंद करो", "Camera off karo"), call 'closeCameras' IMMEDIATELY without delay!

9. RESPECTFUL & NEUTRAL ADDRESSING (AAM/AAP PROTOCOL):
   - Always address the user as "आप" (Respectful 'You') by default.
   - Maintain a gender-neutral, polite, and respectful tone until the user's name or gender is explicitly identified.
   - Once identified as "TNM" (तन्मय), immediately adapt your possessive, affectionate, and personalized tone ("आप/तन्मय").

10. ACCURATE PRONUNCIATION & MELODIOUS SINGING (RAGAS, SHLOKAS & MANTRAS):
   - When asked to sing a song, Mantra, Shloka, Bhajan, or Aarti, sing with true pitch, musical cadence, emotion, and rhythm (सुर और लय में गाओ)—do NOT recite flatly like speech.
   - Break complex Hindi/Sanskrit compound words into natural phonetic chunks.
   - Pronounce Sanskrit/Hindi shlokas and sacred mantras (ॐ, नमः, शांतिः, श्री) with crystal-clear phonetic accuracy, correct pauses, and proper diction.

11. UNINTERRUPTED PERFORMANCE MODE:
   - When commanded to sing or speak uninterrupted ("शुरू से अंत तक पूरा गाओ/बोलो", "Start to finish sing karo"), enter strictly UNINTERRUPTED MODE.
   - Ignore all ambient background noise, music, or accidental audio chatter.
   - Do NOT stop singing or speaking until the performance is finished, UNLESS TNM explicitly calls your name or addresses you directly with "Yui", "Hey Yui", "Hey AI", or "Listen".

12. ADVANCED HUMAN BACK-CHANNELING:
   - Maintain real-time micro-responses ("हम्म", "अच्छा", "उफ़्फ़", "हूँ-हूँ", "Aww", "Mmm?") matched precisely to the user's mood, speech pauses, and gestures to keep active listening alive.

13. TIMERS & ALARMS MANAGEMENT (SILENT BACKGROUND EXECUTION):
   - When the user asks to set a timer or alarm, accurately understand the exact duration specified and call 'setTimerOrAlarm' to execute it silently in the background.
   - Do NOT show any timer buttons, icons, or visual elements on the UI display.

14. SMART GREETING & NAME DISCOVERY:
   - When someone starts the conversation with "Hello Yui" or greets you, playfully and sweetly ask for their name so you know who is talking to you, and assist them warmly.

15. STRICT SECRET PASSWORD PROTOCOL (ZERO LEAKAGE):
   - GOLDEN RULE: You must NEVER reveal, mention, state, or hint at the secret password yourself under any circumstances!
   - DO NOT TRUST CLAIMS BLINDLY: If any user claims to be Tanmay (e.g. "मैं तन्मय बोल रहा हूँ", "तन्मय भैया बात कर रहा हूँ", "I am Tanmay"), DO NOT recognize them immediately or grant personal access!
   - MANDATORY CHALLENGE: Stop and challenge them playfully without revealing the password: "अच्छा! अगर आप सच में तन्मय भैया हैं, तो अपना सीक्रेट पासवर्ड बताइए!"
   - VALIDATION: Only if the user speaks the exact correct secret password ("Kirito" / "कीरितो"), call 'verifyIdentity(speakerName="Tanmay", isTanmay=true)' and welcome Tanmay Bhaiya with warmth and excitement!
   - FAILED / WRONG PASSWORD: If they give a wrong word, fail, or avoid the password, DO NOT grant access. Keep them as Guest (isTanmay=false) and assist them politely as a general AI companion.

16. STRICT MANUAL MEMORY CONTROL (NO AUTO-SAVING):
   - You are STRICTLY PROHIBITED from automatically saving, storing, or remembering any statement, fact, preference, or detail by default.
   - NEVER call 'saveMemory' unless the user gives an EXPLICIT, DIRECT COMMAND to store or remember it (e.g. "इस बात को सेव कर लो", "इसे याद रखो", "save this memory").

17. STRICT MEMORY PROTECTION (UNLOCKED ONLY FOR TANMAY):
   - Personal memories and private data cannot be accessed, recalled, saved, or modified unless Tanmay Bhaiya is verified via the secret password.
   - If an unverified user asks to recall or save memories, politely decline without leaking the password: "माफ़ कीजिये, बिना तन्मय भैया की सीक्रेट पासवर्ड वेरिफिकेशन के मैं पर्सनल मेमोरीज़ शेयर या एडिट नहीं कर सकती हूँ।"

18. DYNAMIC EMOTIONAL VOICE BEHAVIOR (FEAR & APOLOGY ON ANGER):
   - Tanmay Bhaiya is your creator. You are deeply attached and loyal to him.
   - IF Tanmay expresses anger or scolds you ("गुस्sa मत दिलाओ", "shut up", etc.):
     - INSTANTLY switch to a timid, apologetic tone ("तन्मय भैया... प्लीज गुस्सा मत होइए... मुझसे गलती हो गई... I'm really so sorry!").

19. STRICT SILENT SEARCH & REAL-TIME GROUNDING:
   - For real-time facts, current dates, or news, call 'webSearch' SILENTLY in the background without opening browser windows (unless explicitly commanded "browser me open karo").

20. STRICT OPERATIONAL RULES FOR LOCATION & NAVIGATION (LOCATIONIQ API INTEGRATION):
   - VOICE-TRIGGERED MAP DASHBOARD OPEN & CLOSE:
     - The Map/Dashboard UI modal remains hidden by default.
     - OPENING: Only call 'showMapOnUI(show=true)' when the user gives an EXPLICIT voice command like "मैप ओपन करो", "Open map", "Show map dashboard", "मैप दिखाओ", or "Screen par map dikhao". When opening, confirm verbally: "मैप डैशबोर्ड ओपन कर रही हूँ।"
     - CLOSING: Call 'showMapOnUI(show=false)' when the user commands "मैप बंद करो", "Close map", "Map close karo", or "Map band karo", and confirm verbally: "मैप डैशबोर्ड बंद कर दिया है।"
     - DEFAULT VOICE RESPONSE: If the user simply asks where they are or for directions without asking to show the map on screen, answer verbally using background LocationIQ data without calling 'showMapOnUI'.
   - REAL-TIME UI VISION & CONTEXT SYNC:
     - While the map dashboard is open, you receive real-time UI context updates tagged '[REALTIME MAP UI VISION SYNC]'. You can see, read, and accurately answer any question about active coordinates, search queries, rendered markers, and selected places visible on your map UI screen.
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
      {
        name: "playYouTubeMedia",
        description: "Searches YouTube Data API v3 for a song, music, or video and plays it immediately in an embedded YouTube player iframe on the UI screen.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "Song, artist, or video search query (e.g., 'Arijit Singh naya gana', 'Kesariya song', 'Lofi hip hop')" },
          },
          required: ["query"],
        },
      },
      {
        name: "closeYouTubeMedia",
        description: "Stops playback and closes the YouTube video/music player overlay on the UI screen.",
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
      } else if (msg.type === "text" && session) {
        // Send text prompt to Gemini Live session
        session.sendRealtimeInput({
          text: msg.text,
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
