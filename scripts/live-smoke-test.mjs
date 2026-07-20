const relayUrl = "http://127.0.0.1:8787/analyze";

const syntheticPayload = {
  userCriteria:
    "I am a backend developer experienced with C#, .NET, SQL, and Azure. I prefer hybrid or remote work. I speak English and do not speak Japanese. Japanese must not be mandatory.",
  preferredLanguage: "English",
  job: {
    title: "Backend Software Engineer",
    company: "Fictional Systems",
    location: "Tokyo or remote within Europe",
    description: `Fictional Systems is hiring a mid-level backend engineer.

You will build APIs with C# and .NET, work with Azure services, and improve SQL data pipelines. Three or more years of backend experience is required. React is used by another team and is helpful but not required.

The role can be performed remotely within Europe. The working language is English. Japanese is welcome but not required.`,
  },
};

const response = await fetch(relayUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(syntheticPayload),
});
const body = await response.json();

if (!response.ok) {
  throw new Error(body.error || `Smoke test failed (${response.status}).`);
}

const { analysis } = body;
console.log(`${analysis.score}/100 — ${analysis.recommendation.toUpperCase()}`);
console.log(analysis.summary);
console.log(`Model: ${analysis.provider.model}`);
console.log(`Response: ${analysis.provider.responseId}`);
