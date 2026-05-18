import { NextRequest, NextResponse } from "next/server";
import { CascadeAgent } from "@cascadeflow/core";

// Initialize CascadeFlow agent for intelligent chat orchestration
const cascadeAgent = new CascadeAgent({
  models: [
    { name: "llama-3.1-8b-instant", provider: "groq", cost: 0.0001 },
    { name: "llama-3.3-70b-versatile", provider: "groq", cost: 0.0005 }
  ]
});

export async function POST(req: NextRequest) {
  try {
    const { messages, contextData } = await req.json();
    
    console.log("[DEBUG Chat API] Request received with", messages.length, "messages.");
    
    // Telemetry tracking
    const telemetry: string[] = [];
    const logEvent = (msg: string) => telemetry.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    
    logEvent("AI terminal query received");
    logEvent("CascadeFlow runtime initialized locally.");

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "dummy_key_for_build") {
      console.log("[DEBUG Chat API] Groq API Key missing.");
      logEvent("Groq API unavailable — AI responses disabled.");
      return NextResponse.json({
        message: "Groq configuration is missing. CascadeFlow is active locally, but requires a Groq API key to process this intelligence request.",
        telemetry
      });
    }
    
    console.log("[DEBUG Chat API] Env GROQ_API_KEY exists:", !!process.env.GROQ_API_KEY);
    console.log("[DEBUG Chat API] CascadeFlow initialized with Groq models: llama-3.1-8b-instant & llama-3.3-70b-versatile");

    logEvent("AI orchestration active.");
    
    const prompt = `System: You are an elite cybersecurity AI named CipherKavach. 
You are assisting a developer in analyzing vulnerability scans.
Here is the context of the current scan (vulnerabilities, remediation, etc):
${JSON.stringify(contextData).substring(0, 3000)} // Truncated to fit context

Answer the user's latest question clearly, concisely, and accurately based ONLY on the scan data.
Format your responses using Markdown.

Chat History:
${messages.map((m: {role: string, content: string}) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}

Respond to the latest USER message as the ASSISTANT.`;

    logEvent("Contextual security intelligence loaded into context window");
    
    const start = Date.now();
    // Execute via CascadeFlow
    const result = await cascadeAgent.run(prompt, {
      forceDirect: true // Fast response for chat
    });
    const duration = Date.now() - start;
    
    console.log("[DEBUG Chat API] CascadeFlow execution successful.");
    logEvent(`Terminal query processed in ${duration}ms via Groq LLM`);
    logEvent("AI terminal response dispatched back to client");

    return NextResponse.json({
      message: result.content || "No intelligence generated. Please rephrase.",
      telemetry
    });
  } catch (error: unknown) {
    console.error("[DEBUG Chat API] Fatal error:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      message: "AI intelligence temporarily unavailable. CascadeFlow is active, but Groq connection failed."
    }, { status: 500 });
  }
}
