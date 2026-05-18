import { NextRequest, NextResponse } from "next/server";
import { CascadeAgent } from "@cascadeflow/core";

// Initialize CascadeFlow agent for intelligent orchestration
const cascadeAgent = new CascadeAgent({
  models: [
    { name: "llama-3.1-8b-instant", provider: "groq", cost: 0.0001 },
    { name: "llama-3.3-70b-versatile", provider: "groq", cost: 0.0005 }
  ]
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const repoMetadataStr = formData.get("repoMetadata") as string | null;
    const repoMetadata = repoMetadataStr ? JSON.parse(repoMetadataStr) : null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileContent = await file.text();
    let packageJson;
    try {
      packageJson = JSON.parse(fileContent);
    } catch {
      return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
    }

    const telemetry: string[] = [];
    const logEvent = (msg: string) => telemetry.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    
    logEvent("CascadeFlow runtime initialized locally.");
    logEvent("Dependency parsing completed");

    // Parse dependencies
    const dependencies = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    const depEntries = Object.entries(dependencies);
    const extractedCount = depEntries.length;

    if (extractedCount === 0) {
      return NextResponse.json({
        extracted_count: 0,
        vulnerabilities: [],
      });
    }

    // Call OSV.dev for vulnerabilities
    logEvent("Vulnerability scan executed against OSV.dev");
    const vulnerabilities: Array<Record<string, unknown>> = [];
    const seenVulnIds = new Set<string>();

    // For hackathon/MVP, we'll limit the number of checks to avoid rate limits or long processing times
    const maxDepsToCheck = 20; 
    const depsToCheck = depEntries.slice(0, maxDepsToCheck);

    await Promise.all(depsToCheck.map(async ([name, versionStr]) => {
      // Clean up version string (e.g., "^1.2.3" -> "1.2.3")
      // Extract the first pure version number using a regex
      let version = versionStr as string;
      const match = version.match(/\d+\.\d+\.\d+/);
      if (match) {
        version = match[0];
      } else {
        version = version.replace(/[\^~><=\s]/g, "").split("||")[0].trim();
      }

      const requestBody = {
        package: {
          name,
          ecosystem: "npm",
        },
        version,
      };

      try {
        const osvRes = await fetch("https://api.osv.dev/v1/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (osvRes.ok) {
          const osvData = await osvRes.json();
          
          if (osvData.vulns && osvData.vulns.length > 0) {
            for (const vuln of osvData.vulns) {
              // Prevent duplicate vulnerabilities
              if (seenVulnIds.has(vuln.id)) continue;
              seenVulnIds.add(vuln.id);

              // Extract aliases (CVEs)
              const aliases = vuln.aliases && vuln.aliases.length > 0 ? vuln.aliases.join(", ") : "No CVE ID";
              
              // Extract severity
              let severity = "HIGH";
              if (vuln.database_specific && vuln.database_specific.severity) {
                severity = vuln.database_specific.severity;
              }

              vulnerabilities.push({
                id: vuln.id,
                aliases: aliases,
                package: name,
                severity: severity,
                description: vuln.summary || vuln.details || "Security vulnerability detected",
              });
            }
          }
        } else {
          console.error(`OSV Error for ${name}: ${osvRes.status} ${osvRes.statusText}`);
        }
      } catch (err) {
        console.error(`Error checking package ${name}:`, err);
      }
    }));

    let overall_ai_summary = null;
    let remediation_script = null;
    let exploit_simulation = null;
    let patch_priority = null;
    let impact_analysis = null;
    let progression_timeline = null;
    let trust_score = null;
    
    if (vulnerabilities.length > 0 && process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "dummy_key_for_build") {
      try {
        console.log("[DEBUG Scan API] Env GROQ_API_KEY exists:", !!process.env.GROQ_API_KEY);
        console.log("[DEBUG Scan API] CascadeFlow initialized with Groq models: llama-3.1-8b-instant & llama-3.3-70b-versatile");
        logEvent("AI orchestration active.");
        const severityScores = vulnerabilities.map(v => v.severity === "CRITICAL" ? 4 : v.severity === "HIGH" ? 3 : 1);
        const hasCritical = severityScores.includes(4);
        
        logEvent(`AI routing initialized. Complexity: ${hasCritical ? 'HIGH' : 'LOW'}`);
        if (hasCritical) {
          logEvent("Escalated to higher quality model (Groq 70B)");
        } else {
          logEvent("AI analysis routed to efficient model (Groq 8B)");
        }

        const prompt = `Act as an expert AI cybersecurity analyst. The following vulnerabilities were detected during a dependency scan:\n\n${vulnerabilities.map(v => `- [${v.severity}] ${v.package}: ${v.description}`).join("\n")}\n\nYou must return a JSON object with the following keys:\n1. "executive_summary": A sharp, concise, analyst-style security briefing (max 3 sentences). Focus strictly on threat intelligence, risk impact, and strategic priority. Use markdown to **bold** critical terms. Do NOT use filler text like "The scan revealed" or "In summary".\n2. "remediation_script": An exact terminal command (e.g., npm install package@latest) to patch the affected packages.\n3. "exploit_simulation": A small (3-5 lines) mock JavaScript code snippet demonstrating how the most severe vulnerability found might be exploited in theory. If not applicable, return null.\n4. "patch_priority": { "highest_priority_package": "string", "most_dangerous_exploit": "string", "fastest_remediation_path": "string" }\n5. "impact_analysis": "string" (Concise 1-2 sentence executive-friendly impact summary if ignored)\n6. "progression_timeline": array of 4 to 5 short strings showing attack progression (e.g. ["Initial Exploit", "Privilege Escalation", "System Compromise"])\n7. "trust_score": { "status": "Trusted" | "Moderate Risk" | "High Exposure" | "Abandoned", "reasoning": "string" }\nONLY RETURN RAW JSON, no markdown formatting blocks.`;
        
        // Execute via CascadeFlow Agent
        const start = Date.now();
        const completion = await cascadeAgent.run(prompt, {
           forceDirect: !hasCritical,
        });
        const duration = Date.now() - start;
        
        logEvent(`AI task completed in ${duration}ms. Cost/Tokens tracked via CascadeFlow SDK.`);
        logEvent("Remediation generated");

        // The agent.run returns a result object where result.content contains the response
        const contentStr = completion.content || "{}";
        let parsedContent = contentStr.trim();
        
        // Extract JSON from markdown code blocks if present
        const jsonMatch = parsedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
           parsedContent = jsonMatch[1];
        }
        
        const aiResponse = JSON.parse(parsedContent);
        overall_ai_summary = aiResponse.executive_summary || null;
        remediation_script = aiResponse.remediation_script || null;
        exploit_simulation = aiResponse.exploit_simulation || null;
        patch_priority = aiResponse.patch_priority || null;
        impact_analysis = aiResponse.impact_analysis || null;
        progression_timeline = aiResponse.progression_timeline || null;
        trust_score = aiResponse.trust_score || null;
      } catch (err) {
        logEvent("AI Orchestration Error: " + (err instanceof Error ? err.message : String(err)));
        console.error("Groq AI summary error:", err);
      }
    } else if (vulnerabilities.length > 0) {
      logEvent("Groq API unavailable — AI responses disabled.");
    }

    logEvent("PDF report payload prepared");

    return NextResponse.json({
      extracted_count: extractedCount,
      vulnerabilities,
      overall_ai_summary,
      remediation_script,
      exploit_simulation,
      patch_priority,
      impact_analysis,
      progression_timeline,
      trust_score,
      telemetry,
      repoMetadata
    });
  } catch (error: unknown) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { error: "Internal server error during scan" },
      { status: 500 }
    );
  }
}
