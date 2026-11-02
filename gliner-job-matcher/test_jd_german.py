from gliner2 import AutoExtractor
import time

MODEL_ID = "fastino/gliner2.5-multi-v1"

model = AutoExtractor.from_pretrained(MODEL_ID)

job_description = """
Wir suchen einen erfahrenen Senior Backend Entwickler.

Anforderungen:
- Mindestens 5 Jahre Berufserfahrung.
- Sehr gute Kenntnisse in C# und .NET.
- Erfahrung mit ASP.NET Core und REST APIs.
- Englischkenntnisse sind erforderlich.
- Deutschkenntnisse sind von Vorteil, aber keine Voraussetzung.
"""

labels = {
    "programming_language": "Programming languages required or mentioned, such as C#, Java, Python",
    "framework": "Software frameworks and platforms, such as .NET, Blazor, ASP.NET Core",
    "experience": "Required years of professional work experience",
    "required_language": "Human languages explicitly required for the job",
    "optional_language": "Human languages described as optional, preferred, or a plus",
    "seniority": "Job seniority or experience level, such as Senior or Junior",
}

start = time.perf_counter()

result = model.extract_entities(
    job_description,
    labels,
    include_confidence=True,
)

elapsed = time.perf_counter() - start

print("\nExtraction result:")
print(result)
print(f"\nInference time: {elapsed:.3f} seconds")